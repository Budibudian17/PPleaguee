'use client'

import { useState, useEffect } from 'react'
import { getMatches, getLeagueConfig } from '@/app/actions/admin'
import { LeagueConfig } from '@/types'

export default function FixturesPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null)

  const loadMatches = async () => {
    const matchesData = await getMatches()
    setMatches(matchesData as any[])
  }

  const loadLeagueConfig = async () => {
    const configData = await getLeagueConfig()
    setLeagueConfig(configData as LeagueConfig | null)
  }

  useEffect(() => {
    loadMatches()
    loadLeagueConfig()
  }, [])

  // Filter tournament matches
  const tournamentMatches = matches.filter(m => m.phase === 'tournament')

  // Group by round
  const tournamentMatchesByRound: Record<string, any[]> = {}
  tournamentMatches.forEach((match: any) => {
    const round = match.tournament_round || 'unknown'
    if (!tournamentMatchesByRound[round]) {
      tournamentMatchesByRound[round] = []
    }
    tournamentMatchesByRound[round].push(match)
  })

  // Component Card untuk Render Match Item (View Only)
  const MatchCard = ({ match, isCenter = false }: { match?: any; isCenter?: boolean }) => {
    if (!match) {
      return (
        <div className="bg-[#161616] border border-[#262626] border-dashed rounded-sm p-3 opacity-40 text-center">
          <span className="text-[11px] text-gray-500 font-mono">TBD</span>
        </div>
      )
    }

    const isPlayed = match.status === 'played'
    const homeWins = isPlayed && match.home_score > match.away_score
    const awayWins = isPlayed && match.away_score > match.home_score

    return (
      <div
        className={`relative bg-[#161616] border ${
          isCenter ? 'border-[#00FF66]/40' : 'border-[#262626]'
        } rounded-sm p-2.5 transition-all duration-200 z-10`}
      >
        {/* Home Team */}
        <div className="flex items-center justify-between py-1 border-b border-[#222]">
          <div className="flex items-center gap-2 truncate pr-2">
            {match.home_team_logo && (
              <img src={match.home_team_logo} alt={match.home_team_name} className="w-4 h-4 object-contain flex-shrink-0" />
            )}
            <span className={`text-xs truncate ${homeWins ? 'text-[#00FF66] font-bold' : 'text-gray-200 font-medium'}`}>
              {match.home_team_name || 'TBD'}
            </span>
          </div>
          <span className={`font-mono text-xs ${homeWins ? 'text-[#00FF66] font-bold' : 'text-gray-400'}`}>
            {isPlayed ? match.home_score : '-'}
          </span>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 truncate pr-2">
            {match.away_team_logo && (
              <img src={match.away_team_logo} alt={match.away_team_name} className="w-4 h-4 object-contain flex-shrink-0" />
            )}
            <span className={`text-xs truncate ${awayWins ? 'text-[#00FF66] font-bold' : 'text-gray-200 font-medium'}`}>
              {match.away_team_name || 'TBD'}
            </span>
          </div>
          <span className={`font-mono text-xs ${awayWins ? 'text-[#00FF66] font-bold' : 'text-gray-400'}`}>
            {isPlayed ? match.away_score : '-'}
          </span>
        </div>
      </div>
    )
  }

  // Visual Tree Bracket Component (World Cup / FIFA Pathways Style)
  const renderSymmetricalBracket = () => {
    const qf = tournamentMatchesByRound['quarter_final'] || []
    const sf = tournamentMatchesByRound['semi_final'] || []
    const finalMatch = (tournamentMatchesByRound['final'] || [])[0]
    const thirdPlaceMatch = (tournamentMatchesByRound['third_place'] || [])[0]

    // For World Cup mode, calculate group standings to show bye teams in semifinal
    let groupATop1User = null
    let groupBTop1User = null
    let totalParticipants = 0

    if (leagueConfig?.tournament_mode === 'worldcup') {
      const groupMatches = matches.filter(m => m.phase === 'group')
      const groupAStandings = new Map<string, { points: number, goalDiff: number, goalsFor: number, teamName: string, teamLogo: string }>()
      const groupBStandings = new Map<string, { points: number, goalDiff: number, goalsFor: number, teamName: string, teamLogo: string }>()

      // Count unique participants
      const participantSet = new Set<string>()
      groupMatches.forEach((match: any) => {
        participantSet.add(match.home_user_id)
        participantSet.add(match.away_user_id)
      })
      totalParticipants = participantSet.size

      groupMatches.forEach((match: any) => {
        const standings = match.group === 'A' ? groupAStandings : groupBStandings
        const homeStanding = standings.get(match.home_user_id) || { points: 0, goalDiff: 0, goalsFor: 0, teamName: match.home_team_name, teamLogo: match.home_team_logo }
        const awayStanding = standings.get(match.away_user_id) || { points: 0, goalDiff: 0, goalsFor: 0, teamName: match.away_team_name, teamLogo: match.away_team_logo }

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
          .map(entry => ({ id: entry[0], ...entry[1] }))
      }

      groupATop1User = getTop1(groupAStandings)[0]
      groupBTop1User = getTop1(groupBStandings)[0]
    }

    // Bagi perempat final dan semifinal ke kiri (Left) & kanan (Right)
    const qfLeft = qf.slice(0, Math.ceil(qf.length / 2))
    const qfRight = qf.slice(Math.ceil(qf.length / 2))
    const sfLeft = sf[0]
    const sfRight = sf[1]

    // Create placeholder semifinal matches for World Cup mode if they don't exist
    const createPlaceholderSemi = (byeTeam: any, opponentLabel: string = 'Pemenang QF') => ({
      id: 'placeholder',
      home_user_id: null,
      away_user_id: byeTeam?.id,
      home_team_name: opponentLabel,
      away_team_name: byeTeam?.teamName || 'TBD',
      home_team_logo: '',
      away_team_logo: byeTeam?.teamLogo || '',
      status: 'scheduled',
      home_score: null,
      away_score: null
    })

    // For 4 people: show top 1 from each group as semifinalists (no QF)
    // For 6+ people: show bye teams as semifinalists
    // For 5 people: show QF winners as semifinalists
    const displaySfLeft = sfLeft || (groupATop1User && (totalParticipants === 4 || totalParticipants >= 6) ? createPlaceholderSemi(groupATop1User, totalParticipants === 4 ? 'Top 1 Grup B' : 'Pemenang QF') : null)
    const displaySfRight = sfRight || (groupBTop1User && (totalParticipants === 4 || totalParticipants >= 6) ? createPlaceholderSemi(groupBTop1User, totalParticipants === 4 ? 'Top 1 Grup A' : 'Pemenang QF') : null)

    return (
      <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-wider">BRACKET TURNAMEN</h2>
          <span className="text-xs text-gray-500 uppercase tracking-widest hidden sm:inline">
            Scroll horizontal jika layar sempit ➔
          </span>
        </div>

        <div className="p-6 overflow-x-auto">
          <div className="min-w-[1000px] flex items-center justify-between gap-2 py-4">
            
            {/* === KIRI: QUARTER FINALS === */}
            {qfLeft.length > 0 && (
              <div className="flex-1 flex flex-col justify-around gap-12 relative">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-[#262626] pb-1">
                  PEREMPAT FINAL
                </div>
                {qfLeft.map((match, idx) => (
                  <div key={match.id || idx} className="relative flex items-center">
                    <div className="w-full">
                      <MatchCard match={match} />
                    </div>
                    {/* Horizontal connector ke kanan */}
                    <div className="w-6 h-[2px] bg-[#333]" />
                  </div>
                ))}
              </div>
            )}

            {/* === KIRI: SEMI FINAL === */}
            {(displaySfLeft || qfLeft.length > 0) && (
              <div className="flex-1 flex flex-col justify-center relative">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-[#262626] pb-1">
                  SEMI FINAL
                </div>
                <div className="relative flex items-center my-auto">
                  {/* Garis cabang penyambung dari QF Kiri */}
                  <div className="w-6 h-[2px] bg-[#333]" />
                  <div className="w-full">
                    <MatchCard match={displaySfLeft} />
                  </div>
                  <div className="w-6 h-[2px] bg-[#333]" />
                </div>
              </div>
            )}

            {/* === TENGAH: FINAL & JUARA 3 === */}
            <div className="w-[220px] flex flex-col justify-center items-center gap-8 relative px-2">
              {/* FINAL */}
              <div className="w-full text-center">
                <div className="text-xs font-extrabold text-[#00FF66] uppercase tracking-widest mb-2 border-b border-[#00FF66]/30 pb-1">
                  ★ FINAL ★
                </div>
                <MatchCard match={finalMatch} isCenter={true} />
              </div>

              {/* JUARA 3 (Jika Ada) */}
              {thirdPlaceMatch && (
                <div className="w-full text-center">
                  <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1">
                    PEREBUTAN JUARA 3
                  </div>
                  <MatchCard match={thirdPlaceMatch} />
                </div>
              )}
            </div>

            {/* === KANAN: SEMI FINAL === */}
            {(displaySfRight || qfRight.length > 0) && (
              <div className="flex-1 flex flex-col justify-center relative">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-[#262626] pb-1">
                  SEMI FINAL
                </div>
                <div className="relative flex items-center my-auto">
                  <div className="w-6 h-[2px] bg-[#333]" />
                  <div className="w-full">
                    <MatchCard match={displaySfRight} />
                  </div>
                  <div className="w-6 h-[2px] bg-[#333]" />
                </div>
              </div>
            )}

            {/* === KANAN: QUARTER FINALS === */}
            {qfRight.length > 0 && (
              <div className="flex-1 flex flex-col justify-around gap-12 relative">
                <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-[#262626] pb-1">
                  PEREMPAT FINAL
                </div>
                {qfRight.map((match, idx) => (
                  <div key={match.id || idx} className="relative flex items-center">
                    <div className="w-6 h-[2px] bg-[#333]" />
                    <div className="w-full">
                      <MatchCard match={match} />
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        {/* Header Title */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-2">
            PPLG LEAGUE
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">
            JADWAL PERTANDINGAN
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

        {/* Section Render Bracket */}
        {leagueConfig?.tournament_mode === 'worldcup' ? (
          leagueConfig.status === 'tournament_ongoing' && Object.keys(tournamentMatchesByRound).length > 0 ? (
            renderSymmetricalBracket()
          ) : (
            <div className="bg-[#121212] border border-[#262626] rounded-sm p-8 text-center">
              <p className="text-gray-500">
                {leagueConfig.status === 'group_ongoing' 
                  ? 'Selesaikan semua pertandingan grup terlebih dahulu untuk melihat bracket turnamen.' 
                  : 'Belum ada bracket turnamen.'}
              </p>
            </div>
          )
        ) : (
          Object.keys(tournamentMatchesByRound).length > 0 ? (
            renderSymmetricalBracket()
          ) : (
            <div className="bg-[#121212] border border-[#262626] rounded-sm p-8 text-center">
              <p className="text-gray-500">
                Belum ada bracket turnamen. Selesaikan liga dan admin akan generate bracket turnamen.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  )
}