'use client'

import { useState, useEffect } from 'react'
import { 
  getUsers, 
  getGamePlayers, 
  getMatches, 
  addGamePlayer, 
  deleteGamePlayer,
  deleteUser,
  deleteMatch,
  deleteAllData,
  lockRegistrationAndGenerateSchedule,
  verifyAdminPin,
  getLeagueConfig,
  completeLeagueAndQualifyTop4,
  startTournament,
  updateMatchScore,
  getMatchStats,
  generateNextTournamentRound
} from '@/app/actions/admin'
import { User, GamePlayer, Match, LeagueConfig } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import Alert from '@/components/Alert'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Add game player form
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  
  // Custom modals
  const [showDeleteGamePlayerModal, setShowDeleteGamePlayerModal] = useState(false)
  const [deleteGamePlayerId, setDeleteGamePlayerId] = useState('')
  
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false)
  const [deleteUserId, setDeleteUserId] = useState('')
  
  const [showDeleteMatchModal, setShowDeleteMatchModal] = useState(false)
  const [deleteMatchId, setDeleteMatchId] = useState('')
  
  const [showGenerateScheduleModal, setShowGenerateScheduleModal] = useState(false)
  
  const [showDeleteAllDataModal, setShowDeleteAllDataModal] = useState(false)
  
  const [showCompleteLeagueModal, setShowCompleteLeagueModal] = useState(false)
  const [showStartTournamentModal, setShowStartTournamentModal] = useState(false)
  const [showNextRoundModal, setShowNextRoundModal] = useState(false)
  
  // Home/Away toggle
  const [homeAway, setHomeAway] = useState(false)
  
  // Score input modal
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [playerStats, setPlayerStats] = useState<{ playerName: string, statType: 'goal' | 'assist', count: number }[]>([])

  const loadData = async () => {
    const [usersData, gamePlayersData, matchesData, configData] = await Promise.all([
      getUsers(),
      getGamePlayers(),
      getMatches(),
      getLeagueConfig()
    ])
    setUsers(usersData)
    setGamePlayers(gamePlayersData)
    setMatches(matchesData)
    setLeagueConfig(configData)
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    if (await verifyAdminPin(adminPin)) {
      setIsAuthenticated(true)
      setMessage(null)
    } else {
      setMessage({ type: 'error', text: 'PIN Admin salah' })
    }
  }

  const handleAddGamePlayer = async () => {
    if (!selectedUserId || !newPlayerName) {
      setMessage({ type: 'error', text: 'Pilih tim dan masukkan nama pemain' })
      return
    }

    const user = users.find(u => u.id === selectedUserId)
    if (!user) return

    setIsLoading(true)
    const result = await addGamePlayer(selectedUserId, user.team_name, newPlayerName, adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Pemain berhasil ditambahkan!' })
      setNewPlayerName('')
      setSelectedUserId('')
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menambah pemain' })
    }
    
    setIsLoading(false)
  }

  const handleDeleteGamePlayer = async (playerId: string) => {
    setDeleteGamePlayerId(playerId)
    setShowDeleteGamePlayerModal(true)
  }

  const confirmDeleteGamePlayer = async () => {
    setShowDeleteGamePlayerModal(false)
    setIsLoading(true)
    const result = await deleteGamePlayer(deleteGamePlayerId, adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Pemain berhasil dihapus!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menghapus pemain' })
    }
    
    setIsLoading(false)
  }

  const handleDeleteUser = async (userId: string) => {
    setDeleteUserId(userId)
    setShowDeleteUserModal(true)
  }

  const confirmDeleteUser = async () => {
    setShowDeleteUserModal(false)
    setIsLoading(true)
    const result = await deleteUser(deleteUserId, adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Tim berhasil dihapus!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menghapus tim' })
    }
    
    setIsLoading(false)
  }

  const handleDeleteMatch = async (matchId: string) => {
    setDeleteMatchId(matchId)
    setShowDeleteMatchModal(true)
  }

  const confirmDeleteMatch = async () => {
    setShowDeleteMatchModal(false)
    setIsLoading(true)
    const result = await deleteMatch(deleteMatchId, adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Pertandingan berhasil dihapus!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menghapus pertandingan' })
    }
    
    setIsLoading(false)
  }

  const handleGenerateSchedule = async () => {
    if (users.length < 2) {
      setMessage({ type: 'error', text: 'Minimal 2 tim diperlukan untuk generate jadwal' })
      return
    }

    setShowGenerateScheduleModal(true)
  }

  const confirmGenerateSchedule = async () => {
    setShowGenerateScheduleModal(false)
    setIsLoading(true)
    const result = await lockRegistrationAndGenerateSchedule(adminPin, homeAway)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Jadwal lama dihapus, jadwal baru berhasil dibuat!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal membuat jadwal' })
    }
    
    setIsLoading(false)
  }

  const handleDeleteAllData = async () => {
    setShowDeleteAllDataModal(true)
  }

  const confirmDeleteAllData = async () => {
    setShowDeleteAllDataModal(false)
    setIsLoading(true)
    const result = await deleteAllData(adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Semua data berhasil dihapus!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menghapus data' })
      if (result.error === 'Tidak ada data untuk dihapus') {
        setMessage({ type: 'info', text: 'Tidak ada data untuk dihapus. Database sudah kosong.' })
      }
    }
    
    setIsLoading(false)
  }

  const handleInputScore = async (match: Match) => {
    setSelectedMatch(match)
    setHomeScore(match.home_score?.toString() || '')
    setAwayScore(match.away_score?.toString() || '')
    setPlayerStats([])
    
    // Load existing stats for this match
    const existingStats = await getMatchStats(match.id)
    setPlayerStats(existingStats.map(stat => ({
      playerName: stat.player_name,
      statType: stat.type,
      count: stat.count
    })))
    
    setShowScoreModal(true)
  }

  const handleAddPlayerStat = () => {
    setPlayerStats([...playerStats, { playerName: '', statType: 'goal', count: 1 }])
  }

  const handleRemovePlayerStat = (index: number) => {
    const newStats = playerStats.filter((_, i) => i !== index)
    setPlayerStats(newStats)
  }

  const handleUpdatePlayerStat = (index: number, field: 'playerName' | 'statType' | 'count', value: any) => {
    const newStats = [...playerStats]
    newStats[index] = { ...newStats[index], [field]: value }
    setPlayerStats(newStats)
  }

  const handleSaveScore = async () => {
    if (!selectedMatch) return
    setIsLoading(true)
    
    const result = await updateMatchScore(
      selectedMatch.id,
      parseInt(homeScore),
      parseInt(awayScore),
      playerStats.map(stat => ({
        player_name: stat.playerName,
        team_name: selectedMatch.home_team_name,
        type: stat.statType,
        count: stat.count
      })),
      adminPin
    )
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Skor berhasil diupdate!' })
      setShowScoreModal(false)
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal update skor' })
    }
    
    setIsLoading(false)
  }

  const handleGenerateNextRound = async () => {
    setShowNextRoundModal(true)
  }

  const confirmGenerateNextRound = async () => {
    setShowNextRoundModal(false)
    setIsLoading(true)
    const result = await generateNextTournamentRound(adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Ronde berikutnya berhasil dibuat!' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal membuat ronde berikutnya' })
    }
    
    setIsLoading(false)
  }

  const handleCompleteLeague = async () => {
    setShowCompleteLeagueModal(true)
  }

  const confirmCompleteLeague = async () => {
    setShowCompleteLeagueModal(false)
    setIsLoading(true)
    const result = await completeLeagueAndQualifyTop4(adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Liga selesai! Top 4 tim telah dikualifikasi.' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menyelesaikan liga' })
    }
    
    setIsLoading(false)
  }

  const handleStartTournament = async () => {
    setShowStartTournamentModal(true)
  }

  const confirmStartTournament = async () => {
    setShowStartTournamentModal(false)
    setIsLoading(true)
    const result = await startTournament(adminPin)
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Turnamen dimulai! Jadwal pertandingan telah dibuat.' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal memulai turnamen' })
    }
    
    setIsLoading(false)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#000000] text-white p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-[#121212] border border-[#262626] rounded-sm p-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-6 text-center">
              PPLG LEAGUE - ADMIN
            </h1>
            
            <div className="space-y-4">
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
              </div>

              <button
                onClick={handleLogin}
                className="w-full bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors"
              >
                Login Admin
              </button>

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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-2">
              PPLG LEAGUE - ADMIN
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">
              Panel Admin Turnamen FC 26
            </p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="bg-[#161616] border border-[#262626] text-white font-bold uppercase tracking-wider py-2 px-3 sm:px-4 rounded-sm hover:bg-[#1a1a1a] hover:border-[#00FF66] transition-colors text-xs sm:text-sm"
          >
            Logout
          </button>
        </div>

        {message && (
          <div className="mb-6">
            <Alert 
              type={message.type as 'success' | 'error' | 'info'} 
              message={message.text}
              onClose={() => setMessage(null)}
            />
          </div>
        )}

        {/* League Status */}
        <div className="mb-6 bg-[#121212] border border-[#262626] rounded-sm p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider">STATUS LIGA</h2>
            <span className={`px-3 py-1 rounded-sm text-xs font-bold uppercase ${
              leagueConfig?.status === 'league_ongoing' ? 'bg-[#00FF66]/20 text-[#00FF66]' :
              leagueConfig?.status === 'league_completed' ? 'bg-blue-500/20 text-blue-500' :
              leagueConfig?.status === 'tournament_ongoing' ? 'bg-purple-500/20 text-purple-500' :
              'bg-gray-500/20 text-gray-500'
            }`}>
              {leagueConfig?.status || 'registration'}
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {leagueConfig?.status === 'league_ongoing' && (
              <button
                onClick={handleCompleteLeague}
                disabled={isLoading}
                className="bg-blue-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Selesaikan Liga & Kualifikasi Top 4
              </button>
            )}
            
            {leagueConfig?.status === 'league_completed' && !leagueConfig.tournament_started && (
              <button
                onClick={handleStartTournament}
                disabled={isLoading}
                className="bg-purple-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Mulai Turnamen
              </button>
            )}
            
            {leagueConfig?.status === 'tournament_ongoing' && (
              <button
                onClick={handleGenerateNextRound}
                disabled={isLoading}
                className="bg-purple-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Generate Ronde Berikutnya
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
          {/* Users Section */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider">TIM TERDAFTAR ({users.length})</h2>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={homeAway}
                      onChange={(e) => setHomeAway(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 border-2 rounded-sm transition-colors ${
                      homeAway 
                        ? 'bg-[#00FF66] border-[#00FF66]' 
                        : 'bg-[#161616] border-[#262626] hover:border-[#00FF66]'
                    }`}>
                      {homeAway && (
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                  </div>
                  Home & Away
                </label>
                <button
                  onClick={() => {
                    if (users.length < 2) {
                      setMessage({ type: 'error', text: 'Minimal 2 tim diperlukan untuk generate jadwal' })
                    } else {
                      handleGenerateSchedule()
                    }
                  }}
                  disabled={isLoading}
                  className="bg-[#00FF66] text-black font-bold uppercase tracking-wider py-2 px-3 sm:px-4 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Generate Jadwal
                </button>
              </div>
            </div>
            
            <div className="divide-y divide-[#262626] max-h-96 overflow-y-auto">
              {users.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Belum ada tim terdaftar
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {user.team_logo && (
                        <img src={user.team_logo} alt={user.team_name} className="w-8 h-8 object-contain" />
                      )}
                      <div>
                        <div className="font-bold text-white">{user.team_name}</div>
                        <div className="text-xs text-gray-500">{user.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-1 rounded-sm hover:bg-red-500/20 transition-colors text-sm"
                    >
                      Hapus
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Game Player Section */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">TAMBAH PEMAIN GAME</h2>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Pilih Tim
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors"
                >
                  <option value="">Pilih tim</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.team_name} ({user.team_short_name})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Nama Pemain Game
                </label>
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors"
                  placeholder="Contoh: Mbappe"
                />
              </div>

              <button
                onClick={handleAddGamePlayer}
                disabled={isLoading}
                className="w-full bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Memproses...' : 'Tambah Pemain'}
              </button>
            </div>
          </div>

          {/* Game Players Section */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">PEMAIN GAME ({gamePlayers.length})</h2>
            </div>
            
            <div className="divide-y divide-[#262626] max-h-96 overflow-y-auto">
              {gamePlayers.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Belum ada pemain game
                </div>
              ) : (
                gamePlayers.map((player) => (
                  <div key={player.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{player.player_name}</div>
                      <div className="text-xs text-gray-500">{player.team_name}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteGamePlayer(player.id)}
                      className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-1 rounded-sm hover:bg-red-500/20 transition-colors text-sm"
                    >
                      Hapus
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Matches Section */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">PERTANDINGAN ({matches.length})</h2>
            </div>
            
            <div className="divide-y divide-[#262626] max-h-96 overflow-y-auto">
              {matches.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  Belum ada pertandingan
                </div>
              ) : (
                matches
                  .sort((a, b) => {
                    // Sort by phase first (league before tournament)
                    if (a.phase !== b.phase) {
                      return a.phase === 'league' ? -1 : 1
                    }
                    // Then sort by round
                    if (a.phase === 'league') {
                      return a.round - b.round
                    } else {
                      // Tournament rounds: quarter_final -> semi_final -> final
                      const roundOrder = { 'quarter_final': 1, 'semi_final': 2, 'final': 3 }
                      const aRound = a.tournament_round || 'quarter_final'
                      const bRound = b.tournament_round || 'quarter_final'
                      return (roundOrder[aRound as keyof typeof roundOrder] || 1) - (roundOrder[bRound as keyof typeof roundOrder] || 1)
                    }
                  })
                  .map((match) => (
                  <div key={match.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 text-right">
                        <div className="font-bold text-white text-sm">{match.home_team_name}</div>
                      </div>
                      <div className="mx-4 text-xs">
                        {match.status === 'played' ? (
                          <span className="font-mono font-bold text-[#00FF66]">
                            {match.home_score} - {match.away_score}
                          </span>
                        ) : (
                          <span className="text-gray-400">VS</span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-white text-sm">{match.away_team_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {match.phase === 'league' ? `Pekan ${match.round}` : 
                         match.tournament_round === 'quarter_final' ? 'Perempat Final' :
                         match.tournament_round === 'semi_final' ? 'Semi Final' :
                         match.tournament_round === 'final' ? 'Final' : 'Turnamen'}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleInputScore(match)}
                          className="bg-[#00FF66]/10 border border-[#00FF66]/50 text-[#00FF66] px-3 py-1 rounded-sm hover:bg-[#00FF66]/20 transition-colors text-xs"
                        >
                          Input Skor
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-1 rounded-sm hover:bg-red-500/20 transition-colors text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 bg-red-500/10 border border-red-500/50 rounded-sm p-6">
          <h2 className="text-lg font-bold uppercase tracking-wider text-red-500 mb-4">
            DANGER ZONE
          </h2>
          <button
            onClick={handleDeleteAllData}
            disabled={isLoading}
            className="bg-red-500 text-white font-bold uppercase tracking-wider py-3 px-6 rounded-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hapus Semua Data
          </button>
          <p className="text-xs text-red-400 mt-2">
            Ini akan menghapus SEMUA data (tim, pemain, pertandingan, statistik). Tindakan ini tidak bisa dibatalkan!
          </p>
        </div>
      </div>

      {/* Custom Modals */}
      <ConfirmModal
        isOpen={showDeleteGamePlayerModal}
        title="Hapus Pemain Game"
        message="Apakah Anda yakin ingin menghapus pemain game ini?"
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={confirmDeleteGamePlayer}
        onCancel={() => setShowDeleteGamePlayerModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showDeleteUserModal}
        title="Hapus Tim"
        message="Apakah Anda yakin ingin menghapus tim ini? Semua pemain game di tim ini juga akan dihapus."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={confirmDeleteUser}
        onCancel={() => setShowDeleteUserModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showDeleteMatchModal}
        title="Hapus Pertandingan"
        message="Apakah Anda yakin ingin menghapus pertandingan ini?"
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={confirmDeleteMatch}
        onCancel={() => setShowDeleteMatchModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showGenerateScheduleModal}
        title="Generate Jadwal"
        message="Generate jadwal pertandingan baru? Jadwal liga yang sudah ada akan dihapus dan diganti dengan jadwal baru."
        confirmText="Generate"
        cancelText="Batal"
        onConfirm={confirmGenerateSchedule}
        onCancel={() => setShowGenerateScheduleModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showDeleteAllDataModal}
        title="HAPUS SEMUA DATA"
        message="Ini akan menghapus SEMUA data (tim, pemain, pertandingan, statistik). Tindakan ini tidak bisa dibatalkan!"
        confirmText="Hapus Semua"
        cancelText="Batal"
        onConfirm={confirmDeleteAllData}
        onCancel={() => setShowDeleteAllDataModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showCompleteLeagueModal}
        title="Selesaikan Liga"
        message="Selesaikan liga dan kualifikasi top 4 tim untuk turnamen? Top 4 berdasarkan klasemen akhir."
        confirmText="Selesaikan Liga"
        cancelText="Batal"
        onConfirm={confirmCompleteLeague}
        onCancel={() => setShowCompleteLeagueModal(false)}
        isDangerous={false}
      />

      <ConfirmModal
        isOpen={showStartTournamentModal}
        title="Mulai Turnamen"
        message="Mulai turnamen dengan top 4 tim yang sudah dikualifikasi? Jadwal turnamen akan otomatis dibuat."
        confirmText="Mulai Turnamen"
        cancelText="Batal"
        onConfirm={confirmStartTournament}
        onCancel={() => setShowStartTournamentModal(false)}
        isDangerous={false}
      />

      <ConfirmModal
        isOpen={showNextRoundModal}
        title="Generate Ronde Berikutnya"
        message="Generate ronde berikutnya turnamen? Ini akan membuat Semi Final atau Final berdasarkan hasil pertandingan sebelumnya."
        confirmText="Generate"
        cancelText="Batal"
        onConfirm={confirmGenerateNextRound}
        onCancel={() => setShowNextRoundModal(false)}
        isDangerous={false}
      />

      {/* Score Input Modal */}
      {showScoreModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-x-hidden">
          <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-wider">
                INPUT SKOR PERTANDINGAN
              </h2>
              <button
                onClick={() => setShowScoreModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 text-right">
                  <div className="font-bold text-white">{selectedMatch.home_team_name}</div>
                </div>
                <div className="mx-4 flex items-center gap-2">
                  <input
                    type="number"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-16 bg-[#161616] border border-[#262626] text-white text-center font-mono font-bold py-2 rounded-sm focus:outline-none focus:border-[#00FF66]"
                    min="0"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-16 bg-[#161616] border border-[#262626] text-white text-center font-mono font-bold py-2 rounded-sm focus:outline-none focus:border-[#00FF66]"
                    min="0"
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-white">{selectedMatch.away_team_name}</div>
                </div>
              </div>

              <div className="border-t border-[#262626] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                    STATISTIK PEMAIN
                  </h3>
                  <button
                    onClick={handleAddPlayerStat}
                    className="bg-[#00FF66] text-black font-bold uppercase tracking-wider py-1 px-3 rounded-sm hover:bg-[#00CC52] transition-colors text-xs"
                  >
                    + Tambah
                  </button>
                </div>
                
                {playerStats.map((stat, index) => (
                  <div key={index} className="bg-[#161616] border border-[#262626] rounded-sm p-3 mb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Nama Pemain"
                        value={stat.playerName}
                        onChange={(e) => handleUpdatePlayerStat(index, 'playerName', e.target.value)}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                      />
                      <select
                        value={stat.statType}
                        onChange={(e) => handleUpdatePlayerStat(index, 'statType', e.target.value)}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                      >
                        <option value="goal">Gol</option>
                        <option value="assist">Assist</option>
                      </select>
                      <input
                        type="number"
                        value={stat.count}
                        onChange={(e) => handleUpdatePlayerStat(index, 'count', parseInt(e.target.value))}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                        min="1"
                      />
                    </div>
                    <button
                      onClick={() => handleRemovePlayerStat(index)}
                      className="text-red-500 text-xs hover:text-red-400 transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowScoreModal(false)}
                  className="flex-1 bg-[#161616] border border-[#262626] text-white font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#1a1a1a] hover:border-[#00FF66] transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveScore}
                  disabled={isLoading}
                  className="flex-1 bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}