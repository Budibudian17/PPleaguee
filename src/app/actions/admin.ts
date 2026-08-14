import { db } from '@/lib/firebase'
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
  serverTimestamp 
} from 'firebase/firestore'

const ADMIN_PIN = '2626'

export async function verifyAdminPin(pin: string): Promise<boolean> {
  return pin === ADMIN_PIN
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
      collection(db, 'users'),
      where('team_name', '==', teamData.team_name)
    )
    const usersSnapshot = await getDocs(usersQuery)
    
    if (!usersSnapshot.empty) {
      return { success: false, error: 'Team name already registered' }
    }

    // Register new user with team details from API
    const usersRef = collection(db, 'users')
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
    console.error('Registration error:', error)
    return { success: false, error: 'Registration failed' }
  }
}

// Game Player Management
export async function addGamePlayer(userId: string, teamName: string, playerName: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    const gamePlayersRef = collection(db, 'game_players')
    await addDoc(gamePlayersRef, {
      user_id: userId,
      team_name: teamName,
      player_name: playerName,
      created_at: serverTimestamp()
    })



    return { success: true }
  } catch (error) {
    console.error('Add game player error:', error)
    return { success: false, error: 'Failed to add game player' }
  }
}

export async function deleteGamePlayer(playerId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(db, 'game_players', playerId))


    return { success: true }
  } catch (error) {
    console.error('Delete game player error:', error)
    return { success: false, error: 'Failed to delete game player' }
  }
}

// Schedule Generation
export async function lockRegistrationAndGenerateSchedule(pin: string, homeAway: boolean = false) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    if (users.length < 2) {
      return { success: false, error: 'Need at least 2 teams to generate schedule' }
    }

    // Delete existing league matches
    console.log('Deleting existing league matches...')
    const existingMatchesQuery = query(
      collection(db, 'matches'),
      where('phase', '==', 'league')
    )
    const existingMatchesSnapshot = await getDocs(existingMatchesQuery)
    
    for (const doc of existingMatchesSnapshot.docs) {
      await deleteDoc(doc.ref)
      console.log('Deleted match:', doc.id)
    }
    
    // Delete all existing stats for league matches
    console.log('Deleting existing league stats...')
    const statsRef = collection(db, 'stats')
    const allStatsSnapshot = await getDocs(statsRef)
    
    for (const statDoc of allStatsSnapshot.docs) {
      const statData = statDoc.data()
      const matchRef = doc(db, 'matches', statData.match_id)
      const matchDoc = await getDoc(matchRef)
      
      if (matchDoc.exists() && matchDoc.data()?.phase === 'league') {
        await deleteDoc(statDoc.ref)
        console.log('Deleted stat:', statDoc.id)
      }
    }

    // Generate round-robin schedule
    const matches = generateRoundRobinSchedule(users as any[], homeAway)

    // Insert matches into database
    const matchesRef = collection(db, 'matches')
    for (const match of matches) {
      await addDoc(matchesRef, {
        ...match,
        phase: 'league',
        updated_at: serverTimestamp()
      })
    }

    // Update league config
    const configRef = doc(db, 'league_config', 'config')
    await setDoc(configRef, {
      id: 'config',
      status: 'league_ongoing',
      top_4_qualification: true,
      qualified_teams: [],
      tournament_started: false,
      home_away: homeAway,
      updated_at: serverTimestamp()
    }, { merge: true })




    return { success: true }
  } catch (error) {
    console.error('Schedule generation error:', error)
    return { success: false, error: 'Failed to generate schedule' }
  }
}

function generateRoundRobinSchedule(users: any[], homeAway: boolean = false) {
  const matches: any[] = []
  const n = users.length
  const totalRounds = homeAway ? (n - 1) * 2 : n - 1
  const matchesPerRound = n / 2

  // Create a copy of users array for rotation
  const teams = [...users] as any[]
  
  for (let round = 1; round <= totalRounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const home = teams[match] as any
      const away = teams[teams.length - 1 - match] as any

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

// League Completion and Top 4 Qualification
export async function completeLeagueAndQualifyTop4(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get all league matches
    const matchesQuery = query(
      collection(db, 'matches'),
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

    // Sort teams by points, then goal difference, then goals for
    const sortedTeams = Array.from(standingsMap.entries())
      .sort((a: [string, any], b: [string, any]) => {
        if (b[1].points !== a[1].points) return b[1].points - a[1].points
        if (b[1].goalDiff !== a[1].goalDiff) return b[1].goalDiff - a[1].goalDiff
        return b[1].goalsFor - a[1].goalsFor
      })
      .slice(0, 4)
      .map((entry: [string, any]) => entry[0]) as string[]

    // Update league config
    const configRef = doc(db, 'league_config', 'config')
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
    console.error('Complete league error:', error)
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
    if (!config || config.qualified_teams.length < 4) {
      return { success: false, error: 'Need 4 qualified teams to start tournament' }
    }

    // Generate tournament schedule (Quarter finals -> Semi finals -> Final)
    const qualifiedTeamIds = config.qualified_teams
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
    
    const qualifiedUsers = qualifiedTeamIds.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

    if (qualifiedUsers.length < 4) {
      return { success: false, error: 'Need 4 qualified teams' }
    }

    // For 4 teams, go directly to semi finals (2 matches: 1v4, 2v3)
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

    // Insert semi finals
    const matchesRef = collection(db, 'matches')
    for (const match of semiFinals) {
      await addDoc(matchesRef, {
        ...match,
        updated_at: serverTimestamp()
      })
    }

    // Update league config
    const configRef = doc(db, 'league_config', 'config')
    await setDoc(configRef, {
      id: 'config',
      status: 'tournament_ongoing',
      top_4_qualification: true,
      qualified_teams: qualifiedTeamIds,
      tournament_started: true,
      updated_at: serverTimestamp()
    }, { merge: true })



    return { success: true }
  } catch (error) {
    console.error('Start tournament error:', error)
    return { success: false, error: 'Failed to start tournament' }
  }
}

export async function generateNextTournamentRound(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Get all tournament matches
    const allMatchesQuery = query(
      collection(db, 'matches'),
      where('phase', '==', 'tournament')
    )
    const allSnapshot = await getDocs(allMatchesQuery)
    const allMatches = allSnapshot.docs.map(doc => doc.data())

    // Get completed tournament matches
    const completedMatches = allMatches.filter(m => m.status === 'played')

    // Determine current tournament stage
    const semiFinals = allMatches.filter(m => m.tournament_round === 'semi_final')
    const finals = allMatches.filter(m => m.tournament_round === 'final')

    const semiFinalsCompleted = completedMatches.filter(m => m.tournament_round === 'semi_final').length
    const finalsCompleted = completedMatches.filter(m => m.tournament_round === 'final').length

    // If semi finals exist but not completed
    if (semiFinals.length > 0 && semiFinalsCompleted < semiFinals.length) {
      return { success: false, error: 'Complete all semi finals first' }
    }

    // Generate final if semi finals are completed and no final exists
    if (semiFinalsCompleted >= 2 && finals.length === 0) {
      const semiFinalWinners = semiFinals
        .map(m => m.home_score > m.away_score ? m.home_user_id : m.away_user_id)

      if (semiFinalWinners.length < 2) {
        return { success: false, error: 'Need 2 semi final winners' }
      }

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      const finalists = semiFinalWinners.map((id: string) => users.find((u: any) => u.id === id)).filter((u: any) => u !== undefined) as any[]

      if (finalists.length < 2) {
        return { success: false, error: 'Need 2 finalists' }
      }

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

      await addDoc(collection(db, 'matches'), {
        ...final,
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
      
      // Update league config to mark tournament as completed
      const configRef = doc(db, 'league_config', 'config')
      await setDoc(configRef, {
        id: 'config',
        status: 'tournament_completed',
        updated_at: serverTimestamp()
      }, { merge: true })
      
  
  
  
      
      return { success: false, error: `🏆 Tournament Winner: ${winner}` }
    }

    return { success: false, error: 'Complete all semi finals first' }
  } catch (error) {
    console.error('Generate next round error:', error)
    return { success: false, error: 'Failed to generate next round' }
  }
}

// Match Score Update
export async function updateMatchScore(
  matchId: string,
  homeScore: number,
  awayScore: number,
  stats: { player_name: string; team_name: string; type: 'goal' | 'assist'; count: number }[],
  pin: string
) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    // Update match score and status
    const matchRef = doc(db, 'matches', matchId)
    await updateDoc(matchRef, {
      home_score: homeScore,
      away_score: awayScore,
      status: 'played',
      updated_at: serverTimestamp()
    })

    // Delete existing stats for this match
    const statsQuery = query(
      collection(db, 'stats'),
      where('match_id', '==', matchId)
    )
    const statsSnapshot = await getDocs(statsQuery)
    
    for (const statDoc of statsSnapshot.docs) {
      await deleteDoc(doc(db, 'stats', statDoc.id))
    }

    // Insert new stats
    if (stats.length > 0) {
      const statsRef = collection(db, 'stats')
      for (const stat of stats) {
        await addDoc(statsRef, {
          match_id: matchId,
          player_name: stat.player_name,
          team_name: stat.team_name,
          type: stat.type,
          count: stat.count,
          created_at: serverTimestamp()
        })
      }
    }




    return { success: true }
  } catch (error) {
    console.error('Update match score error:', error)
    return { success: false, error: 'Failed to update match score' }
  }
}

// Data Retrieval Functions
export async function getUsers() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'))
    return usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
  } catch (error) {
    console.error('Get users error:', error)
    return []
  }
}

export async function getGamePlayers() {
  try {
    const gamePlayersSnapshot = await getDocs(collection(db, 'game_players'))
    return gamePlayersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[]
  } catch (error) {
    console.error('Get game players error:', error)
    return []
  }
}

export async function getMatches() {
  try {
    const matchesSnapshot = await getDocs(collection(db, 'matches'))
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
    console.error('Get matches error:', error)
    return []
  }
}

export async function getLeagueConfig() {
  try {
    const configDoc = await getDoc(doc(db, 'league_config', 'config'))
    if (configDoc.exists()) {
      return configDoc.data()
    }
    return null
  } catch (error) {
    console.error('Get league config error:', error)
    return null
  }
}

export async function getMatchStats(matchId: string) {
  try {
    const statsQuery = query(
      collection(db, 'stats'),
      where('match_id', '==', matchId)
    )
    const statsSnapshot = await getDocs(statsQuery)
    return statsSnapshot.docs.map(doc => doc.data())
  } catch (error) {
    console.error('Get match stats error:', error)
    return []
  }
}

// Deletion Functions
export async function deleteUser(userId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(db, 'users', userId))

    return { success: true }
  } catch (error) {
    console.error('Delete user error:', error)
    return { success: false, error: 'Failed to delete user' }
  }
}

export async function deleteMatch(matchId: string, pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    await deleteDoc(doc(db, 'matches', matchId))



    return { success: true }
  } catch (error) {
    console.error('Delete match error:', error)
    return { success: false, error: 'Failed to delete match' }
  }
}

export async function deleteAllData(pin: string) {
  try {
    if (!await verifyAdminPin(pin)) {
      return { success: false, error: 'Invalid PIN' }
    }

    console.log('Starting delete all data...')
    
    // Check for existing data
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const matchesSnapshot = await getDocs(collection(db, 'matches'))
    const gamePlayersSnapshot = await getDocs(collection(db, 'game_players'))
    const statsSnapshot = await getDocs(collection(db, 'stats'))
    const configDoc = await getDoc(doc(db, 'league_config', 'config'))

    const dataCounts = {
      users: usersSnapshot.size,
      matches: matchesSnapshot.size,
      gamePlayers: gamePlayersSnapshot.size,
      stats: statsSnapshot.size,
      config: configDoc.exists()
    }

    console.log('Data counts:', dataCounts)

    if (usersSnapshot.size === 0 && matchesSnapshot.size === 0 && 
        gamePlayersSnapshot.size === 0 && statsSnapshot.size === 0 && !configDoc.exists()) {
      return { success: false, error: 'Tidak ada data untuk dihapus' }
    }

    // Delete stats first (they reference matches)
    console.log('Deleting stats...')
    if (statsSnapshot.size > 0) {
      for (const statDoc of statsSnapshot.docs) {
        await deleteDoc(doc(db, 'stats', statDoc.id))
      }
      console.log('Stats deleted')
    }

    // Delete matches
    console.log('Deleting matches...')
    if (matchesSnapshot.size > 0) {
      for (const matchDoc of matchesSnapshot.docs) {
        await deleteDoc(doc(db, 'matches', matchDoc.id))
      }
      console.log('Matches deleted')
    }

    // Delete game players
    console.log('Deleting game players...')
    if (gamePlayersSnapshot.size > 0) {
      for (const playerDoc of gamePlayersSnapshot.docs) {
        await deleteDoc(doc(db, 'game_players', playerDoc.id))
      }
      console.log('Game players deleted')
    }

    // Delete users
    console.log('Deleting users...')
    if (usersSnapshot.size > 0) {
      for (const userDoc of usersSnapshot.docs) {
        await deleteDoc(doc(db, 'users', userDoc.id))
      }
      console.log('Users deleted')
    }

    // Delete league config
    console.log('Deleting league config...')
    if (configDoc.exists()) {
      await deleteDoc(doc(db, 'league_config', 'config'))
      console.log('League config deleted')
    }

    console.log('Delete all data completed successfully')

    return { success: true }
  } catch (error) {
    console.error('Delete all data error:', error)
    return { success: false, error: 'Failed to delete all data' }
  }
}