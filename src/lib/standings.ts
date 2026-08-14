import { Standing, TopScorer, TopAssist, User, Match } from '@/types'

export async function calculateStandings(): Promise<Standing[]> {
  try {
    // Lazy import Firebase only when needed
    const { db } = await import('./firebase')
    const { collection, getDocs, query, where } = await import('firebase/firestore')

    // Fetch all users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        name: data.name,
        team_name: data.team_name,
        team_id: data.team_id || 0,
        team_logo: data.team_logo || '',
        team_short_name: data.team_short_name || '',
        league_id: data.league_id || 0,
        league_name: data.league_name || '',
        created_at: data.created_at?.toDate?.() || new Date().toISOString()
      } as User
    })

    // Fetch all played matches
    const matchesQuery = query(
      collection(db, 'matches'),
      where('status', '==', 'played')
    )
    const matchesSnapshot = await getDocs(matchesQuery)
    const matches = matchesSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        home_user_id: data.home_user_id,
        away_user_id: data.away_user_id,
        home_team_name: data.home_team_name,
        away_team_name: data.away_team_name,
        home_score: data.home_score,
        away_score: data.away_score,
        status: data.status,
        round: data.round,
        updated_at: data.updated_at?.toDate?.() || new Date().toISOString()
      } as Match
    })

    // Initialize standings for each user
    const standingsMap = new Map<string, Standing>()

    users.forEach(user => {
      standingsMap.set(user.id, {
        position: 0,
        user_name: user.name,
        team_name: user.team_name,
        team_logo: user.team_logo || '',
        team_short_name: user.team_short_name || '',
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0
      })
    })

    // Process each match
    matches.forEach(match => {
      const homeStanding = standingsMap.get(match.home_user_id)
      const awayStanding = standingsMap.get(match.away_user_id)

      if (homeStanding && awayStanding) {
        const homeScore = match.home_score || 0
        const awayScore = match.away_score || 0

        // Update games played
        homeStanding.played++
        awayStanding.played++

        // Update goals
        homeStanding.goals_for += homeScore
        homeStanding.goals_against += awayScore
        awayStanding.goals_for += awayScore
        awayStanding.goals_against += homeScore

        // Update goal difference
        homeStanding.goal_difference = homeStanding.goals_for - homeStanding.goals_against
        awayStanding.goal_difference = awayStanding.goals_for - awayStanding.goals_against

        // Update points and win/draw/loss
        if (homeScore > awayScore) {
          homeStanding.won++
          homeStanding.points += 3
          awayStanding.lost++
        } else if (homeScore < awayScore) {
          awayStanding.won++
          awayStanding.points += 3
          homeStanding.lost++
        } else {
          homeStanding.drawn++
          awayStanding.drawn++
          homeStanding.points += 1
          awayStanding.points += 1
        }
      }
    })

    // Convert map to array and sort
    const standings = Array.from(standingsMap.values()).sort((a, b) => {
      // Sort by points (descending)
      if (b.points !== a.points) {
        return b.points - a.points
      }
      // Then by goal difference (descending)
      if (b.goal_difference !== a.goal_difference) {
        return b.goal_difference - a.goal_difference
      }
      // Then by goals for (descending)
      if (b.goals_for !== a.goals_for) {
        return b.goals_for - a.goals_for
      }
      // Finally by team name (ascending)
      return a.team_name.localeCompare(b.team_name)
    })

    // Assign positions
    standings.forEach((standing, index) => {
      standing.position = index + 1
    })

    return standings
  } catch (error) {
    console.error('Error calculating standings:', error)
    return []
  }
}

export async function getTopScorers(limitCount: number = 10): Promise<TopScorer[]> {
  try {
    const { db } = await import('./firebase')
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore')

    const statsQuery = query(
      collection(db, 'stats'),
      where('type', '==', 'goal'),
      orderBy('count', 'desc'),
      limit(limitCount)
    )
    const statsSnapshot = await getDocs(statsQuery)
    const stats = statsSnapshot.docs.map(doc => doc.data())

    return stats.map(stat => ({
      player_name: stat.player_name,
      team_name: stat.team_name,
      goals: stat.count
    }))
  } catch (error) {
    console.error('Error fetching top scorers:', error)
    return []
  }
}

export async function getTopAssists(limitCount: number = 10): Promise<TopAssist[]> {
  try {
    const { db } = await import('./firebase')
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore')

    const statsQuery = query(
      collection(db, 'stats'),
      where('type', '==', 'assist'),
      orderBy('count', 'desc'),
      limit(limitCount)
    )
    const statsSnapshot = await getDocs(statsQuery)
    const stats = statsSnapshot.docs.map(doc => doc.data())

    return stats.map(stat => ({
      player_name: stat.player_name,
      team_name: stat.team_name,
      assists: stat.count
    }))
  } catch (error) {
    console.error('Error fetching top assists:', error)
    return []
  }
}