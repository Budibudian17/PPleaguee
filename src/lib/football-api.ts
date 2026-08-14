// Football API Service for fetching leagues and teams

const API_BASE_URL = 'https://api.football-data.org/v4'
const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_API_KEY || ''

export interface League {
  id: number
  name: string
  code: string
  areaName: string
}

export interface Team {
  id: number
  name: string
  shortName: string
  crest: string
  address: string
  website: string
  founded: number
  clubColors: string
}

// Server-side API functions (Server Actions)
export async function fetchLeagues(): Promise<League[]> {
  try {
    console.log('Fetching leagues with API key:', API_KEY ? 'Set' : 'Not set')
    
    const response = await fetch(`${API_BASE_URL}/competitions`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      // Add cache control
      cache: 'no-store',
    })

    console.log('Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', errorText)
      throw new Error(`Failed to fetch leagues: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Leagues fetched:', data.competitions?.length || 0)
    return data.competitions || []
  } catch (error) {
    console.error('Error fetching leagues:', error)
    return []
  }
}

export async function fetchTeams(leagueId: number): Promise<Team[]> {
  try {
    console.log('Fetching teams for league:', leagueId)
    
    const response = await fetch(`${API_BASE_URL}/competitions/${leagueId}/teams`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      cache: 'no-store',
    })

    console.log('Teams response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', errorText)
      throw new Error(`Failed to fetch teams: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Teams fetched:', data.teams?.length || 0)
    return data.teams || []
  } catch (error) {
    console.error('Error fetching teams:', error)
    return []
  }
}

export async function fetchPlayers(teamId: number): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch team details')
    }

    const data = await response.json()
    return data.squad || []
  } catch (error) {
    console.error('Error fetching players:', error)
    return []
  }
}