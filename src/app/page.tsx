'use client'

import { useState, useEffect } from 'react'
import { calculateStandings, getTopScorers, getTopAssists } from '@/lib/standings'
import { getMatches, getLeagueConfig } from '@/app/actions/admin'
import { Standing, TopScorer, TopAssist, Match, LeagueConfig } from '@/types'

export default function Home() {
  const [standings, setStandings] = useState<Standing[]>([])
  const [topScorers, setTopScorers] = useState<TopScorer[]>([])
  const [topAssists, setTopAssists] = useState<TopAssist[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [standingsData, scorersData, assistsData, matchesData, configData] = await Promise.all([
          calculateStandings(),
          getTopScorers(3),
          getTopAssists(3),
          getMatches(),
          getLeagueConfig()
        ])
        setStandings(standingsData)
        setTopScorers(scorersData)
        setTopAssists(assistsData)
        setMatches(matchesData)
        setLeagueConfig(configData as LeagueConfig | null)
      } catch (error) {
        // Error handling without console logging for security
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }
  
  // Filter matches based on tournament mode
  const leagueMatches = matches.filter((m: any) => m.phase === 'league')
  const groupMatches = matches.filter((m: any) => m.phase === 'group')
  const tournamentMatches = matches.filter((m: any) => m.phase === 'tournament')
  
  const leagueMatchesByRound: Record<number, any[]> = leagueMatches.reduce((acc: any, match: any) => {
    if (!acc[match.round]) {
      acc[match.round] = []
    }
    acc[match.round].push(match)
    return acc
  }, {} as Record<number, any[]>)

  // Group matches by group
  const groupMatchesByGroup: Record<string, any[]> = groupMatches.reduce((acc: any, match: any) => {
    const group = match.group || 'A'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(match)
    return acc
  }, {} as Record<string, any[]>)

  // Calculate group standings
  const groupStandings: Record<string, any[]> = {}
  Object.entries(groupMatchesByGroup).forEach(([group, matches]) => {
    const standingsMap = new Map<string, any>()
    
    // First, initialize all teams from matches (regardless of status)
    matches.forEach((match: any) => {
      if (!standingsMap.has(match.home_team_name)) {
        standingsMap.set(match.home_team_name, {
          team_name: match.home_team_name,
          team_logo: match.home_team_logo,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0
        })
      }
      if (!standingsMap.has(match.away_team_name)) {
        standingsMap.set(match.away_team_name, {
          team_name: match.away_team_name,
          team_logo: match.away_team_logo,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0
        })
      }
    })
    
    // Then update stats for played matches
    matches.forEach((match: any) => {
      if (match.status === 'played') {
        // Home team
        const homeStats = standingsMap.get(match.home_team_name)!
        homeStats.played += 1
        homeStats.goals_for += match.home_score
        homeStats.goals_against += match.away_score
        if (match.home_score > match.away_score) {
          homeStats.won += 1
          homeStats.points += 3
        } else if (match.home_score === match.away_score) {
          homeStats.drawn += 1
          homeStats.points += 1
        } else {
          homeStats.lost += 1
        }
        standingsMap.set(match.home_team_name, homeStats)
        
        // Away team
        const awayStats = standingsMap.get(match.away_team_name)!
        awayStats.played += 1
        awayStats.goals_for += match.away_score
        awayStats.goals_against += match.home_score
        if (match.away_score > match.home_score) {
          awayStats.won += 1
          awayStats.points += 3
        } else if (match.away_score === match.home_score) {
          awayStats.drawn += 1
          awayStats.points += 1
        } else {
          awayStats.lost += 1
        }
        standingsMap.set(match.away_team_name, awayStats)
      }
    })
    
    // Sort by points, then goal difference, then goals for, then alphabetically
    const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
      const aGD = a.goals_for - a.goals_against
      const bGD = b.goals_for - b.goals_against
      if (b.points !== a.points) return b.points - a.points
      if (bGD !== aGD) return bGD - aGD
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      return a.team_name.localeCompare(b.team_name)
    }).map((team, index) => ({ ...team, position: index + 1 }))
    
    groupStandings[group] = sortedStandings
  })

  // Tournament matches by round
  const tournamentMatchesByRound: Record<string, any[]> = {}
  tournamentMatches.forEach((match: any) => {
    const round = match.tournament_round || 'unknown'
    if (!tournamentMatchesByRound[round]) {
      tournamentMatchesByRound[round] = []
    }
    tournamentMatchesByRound[round].push(match)
  })

  return (
    <div className="min-h-screen bg-[#000000] text-white p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-2">
            PPLG LEAGUE
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">
            FC 26 Tournament Standings
          </p>
          {leagueConfig?.tournament_mode && (
            <div className="mt-2">
              <span className={`px-2 py-1 rounded-sm text-xs font-bold uppercase ${
                leagueConfig.tournament_mode === 'liga' ? 'bg-[#00FF66]/20 text-[#00FF66]' :
                leagueConfig.tournament_mode === 'knockout' ? 'bg-red-500/20 text-red-500' :
                'bg-blue-500/20 text-blue-500'
              }`}>
                {leagueConfig.tournament_mode === 'worldcup' ? 'GRUP TURNAMEN' : leagueConfig.tournament_mode}
              </span>
            </div>
          )}
        </div>

        {/* Knockout Mode - Show Bracket */}
        {leagueConfig?.tournament_mode === 'knockout' && (
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">BRACKET TURNAMEN</h2>
            </div>
            <div className="p-4">
              {Object.keys(tournamentMatchesByRound).length === 0 ? (
                <div className="text-center text-gray-500 text-sm">
                  Belum ada jadwal turnamen
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(tournamentMatchesByRound)
                    .sort(([a], [b]) => {
                      const order: Record<string, number> = { 'play_in': 1, 'quarter_final': 2, 'semi_final': 3, 'final': 4, 'third_place': 5 }
                      return (order[a] || 0) - (order[b] || 0)
                    })
                    .map(([round, roundMatches]) => (
                      <div key={round} className="mb-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
                          {round === 'play_in' ? 'PLAY-IN' :
                           round === 'quarter_final' ? 'PEREMPAT FINAL' :
                           round === 'semi_final' ? 'SEMI FINAL' :
                           round === 'final' ? 'FINAL' :
                           round === 'third_place' ? 'PEREBUTAN JUARA 3' : round.toUpperCase()}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {roundMatches.map((match: any) => (
                            <div key={match.id} className="bg-[#161616] border border-[#262626] rounded-sm p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex-1 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {match.home_team_logo && (
                                      <img src={match.home_team_logo} alt={match.home_team_name} className="w-6 h-6 object-contain" />
                                    )}
                                    <div className="font-medium text-white text-sm">{match.home_team_name}</div>
                                  </div>
                                </div>
                                <div className="mx-3">
                                  {match.status === 'played' ? (
                                    <span className="font-mono font-bold text-[#00FF66] text-sm">
                                      {match.home_score} - {match.away_score}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-gray-400 text-sm">VS</span>
                                  )}
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-white text-sm">{match.away_team_name}</div>
                                    {match.away_team_logo && (
                                      <img src={match.away_team_logo} alt={match.away_team_name} className="w-6 h-6 object-contain" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* World Cup Mode - Show Group Standings + Bracket */}
        {leagueConfig?.tournament_mode === 'worldcup' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Main Group Standings */}
            <div className="lg:col-span-2 w-full space-y-6">
              {Object.keys(groupStandings).length === 0 ? (
                <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden w-full">
                  <div className="px-4 py-3 border-b border-[#262626]">
                    <h2 className="text-lg font-bold uppercase tracking-wider">KLASEMEN GRUP</h2>
                  </div>
                  <div className="p-8 text-center text-gray-500">
                    Belum ada jadwal grup
                  </div>
                </div>
              ) : (
                Object.entries(groupStandings)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([group, standings]) => (
                  <div key={group} className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden w-full">
                    <div className="px-4 py-3 border-b border-[#262626]">
                      <h2 className="text-lg font-bold uppercase tracking-wider">KLASEMEN GRUP {group}</h2>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#161616] border-b border-[#262626]">
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">#</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Tim</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">M</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">M</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">S</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">K</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">GM</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">GK</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">SG</th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#262626]">
                          {standings.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                Belum ada data klasemen
                              </td>
                            </tr>
                          ) : (
                            standings.map((standing) => {
                              const getPositionColor = (pos: number) => {
                                switch(pos) {
                                  case 1: return { bg: 'bg-[#00FF66]/10', text: 'text-[#00FF66]', border: 'border-[#00FF66]/30' }
                                  case 2: return { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/30' }
                                  case 3: return { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/30' }
                                  default: return { bg: '', text: 'text-gray-300', border: '' }
                                }
                              }
                              const posColor = getPositionColor(standing.position)
                              
                              return (
                                <tr 
                                  key={standing.team_name} 
                                  className={`hover:bg-[#161616] transition-colors ${posColor.bg} ${standing.position <= 3 ? posColor.border + ' border-l-2' : ''}`}
                                >
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                                    <span className={`font-mono font-bold text-xs sm:text-sm ${posColor.text}`}>
                                      {standing.position}
                                    </span>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {standing.team_logo && (
                                        <img src={standing.team_logo} alt={standing.team_name} className="w-5 h-5 object-contain" />
                                      )}
                                      <span className="font-medium text-white text-xs sm:text-sm">{standing.team_name}</span>
                                    </div>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{standing.played}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{standing.won}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{standing.drawn}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden sm:table-cell">{standing.lost}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden md:table-cell">{standing.goals_for}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden md:table-cell">{standing.goals_against}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono text-gray-400 text-xs sm:text-sm hidden md:table-cell">{standing.goals_for - standing.goals_against}</td>
                                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center font-mono font-bold text-white text-xs sm:text-sm">{standing.points}</td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                      <div className="px-4 py-3 border-t border-[#262626] flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#00FF66] rounded-sm"></div>
                          <span className="text-gray-300">Posisi 1</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#3B82F6] rounded-sm"></div>
                          <span className="text-gray-300">Posisi 2</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-[#F59E0B] rounded-sm"></div>
                          <span className="text-gray-300">Posisi 3</span>
                        </div>
                        <span className="text-gray-500 ml-2">- Lolos Knockout</span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Tournament Bracket */}
              {Object.keys(tournamentMatchesByRound).length > 0 && (
                <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden w-full">
                  <div className="px-4 py-3 border-b border-[#262626]">
                    <h2 className="text-lg font-bold uppercase tracking-wider">BRACKET KNOCKOUT</h2>
                  </div>
                  <div className="p-4">
                    <div className="space-y-6">
                      {Object.entries(tournamentMatchesByRound)
                        .sort(([a], [b]) => {
                          const order: Record<string, number> = { 'quarter_final': 1, 'semi_final': 2, 'final': 3, 'third_place': 4 }
                          return (order[a] || 0) - (order[b] || 0)
                        })
                        .map(([round, roundMatches]) => (
                          <div key={round} className="mb-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
                              {round === 'quarter_final' ? 'PEREMPAT FINAL' :
                               round === 'semi_final' ? 'SEMI FINAL' :
                               round === 'final' ? 'FINAL' :
                               round === 'third_place' ? 'PEREBUTAN JUARA 3' : round.toUpperCase()}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {roundMatches.map((match: any) => (
                                <div key={match.id} className="bg-[#161616] border border-[#262626] rounded-sm p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        {match.home_team_logo && (
                                          <img src={match.home_team_logo} alt={match.home_team_name} className="w-6 h-6 object-contain" />
                                        )}
                                        <div className="font-medium text-white text-sm">{match.home_team_name}</div>
                                      </div>
                                    </div>
                                    <div className="mx-3">
                                      {match.status === 'played' ? (
                                        <span className="font-mono font-bold text-[#00FF66] text-sm">
                                          {match.home_score} - {match.away_score}
                                        </span>
                                      ) : (
                                        <span className="font-mono text-gray-400 text-sm">VS</span>
                                      )}
                                    </div>
                                    <div className="flex-1 text-left">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium text-white text-sm">{match.away_team_name}</div>
                                        {match.away_team_logo && (
                                          <img src={match.away_team_logo} alt={match.away_team_name} className="w-6 h-6 object-contain" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Side Stats */}
            <div className="lg:col-span-1 space-y-6">
              {/* Top Scorers */}
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">TOP SCORERS</h2>
                </div>
                <div className="p-4">
                  {topScorers.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">
                      Belum ada data gol
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topScorers.map((scorer: any, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-[#161616] border border-[#262626] rounded-sm p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#00FF66] text-xs">{index + 1}</span>
                            <span className="text-white text-xs">{scorer.player_name}</span>
                          </div>
                          <span className="font-mono text-white text-xs">{scorer.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Assists */}
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">TOP ASSISTS</h2>
                </div>
                <div className="p-4">
                  {topAssists.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">
                      Belum ada data assist
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topAssists.map((assist: any, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-[#161616] border border-[#262626] rounded-sm p-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#3B82F6] text-xs">{index + 1}</span>
                            <span className="text-white text-xs">{assist.player_name}</span>
                          </div>
                          <span className="font-mono text-white text-xs">{assist.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Group Matches Schedule */}
              {Object.keys(groupMatchesByGroup).length > 0 && (
                <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#262626]">
                    <h2 className="text-lg font-bold uppercase tracking-wider">JADWAL GRUP</h2>
                  </div>
                  <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                    {Object.entries(groupMatchesByGroup)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([group, groupMatches]) => (
                      <div key={group}>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                          GRUP {group}
                        </h3>
                        <div className="space-y-2">
                          {groupMatches.map((match: any) => (
                            <div key={match.id} className="bg-[#161616] border border-[#262626] rounded-sm p-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 text-right">
                                  <div className="font-medium text-white text-xs">{match.home_team_name}</div>
                                </div>
                                <div className="mx-2">
                                  {match.status === 'played' ? (
                                    <span className="font-mono font-bold text-[#00FF66] text-xs">
                                      {match.home_score} - {match.away_score}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-gray-400 text-xs">VS</span>
                                  )}
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="font-medium text-white text-xs">{match.away_team_name}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Liga Mode - Default Standings */}
        {(!leagueConfig?.tournament_mode || leagueConfig.tournament_mode === 'liga') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Main Standings Table */}
            <div className="lg:col-span-2 w-full">
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden w-full">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">KLASEMEN</h2>
                </div>
              
              <div className="overflow-x-auto w-full">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#161616] border-b border-[#262626]">
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">#</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Tim</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">Mn</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">M</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">S</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden sm:table-cell">K</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">GM</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">GK</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono hidden md:table-cell">SG</th>
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626]">
                    {standings.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                          Belum ada data klasemen. Daftarkan tim untuk memulai.
                        </td>
                      </tr>
                    ) : (
                      standings.map((standing) => {
                        const getPositionColor = (pos: number) => {
                          switch(pos) {
                            case 1: return { bg: 'bg-[#00FF66]/10', text: 'text-[#00FF66]', border: 'border-[#00FF66]/30' }
                            case 2: return { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/30' }
                            case 3: return { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/30' }
                            case 4: return { bg: 'bg-[#8B5CF6]/10', text: 'text-[#8B5CF6]', border: 'border-[#8B5CF6]/30' }
                            default: return { bg: '', text: 'text-gray-300', border: '' }
                          }
                        }
                        const posColor = getPositionColor(standing.position)
                        
                        return (
                        <tr 
                          key={standing.team_name} 
                          className={`hover:bg-[#161616] transition-colors ${posColor.bg} ${standing.position <= 4 ? posColor.border + ' border-l-2' : ''}`}
                        >
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                            <span className={`font-mono font-bold text-xs sm:text-sm ${posColor.text}`}>
                              {standing.position}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {standing.team_logo && (
                                <img src={standing.team_logo} alt={standing.team_name} className="w-6 h-6 object-contain" />
                              )}
                              <div>
                                <div className="font-medium text-white text-xs sm:text-sm">{standing.team_name}</div>
                                <div className="text-xs text-gray-500 hidden sm:block">{standing.user_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden sm:table-cell text-xs sm:text-sm">
                            {standing.played}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden sm:table-cell text-xs sm:text-sm">
                            {standing.won}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden sm:table-cell text-xs sm:text-sm">
                            {standing.drawn}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden sm:table-cell text-xs sm:text-sm">
                            {standing.lost}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden md:table-cell text-xs sm:text-sm">
                            {standing.goals_for}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden md:table-cell text-xs sm:text-sm">
                            {standing.goals_against}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono text-gray-300 hidden md:table-cell text-xs sm:text-sm">
                            {standing.goal_difference > 0 ? '+' : ''}{standing.goal_difference}
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center font-mono font-bold text-[#00FF66] text-xs sm:text-sm">
                            {standing.points}
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
                
                {/* Legend at bottom of table */}
                <div className="px-4 py-3 border-t border-[#262626] bg-[#161616]">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#00FF66] rounded-sm"></div>
                      <span className="text-gray-300">Posisi 1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#3B82F6] rounded-sm"></div>
                      <span className="text-gray-300">Posisi 2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#F59E0B] rounded-sm"></div>
                      <span className="text-gray-300">Posisi 3</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-[#8B5CF6] rounded-sm"></div>
                      <span className="text-gray-300">Posisi 4</span>
                    </div>
                    <span className="text-gray-500 ml-2">- Lolos Turnamen</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Stats */}
          <div className="lg:col-span-1 space-y-6">
              {/* Top Scorers */}
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">TOP SCORERS</h2>
                </div>
                <div className="p-4">
                  {topScorers.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">
                      Belum ada data gol
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {topScorers.map((scorer, index) => (
                        <div key={index} className="flex-1 bg-[#161616] border border-[#262626] rounded-sm p-3">
                          <div className="flex items-center justify-center mb-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              index === 0 ? 'bg-[#00FF66] text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              'bg-amber-600 text-black'
                            }`}>
                              {index + 1}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-white text-xs mb-1">{scorer.player_name}</div>
                            <div className="text-xs text-gray-500 mb-2">{scorer.team_name}</div>
                            <div className="font-mono font-bold text-[#00FF66] text-sm">
                              {scorer.goals} Goals
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top Assists */}
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">TOP ASSISTS</h2>
                </div>
                <div className="p-4">
                  {topAssists.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">
                      Belum ada data assist
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {topAssists.map((assist, index) => (
                        <div key={index} className="flex-1 bg-[#161616] border border-[#262626] rounded-sm p-3">
                          <div className="flex items-center justify-center mb-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              index === 0 ? 'bg-[#00FF66] text-black' :
                              index === 1 ? 'bg-gray-400 text-black' :
                              'bg-amber-600 text-black'
                            }`}>
                              {index + 1}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-white text-xs mb-1">{assist.player_name}</div>
                            <div className="text-xs text-gray-500 mb-2">{assist.team_name}</div>
                            <div className="font-mono font-bold text-[#00FF66] text-sm">
                              {assist.assists} Assists
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* League Schedule */}
              <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#262626]">
                  <h2 className="text-lg font-bold uppercase tracking-wider">JADWAL LIGA</h2>
                </div>
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                  {Object.keys(leagueMatchesByRound).length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">
                      Belum ada jadwal liga
                    </div>
                  ) : (
                    Object.entries(leagueMatchesByRound)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([round, roundMatches]) => (
                        <div key={round} className="mb-3">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">
                            PEKAN {round}
                          </h3>
                          {roundMatches
                            .sort((a: any, b: any) => a.home_team_name.localeCompare(b.home_team_name))
                            .map((match: any) => (
                            <div key={match.id} className="bg-[#161616] border border-[#262626] rounded-sm p-2 mb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 text-right">
                                  <div className="font-medium text-white text-xs">{match.home_team_name}</div>
                                </div>
                                <div className="mx-2">
                                  {match.status === 'played' ? (
                                    <span className="font-mono font-bold text-[#00FF66] text-xs">
                                      {match.home_score} - {match.away_score}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-gray-400 text-xs">VS</span>
                                  )}
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="font-medium text-white text-xs">{match.away_team_name}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}