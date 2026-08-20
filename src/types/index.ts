export interface User {
  id: string
  name: string
  team_name: string
  team_id: number // API team ID
  team_logo: string // API team logo URL
  team_short_name: string // API team short name
  league_id: number // API league ID
  league_name: string // API league name
  created_at: any // Firestore Timestamp
}

export interface GamePlayer {
  id: string
  user_id: string
  team_name: string
  player_name: string // For backward compatibility
  long_name?: string
  short_name?: string
  club_position?: string
  club_jersey_number?: number
  overall?: number
  potential?: number
  age?: number
  created_at: any // Firestore Timestamp
}

export interface Match {
  id: string
  home_user_id: string
  away_user_id: string
  home_team_name: string
  away_team_name: string
  home_team_logo: string
  away_team_logo: string
  home_team_short_name: string
  away_team_short_name: string
  home_score: number | null
  away_score: number | null
  status: 'scheduled' | 'played'
  round: number
  phase: 'league' | 'tournament' | 'group'
  tournament_round?: 'play_in' | 'quarter_final' | 'semi_final' | 'final' | 'third_place' | 'group_stage'
  group?: 'A' | 'B'
  updated_at: any // Firestore Timestamp
}

export interface LeagueConfig {
  id: string
  status: 'registration' | 'league_ongoing' | 'league_completed' | 'tournament_ongoing' | 'tournament_completed' | 'group_ongoing'
  tournament_mode?: 'liga' | 'knockout' | 'worldcup'
  top_4_qualification: boolean
  qualified_teams: string[]
  tournament_started: boolean
  home_away?: boolean
  updated_at: any // Firestore Timestamp
}

export interface Stat {
  id: string
  match_id: string
  player_name: string
  team_name: string
  type: 'goal' | 'assist'
  count: number
  minute?: number // Goal/assist minute
  created_at?: any // Firestore Timestamp
}

export interface Standing {
  position: number
  user_name: string
  team_name: string
  team_logo: string
  team_short_name: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface TopScorer {
  player_name: string
  team_name: string
  goals: number
}

export interface TopAssist {
  player_name: string
  team_name: string
  assists: number
}