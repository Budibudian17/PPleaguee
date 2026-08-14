// Football API Service for fetching leagues and teams

const API_BASE_URL = 'https://api.football-data.org/v4'
const API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_API_KEY || ''

// Cache configuration
const CACHE_TTL = 3600 // 1 hour cache for leagues/teams

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

// Server-side API functions (Server Actions) with caching
export async function fetchLeagues(): Promise<League[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/competitions`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      next: { revalidate: CACHE_TTL }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch leagues: ${response.status}`)
    }

    const data = await response.json()
    return data.competitions || []
  } catch (error) {
    console.log('Error fetching leagues:', error)
    return []
  }
}

export async function fetchTeams(leagueId: number): Promise<Team[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/competitions/${leagueId}/teams`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      next: { revalidate: CACHE_TTL }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch teams: ${response.status}`)
    }

    const data = await response.json()
    return data.teams || []
  } catch (error) {
    console.log('Error fetching teams:', error)
    return []
  }
}

export async function fetchPlayers(teamId: number): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
      headers: {
        'X-Auth-Token': API_KEY,
      },
      next: { revalidate: CACHE_TTL }, // Cache for 1 hour
    })

    if (!response.ok) {
      throw new Error('Failed to fetch team details')
    }

    const data = await response.json()
    return data.squad || []
  } catch (error) {
    console.log('Error fetching players:', error)
    return []
  }
}