'use client'

import { useState, useEffect } from 'react'
import { getMatches, getMatchStats, updateMatchScore, getGamePlayers, verifyAdminPin, getLeagueConfig } from '@/app/actions/admin'
import { Match, Stat, GamePlayer, LeagueConfig } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import Alert from '@/components/Alert'

interface MatchWithTeams extends Omit<Match, 'tournament_round'> {
  home_team_name: string
  away_team_name: string
  phase: 'league' | 'tournament' | 'group'
  tournament_round?: 'play_in' | 'quarter_final' | 'semi_final' | 'final' | 'third_place'
  group?: 'A' | 'B'
}

export default function FixturesPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [pinVerified, setPinVerified] = useState(false)
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
  const [stats, setStats] = useState<{ player_name: string; team_name: string; type: 'goal' | 'assist'; count: number }[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([])
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false)
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null)

  const loadMatches = async () => {
    const matchesData = await getMatches()
    setMatches(matchesData as any[])
  }

  const loadGamePlayers = async () => {
    const playersData = await getGamePlayers()
    setGamePlayers(playersData as GamePlayer[])
  }

  const loadLeagueConfig = async () => {
    const configData = await getLeagueConfig()
    setLeagueConfig(configData as LeagueConfig | null)
  }

  useEffect(() => {
    loadMatches()
    loadGamePlayers()
    loadLeagueConfig()
  }, [])

  const handleInputResult = async (match: any) => {
    setSelectedMatch(match)
    setShowModal(true)
    setPinVerified(false)
    setAdminPin('')
    setHomeScore(match.home_score || 0)
    setAwayScore(match.away_score || 0)
    
    // Load existing stats for this match
    const existingStats = await getMatchStats(match.id)
    setStats(existingStats.map(stat => ({
      player_name: stat.player_name,
      team_name: stat.team_name,
      type: stat.type,
      count: stat.count
    })))
  }

  const handleVerifyPin = async () => {
    const isValid = await verifyAdminPin(adminPin)
    if (isValid) {
      setPinVerified(true)
      setMessage(null)
    } else {
      setMessage({ type: 'error', text: 'PIN Admin salah' })
    }
  }

  const handleAddStat = () => {
    setStats([...stats, { player_name: '', team_name: '', type: 'goal', count: 1 }])
  }

  const handleRemoveStat = (index: number) => {
    const newStats = stats.filter((_, i) => i !== index)
    setStats(newStats)
  }

  const handleUpdateStat = (index: number, field: keyof typeof stats[0], value: any) => {
    const newStats = [...stats]
    newStats[index] = { ...newStats[index], [field]: value }
    setStats(newStats)
  }

  const handleSubmitScore = async () => {
    if (!selectedMatch) return
    setShowSubmitConfirmModal(true)
  }

  const confirmSubmitScore = async () => {
    setShowSubmitConfirmModal(false)
    if (!selectedMatch) return

    setIsLoading(true)
    setMessage(null)

    const result = await updateMatchScore(
      selectedMatch.id,
      homeScore,
      awayScore,
      stats,
      adminPin
    )

    if (result.success) {
      setMessage({ type: 'success', text: 'Skor berhasil diupdate!' })
      setShowModal(false)
      await loadMatches()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal update skor' })
    }

    setIsLoading(false)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedMatch(null)
    setPinVerified(false)
    setAdminPin('')
    setMessage(null)
  }

  // Group matches by phase and round
  const leagueMatches = matches.filter(m => m.phase === 'league')
  const groupMatches = matches.filter(m => m.phase === 'group')
  const tournamentMatches = matches.filter(m => m.phase === 'tournament')

  // Group matches by group for World Cup mode
  const groupMatchesByGroup: Record<string, any[]> = groupMatches.reduce((acc: any, match: any) => {
    const group = match.group || 'A'
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(match)
    return acc
  }, {} as Record<string, any[]>)

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


        {/* Tournament Bracket - Only show after group stage completed for World Cup */}
        {leagueConfig?.tournament_mode === 'worldcup' ? (
          // For World Cup, only show bracket if status is tournament_ongoing (group stage completed)
          leagueConfig.status === 'tournament_ongoing' && Object.keys(tournamentMatchesByRound).length > 0 ? (
            <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262626]">
                <h2 className="text-lg font-bold uppercase tracking-wider">BRACKET TURNAMEN</h2>
              </div>
              <div className="p-4">
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
                            <div 
                              key={match.id} 
                              className="bg-[#161616] border border-[#262626] rounded-sm p-3 cursor-pointer hover:border-[#00FF66] transition-colors"
                              onClick={() => handleInputResult(match)}
                            >
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
          // For other modes (Knockout, Liga)
          Object.keys(tournamentMatchesByRound).length > 0 ? (
            <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262626]">
                <h2 className="text-lg font-bold uppercase tracking-wider">BRACKET TURNAMEN</h2>
              </div>
              <div className="p-4">
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
                            <div 
                              key={match.id} 
                              className="bg-[#161616] border border-[#262626] rounded-sm p-3 cursor-pointer hover:border-[#00FF66] transition-colors"
                              onClick={() => handleInputResult(match)}
                            >
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
          ) : (
            <div className="bg-[#121212] border border-[#262626] rounded-sm p-8 text-center">
              <p className="text-gray-500">
                Belum ada bracket turnamen. Selesaikan liga dan admin akan generate bracket turnamen.
              </p>
            </div>
          )
        )}

        {/* Modal */}
        {showModal && selectedMatch && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
                <h2 className="text-lg font-bold uppercase tracking-wider">
                  INPUT HASIL PERTANDINGAN
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Match Info */}
                <div className="bg-[#161616] border border-[#262626] rounded-sm p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="font-bold text-white">{selectedMatch.home_team_name}</div>
                    </div>
                    <div className="mx-4 text-center">
                      <div className="text-sm text-gray-400 mb-2">SKOR AKHIR</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={homeScore}
                          onChange={(e) => setHomeScore(parseInt(e.target.value) || 0)}
                          disabled={!pinVerified}
                          className="w-16 bg-[#121212] border border-[#262626] rounded-sm px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-[#00FF66] disabled:opacity-50"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="number"
                          min="0"
                          value={awayScore}
                          onChange={(e) => setAwayScore(parseInt(e.target.value) || 0)}
                          disabled={!pinVerified}
                          className="w-16 bg-[#121212] border border-[#262626] rounded-sm px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-[#00FF66] disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="text-center flex-1">
                      <div className="font-bold text-white">{selectedMatch.away_team_name}</div>
                    </div>
                  </div>
                </div>

                {!pinVerified ? (
                  /* PIN Verification */
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                      PIN Admin
                    </label>
                    <input
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors"
                      placeholder="Masukkan PIN"
                    />
                    <button
                      onClick={handleVerifyPin}
                      className="mt-4 w-full bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors"
                    >
                      Verifikasi PIN
                    </button>
                  </div>
                ) : (
                  /* Stats Input */
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                          STATISTIK PEMAIN GAME
                        </h3>
                        <button
                          onClick={handleAddStat}
                          className="text-xs bg-[#161616] border border-[#262626] text-white px-3 py-1 rounded-sm hover:border-[#00FF66] transition-colors"
                        >
                          + Tambah
                        </button>
                      </div>
                      
                      {stats.map((stat, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <select
                            value={stat.player_name}
                            onChange={(e) => {
                              const selectedPlayer = gamePlayers.find(p => p.player_name === e.target.value)
                              handleUpdateStat(index, 'player_name', e.target.value)
                              if (selectedPlayer) {
                                handleUpdateStat(index, 'team_name', selectedPlayer.team_name)
                              }
                            }}
                            className="flex-1 bg-[#161616] border border-[#262626] rounded-sm px-3 py-2 text-white focus:outline-none focus:border-[#00FF66] text-sm"
                          >
                            <option value="">Pilih Pemain Game</option>
                            {gamePlayers.map(player => (
                              <option key={player.id} value={player.player_name}>
                                {player.player_name} ({player.team_name})
                              </option>
                            ))}
                          </select>
                          
                          <select
                            value={stat.type}
                            onChange={(e) => handleUpdateStat(index, 'type', e.target.value)}
                            className="bg-[#161616] border border-[#262626] rounded-sm px-3 py-2 text-white focus:outline-none focus:border-[#00FF66] text-sm"
                          >
                            <option value="goal">Gol</option>
                            <option value="assist">Assist</option>
                          </select>
                          
                          <input
                            type="number"
                            min="1"
                            value={stat.count}
                            onChange={(e) => handleUpdateStat(index, 'count', parseInt(e.target.value) || 1)}
                            className="w-16 bg-[#161616] border border-[#262626] rounded-sm px-3 py-2 text-white focus:outline-none focus:border-[#00FF66] text-sm font-mono text-center"
                          />
                          
                          <button
                            onClick={() => handleRemoveStat(index)}
                            className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-2 rounded-sm hover:bg-red-500/20 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSubmitScore}
                      disabled={isLoading}
                      className="w-full bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Memproses...' : 'Simpan Hasil'}
                    </button>
                  </div>
                )}

                {message && (
                  <Alert 
                    type={message.type as 'success' | 'error' | 'info'} 
                    message={message.text}
                    onClose={() => setMessage(null)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Score Confirmation Modal */}
        <ConfirmModal
          isOpen={showSubmitConfirmModal}
          title="Simpan Hasil Pertandingan"
          message="Apakah Anda yakin ingin menyimpan hasil pertandingan ini?"
          confirmText="Simpan"
          cancelText="Batal"
          onConfirm={confirmSubmitScore}
          onCancel={() => setShowSubmitConfirmModal(false)}
          isDangerous={false}
        />
      </div>
    </div>
  )
}