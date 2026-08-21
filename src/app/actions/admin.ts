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

    // Create a map of team names to user IDs (case-insensitive)
    const teamNameMap = new Map<string, string>()
    users.forEach((user: any) => {
      teamNameMap.set(user.team_name.toLowerCase(), user.id)
    })

    // Filter players whose clubs match registered teams
    const matchedPlayers = players.filter(player => {
      const clubName = player.club_name?.toLowerCase()
      return clubName && teamNameMap.has(clubName)
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
      const userId = teamNameMap.get(player.club_name.toLowerCase())
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
        team_name: player.club_name,
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (error) {
    console.error('Error fetching team players:', error)
    return []
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
export async function lockRegistrationAndGenerateSchedule(pin: string, mode: 'liga' | 'knockout' | 'worldcup', homeAway: boolean = false) {
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
      const result = generateWorldCupSchedule(users as any[], homeAway)
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

function generateWorldCupSchedule(users: any[], homeAway: boolean = false) {
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
    qualifiedTeams: []
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

      // Get total participants
      const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const totalParticipants = users.length

      // Determine qualification logic based on participant count
      let qualifiedTeams: any[] = []
      let hasByeSystem = false

      if (totalParticipants === 4) {
        // 4 people: Top 1 from each group (2 teams) -> Skip QF, go to SF
        const getTop1 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 1)
            .map(entry => entry[0])
        }

        const groupATop1 = getTop1(groupAStandings)
        const groupBTop1 = getTop1(groupBStandings)

        if (groupATop1.length < 1 || groupBTop1.length < 1) {
          return { success: false, error: 'Need at least 1 team in each group' }
        }

        const groupAUsers = groupATop1.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
        const groupBUsers = groupBTop1.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

        qualifiedTeams = [groupAUsers[0], groupBUsers[0]]
        hasByeSystem = false

        // Generate semi finals directly (skip QF)
        const homeAway = config?.home_away || false
        const semiFinals = []

        if (homeAway) {
          semiFinals.push({
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
            tournament_round: 'semi_final'
          })
          semiFinals.push({
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
            tournament_round: 'semi_final'
          })
        } else {
          semiFinals.push({
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
      } else if (totalParticipants === 6) {
        // 6 people: Top 1 from each group (bye to SF), Top 2-3 to QF
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
          return { success: false, error: 'Need at least 3 teams in each group for World Cup Extended' }
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
      } else if (totalParticipants >= 6) {
        // 6-9 people: Top 1 from each group (bye to SF), Top 2-3 to QF
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
          return { success: false, error: 'Need at least 3 teams in each group for World Cup Extended' }
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
      } else {
        // 5 people: Top 2 from each group (4 teams) -> QF -> SF -> F
        const getTop2 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 2)
            .map(entry => entry[0])
        }

        const groupATop2 = getTop2(groupAStandings)
        const groupBTop2 = getTop2(groupBStandings)

        if (groupATop2.length < 2 || groupBTop2.length < 2) {
          return { success: false, error: 'Need at least 2 teams in each group' }
        }

        const groupAUsers = groupATop2.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
        const groupBUsers = groupBTop2.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

        // Order: Group A 1st, Group B 2nd, Group B 1st, Group A 2nd (cross bracket)
        qualifiedTeams = [
          groupAUsers[0], // Group A 1st
          groupBUsers[1], // Group B 2nd
          groupBUsers[0], // Group B 1st
          groupAUsers[1]  // Group A 2nd
        ]
        hasByeSystem = false
      }

      const homeAway = config?.home_away || false

      // Generate quarter finals (only for 5, 7, 8 people cases)
      const quarterFinalMatches = []
      if (!hasByeSystem) {
        // Standard QF: 4 teams, 2 matches
        if (homeAway) {
          quarterFinalMatches.push({
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
          quarterFinalMatches.push({
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
          quarterFinalMatches.push({
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
          quarterFinalMatches.push({
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
        } else {
          quarterFinalMatches.push({
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
          quarterFinalMatches.push({
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
        }
      } else {
        // Bye system (6 people): 2 QF matches
        if (homeAway) {
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[2].id,
            away_user_id: qualifiedTeams[5].id,
            home_team_name: qualifiedTeams[2].team_name,
            away_team_name: qualifiedTeams[5].team_name,
            home_team_logo: qualifiedTeams[2].team_logo || '',
            away_team_logo: qualifiedTeams[5].team_logo || '',
            home_team_short_name: qualifiedTeams[2].team_short_name || '',
            away_team_short_name: qualifiedTeams[5].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[5].id,
            away_user_id: qualifiedTeams[2].id,
            home_team_name: qualifiedTeams[5].team_name,
            away_team_name: qualifiedTeams[2].team_name,
            home_team_logo: qualifiedTeams[5].team_logo || '',
            away_team_logo: qualifiedTeams[2].team_logo || '',
            home_team_short_name: qualifiedTeams[5].team_short_name || '',
            away_team_short_name: qualifiedTeams[2].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[3].id,
            away_user_id: qualifiedTeams[4].id,
            home_team_name: qualifiedTeams[3].team_name,
            away_team_name: qualifiedTeams[4].team_name,
            home_team_logo: qualifiedTeams[3].team_logo || '',
            away_team_logo: qualifiedTeams[4].team_logo || '',
            home_team_short_name: qualifiedTeams[3].team_short_name || '',
            away_team_short_name: qualifiedTeams[4].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[4].id,
            away_user_id: qualifiedTeams[3].id,
            home_team_name: qualifiedTeams[4].team_name,
            away_team_name: qualifiedTeams[3].team_name,
            home_team_logo: qualifiedTeams[4].team_logo || '',
            away_team_logo: qualifiedTeams[3].team_logo || '',
            home_team_short_name: qualifiedTeams[4].team_short_name || '',
            away_team_short_name: qualifiedTeams[3].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
        } else {
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[2].id,
            away_user_id: qualifiedTeams[5].id,
            home_team_name: qualifiedTeams[2].team_name,
            away_team_name: qualifiedTeams[5].team_name,
            home_team_logo: qualifiedTeams[2].team_logo || '',
            away_team_logo: qualifiedTeams[5].team_logo || '',
            home_team_short_name: qualifiedTeams[2].team_short_name || '',
            away_team_short_name: qualifiedTeams[5].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
          quarterFinalMatches.push({
            home_user_id: qualifiedTeams[3].id,
            away_user_id: qualifiedTeams[4].id,
            home_team_name: qualifiedTeams[3].team_name,
            away_team_name: qualifiedTeams[4].team_name,
            home_team_logo: qualifiedTeams[3].team_logo || '',
            away_team_logo: qualifiedTeams[4].team_logo || '',
            home_team_short_name: qualifiedTeams[3].team_short_name || '',
            away_team_short_name: qualifiedTeams[4].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
        }
      }

      for (const match of quarterFinalMatches) {
        await addDoc(collection(getDBInstance(), 'matches'), {
          ...match,
          updated_at: serverTimestamp()
        })
      }

      // Update league config
      const configRef = doc(getDBInstance(), 'league_config', 'config')
      await setDoc(configRef, {
        id: 'config',
        status: 'tournament_ongoing',
        updated_at: serverTimestamp()
      }, { merge: true })

      return { success: true }
    }

    // Handle Knockout and Liga tournament progression
    const allMatchesQuery = query(
      collection(getDBInstance(), 'matches'),
      where('phase', '==', 'tournament')
    )
    const allSnapshot = await getDocs(allMatchesQuery)
    const allMatches = allSnapshot.docs.map(doc => doc.data())

    // Get completed tournament matches
    const completedMatches = allMatches.filter(m => m.status === 'played')

    // Determine current tournament stage
    const playInMatches = allMatches.filter(m => m.tournament_round === 'play_in')
    const quarterFinals = allMatches.filter(m => m.tournament_round === 'quarter_final')
    const semiFinals = allMatches.filter(m => m.tournament_round === 'semi_final')
    const finals = allMatches.filter(m => m.tournament_round === 'final')

    const playInCompleted = completedMatches.filter(m => m.tournament_round === 'play_in').length
    const quarterFinalsCompleted = completedMatches.filter(m => m.tournament_round === 'quarter_final').length
    const semiFinalsCompleted = completedMatches.filter(m => m.tournament_round === 'semi_final').length
    const finalsCompleted = completedMatches.filter(m => m.tournament_round === 'final').length

    // Handle play-in completion (Knockout mode with odd teams)
    if (playInMatches.length > 0 && playInCompleted < playInMatches.length) {
      return { success: false, error: 'Complete play-in matches first' }
    }

    // Generate quarter finals after play-in
    if (playInCompleted >= 2 && quarterFinals.length === 0) {
      // Calculate play-in winner (aggregate score)
      const playInWinner = playInMatches[0].home_score + playInMatches[1].away_score > 
                          playInMatches[0].away_score + playInMatches[1].home_score
        ? playInMatches[0].home_user_id
        : playInMatches[0].away_user_id

      const config = await getLeagueConfig()
      const qualifiedTeamIds = config?.qualified_teams || []
      const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      const qualifiedUsers = qualifiedTeamIds.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
      const playInUser = users.find((u: any) => u.id === playInWinner)

      if (!playInUser) {
        return { success: false, error: 'Play-in winner not found' }
      }

      const allTournamentTeams = [...qualifiedUsers, playInUser]
      const homeAway = config?.home_away || false

      // Generate quarter finals
      const quarterFinalMatches = []
      for (let i = 0; i < allTournamentTeams.length; i += 2) {
        if (homeAway) {
          quarterFinalMatches.push({
            home_user_id: allTournamentTeams[i].id,
            away_user_id: allTournamentTeams[i + 1].id,
            home_team_name: allTournamentTeams[i].team_name,
            away_team_name: allTournamentTeams[i + 1].team_name,
            home_team_logo: allTournamentTeams[i].team_logo || '',
            away_team_logo: allTournamentTeams[i + 1].team_logo || '',
            home_team_short_name: allTournamentTeams[i].team_short_name || '',
            away_team_short_name: allTournamentTeams[i + 1].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
          quarterFinalMatches.push({
            home_user_id: allTournamentTeams[i + 1].id,
            away_user_id: allTournamentTeams[i].id,
            home_team_name: allTournamentTeams[i + 1].team_name,
            away_team_name: allTournamentTeams[i].team_name,
            home_team_logo: allTournamentTeams[i + 1].team_logo || '',
            away_team_logo: allTournamentTeams[i].team_logo || '',
            home_team_short_name: allTournamentTeams[i + 1].team_short_name || '',
            away_team_short_name: allTournamentTeams[i].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
        } else {
          quarterFinalMatches.push({
            home_user_id: allTournamentTeams[i].id,
            away_user_id: allTournamentTeams[i + 1].id,
            home_team_name: allTournamentTeams[i].team_name,
            away_team_name: allTournamentTeams[i + 1].team_name,
            home_team_logo: allTournamentTeams[i].team_logo || '',
            away_team_logo: allTournamentTeams[i + 1].team_logo || '',
            home_team_short_name: allTournamentTeams[i].team_short_name || '',
            away_team_short_name: allTournamentTeams[i + 1].team_short_name || '',
            status: 'scheduled',
            round: 2,
            phase: 'tournament',
            tournament_round: 'quarter_final'
          })
        }
      }

      for (const match of quarterFinalMatches) {
        await addDoc(collection(getDBInstance(), 'matches'), {
          ...match,
          updated_at: serverTimestamp()
        })
      }

      return { success: true }
    }

    // Handle quarter finals completion
    const isWorldCupExtended = config?.tournament_mode === 'worldcup'
    const isKnockout = config?.tournament_mode === 'knockout'
    const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
    const totalParticipants = usersSnapshot.docs.length

    // For 4 people in World Cup mode, skip QF check (no QF matches)
    // For 2 people in knockout mode, skip QF (direct final)
    // For 4 people in knockout mode, skip QF (direct SF)
    let requiredQuarterFinals = isWorldCupExtended ? 2 : 4
    if (isWorldCupExtended && totalParticipants === 4) {
      requiredQuarterFinals = 0 // No QF for 4 people in World Cup
    } else if (isWorldCupExtended && totalParticipants >= 6) {
      requiredQuarterFinals = 2 // 2 QF matches for 6+ people (bye system)
    } else if (isKnockout && totalParticipants <= 4) {
      requiredQuarterFinals = 0 // No QF for 2-4 people in knockout
    }

    if (quarterFinals.length > 0 && quarterFinalsCompleted < quarterFinals.length) {
      return { success: false, error: 'Complete all quarter finals first' }
    }

    // Generate semi finals after quarter finals (or directly after group stage/play-in for small participant counts)
    const shouldGenerateSemiFinals = (
      (totalParticipants === 4 && quarterFinals.length === 0 && semiFinals.length === 0) ||
      (isKnockout && totalParticipants === 4 && quarterFinals.length === 0 && semiFinals.length === 0) ||
      (quarterFinalsCompleted >= requiredQuarterFinals && semiFinals.length === 0)
    )

    if (shouldGenerateSemiFinals) {

      // For 4 people case: get top 1 from each group directly (no QF)
      // For knockout 4 people: get QF winners or direct SF
      let semiFinalists: any[] = []
      if (totalParticipants === 4 && isWorldCupExtended) {
        const groupMatchesQuery = query(
          collection(getDBInstance(), 'matches'),
          where('phase', '==', 'group')
        )
        const groupSnapshot = await getDocs(groupMatchesQuery)
        const groupMatches = groupSnapshot.docs.map(doc => doc.data())

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

        const getTop1 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 1)
            .map(entry => entry[0])
        }

        const groupATop1 = getTop1(groupAStandings)[0]
        const groupBTop1 = getTop1(groupBStandings)[0]

        const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        const groupAUser = users.find((u: any) => u.id === groupATop1) as any
        const groupBUser = users.find((u: any) => u.id === groupBTop1) as any

        if (!groupAUser || !groupBUser) {
          return { success: false, error: 'Group winners not found' }
        }

        semiFinalists = [groupAUser, groupBUser]
      } else if (isKnockout && totalParticipants === 4) {
        // Knockout 4 people: SF matches are already generated in schedule
        // Just get the winners
        const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        semiFinalists = quarterFinals.length > 0 ? quarterFinals
          .filter(m => m.status === 'played')
          .map(m => m.home_score > m.away_score ? m.home_user_id : m.away_user_id)
          .map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[] : []
      } else if (isKnockout && totalParticipants === 3) {
        // Knockout 3 people: Get play-in winner + bye team
        const playInWinners = playInMatches
          .filter(m => m.status === 'played')
          .map(m => m.home_score > m.away_score ? m.home_user_id : m.away_user_id)

        if (playInWinners.length < 1) {
          return { success: false, error: 'Complete play-in match first' }
        }

        const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        const qualifiedTeamIds = config?.qualified_teams || []
        const byeTeam = users.find((u: any) => u.id === qualifiedTeamIds[0])
        const playInWinner = users.find((u: any) => u.id === playInWinners[0])

        if (!byeTeam || !playInWinner) {
          return { success: false, error: 'Teams not found' }
        }

        semiFinalists = [byeTeam, playInWinner]
      } else {
        // Standard case: get QF winners
        const quarterFinalWinners = quarterFinals
          .filter(m => m.status === 'played')
          .map(m => {
            // For home-away, calculate aggregate
            if (quarterFinals.length > quarterFinals.length / 2) {
              const homeAwayPair = quarterFinals.filter(qf =>
                (qf.home_user_id === m.home_user_id && qf.away_user_id === m.away_user_id) ||
                (qf.home_user_id === m.away_user_id && qf.away_user_id === m.home_user_id)
              )
              const aggregateHome = homeAwayPair.reduce((sum, qf) => sum + (qf.home_score || 0), 0)
              const aggregateAway = homeAwayPair.reduce((sum, qf) => sum + (qf.away_score || 0), 0)
              return aggregateHome > aggregateAway ? m.home_user_id : m.away_user_id
            }
            return m.home_score > m.away_score ? m.home_user_id : m.away_user_id
          })
          .filter((value, index, self) => self.indexOf(value) === index)

        if (quarterFinalWinners.length < 2) {
          return { success: false, error: 'Need at least 2 quarter final winners' }
        }

        const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        semiFinalists = quarterFinalWinners.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
      }

      let semiFinalMatches = []

      // Generate semi final matches based on participant count
      if (isWorldCupExtended && totalParticipants === 6) {
        // 6-team tournament: Top 1 from each group got bye to semifinal
        // Get group standings to find top 1 from each group
        const groupMatchesQuery = query(
          collection(getDBInstance(), 'matches'),
          where('phase', '==', 'group')
        )
        const groupSnapshot = await getDocs(groupMatchesQuery)
        const groupMatches = groupSnapshot.docs.map(doc => doc.data())

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

        const getTop1 = (standings: Map<string, any>) => {
          return Array.from(standings.entries())
            .sort((a, b) => {
              if (b[1].points !== a[1].points) return b[1].points - a[1].points
              if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
              return b[1].goalsFor - a[1].goalsFor
            })
            .slice(0, 1)
            .map(entry => entry[0])
        }

        const groupATop1 = getTop1(groupAStandings)[0]
        const groupBTop1 = getTop1(groupBStandings)[0]

        const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        const groupAUser = users.find((u: any) => u.id === groupATop1) as any
        const groupBUser = users.find((u: any) => u.id === groupBTop1) as any

        if (!groupAUser || !groupBUser) {
          return { success: false, error: 'Group winners not found' }
        }

        const quarterFinalistUsers = semiFinalists

        // Semi 1: Winner of Quarter 1 vs Group A 1st (bye)
        // Semi 2: Winner of Quarter 2 vs Group B 1st (bye)
        semiFinalMatches = [
          {
            home_user_id: quarterFinalistUsers[0]?.id,
            away_user_id: groupAUser.id,
            home_team_name: quarterFinalistUsers[0]?.team_name || '',
            away_team_name: groupAUser.team_name || '',
            home_team_logo: quarterFinalistUsers[0]?.team_logo || '',
            away_team_logo: groupAUser.team_logo || '',
            home_team_short_name: quarterFinalistUsers[0]?.team_short_name || '',
            away_team_short_name: groupAUser.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          },
          {
            home_user_id: quarterFinalistUsers[1]?.id,
            away_user_id: groupBUser.id,
            home_team_name: quarterFinalistUsers[1]?.team_name || '',
            away_team_name: groupBUser.team_name || '',
            home_team_logo: quarterFinalistUsers[1]?.team_logo || '',
            away_team_logo: groupBUser.team_logo || '',
            home_team_short_name: quarterFinalistUsers[1]?.team_short_name || '',
            away_team_short_name: groupBUser.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          }
        ]
      } else {
        // Standard tournament (4, 5, 7, 8 people): semiFinalists already contains QF winners or group winners
        if (semiFinalists.length < 2) {
          return { success: false, error: 'Need at least 2 semi finalists' }
        }

        semiFinalMatches = [
          {
            home_user_id: semiFinalists[0]?.id,
            away_user_id: semiFinalists[1]?.id,
            home_team_name: semiFinalists[0]?.team_name || '',
            away_team_name: semiFinalists[1]?.team_name || '',
            home_team_logo: semiFinalists[0]?.team_logo || '',
            away_team_logo: semiFinalists[1]?.team_logo || '',
            home_team_short_name: semiFinalists[0]?.team_short_name || '',
            away_team_short_name: semiFinalists[1]?.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          }
        ]

        // For 4+ QF winners, add second semi final
        if (semiFinalists.length >= 4) {
          semiFinalMatches.push({
            home_user_id: semiFinalists[2]?.id,
            away_user_id: semiFinalists[3]?.id,
            home_team_name: semiFinalists[2]?.team_name || '',
            away_team_name: semiFinalists[3]?.team_name || '',
            home_team_logo: semiFinalists[2]?.team_logo || '',
            away_team_logo: semiFinalists[3]?.team_logo || '',
            home_team_short_name: semiFinalists[2]?.team_short_name || '',
            away_team_short_name: semiFinalists[3]?.team_short_name || '',
            status: 'scheduled',
            round: 100,
            phase: 'tournament',
            tournament_round: 'semi_final'
          })
        }
      }

      for (const match of semiFinalMatches) {
        await addDoc(collection(getDBInstance(), 'matches'), {
          ...match,
          updated_at: serverTimestamp()
        })
      }

      return { success: true }
    }

    // If semi finals exist but not completed
    if (semiFinals.length > 0 && semiFinalsCompleted < semiFinals.length) {
      return { success: false, error: 'Complete all semi finals first' }
    }

    // Generate final after semi finals
    if (semiFinalsCompleted >= 2 && finals.length === 0) {
      const semiFinalWinners = semiFinals
        .map(m => m.home_score > m.away_score ? m.home_user_id : m.away_user_id)

      const semiFinalLosers = semiFinals
        .map(m => m.home_score > m.away_score ? m.away_user_id : m.home_user_id)

      if (semiFinalWinners.length < 2) {
        return { success: false, error: 'Need 2 semi final winners' }
      }

      const usersSnapshot = await getDocs(collection(getDBInstance(), 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      const finalists = semiFinalWinners.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]
      const thirdPlaceTeams = semiFinalLosers.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

      const final = {
        home_user_id: finalists[0]?.id,
        away_user_id: finalists[1]?.id,
        home_team_name: finalists[0]?.team_name || '',
        away_team_name: finalists[1]?.team_name || '',
        home_team_logo: finalists[0]?.team_logo || '',
        away_team_logo: finalists[1]?.team_logo || '',
        home_team_short_name: finalists[0]?.team_short_name || '',
        away_team_short_name: finalists[1]?.team_short_name || '',
        status: 'scheduled',
        round: 101,
        phase: 'tournament',
        tournament_round: 'final'
      }

      // 3rd place playoff
      const thirdPlaceMatch = {
        home_user_id: thirdPlaceTeams[0]?.id,
        away_user_id: thirdPlaceTeams[1]?.id,
        home_team_name: thirdPlaceTeams[0]?.team_name || '',
        away_team_name: thirdPlaceTeams[1]?.team_name || '',
        home_team_logo: thirdPlaceTeams[0]?.team_logo || '',
        away_team_logo: thirdPlaceTeams[1]?.team_logo || '',
        home_team_short_name: thirdPlaceTeams[0]?.team_short_name || '',
        away_team_short_name: thirdPlaceTeams[1]?.team_short_name || '',
        status: 'scheduled',
        round: 102,
        phase: 'tournament',
        tournament_round: 'third_place'
      }

      await addDoc(collection(getDBInstance(), 'matches'), {
        ...final,
        updated_at: serverTimestamp()
      })

      await addDoc(collection(getDBInstance(), 'matches'), {
        ...thirdPlaceMatch,
        updated_at: serverTimestamp()
      })

      return { success: true }
    }

    // If final is completed, show winner and mark tournament as completed
    if (finalsCompleted >= 1) {
      const finalMatch = finals[0]
      const winner = finalMatch.home_score > finalMatch.away_score 
        ? finalMatch.home_team_name 
        : finalMatch.away_team_name
      
      // Check if 3rd place match is also completed (for World Cup mode)
      const thirdPlaceMatches = allMatches.filter(m => m.tournament_round === 'third_place')
      const thirdPlaceCompleted = completedMatches.filter(m => m.tournament_round === 'third_place').length
      
      if (thirdPlaceMatches.length > 0 && thirdPlaceCompleted === 0) {
        return { success: false, error: 'Complete 3rd place match first' }
      }
      
      // Update league config to mark tournament as completed
      const configRef = doc(getDBInstance(), 'league_config', 'config')
      await setDoc(configRef, {
        id: 'config',
        status: 'tournament_completed',
        updated_at: serverTimestamp()
      }, { merge: true })
      
      let message = `🏆 Tournament Winner: ${winner}`
      if (thirdPlaceMatches.length > 0 && thirdPlaceCompleted > 0) {
        const thirdPlaceMatch = thirdPlaceMatches[0]
        const thirdPlace = thirdPlaceMatch.home_score > thirdPlaceMatch.away_score
          ? thirdPlaceMatch.home_team_name
          : thirdPlaceMatch.away_team_name
        message += `\n🥉 3rd Place: ${thirdPlace}`
      }
      
      return { success: false, error: message }
    }

    return { success: false, error: 'Complete current round first' }
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