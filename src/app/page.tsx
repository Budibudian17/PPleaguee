import { calculateStandings, getTopScorers, getTopAssists } from '@/lib/standings'
import { getMatches } from '@/app/actions/admin'
import { Standing, TopScorer, TopAssist, Match } from '@/types'

export default async function Home() {
  const standings: Standing[] = await calculateStandings()
  const topScorers: TopScorer[] = await getTopScorers(3)
  const topAssists: TopAssist[] = await getTopAssists(3)
  const matches: any[] = await getMatches()
  
  // Filter only league matches and group by round
  const leagueMatches = matches.filter((m: any) => m.phase === 'league')
  const leagueMatchesByRound = leagueMatches.reduce((acc: any, match: any) => {
    if (!acc[match.round]) {
      acc[match.round] = []
    }
    acc[match.round].push(match)
    return acc
  }, {} as Record<number, any[]>)

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
        </div>

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
                      standings.map((standing) => (
                        <tr 
                          key={standing.team_name} 
                          className={`hover:bg-[#161616] transition-colors ${
                            standing.position === 1 ? 'bg-[#00FF66]/10' : ''
                          }`}
                        >
                          <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">
                            <span className={`font-mono font-bold text-xs sm:text-sm ${
                              standing.position === 1 ? 'text-[#00FF66]' : 'text-gray-300'
                            }`}>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Side Stats */}
          <div className="space-y-6">
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
                          .sort((a, b) => a.home_team_name.localeCompare(b.home_team_name))
                          .map((match) => (
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
      </div>
    </div>
  )
}