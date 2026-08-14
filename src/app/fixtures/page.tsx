'use client'

import { useState, useEffect } from 'react'
import { getMatches, getMatchStats, updateMatchScore, getGamePlayers, verifyAdminPin } from '@/app/actions/admin'
import { Match, Stat, GamePlayer } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import Alert from '@/components/Alert'

interface MatchWithTeams extends Omit<Match, 'tournament_round'> {
  home_team_name: string
  away_team_name: string
  phase: 'league' | 'tournament'
  tournament_round?: 'quarter_final' | 'semi_final' | 'final'
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

  const loadMatches = async () => {
    const matchesData = await getMatches()
    console.log('Matches data received:', matchesData)
    setMatches(matchesData as any[])
  }

  const loadGamePlayers = async () => {
    const playersData = await getGamePlayers()
    setGamePlayers(playersData as GamePlayer[])
  }

  useEffect(() => {
    loadMatches()
    loadGamePlayers()
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
    console.log('Verifying PIN:', adminPin)
    const isValid = await verifyAdminPin(adminPin)
    if (isValid) {
      setPinVerified(true)
      setMessage(null)
    } else {
      console.log('PIN verification failed')
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
  const tournamentMatches = matches.filter(m => m.phase === 'tournament')

  // For bracket display, organize tournament matches
  const quarterFinals = tournamentMatches
    .filter(m => m.tournament_round === 'quarter_final')
    .sort((a, b) => a.home_team_name.localeCompare(b.home_team_name))
  const semiFinals = tournamentMatches
    .filter(m => m.tournament_round === 'semi_final')
    .sort((a, b) => a.home_team_name.localeCompare(b.home_team_name))
  const finals = tournamentMatches
    .filter(m => m.tournament_round === 'final')
    .sort((a, b) => a.home_team_name.localeCompare(b.home_team_name))

  return (
    <div className="min-h-screen bg-[#000000] text-white p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-2">
            PPLG LEAGUE
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">
            BRACKET TURNAMEN
          </p>
        </div>

        {tournamentMatches.length === 0 ? (
          <div className="bg-[#121212] border border-[#262626] rounded-sm p-8 text-center">
            <p className="text-gray-500">Belum ada bracket turnamen. Selesaikan liga dan admin akan generate bracket turnamen.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Tournament Bracket */}
            <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wider mb-6 text-purple-500">
              BRACKET TURNAMEN
            </h2>
            
            <div className="flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-8 overflow-x-auto">
              {/* Quarter Finals */}
              {quarterFinals.length > 0 && (
                <div className="flex flex-col gap-12 min-w-[180px]">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-gray-400 text-center mb-4">
                    PEREMPAT FINAL
                  </h3>
                  <div className="flex flex-col gap-8">
                    {quarterFinals.map((match, index) => (
                      <div key={match.id} className="relative">
                        <div
                          className="bg-[#161616] border border-purple-500/30 rounded-sm p-2 sm:p-3 relative"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-right flex items-center justify-end gap-2">
                              {match.home_team_logo && (
                                <img src={match.home_team_logo} alt={match.home_team_name} className="w-6 h-6 object-contain" />
                              )}
                              <div className="font-bold text-white text-xs">{match.home_team_name}</div>
                            </div>
                            <div className="mx-2">
                              {match.status === 'played' ? (
                                <span className="font-mono font-bold text-purple-500 text-xs">
                                  {match.home_score} - {match.away_score}
                                </span>
                              ) : (
                                <span className="font-mono text-gray-400 text-xs">VS</span>
                              )}
                            </div>
                            <div className="flex-1 text-left flex items-center gap-2">
                              <div className="font-bold text-white text-xs">{match.away_team_name}</div>
                              {match.away_team_logo && (
                                <img src={match.away_team_logo} alt={match.away_team_name} className="w-6 h-6 object-contain" />
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Horizontal line to next round */}
                        <div className="hidden lg:block absolute right-0 top-1/2 w-4 h-0.5 bg-purple-500/30 -translate-y-1/2 translate-x-full" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Semi Finals */}
              {semiFinals.length > 0 && (
                <div className="flex flex-col gap-12 min-w-[180px] mt-0 lg:mt-8">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-gray-400 text-center mb-4">
                    SEMI FINAL
                  </h3>
                  <div className="flex flex-col gap-8">
                    {semiFinals.map((match, index) => (
                      <div key={match.id} className="relative">
                        <div
                          className="bg-[#161616] border border-purple-500/30 rounded-sm p-2 sm:p-3 relative"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-right flex items-center justify-end gap-2">
                              {match.home_team_logo && (
                                <img src={match.home_team_logo} alt={match.home_team_name} className="w-6 h-6 object-contain" />
                              )}
                              <div className="font-bold text-white text-xs">{match.home_team_name}</div>
                            </div>
                            <div className="mx-2">
                              {match.status === 'played' ? (
                                <span className="font-mono font-bold text-purple-500 text-xs">
                                  {match.home_score} - {match.away_score}
                                </span>
                              ) : (
                                <span className="font-mono text-gray-400 text-xs">VS</span>
                              )}
                            </div>
                            <div className="flex-1 text-left flex items-center gap-2">
                              <div className="font-bold text-white text-xs">{match.away_team_name}</div>
                              {match.away_team_logo && (
                                <img src={match.away_team_logo} alt={match.away_team_name} className="w-6 h-6 object-contain" />
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Horizontal line to next round */}
                        <div className="hidden lg:block absolute right-0 top-1/2 w-4 h-0.5 bg-purple-500/30 -translate-y-1/2 translate-x-full" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final */}
              {finals.length > 0 && (
                <div className="flex flex-col gap-12 min-w-[180px] mt-0 lg:mt-16">
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-[#00FF66] text-center mb-4">
                    FINAL
                  </h3>
                  <div className="flex flex-col gap-8">
                    {finals.map((match) => (
                      <div
                        key={match.id}
                        className="bg-[#161616] border border-[#00FF66]/30 rounded-sm p-2 sm:p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 text-right flex items-center justify-end gap-2">
                            {match.home_team_logo && (
                              <img src={match.home_team_logo} alt={match.home_team_name} className="w-6 h-6 object-contain" />
                            )}
                            <div className="font-bold text-white text-xs">{match.home_team_name}</div>
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
                          <div className="flex-1 text-left flex items-center gap-2">
                            <div className="font-bold text-white text-xs">{match.away_team_name}</div>
                            {match.away_team_logo && (
                              <img src={match.away_team_logo} alt={match.away_team_name} className="w-6 h-6 object-contain" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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