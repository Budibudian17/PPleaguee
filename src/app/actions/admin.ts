import { getDB } from '@/lib/firebase'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  setDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'

function getDBInstance() {
  return getDB()
}

const ADMIN_PIN = process.env.ADMIN_PIN || '2626'

export async function verifyAdminPin(pin: string): Promise<boolean> {
  return pin === ADMIN_PIN
}

// Import FC26 players from CSV
export async function importFC26Players() {
  try {
    // Fetch CSV file from public directory
    const csvUrl = '/file/FC26_20250921.csv'
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}${csvUrl}`)
    const csvText = await response.text()

    // Parse CSV with proper handling of quoted fields
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const lines = csvText.split('\n').filter(line => line.trim())
    const headers = parseCSVLine(lines[0])
    const players: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length !== headers.length) continue

      const player: any = {}
      headers.forEach((header, index) => {
        player[header.trim()] = values[index]?.replace(/^"|"$/g, '') || ''
      })

      if (player.club_name && player.long_name) {
        players.push(player)
      }
    }

    // Get all registered users to match team names
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Common team name mappings (CSV name -> registered name)
    const teamNameMappings: { [key: string]: string } = {
      'arsenal': 'Arsenal FC',
      'bayern munich': 'Bayern München',
      'bayern': 'Bayern München',
      'paris saint-germain': 'PSG',
      'psg': 'PSG',
      'paris': 'PSG',
      'manchester united': 'Manchester United',
      'man utd': 'Manchester United',
      'real madrid': 'Real Madrid',
      'napoli': 'Napoli',
      'fc barcelona': 'FC Barcelona',
      'barcelona': 'FC Barcelona',
      'chelsea': 'Chelsea FC',
      'liverpool': 'Liverpool FC',
      'manchester city': 'Manchester City',
      'man city': 'Manchester City',
      'juventus': 'Juventus FC',
      'inter': 'Inter Milan',
      'inter milan': 'Inter Milan',
      'ac milan': 'AC Milan',
      'milan': 'AC Milan',
      'tottenham': 'Tottenham Hotspur',
      'spurs': 'Tottenham Hotspur',
      'dortmund': 'Borussia Dortmund',
      'borussia dortmund': 'Borussia Dortmund',
      'atletico madrid': 'Atletico Madrid',
      'atletico': 'Atletico Madrid'
    }

    // Create a map of team names to user IDs (case-insensitive)
    const teamNameMap = new Map<string, string>()
    users.forEach((user: any) => {
      teamNameMap.set(user.team_name.toLowerCase(), user.id)
    })

    // Filter players whose clubs match registered teams
    const matchedPlayers = players.filter(player => {
      const clubName = player.club_name?.toLowerCase()
      if (!clubName) return false

      // Direct match
      if (teamNameMap.has(clubName)) return true

      // Check mappings
      const mappedName = teamNameMappings[clubName]
      if (mappedName && teamNameMap.has(mappedName.toLowerCase())) return true

      // Try partial match (remove "FC", etc.)
      const normalizedClub = clubName.replace(/\s+(fc|cf)$/i, '').trim()
      if (teamNameMap.has(normalizedClub)) return true

      return false
    })

    // Use batch write for efficiency
    const maxBatchSize = 500
    let batch = writeBatch(getDBInstance())
    let batchCount = 0

    // Clear existing game_players for registered teams
    for (const user of users) {
      const existingPlayersQuery = query(
        collection(getDBInstance(), 'game_players'),
        where('team_name', '==', (user as any).team_name)
      )
      const existingSnapshot = await getDocs(existingPlayersQuery)
      for (const doc of existingSnapshot.docs) {
        batch.delete(doc.ref)
        batchCount++
        if (batchCount >= maxBatchSize) {
          await batch.commit()
          batch = writeBatch(getDBInstance())
          batchCount = 0
        }
      }
    }

    // Add new players
    for (const player of matchedPlayers) {
      const clubName = player.club_name?.toLowerCase()
      let userId = teamNameMap.get(clubName)

      // Try mappings if direct match fails
      if (!userId) {
        const mappedName = teamNameMappings[clubName]
        if (mappedName) {
          userId = teamNameMap.get(mappedName.toLowerCase())
        }
      }

      // Try partial match if still no match
      if (!userId) {
        const normalizedClub = clubName.replace(/\s+(fc|cf)$/i, '').trim()
        userId = teamNameMap.get(normalizedClub)
      }

      const user = users.find((u: any) => u.id === userId) as any
      const playerRef = doc(collection(getDBInstance(), 'game_players'))

      batch.set(playerRef, {
        player_id: player.player_id,
        player_name: player.short_name || player.long_name, // For backward compatibility
        short_name: player.short_name,
        long_name: player.long_name,
        player_positions: player.player_positions,
        overall: parseInt(player.overall) || 0,
        potential: parseInt(player.potential) || 0,
        club_name: player.club_name,
        club_position: player.club_position,
        club_jersey_number: parseInt(player.club_jersey_number) || 0,
        age: parseInt(player.age) || 0,
        height_cm: parseInt(player.height_cm) || 0,
        weight_kg: parseInt(player.weight_kg) || 0,
        preferred_foot: player.preferred_foot,
        user_id: userId,
        team_name: user?.team_name || player.club_name, // Use user's team_name for proper matching
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      })

      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit()
    }

    return {
      success: true,
      message: `Imported ${matchedPlayers.length} players for ${teamNameMap.size} teams`
    }
  } catch (error) {
    console.error('Error importing FC26 players:', error)
    return { success: false, error: 'Failed to import players' }
  }
}

// Get players for a specific team
export async function getTeamPlayers(teamName: string) {
  try {
    const playersQuery = query(
      collection(getDBInstance(), 'game_players'),
      where('team_name', '==', teamName)
    )
    const snapshot = await getDocs(playersQuery)
    const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    console.log(`getTeamPlayers for ${teamName}:`, players.length, 'players found')
    console.log('Players:', players)

    return players
  } catch (error) {
    console.error('Error fetching team players:', error)
    return []
  }
}

// Add a single player manually
export async function addManualPlayer(pin: string, playerData: {
  user_id: string
  team_name: string
  player_name: string
  short_name?: string
  long_name?: string
  club_jersey_number?: number
  club_position?: string
  overall?: number
  potential?: number
  age?: number
}) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    const playerRef = doc(collection(getDBInstance(), 'game_players'))
    await setDoc(playerRef, {
      player_id: `manual_${Date.now()}`,
      player_name: playerData.player_name,
      short_name: playerData.short_name || playerData.player_name,
      long_name: playerData.long_name || playerData.player_name,
      player_positions: playerData.club_position || '',
      overall: playerData.overall || 0,
      potential: playerData.potential || 0,
      club_name: playerData.team_name,
      club_position: playerData.club_position || '',
      club_jersey_number: playerData.club_jersey_number || 0,
      age: playerData.age || 0,
      height_cm: 0,
      weight_kg: 0,
      preferred_foot: '',
      user_id: playerData.user_id,
      team_name: playerData.team_name,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    })

    return { success: true, message: 'Pemain berhasil ditambahkan' }
  } catch (error) {
    console.error('Error adding manual player:', error)
    return { success: false, error: 'Gagal menambahkan pemain' }
  }
}

// Delete all game players
export async function deleteAllGamePlayers() {
  try {
    const playersSnapshot = await getDocs(collection(getDBInstance(), 'game_players'))

    if (playersSnapshot.empty) {
      return { success: false, error: 'Tidak ada pemain untuk dihapus' }
    }

    let batch = writeBatch(getDBInstance())
    let batchCount = 0
    const maxBatchSize = 500

    for (const doc of playersSnapshot.docs) {
      batch.delete(doc.ref)
      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    return {
      success: true,
      message: `Berhasil menghapus ${playersSnapshot.size} pemain`
    }
  } catch (error) {
    console.error('Error deleting all game players:', error)
    return { success: false, error: 'Gagal menghapus pemain' }
  }
}

// Reset tournament - delete all matches and reset league config to registration
export async function resetTournament(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Delete all matches
    const matchesSnapshot = await getDocs(collection(getDBInstance(), 'matches'))
    let batch = writeBatch(getDBInstance())
    let batchCount = 0
    const maxBatchSize = 500

    for (const doc of matchesSnapshot.docs) {
      batch.delete(doc.ref)
      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    // Delete all stats
    const statsSnapshot = await getDocs(collection(getDBInstance(), 'stats'))
    batch = writeBatch(getDBInstance())
    batchCount = 0

    for (const doc of statsSnapshot.docs) {
      batch.delete(doc.ref)
      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    // Reset league config to registration
    const configRef = doc(getDBInstance(), 'league_config', 'config')
    await setDoc(configRef, {
      id: 'config',
      status: 'registration',
      tournament_mode: null,
      top_4_qualification: false,
      qualified_teams: [],
      tournament_started: false,
      home_away: false,
      updated_at: serverTimestamp()
    }, { merge: true })

    return {
      success: true,
      message: `Berhasil mereset turnamen. ${matchesSnapshot.size} pertandingan dan ${statsSnapshot.size} statistik dihapus.`
    }
  } catch (error) {
    console.error('Error resetting tournament:', error)
    return { success: false, error: 'Gagal mereset turnamen' }
  }
}

// Swap teams between groups and regenerate World Cup schedule
export async function swapTeamsAndRegenerate(pin: string, groupAUserIds: string[], groupBUserIds: string[]) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get current league config
    const config = await getLeagueConfig()
    if (!config || config.tournament_mode !== 'worldcup') {
      return { success: false, error: 'Hanya bisa swap grup di mode World Cup' }
    }

    // Get all users
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Reorder users based on new group assignments
    const groupAUsers = groupAUserIds.map(id => allUsers.find((u: any) => u.id === id)).filter((u: any) => u !== undefined)
    const groupBUsers = groupBUserIds.map(id => allUsers.find((u: any) => u.id === id)).filter((u: any) => u !== undefined)
    const reorderedUsers = [...groupAUsers, ...groupBUsers]

    if (reorderedUsers.length !== allUsers.length) {
      return { success: false, error: 'Invalid team selection' }
    }

    // Delete all existing matches (group stage and knockout)
    const matchesSnapshot = await getDocs(collection(getDBInstance(), 'matches'))
    let batch = writeBatch(getDBInstance())
    let batchCount = 0
    const maxBatchSize = 500

    for (const doc of matchesSnapshot.docs) {
      batch.delete(doc.ref)
      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    // Delete all stats
    const statsSnapshot = await getDocs(collection(getDBInstance(), 'stats'))
    batch = writeBatch(getDBInstance())
    batchCount = 0

    for (const doc of statsSnapshot.docs) {
      batch.delete(doc.ref)
      batchCount++
      if (batchCount >= maxBatchSize) {
        await batch.commit()
        batch = writeBatch(getDBInstance())
        batchCount = 0
      }
    }

    if (batchCount > 0) {
      await batch.commit()
    }

    // Regenerate World Cup schedule with new group assignments
    const result = generateWorldCupSchedule(reorderedUsers as any[], config.home_away || false)

    // Insert new matches
    const matchesRef = collection(getDBInstance(), 'matches')
    for (const match of result.matches) {
      await addDoc(matchesRef, {
        ...match,
        updated_at: serverTimestamp()
      })
    }

    return {
      success: true,
      message: `Berhasil menukar grup dan meregenerate jadwal. ${result.matches.length} pertandingan dibuat.`
    }
  } catch (error) {
    console.error('Error swapping teams:', error)
    return { success: false, error: 'Gagal menukar grup' }
  }
}

// User Registration
export async function registerUser(name: string, teamData: {
  team_name: string
  team_id: number
  team_logo: string
  team_short_name: string
  league_id: number
  league_name: string
}) {
  try {
    // Check if team name already exists
    const usersQuery = query(
      collection(getDBInstance(), 'users'),
      where('team_name', '==', teamData.team_name)
    )
    const usersSnapshot = await getDocs(usersQuery)
    
    if (!usersSnapshot.empty) {
      return { success: false, error: 'Team name already registered' }
    }

    // Register new user with team details from API
    const usersRef = collection(getDBInstance(), 'users')
    await addDoc(usersRef, {
      name,
      team_name: teamData.team_name,
      team_id: teamData.team_id,
      team_logo: teamData.team_logo,
      team_short_name: teamData.team_short_name,
      league_id: teamData.league_id,
      league_name: teamData.league_name,
      created_at: serverTimestamp()
    })

    return { success: true }
  } catch (error) {

    return { success: false, error: 'Registration failed' }
  }
}

// Game Player Management
export async function addGamePlayer(userId: string, teamName: string, playerName: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    const gamePlayersRef = collection(getDBInstance(), 'game_players')
    await addDoc(gamePlayersRef, {
      user_id: userId,
      team_name: teamName,
      player_name: playerName,
      created_at: serverTimestamp()
    })



    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to add game player' }
  }
}

export async function deleteGamePlayer(playerId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(getDBInstance(), 'game_players', playerId))


    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete game player' }
  }
}

// Schedule Generation
export async function lockRegistrationAndGenerateSchedule(pin: string, mode: 'liga' | 'knockout' | 'worldcup', homeAway: boolean = false, qualificationSystem: 'top3' | 'top4' = 'top3') {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get all users
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    if (users.length < 2) {
      return { success: false, error: 'Need at least 2 teams to generate schedule' }
    }

    // Delete all existing matches
    const allMatchesQuery = query(collection(getDBInstance(), 'matches'))
    const allMatchesSnapshot = await getDocs(allMatchesQuery)

    for (const doc of allMatchesSnapshot.docs) {
      await deleteDoc(doc.ref)
    }

    // Delete all existing stats
    const statsRef = collection(getDBInstance(), 'stats')
    const allStatsSnapshot = await getDocs(statsRef)

    for (const statDoc of allStatsSnapshot.docs) {
      await deleteDoc(statDoc.ref)
    }

    let matches: any[] = []
    let status: string = 'league_ongoing'
    let qualifiedTeams: string[] = []

    // Generate schedule based on mode
    if (mode === 'liga') {
      matches = generateRoundRobinSchedule(users as any[], homeAway)
      status = 'league_ongoing'
    } else if (mode === 'knockout') {
      const result = generateKnockoutSchedule(users as any[], homeAway)
      matches = result.matches
      status = result.status
      qualifiedTeams = result.qualifiedTeams
    } else if (mode === 'worldcup') {
      const result = generateWorldCupSchedule(users as any[], homeAway, qualificationSystem)
      matches = result.matches
      status = result.status
      qualifiedTeams = result.qualifiedTeams
    }

    // Insert matches into database
    const matchesRef = collection(getDBInstance(), 'matches')
    for (const match of matches) {
      await addDoc(matchesRef, {
        ...match,
        updated_at: serverTimestamp()
      })
    }

    // Update league config
    const configRef = doc(getDBInstance(), 'league_config', 'config')
    await setDoc(configRef, {
      id: 'config',
      status: status,
      tournament_mode: mode,
      top_4_qualification: mode === 'liga',
      qualification_system: mode === 'worldcup' ? qualificationSystem : undefined,
      qualified_teams: qualifiedTeams,
      tournament_started: mode !== 'liga',
      home_away: homeAway,
      updated_at: serverTimestamp()
    }, { merge: true })

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to generate schedule' }
  }
}

function generateRoundRobinSchedule(users: any[], homeAway: boolean = false) {
  const matches: any[] = []
  const n = users.length

  // If less than 2 teams, no matches
  if (n < 2) {
    return matches
  }

  // If odd number of teams, add a dummy team for bye
  const hasDummy = n % 2 !== 0
  const teams = hasDummy ? [...users, { id: 'dummy', team_name: 'BYE', team_logo: '', team_short_name: 'BYE' }] as any[] : [...users] as any[]
  const totalRounds = homeAway ? (teams.length - 1) * 2 : teams.length - 1
  const matchesPerRound = teams.length / 2

  for (let round = 1; round <= totalRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = teams[match] as any
      const away = teams[teams.length - 1 - match] as any

      // Skip matches involving dummy team (bye)
      if (home.id === 'dummy' || away.id === 'dummy') {
        continue
      }

      // Skip self-matches (shouldn't happen with proper rotation, but safety check)
      if (home.id === away.id) {
        continue
      }

      matches.push({
        home_user_id: home.id,
        away_user_id: away.id,
        home_team_name: home.team_name,
        away_team_name: away.team_name,
        home_team_logo: home.team_logo || '',
        away_team_logo: away.team_logo || '',
        home_team_short_name: home.team_short_name || '',
        away_team_short_name: away.team_short_name || '',
        status: 'scheduled',
        round: round,
        phase: 'league'
      })
    }

    // Rotate teams (keep first team fixed, rotate others)
    const lastTeam = teams.pop()
    if (lastTeam) {
      teams.splice(1, 0, lastTeam)
    }
  }

  return matches
}

function generateKnockoutSchedule(users: any[], homeAway: boolean = false) {
  const matches: any[] = []
  const n = users.length

  // Shuffle users for random pairing
  const shuffled = [...users].sort(() => Math.random() - 0.5)

  // Dynamic knockout structure based on participant count
  if (n === 2) {
    // 2 people: Direct final
    if (homeAway) {
      matches.push({
        home_user_id: shuffled[0].id,
        away_user_id: shuffled[1].id,
        home_team_name: shuffled[0].team_name,
        away_team_name: shuffled[1].team_name,
        home_team_logo: shuffled[0].team_logo || '',
        away_team_logo: shuffled[1].team_logo || '',
        home_team_short_name: shuffled[0].team_short_name || '',
        away_team_short_name: shuffled[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'final'
      })
      matches.push({
        home_user_id: shuffled[1].id,
        away_user_id: shuffled[0].id,
        home_team_name: shuffled[1].team_name,
        away_team_name: shuffled[0].team_name,
        home_team_logo: shuffled[1].team_logo || '',
        away_team_logo: shuffled[0].team_logo || '',
        home_team_short_name: shuffled[1].team_short_name || '',
        away_team_short_name: shuffled[0].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'final'
      })
    } else {
      matches.push({
        home_user_id: shuffled[0].id,
        away_user_id: shuffled[1].id,
        home_team_name: shuffled[0].team_name,
        away_team_name: shuffled[1].team_name,
        home_team_logo: shuffled[0].team_logo || '',
        away_team_logo: shuffled[1].team_logo || '',
        home_team_short_name: shuffled[0].team_short_name || '',
        away_team_short_name: shuffled[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'final'
      })
    }
    return { matches, status: 'tournament_ongoing', qualifiedTeams: [] }
  } else if (n === 3) {
    // 3 people: Play-in → SF → F
    const playInTeams = shuffled.slice(0, 2)
    const byeTeam = shuffled[2]

    if (homeAway) {
      matches.push({
        home_user_id: playInTeams[0].id,
        away_user_id: playInTeams[1].id,
        home_team_name: playInTeams[0].team_name,
        away_team_name: playInTeams[1].team_name,
        home_team_logo: playInTeams[0].team_logo || '',
        away_team_logo: playInTeams[1].team_logo || '',
        home_team_short_name: playInTeams[0].team_short_name || '',
        away_team_short_name: playInTeams[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
      matches.push({
        home_user_id: playInTeams[1].id,
        away_user_id: playInTeams[0].id,
        home_team_name: playInTeams[1].team_name,
        away_team_name: playInTeams[0].team_name,
        home_team_logo: playInTeams[1].team_logo || '',
        away_team_logo: playInTeams[0].team_logo || '',
        home_team_short_name: playInTeams[1].team_short_name || '',
        away_team_short_name: playInTeams[0].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
    } else {
      matches.push({
        home_user_id: playInTeams[0].id,
        away_user_id: playInTeams[1].id,
        home_team_name: playInTeams[0].team_name,
        away_team_name: playInTeams[1].team_name,
        home_team_logo: playInTeams[0].team_logo || '',
        away_team_logo: playInTeams[1].team_logo || '',
        home_team_short_name: playInTeams[0].team_short_name || '',
        away_team_short_name: playInTeams[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
    }
    return { matches, status: 'tournament_ongoing', qualifiedTeams: [byeTeam.id] }
  } else if (n === 4) {
    // 4 people: QF → SF → F (actually SF since only 4 teams)
    const semiFinals = []
    for (let i = 0; i < n; i += 2) {
      if (homeAway) {
        semiFinals.push({
          home_user_id: shuffled[i].id,
          away_user_id: shuffled[i + 1].id,
          home_team_name: shuffled[i].team_name,
          away_team_name: shuffled[i + 1].team_name,
          home_team_logo: shuffled[i].team_logo || '',
          away_team_logo: shuffled[i + 1].team_logo || '',
          home_team_short_name: shuffled[i].team_short_name || '',
          away_team_short_name: shuffled[i + 1].team_short_name || '',
          status: 'scheduled',
          round: 1,
          phase: 'tournament',
          tournament_round: 'semi_final'
        })
        semiFinals.push({
          home_user_id: shuffled[i + 1].id,
          away_user_id: shuffled[i].id,
          home_team_name: shuffled[i + 1].team_name,
          away_team_name: shuffled[i].team_name,
          home_team_logo: shuffled[i + 1].team_logo || '',
          away_team_logo: shuffled[i].team_logo || '',
          home_team_short_name: shuffled[i + 1].team_short_name || '',
          away_team_short_name: shuffled[i].team_short_name || '',
          status: 'scheduled',
          round: 1,
          phase: 'tournament',
          tournament_round: 'semi_final'
        })
      } else {
        semiFinals.push({
          home_user_id: shuffled[i].id,
          away_user_id: shuffled[i + 1].id,
          home_team_name: shuffled[i].team_name,
          away_team_name: shuffled[i + 1].team_name,
          home_team_logo: shuffled[i].team_logo || '',
          away_team_logo: shuffled[i + 1].team_logo || '',
          home_team_short_name: shuffled[i].team_short_name || '',
          away_team_short_name: shuffled[i + 1].team_short_name || '',
          status: 'scheduled',
          round: 1,
          phase: 'tournament',
          tournament_round: 'semi_final'
        })
      }
    }
    matches.push(...semiFinals)
    return { matches, status: 'tournament_ongoing', qualifiedTeams: [] }
  } else if (n % 2 !== 0) {
    // Odd number (5, 7): Play-in round
    const playInTeams = shuffled.slice(0, 2)
    const remainingTeams = shuffled.slice(2)

    if (homeAway) {
      matches.push({
        home_user_id: playInTeams[0].id,
        away_user_id: playInTeams[1].id,
        home_team_name: playInTeams[0].team_name,
        away_team_name: playInTeams[1].team_name,
        home_team_logo: playInTeams[0].team_logo || '',
        away_team_logo: playInTeams[1].team_logo || '',
        home_team_short_name: playInTeams[0].team_short_name || '',
        away_team_short_name: playInTeams[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
      matches.push({
        home_user_id: playInTeams[1].id,
        away_user_id: playInTeams[0].id,
        home_team_name: playInTeams[1].team_name,
        away_team_name: playInTeams[0].team_name,
        home_team_logo: playInTeams[1].team_logo || '',
        away_team_logo: playInTeams[0].team_logo || '',
        home_team_short_name: playInTeams[1].team_short_name || '',
        away_team_short_name: playInTeams[0].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
    } else {
      matches.push({
        home_user_id: playInTeams[0].id,
        away_user_id: playInTeams[1].id,
        home_team_name: playInTeams[0].team_name,
        away_team_name: playInTeams[1].team_name,
        home_team_logo: playInTeams[0].team_logo || '',
        away_team_logo: playInTeams[1].team_logo || '',
        home_team_short_name: playInTeams[0].team_short_name || '',
        away_team_short_name: playInTeams[1].team_short_name || '',
        status: 'scheduled',
        round: 1,
        phase: 'tournament',
        tournament_round: 'play_in'
      })
    }

    return {
      matches,
      status: 'tournament_ongoing',
      qualifiedTeams: remainingTeams.map(t => t.id)
    }
  }

  // Even number (6, 8): go straight to quarter finals
  const quarterFinals = []
  for (let i = 0; i < n; i += 2) {
    if (homeAway) {
      quarterFinals.push({
        home_user_id: shuffled[i].id,
        away_user_id: shuffled[i + 1].id,
        home_team_name: shuffled[i].team_name,
        away_team_name: shuffled[i + 1].team_name,
        home_team_logo: shuffled[i].team_logo || '',
        away_team_logo: shuffled[i + 1].team_logo || '',
        home_team_short_name: shuffled[i].team_short_name || '',
        away_team_short_name: shuffled[i + 1].team_short_name || '',
        status: 'scheduled',
        round: 2,
        phase: 'tournament',
        tournament_round: 'quarter_final'
      })
      quarterFinals.push({
        home_user_id: shuffled[i + 1].id,
        away_user_id: shuffled[i].id,
        home_team_name: shuffled[i + 1].team_name,
        away_team_name: shuffled[i].team_name,
        home_team_logo: shuffled[i + 1].team_logo || '',
        away_team_logo: shuffled[i].team_logo || '',
        home_team_short_name: shuffled[i + 1].team_short_name || '',
        away_team_short_name: shuffled[i].team_short_name || '',
        status: 'scheduled',
        round: 2,
        phase: 'tournament',
        tournament_round: 'quarter_final'
      })
    } else {
      quarterFinals.push({
        home_user_id: shuffled[i].id,
        away_user_id: shuffled[i + 1].id,
        home_team_name: shuffled[i].team_name,
        away_team_name: shuffled[i + 1].team_name,
        home_team_logo: shuffled[i].team_logo || '',
        away_team_logo: shuffled[i + 1].team_logo || '',
        home_team_short_name: shuffled[i].team_short_name || '',
        away_team_short_name: shuffled[i + 1].team_short_name || '',
        status: 'scheduled',
        round: 2,
        phase: 'tournament',
        tournament_round: 'quarter_final'
      })
    }
  }
  
  return {
    matches: quarterFinals,
    status: 'tournament_ongoing',
    qualifiedTeams: []
  }
}

function generateWorldCupSchedule(users: any[], homeAway: boolean = false, qualificationSystem: 'top3' | 'top4' = 'top3') {
  const matches: any[] = []
  const n = users.length

  // Split into groups
  const groupASize = Math.ceil(n / 2)
  const groupBSize = Math.floor(n / 2)

  const groupA = users.slice(0, groupASize)
  const groupB = users.slice(groupASize)

  // Generate group stage matches (round robin within each group)
  const groupAMatches = generateRoundRobinSchedule(groupA, homeAway)
  const groupBMatches = generateRoundRobinSchedule(groupB, homeAway)

  // Mark group matches
  groupAMatches.forEach(m => {
    m.phase = 'group'
    m.group = 'A'
    m.tournament_round = 'group_stage'
  })
  groupBMatches.forEach(m => {
    m.phase = 'group'
    m.group = 'B'
    m.tournament_round = 'group_stage'
  })

  matches.push(...groupAMatches, ...groupBMatches)

  return {
    matches,
    status: 'group_ongoing',
    qualifiedTeams: [],
    qualificationSystem
  }
}

// League Completion and Top 4 Qualification
export async function completeLeagueAndQualifyTop4(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get all league matches
    const matchesQuery = query(
      collection(getDBInstance(), 'matches'),
      where('phase', '==', 'league')
    )
    const matchesSnapshot = await getDocs(matchesQuery)
    const matches = matchesSnapshot.docs.map(doc => doc.data())

    // Check if all matches are played
    const unplayedMatches = matches.filter(m => m.status !== 'played')
    if (unplayedMatches.length > 0) {
      return { success: false, error: 'Complete all league matches first' }
    }

    // Calculate standings
    const standingsMap = new Map<string, { points: number, goalDiff: number, goalsFor: number }>()

    matches.forEach(match => {
      const homeStanding = standingsMap.get(match.home_user_id) || { points: 0, goalDiff: 0, goalsFor: 0 }
      const awayStanding = standingsMap.get(match.away_user_id) || { points: 0, goalDiff: 0, goalsFor: 0 }

      const homeScore = match.home_score || 0
      const awayScore = match.away_score || 0

      homeStanding.goalsFor += homeScore
      awayStanding.goalsFor += awayScore
      homeStanding.goalDiff += homeScore - awayScore
      awayStanding.goalDiff += awayScore - homeScore

      if (homeScore > awayScore) {
        homeStanding.points += 3
      } else if (homeScore < awayScore) {
        awayStanding.points += 3
      } else {
        homeStanding.points += 1
        awayStanding.points += 1
      }

      standingsMap.set(match.home_user_id, homeStanding)
      standingsMap.set(match.away_user_id, awayStanding)
    })

    // Determine number of qualified teams based on total participants
    const totalTeams = standingsMap.size
    const qualifiedCount = totalTeams >= 4 ? 4 : (totalTeams >= 2 ? 2 : 0)
    
    if (qualifiedCount < 2) {
      return { success: false, error: 'Need at least 2 teams to qualify for tournament' }
    }

    // Sort teams by points, then goal difference, then goals for
    const sortedTeams = Array.from(standingsMap.entries())
      .sort((a: [string, any], b: [string, any]) => {
        if (b[1].points !== a[1].points) return b[1].points - a[1].points
        if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
        return b[1].goalsFor - a[1].goalsFor
      })
      .slice(0, qualifiedCount)
      .map((entry: [string, any]) => entry[0]) as string[]

    // Update league config
    const configRef = doc(getDBInstance(), 'league_config', 'config')
    await setDoc(configRef, {
      id: 'config',
      status: 'league_completed',
      top_4_qualification: true,
      qualified_teams: sortedTeams,
      tournament_started: false,
      updated_at: serverTimestamp()
    }, { merge: true })




    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to complete league' }
  }
}

// Tournament Management
export async function startTournament(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get league config
    const config = await getLeagueConfig()
    if (!config) {
      return { success: false, error: 'No league config found' }
    }

    // For Liga mode, use qualified teams
    if (config.tournament_mode === 'liga') {
      if (!config.qualified_teams || config.qualified_teams.length < 2) {
        return { success: false, error: 'Need at least 2 qualified teams to start tournament' }
      }

      const qualifiedTeamIds = config.qualified_teams
      const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
      
      const qualifiedUsers = qualifiedTeamIds.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

      if (qualifiedUsers.length < 2) {
        return { success: false, error: 'Need at least 2 qualified teams' }
      }

      const matchesRef = collection(getDBInstance(), 'matches')

      // If 2 teams, go directly to final
      if (qualifiedUsers.length === 2) {
        const final = {
          home_user_id: qualifiedUsers[0]?.id,
          away_user_id: qualifiedUsers[1]?.id,
          home_team_name: qualifiedUsers[0]?.team_name || '',
          away_team_name: qualifiedUsers[1]?.team_name || '',
          home_team_logo: qualifiedUsers[0]?.team_logo || '',
          away_team_logo: qualifiedUsers[1]?.team_logo || '',
          home_team_short_name: qualifiedUsers[0]?.team_short_name || '',
          away_team_short_name: qualifiedUsers[1]?.team_short_name || '',
          status: 'scheduled',
          round: 101,
          phase: 'tournament',
          tournament_round: 'final'
        }

        await addDoc(matchesRef, {
          ...final,
          updated_at: serverTimestamp()
        })
      }
      // If 4 teams, go to semi finals (2 matches: 1v4, 2v3)
      else if (qualifiedUsers.length === 4) {
        const semiFinals = [
          {
            home_user_id: qualifiedUsers[0]?.id,
            away_user_id: qualifiedUsers[3]?.id,
            home_team_name: qualifiedUsers[0]?.team_name || '',
            away_team_name: qualifiedUsers[3]?.team_name || '',
            home_team_logo: qualifiedUsers[0]?.team_logo || '',
            away_team_logo: qualifiedUsers[3]?.team_logo || '',
            home_team_short_name: qualifiedUsers[0]?.team_short_name || '',
            away_team_short_name: qualifiedUsers[3]?.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          },
          {
            home_user_id: qualifiedUsers[1]?.id,
            away_user_id: qualifiedUsers[2]?.id,
            home_team_name: qualifiedUsers[1]?.team_name || '',
            away_team_name: qualifiedUsers[2]?.team_name || '',
            home_team_logo: qualifiedUsers[1]?.team_logo || '',
            away_team_logo: qualifiedUsers[2]?.team_logo || '',
            home_team_short_name: qualifiedUsers[1]?.team_short_name || '',
            away_team_short_name: qualifiedUsers[2]?.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          }
        ]

        for (const match of semiFinals) {
          await addDoc(matchesRef, {
            ...match,
            updated_at: serverTimestamp()
          })
        }
      }

      // Update league config
      const configRef = doc(getDBInstance(), 'league_config', 'config')
      await setDoc(configRef, {
        id: 'config',
        status: 'tournament_ongoing',
        top_4_qualification: true,
        qualified_teams: qualifiedTeamIds,
        tournament_started: true,
        updated_at: serverTimestamp()
      }, { merge: true })
    }
    // For Knockout and World Cup modes, tournament already started
    else {
      return { success: false, error: 'Tournament already started for this mode' }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to start tournament' }
  }
}

export async function generateNextTournamentRound(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    const config = await getLeagueConfig()
    if (!config) {
      return { success: false, error: 'No league config found' }
    }

    // Handle World Cup group stage completion
    if (config.tournament_mode === 'worldcup' && config.status === 'group_ongoing') {
      const groupMatchesQuery = query(
        collection(getDBInstance(), 'matches'),
        where('phase', '==', 'group')
      )
      const groupSnapshot = await getDocs(groupMatchesQuery)
      const groupMatches = groupSnapshot.docs.map(doc => doc.data())

      const unplayedGroupMatches = groupMatches.filter(m => m.status !== 'played')
      if (unplayedGroupMatches.length > 0) {
        return { success: false, error: 'Complete all group matches first' }
      }

      // Calculate group standings
      const groupAStandings = new Map<string, { points: number, goalDiff: number, goalsFor: number }>()
      const groupBStandings = new Map<string, { points: number, goalDiff: number, goalsFor: number }>()

      groupMatches.forEach(match => {
        const standings = match.group === 'A' ? groupAStandings : groupBStandings
        const homeStanding = standings.get(match.home_user_id) || { points: 0, goalDiff: 0, goalsFor: 0 }
        const awayStanding = standings.get(match.away_user_id) || { points: 0, goalDiff: 0, goalsFor: 0 }

        const homeScore = match.home_score || 0
        const awayScore = match.away_score || 0

        homeStanding.goalsFor += homeScore
        awayStanding.goalsFor += awayScore
        homeStanding.goalDiff += homeScore - awayScore
        awayStanding.goalDiff += awayScore - homeScore

        if (homeScore > awayScore) {
          homeStanding.points += 3
        } else if (homeScore < awayScore) {
          awayStanding.points += 3
        } else {
          homeStanding.points += 1
          awayStanding.points += 1
        }

        standings.set(match.home_user_id, homeStanding)
        standings.set(match.away_user_id, awayStanding)
      })

      // Get total participants and qualification system
      const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const totalParticipants = users.length
      const qualificationSystem = config.qualification_system || 'top3'

      // Determine qualification logic based on qualification system
      let qualifiedTeams: any[] = []
      let hasByeSystem = false

      if (qualificationSystem === 'top4') {
        // Top 4 from each group (8 teams) -> Standard bracket QF -> SF -> F
        const getTop4 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 4)
            .map(entry => entry[0])
        }

        const groupATop4 = getTop4(groupAStandings)
        const groupBTop4 = getTop4(groupBStandings)

        if (groupATop4.length < 4 || groupBTop4.length < 4) {
          return { success: false, error: 'Need at least 4 teams in each group for Top 4 qualification' }
        }

        const groupAUsers = groupATop4.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
        const groupBUsers = groupBTop4.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

        // Order: Group A 1st, Group B 1st, Group A 2nd, Group B 2nd, Group A 3rd, Group B 3rd, Group A 4th, Group B 4th
        qualifiedTeams = [
          groupAUsers[0],
          groupBUsers[0],
          groupAUsers[1],
          groupBUsers[1],
          groupAUsers[2],
          groupBUsers[2],
          groupAUsers[3],
          groupBUsers[3]
        ]
        hasByeSystem = false
      } else {
        // Top 3 from each group (6 teams) -> Bye system
        const getTop3 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 3)
            .map(entry => entry[0])
        }

        const groupATop3 = getTop3(groupAStandings)
        const groupBTop3 = getTop3(groupBStandings)

        if (groupATop3.length < 3 || groupBTop3.length < 3) {
          return { success: false, error: 'Need at least 3 teams in each group for Top 3 qualification' }
        }

        const groupAUsers = groupATop3.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
        const groupBUsers = groupBTop3.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

        // Order: Group A 1st, Group B 1st, Group A 2nd, Group B 2nd, Group A 3rd, Group B 3rd
        qualifiedTeams = [
          groupAUsers[0], // Group A 1st - Bye to Semifinal
          groupBUsers[0], // Group B 1st - Bye to Semifinal
          groupAUsers[1], // Group A 2nd
          groupBUsers[1], // Group B 2nd
          groupAUsers[2], // Group A 3rd
          groupBUsers[2]  // Group B 3rd
        ]
        hasByeSystem = true
      }

        // Generate knockout matches based on qualification system
        const homeAway = config?.home_away || false
        const knockoutMatches: any[] = []

        if (hasByeSystem) {
          // Generate quarter finals (only for teams 2-5)
          const quarterFinals = []

          if (homeAway) {
            quarterFinals.push({
              home_user_id: qualifiedTeams[2].id,
              away_user_id: qualifiedTeams[3].id,
              home_team_name: qualifiedTeams[2].team_name,
              away_team_name: qualifiedTeams[3].team_name,
              home_team_logo: qualifiedTeams[2].team_logo || '',
              away_team_logo: qualifiedTeams[3].team_logo || '',
              home_team_short_name: qualifiedTeams[2].team_short_name || '',
              away_team_short_name: qualifiedTeams[3].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[3].id,
              away_user_id: qualifiedTeams[2].id,
              home_team_name: qualifiedTeams[3].team_name,
              away_team_name: qualifiedTeams[2].team_name,
              home_team_logo: qualifiedTeams[3].team_logo || '',
              away_team_logo: qualifiedTeams[2].team_logo || '',
              home_team_short_name: qualifiedTeams[3].team_short_name || '',
              away_team_short_name: qualifiedTeams[2].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[4].id,
              away_user_id: qualifiedTeams[5].id,
              home_team_name: qualifiedTeams[4].team_name,
              away_team_name: qualifiedTeams[5].team_name,
              home_team_logo: qualifiedTeams[4].team_logo || '',
              away_team_logo: qualifiedTeams[5].team_logo || '',
              home_team_short_name: qualifiedTeams[4].team_short_name || '',
              away_team_short_name: qualifiedTeams[5].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[5].id,
              away_user_id: qualifiedTeams[4].id,
              home_team_name: qualifiedTeams[5].team_name,
              away_team_name: qualifiedTeams[4].team_name,
              home_team_logo: qualifiedTeams[5].team_logo || '',
              away_team_logo: qualifiedTeams[4].team_logo || '',
              home_team_short_name: qualifiedTeams[5].team_short_name || '',
              away_team_short_name: qualifiedTeams[4].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
          } else {
            quarterFinals.push({
              home_user_id: qualifiedTeams[2].id,
              away_user_id: qualifiedTeams[3].id,
              home_team_name: qualifiedTeams[2].team_name,
              away_team_name: qualifiedTeams[3].team_name,
              home_team_logo: qualifiedTeams[2].team_logo || '',
              away_team_logo: qualifiedTeams[3].team_logo || '',
              home_team_short_name: qualifiedTeams[2].team_short_name || '',
              away_team_short_name: qualifiedTeams[3].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[4].id,
              away_user_id: qualifiedTeams[5].id,
              home_team_name: qualifiedTeams[4].team_name,
              away_team_name: qualifiedTeams[5].team_name,
              home_team_logo: qualifiedTeams[4].team_logo || '',
              away_team_logo: qualifiedTeams[5].team_logo || '',
              home_team_short_name: qualifiedTeams[4].team_short_name || '',
              away_team_short_name: qualifiedTeams[5].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
          }

          knockoutMatches.push(...quarterFinals)
        } else {
          // Generate quarter finals (all 8 teams)
          const quarterFinals = []

          if (homeAway) {
            quarterFinals.push({
              home_user_id: qualifiedTeams[0].id,
              away_user_id: qualifiedTeams[1].id,
              home_team_name: qualifiedTeams[0].team_name,
              away_team_name: qualifiedTeams[1].team_name,
              home_team_logo: qualifiedTeams[0].team_logo || '',
              away_team_logo: qualifiedTeams[1].team_logo || '',
              home_team_short_name: qualifiedTeams[0].team_short_name || '',
              away_team_short_name: qualifiedTeams[1].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[1].id,
              away_user_id: qualifiedTeams[0].id,
              home_team_name: qualifiedTeams[1].team_name,
              away_team_name: qualifiedTeams[0].team_name,
              home_team_logo: qualifiedTeams[1].team_logo || '',
              away_team_logo: qualifiedTeams[0].team_logo || '',
              home_team_short_name: qualifiedTeams[1].team_short_name || '',
              away_team_short_name: qualifiedTeams[0].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[2].id,
              away_user_id: qualifiedTeams[3].id,
              home_team_name: qualifiedTeams[2].team_name,
              away_team_name: qualifiedTeams[3].team_name,
              home_team_logo: qualifiedTeams[2].team_logo || '',
              away_team_logo: qualifiedTeams[3].team_logo || '',
              home_team_short_name: qualifiedTeams[2].team_short_name || '',
              away_team_short_name: qualifiedTeams[3].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[3].id,
              away_user_id: qualifiedTeams[2].id,
              home_team_name: qualifiedTeams[3].team_name,
              away_team_name: qualifiedTeams[2].team_name,
              home_team_logo: qualifiedTeams[3].team_logo || '',
              away_team_logo: qualifiedTeams[2].team_logo || '',
              home_team_short_name: qualifiedTeams[3].team_short_name || '',
              away_team_short_name: qualifiedTeams[2].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[4].id,
              away_user_id: qualifiedTeams[5].id,
              home_team_name: qualifiedTeams[4].team_name,
              away_team_name: qualifiedTeams[5].team_name,
              home_team_logo: qualifiedTeams[4].team_logo || '',
              away_team_logo: qualifiedTeams[5].team_logo || '',
              home_team_short_name: qualifiedTeams[4].team_short_name || '',
              away_team_short_name: qualifiedTeams[5].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[5].id,
              away_user_id: qualifiedTeams[4].id,
              home_team_name: qualifiedTeams[5].team_name,
              away_team_name: qualifiedTeams[4].team_name,
              home_team_logo: qualifiedTeams[5].team_logo || '',
              away_team_logo: qualifiedTeams[4].team_logo || '',
              home_team_short_name: qualifiedTeams[5].team_short_name || '',
              away_team_short_name: qualifiedTeams[4].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[6].id,
              away_user_id: qualifiedTeams[7].id,
              home_team_name: qualifiedTeams[6].team_name,
              away_team_name: qualifiedTeams[7].team_name,
              home_team_logo: qualifiedTeams[6].team_logo || '',
              away_team_logo: qualifiedTeams[7].team_logo || '',
              home_team_short_name: qualifiedTeams[6].team_short_name || '',
              away_team_short_name: qualifiedTeams[7].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[7].id,
              away_user_id: qualifiedTeams[6].id,
              home_team_name: qualifiedTeams[7].team_name,
              away_team_name: qualifiedTeams[6].team_name,
              home_team_logo: qualifiedTeams[7].team_logo || '',
              away_team_logo: qualifiedTeams[6].team_logo || '',
              home_team_short_name: qualifiedTeams[7].team_short_name || '',
              away_team_short_name: qualifiedTeams[6].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
          } else {
            quarterFinals.push({
              home_user_id: qualifiedTeams[0].id,
              away_user_id: qualifiedTeams[1].id,
              home_team_name: qualifiedTeams[0].team_name,
              away_team_name: qualifiedTeams[1].team_name,
              home_team_logo: qualifiedTeams[0].team_logo || '',
              away_team_logo: qualifiedTeams[1].team_logo || '',
              home_team_short_name: qualifiedTeams[0].team_short_name || '',
              away_team_short_name: qualifiedTeams[1].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[2].id,
              away_user_id: qualifiedTeams[3].id,
              home_team_name: qualifiedTeams[2].team_name,
              away_team_name: qualifiedTeams[3].team_name,
              home_team_logo: qualifiedTeams[2].team_logo || '',
              away_team_logo: qualifiedTeams[3].team_logo || '',
              home_team_short_name: qualifiedTeams[2].team_short_name || '',
              away_team_short_name: qualifiedTeams[3].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[4].id,
              away_user_id: qualifiedTeams[5].id,
              home_team_name: qualifiedTeams[4].team_name,
              away_team_name: qualifiedTeams[5].team_name,
              home_team_logo: qualifiedTeams[4].team_logo || '',
              away_team_logo: qualifiedTeams[5].team_logo || '',
              home_team_short_name: qualifiedTeams[4].team_short_name || '',
              away_team_short_name: qualifiedTeams[5].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
            quarterFinals.push({
              home_user_id: qualifiedTeams[6].id,
              away_user_id: qualifiedTeams[7].id,
              home_team_name: qualifiedTeams[6].team_name,
              away_team_name: qualifiedTeams[7].team_name,
              home_team_logo: qualifiedTeams[6].team_logo || '',
              away_team_logo: qualifiedTeams[7].team_logo || '',
              home_team_short_name: qualifiedTeams[6].team_short_name || '',
              away_team_short_name: qualifiedTeams[7].team_short_name || '',
              status: 'scheduled',
              round: 2,
              phase: 'tournament',
              tournament_round: 'quarter_final'
            })
          }

          knockoutMatches.push(...quarterFinals)
        }

        // Insert knockout matches
        for (const match of knockoutMatches) {
          await addDoc(collection(getDBInstance(), 'matches'), {
            ...match,
            updated_at: serverTimestamp()
          })
        }

        // Update league config status
        const configRef = doc(getDBInstance(), 'league_config', 'config')
        await setDoc(configRef, {
          status: 'tournament_ongoing',
          updated_at: serverTimestamp()
        }, { merge: true })

        return { success: true }
      } else if (config.tournament_mode === 'knockout' && config.status === 'tournament_ongoing') {
        // Handle knockout tournament rounds
        const matchesQuery = query(collection(getDBInstance(), 'matches'))
        const matchesSnapshot = await getDocs(matchesQuery)
        const matches = matchesSnapshot.docs.map(doc => doc.data())
        const currentRoundMatches = matches.filter(m => m.phase === 'tournament' && m.status === 'played')
        const upcomingMatches = matches.filter(m => m.phase === 'tournament' && m.status === 'scheduled')

        if (upcomingMatches.length === 0 && currentRoundMatches.length > 0) {
          // Current round complete, generate next round
          const lastPlayedRound = Math.max(...currentRoundMatches.map(m => m.round || 0))
          const lastRoundType = currentRoundMatches.find(m => m.round === lastPlayedRound)?.tournament_round

          if (lastRoundType === 'quarter_final') {
            // Generate semi finals
            const winners = currentRoundMatches.map(m => {
              const homeScore = m.home_score || 0
              const awayScore = m.away_score || 0
              return homeScore > awayScore ? m.home_user_id : m.away_user_id
            })

            const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            const semiFinals = []
            const homeAway = config?.home_away || false

            if (homeAway) {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              const user2 = users.find((u: any) => u.id === winners[2]) as any
              const user3 = users.find((u: any) => u.id === winners[3]) as any
              semiFinals.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
              semiFinals.push({
                home_user_id: user1?.id,
                away_user_id: user0?.id,
                home_team_name: user1?.team_name,
                away_team_name: user0?.team_name,
                home_team_logo: user1?.team_logo || '',
                away_team_logo: user0?.team_logo || '',
                home_team_short_name: user1?.team_short_name || '',
                away_team_short_name: user0?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
              semiFinals.push({
                home_user_id: user2?.id,
                away_user_id: user3?.id,
                home_team_name: user2?.team_name,
                away_team_name: user3?.team_name,
                home_team_logo: user2?.team_logo || '',
                away_team_logo: user3?.team_logo || '',
                home_team_short_name: user2?.team_short_name || '',
                away_team_short_name: user3?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
              semiFinals.push({
                home_user_id: user3?.id,
                away_user_id: user2?.id,
                home_team_name: user3?.team_name,
                away_team_name: user2?.team_name,
                home_team_logo: user3?.team_logo || '',
                away_team_logo: user2?.team_logo || '',
                home_team_short_name: user3?.team_short_name || '',
                away_team_short_name: user2?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
            } else {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              const user2 = users.find((u: any) => u.id === winners[2]) as any
              const user3 = users.find((u: any) => u.id === winners[3]) as any
              semiFinals.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
              semiFinals.push({
                home_user_id: user2?.id,
                away_user_id: user3?.id,
                home_team_name: user2?.team_name,
                away_team_name: user3?.team_name,
                home_team_logo: user2?.team_logo || '',
                away_team_logo: user3?.team_logo || '',
                home_team_short_name: user2?.team_short_name || '',
                away_team_short_name: user3?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
            }

            for (const match of semiFinals) {
              await addDoc(collection(getDBInstance(), 'matches'), {
                ...match,
                updated_at: serverTimestamp()
              })
            }

            return { success: true }
          } else if (lastRoundType === 'semi_final') {
            // Generate final
            const winners = currentRoundMatches.map(m => {
              const homeScore = m.home_score || 0
              const awayScore = m.away_score || 0
              return homeScore > awayScore ? m.home_user_id : m.away_user_id
            })

            const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            const final = []
            const homeAway = config?.home_away || false

            if (homeAway) {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              final.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
              final.push({
                home_user_id: user1?.id,
                away_user_id: user0?.id,
                home_team_name: user1?.team_name,
                away_team_name: user0?.team_name,
                home_team_logo: user1?.team_logo || '',
                away_team_logo: user0?.team_logo || '',
                home_team_short_name: user1?.team_short_name || '',
                away_team_short_name: user0?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
            } else {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              final.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
            }

            for (const match of final) {
              await addDoc(collection(getDBInstance(), 'matches'), {
                ...match,
                updated_at: serverTimestamp()
              })
            }

            return { success: true }
          } else if (lastRoundType === 'final') {
            // Tournament complete
            const configRef = doc(getDBInstance(), 'league_config', 'config')
            await setDoc(configRef, {
              status: 'tournament_completed',
              updated_at: serverTimestamp()
            }, { merge: true })

            return { success: true }
          }
        }

        return { success: false, error: 'Complete current round first' }
      } else if (config.tournament_mode === 'worldcup' && config.status === 'tournament_ongoing') {
        // Handle World Cup knockout rounds (same as knockout)
        const matchesQuery = query(collection(getDBInstance(), 'matches'))
        const matchesSnapshot = await getDocs(matchesQuery)
        const matches = matchesSnapshot.docs.map(doc => doc.data())
        const currentRoundMatches = matches.filter(m => m.phase === 'tournament' && m.status === 'played')
        const upcomingMatches = matches.filter(m => m.phase === 'tournament' && m.status === 'scheduled')

        if (upcomingMatches.length === 0 && currentRoundMatches.length > 0) {
          // Current round complete, generate next round
          const lastPlayedRound = Math.max(...currentRoundMatches.map(m => m.round || 0))
          const lastRoundType = currentRoundMatches.find(m => m.round === lastPlayedRound)?.tournament_round

          if (lastRoundType === 'quarter_final') {
            // Generate semi finals
            const winners = currentRoundMatches.map(m => {
              const homeScore = m.home_score || 0
              const awayScore = m.away_score || 0
              return homeScore > awayScore ? m.home_user_id : m.away_user_id
            })

            const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            const semiFinals = []
            const homeAway = config?.home_away || false

            if (homeAway) {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              semiFinals.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
              semiFinals.push({
                home_user_id: user1?.id,
                away_user_id: user0?.id,
                home_team_name: user1?.team_name,
                away_team_name: user0?.team_name,
                home_team_logo: user1?.team_logo || '',
                away_team_logo: user0?.team_logo || '',
                home_team_short_name: user1?.team_short_name || '',
                away_team_short_name: user0?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
            } else {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              semiFinals.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'semi_final'
              })
            }

            for (const match of semiFinals) {
              await addDoc(collection(getDBInstance(), 'matches'), {
                ...match,
                updated_at: serverTimestamp()
              })
            }

            return { success: true }
          } else if (lastRoundType === 'semi_final') {
            // Generate final
            const winners = currentRoundMatches.map(m => {
              const homeScore = m.home_score || 0
              const awayScore = m.away_score || 0
              return homeScore > awayScore ? m.home_user_id : m.away_user_id
            })

            const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            const final = []
            const homeAway = config?.home_away || false

            if (homeAway) {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              final.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
              final.push({
                home_user_id: user1?.id,
                away_user_id: user0?.id,
                home_team_name: user1?.team_name,
                away_team_name: user0?.team_name,
                home_team_logo: user1?.team_logo || '',
                away_team_logo: user0?.team_logo || '',
                home_team_short_name: user1?.team_short_name || '',
                away_team_short_name: user0?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
            } else {
              const user0 = users.find((u: any) => u.id === winners[0]) as any
              const user1 = users.find((u: any) => u.id === winners[1]) as any
              final.push({
                home_user_id: user0?.id,
                away_user_id: user1?.id,
                home_team_name: user0?.team_name,
                away_team_name: user1?.team_name,
                home_team_logo: user0?.team_logo || '',
                away_team_logo: user1?.team_logo || '',
                home_team_short_name: user0?.team_short_name || '',
                away_team_short_name: user1?.team_short_name || '',
                status: 'scheduled',
                round: lastPlayedRound + 1,
                phase: 'tournament',
                tournament_round: 'final'
              })
            }

            for (const match of final) {
              await addDoc(collection(getDBInstance(), 'matches'), {
                ...match,
                updated_at: serverTimestamp()
              })
            }

            return { success: true }
          } else if (lastRoundType === 'final') {
            // Tournament complete
            const configRef = doc(getDBInstance(), 'league_config', 'config')
            await setDoc(configRef, {
              status: 'tournament_completed',
              updated_at: serverTimestamp()
            }, { merge: true })

            return { success: true }
          }
        }

        return { success: false, error: 'Complete current round first' }
      } else {
        return { success: false, error: 'Invalid tournament state' }
      }
    } catch (error) {
      return { success: false, error: 'Failed to generate next round' }
    }
  }

// Match Score Update
export async function updateMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number,
  stats: { player_name: string; team_name: string; type: 'goal' | 'assist'; count: number; minute?: number; isPenalty?: boolean }[],
  pin: string
) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Update match score and status
    const matchRef = doc(getDBInstance(), 'matches', matchId)
    await updateDoc(matchRef, {
      home_score: homeScore,
      away_score: awayScore,
      status: 'played',
      updated_at: serverTimestamp()
    })

    // Delete existing stats for this match
    const statsQuery = query(
      collection(getDBInstance(), 'stats'),
      where('match_id', '==', matchId)
    )
    const statsSnapshot = await getDocs(statsQuery)
    
    for (const statDoc of statsSnapshot.docs) {
      await deleteDoc(doc(getDBInstance(), 'stats', statDoc.id))
    }

    // Insert new stats and auto-add players to game_players
    if (stats.length > 0) {
      const statsRef = collection(getDBInstance(), 'stats')
      const gamePlayersRef = collection(getDBInstance(), 'game_players')

      // Get existing game players to avoid duplicates
      const existingGamePlayersSnapshot = await getDocs(gamePlayersRef)
      const existingPlayerNames = new Set(
        existingGamePlayersSnapshot.docs.map(doc => doc.data().player_name)
      )

      for (const stat of stats) {
        // Add stat
        await addDoc(statsRef, {
          match_id: matchId,
          player_name: stat.player_name,
          team_name: stat.team_name,
          type: stat.type,
          count: stat.count,
          minute: stat.minute || null,
          isPenalty: stat.isPenalty || false,
          created_at: serverTimestamp()
        })

        // Auto-add to game_players if not exists
        if (!existingPlayerNames.has(stat.player_name)) {
          // Find user_id from users collection based on team_name
          const usersQuery = query(
            collection(getDBInstance(), 'users'),
            where('team_name', '==', stat.team_name)
          )
          const usersSnapshot = await getDocs(usersQuery)
          const user = usersSnapshot.docs[0]

          if (user) {
            await addDoc(gamePlayersRef, {
              user_id: user.id,
              team_name: stat.team_name,
              player_name: stat.player_name,
              created_at: serverTimestamp()
            })
            existingPlayerNames.add(stat.player_name)
          }
        }
      }
    }




    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to update match score' }
  }
}

// Data Retrieval Functions
export async function getUsers() {
  try {
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
  } catch (error) {
    return []
  }
}

export async function getGamePlayers() {
  try {
    const gamePlayersSnapshot = await getDocs(collection(getDBInstance(), 'game_players'))
    return gamePlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
  } catch (error) {
    return []
  }
}

export async function getMatches() {
  try {
    const matchesSnapshot = await getDocs(collection(getDBInstance(), 'matches'))
    const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
    
    // Sort matches by phase and round
    return matches.sort((a, b) => {
      if (a.phase !== b.phase) {
        return a.phase === 'league' ? -1 : 1
      }
      if (a.round !== b.round) {
        return a.round - b.round
      }
      return 0
    })
  } catch (error) {
    return []
  }
}

export async function getLeagueConfig() {
  try {
    const configDoc = await getDoc(doc(getDBInstance(), 'league_config', 'config'))
    if (configDoc.exists()) {
      return configDoc.data()
    }
    return null
  } catch (error) {
    return null
  }
}

export async function getMatchStats(matchId: string) {
  try {
    const statsQuery = query(
      collection(getDBInstance(), 'stats'),
      where('match_id', '==', matchId)
    )
    const statsSnapshot = await getDocs(statsQuery)
    return statsSnapshot.docs.map(doc => doc.data())
  } catch (error) {
    return []
  }
}

// Deletion Functions
export async function deleteUser(userId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(getDBInstance(), 'users', userId))

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete user' }
  }
}

export async function deleteMatch(matchId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(getDBInstance(), 'matches', matchId))



    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete match' }
  }
}

export async function deleteAllData(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }


    
    // Check for existing data
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    const matchesSnapshot = await getDocs(collection(getDBInstance(), 'matches'))
    const gamePlayersSnapshot = await getDocs(collection(getDBInstance(), 'game_players'))
    const statsSnapshot = await getDocs(collection(getDBInstance(), 'stats'))
    const configDoc = await getDoc(doc(getDBInstance(), 'league_config', 'config'))

    const dataCounts = {
      users: usersSnapshot.size,
      matches: matchesSnapshot.size,
      gamePlayers: gamePlayersSnapshot.size,
      stats: statsSnapshot.size,
      config: configDoc.exists()
    }



    if (usersSnapshot.size === 0 && matchesSnapshot.size === 0 && 
        gamePlayersSnapshot.size === 0 && statsSnapshot.size === 0 && !configDoc.exists()) {
      return { success: false, error: 'Tidak ada data untuk dihapus' }
    }

    // Delete stats first (they reference matches)

    if (statsSnapshot.size > 0) {
      for (const statDoc of statsSnapshot.docs) {
        await deleteDoc(doc(getDBInstance(), 'stats', statDoc.id))
      }

    }

    // Delete matches

    if (matchesSnapshot.size > 0) {
      for (const matchDoc of matchesSnapshot.docs) {
        await deleteDoc(doc(getDBInstance(), 'matches', matchDoc.id))
      }

    }

    // Delete game players

    if (gamePlayersSnapshot.size > 0) {
      for (const playerDoc of gamePlayersSnapshot.docs) {
        await deleteDoc(doc(getDBInstance(), 'game_players', playerDoc.id))
      }

    }

    // Delete users

    if (usersSnapshot.size > 0) {
      for (const userDoc of usersSnapshot.docs) {
        await deleteDoc(doc(getDBInstance(), 'users', userDoc.id))
      }

    }

    // Delete league config

    if (configDoc.exists()) {
      await deleteDoc(doc(getDBInstance(), 'league_config', 'config'))

    }



    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete all data' }
  }
}