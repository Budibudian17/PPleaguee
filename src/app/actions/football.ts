'use server'

import { fetchLeagues as apiFetchLeagues, fetchTeams as apiFetchTeams, League, Team } from '@/lib/football-api'

export async function getLeagues(): Promise<League[]> {
  return await apiFetchLeagues()
}

export async function getTeams(leagueId: number): Promise<Team[]> {
  return await apiFetchTeams(leagueId)
}