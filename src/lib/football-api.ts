// Football API Service for fetching leagues and teams using API-Football

const API_BASE_URL = 'https://apiv3.apifootball.com'
const API_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || ''

// Popular leagues to show first (by league name) - exact matches only
const POPULAR_LEAGUE_NAMES = [
  // 🏆 Liga Pria (Eropa Top 5 & Divisi Bawah)
  'Premier League',
  'Championship',
  'League One',
  'League Two',
  'La Liga',
  'La Liga 2',
  'Bundesliga',
  '2. Bundesliga',
  '3. Liga',
  'Serie A',
  'Serie B',
  'Ligue 1',
  'Ligue 2',
  // 🌍 Liga Pria (Rest of Europe)
  'Eredivisie',
  'Liga Portugal',
  'Jupiler Pro League',
  'Scottish Premiership',
  'Austrian Bundesliga',
  'Süper Lig',
  'Allsvenskan',
  'Eliteserien',
  'Danish Superliga',
  'Ekstraklasa',
  'Liga I',
  'Swiss Super League',
  'League of Ireland',
  // 🌎 Liga Pria (Amerika & Asia-Pasifik)
  'Major League Soccer',
  'Liga Profesional',
  'Saudi League',
  'K League 1',
  'Chinese Super League',
  'A-League',
  'Indian Super League',
  // 🎀 Liga Wanita
  'Women\'s Super League',
  'NWSL',
  'Liga F',
  'Première Ligue',
  'Frauen-Bundesliga',
  // 🥇 Turnamen Internasional (Klub)
  'Champions League',
  'Europa League',
  'Conference League',
  'Libertadores',
  'Sudamericana',
]

// Cache configuration
const CACHE_TTL = 3600 // 1 hour cache for leagues/teams
const LEAGUE_CACHE_TTL = 86400 // 24 hours for leagues (rarely changes)

export interface League {
  league_id: string
  league_name: string
  country_id: string
  country_name: string
  league_logo: string
  league_season: string
}

export interface Team {
  team_key: string
  team_name: string
  team_badge: string
  team_country: string
  team_founded: string
}

// Server-side API functions (Server Actions) with caching
export async function fetchLeagues(): Promise<League[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/?action=get_leagues&APIkey=${API_KEY}`, {
      next: { revalidate: LEAGUE_CACHE_TTL }, // Cache for 24 hours
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch leagues: ${response.status}`)
    }

    const data = await response.json()
    
    // Filter to only show leagues from the popular list
    const filteredLeagues = (data || []).filter((league: League) => 
      POPULAR_LEAGUE_NAMES.some(name => 
        league.league_name.toLowerCase().includes(name.toLowerCase())
      )
    )
    
    // Sort by the order in POPULAR_LEAGUE_NAMES, then by name
    const sortedLeagues = filteredLeagues.sort((a: League, b: League) => {
      const aIndex = POPULAR_LEAGUE_NAMES.findIndex(name => 
        a.league_name.toLowerCase().includes(name.toLowerCase())
      )
      const bIndex = POPULAR_LEAGUE_NAMES.findIndex(name => 
        b.league_name.toLowerCase().includes(name.toLowerCase())
      )
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex
      }
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      
      return a.league_name.localeCompare(b.league_name)
    })
    
    return sortedLeagues
  } catch (error) {
    console.log('Error fetching leagues:', error)
    return []
  }
}

export async function fetchTeams(leagueId: string): Promise<Team[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/?action=get_teams&league_id=${leagueId}&APIkey=${API_KEY}`, {
      next: { revalidate: CACHE_TTL }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status}`)
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.log('Error fetching teams:', error)
    return []
  }
}

export async function fetchPlayers(teamId: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/?action=get_players&team_key=${teamId}&APIkey=${API_KEY}`, {
      next: { revalidate: CACHE_TTL }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error('Failed to fetch team details')
    }

    const data = await response.json()
    return data || []
  } catch (error) {
    console.log('Error fetching players:', error)
    return []
  }
}