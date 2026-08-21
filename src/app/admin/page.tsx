'use client'

import { useState, useEffect, useRef } from 'react'
import { toPng } from 'html-to-image'
import {
  getUsers,
  getGamePlayers,
  getMatches,
  addGamePlayer,
  deleteGamePlayer,
  deleteUser,
  deleteMatch,
  deleteAllData,
  deleteAllGamePlayers,
  resetTournament,
  swapTeamsAndRegenerate,
  lockRegistrationAndGenerateSchedule,
  verifyAdminPin,
  getLeagueConfig,
  completeLeagueAndQualifyTop4,
  startTournament,
  updateMatchScore,
  getMatchStats,
  generateNextTournamentRound,
  importFC26Players,
  getTeamPlayers
} from '@/app/actions/admin'
import { User, GamePlayer, Match, LeagueConfig } from '@/types'
import ConfirmModal from '@/components/ConfirmModal'
import Alert from '@/components/Alert'
import CustomCheckbox from '@/components/CustomCheckbox'
import MatchPoster from '@/components/MatchPoster'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [gamePlayers, setGamePlayers] = useState<GamePlayer[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [leagueConfig, setLeagueConfig] = useState<LeagueConfig | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  // Auto-dismiss message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message])
  const [isLoading, setIsLoading] = useState(false)

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
  const [showDeleteAllPlayersModal, setShowDeleteAllPlayersModal] = useState(false)
  const [showResetTournamentModal, setShowResetTournamentModal] = useState(false)
  const [showSwapGroupsModal, setShowSwapGroupsModal] = useState(false)
  const [selectedGroupA, setSelectedGroupA] = useState<string[]>([])
  const [selectedGroupB, setSelectedGroupB] = useState<string[]>([])
  
  // Home/Away toggle
  const [homeAway, setHomeAway] = useState(false)
  
  // Tournament mode selection
  const [tournamentMode, setTournamentMode] = useState<'liga' | 'knockout' | 'worldcup'>('liga')
  const [qualificationSystem, setQualificationSystem] = useState<'top3' | 'top4'>('top3')
  
  // Score input modal
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [playerStats, setPlayerStats] = useState<{ playerName: string, statType: 'goal' | 'assist', count: number }[]>([])
  const [goalTimeline, setGoalTimeline] = useState<{ team: 'home' | 'away', playerName: string, minute: number, assistPlayer?: string, isPenalty?: boolean }[]>([])
  const [homeTeamPlayers, setHomeTeamPlayers] = useState<any[]>([])
  const [awayTeamPlayers, setAwayTeamPlayers] = useState<any[]>([])
  const [showAllPlayers, setShowAllPlayers] = useState(false)

  // Poster generation
  const [showPosterModal, setShowPosterModal] = useState(false)
  const [posterMatch, setPosterMatch] = useState<Match | null>(null)
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false)
  const posterRef = useRef<HTMLDivElement>(null)

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
    setLeagueConfig(configData as LeagueConfig | null)
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
    const result = await lockRegistrationAndGenerateSchedule(adminPin, tournamentMode, homeAway, qualificationSystem)
    
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
    setGoalTimeline([])

    // Load players for both teams
    const [homePlayers, awayPlayers] = await Promise.all([
      getTeamPlayers(match.home_team_name),
      getTeamPlayers(match.away_team_name)
    ])
    setHomeTeamPlayers(homePlayers)
    setAwayTeamPlayers(awayPlayers)

    // Load existing stats for this match and convert to goal timeline
    const existingStats = await getMatchStats(match.id)
    const goalTimelineFromStats: { team: 'home' | 'away', playerName: string, minute: number, assistPlayer?: string, isPenalty?: boolean }[] = []

    existingStats.forEach(stat => {
      if (stat.type === 'goal') {
        const team = stat.team_name === match.home_team_name ? 'home' : 'away'
        goalTimelineFromStats.push({
          team,
          playerName: stat.player_name,
          minute: stat.minute || 0,
          assistPlayer: '',
          isPenalty: stat.isPenalty || false
        })
      }
    })

    setGoalTimeline(goalTimelineFromStats)

    setShowScoreModal(true)
  }

  const handleAddGoal = () => {
    setGoalTimeline([...goalTimeline, { team: 'home', playerName: '', minute: 0, assistPlayer: '', isPenalty: false }])
  }

  const handleRemoveGoal = (index: number) => {
    const newTimeline = goalTimeline.filter((_, i) => i !== index)
    setGoalTimeline(newTimeline)
  }

  const handleUpdateGoal = (index: number, field: 'team' | 'playerName' | 'minute' | 'assistPlayer' | 'isPenalty', value: any) => {
    const newTimeline = [...goalTimeline]
    newTimeline[index] = { ...newTimeline[index], [field]: value }
    setGoalTimeline(newTimeline)
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

    // Auto-calculate scores from goal timeline
    const homeGoals = goalTimeline.filter(g => g.team === 'home').length
    const awayGoals = goalTimeline.filter(g => g.team === 'away').length

    // Build stats from goal timeline (goals and assists)
    const stats: { player_name: string; team_name: string; type: 'goal' | 'assist'; count: number; minute?: number; isPenalty?: boolean }[] = []

    goalTimeline.forEach(goal => {
      const teamName = goal.team === 'home' ? selectedMatch.home_team_name : selectedMatch.away_team_name

      // Add goal stat
      stats.push({
        player_name: goal.playerName,
        team_name: teamName,
        type: 'goal',
        count: 1,
        minute: goal.minute,
        isPenalty: goal.isPenalty
      })

      // Add assist stat if assist player is specified
      if (goal.assistPlayer) {
        stats.push({
          player_name: goal.assistPlayer,
          team_name: teamName,
          type: 'assist',
          count: 1,
          minute: goal.minute
        })
      }
    })

    const result = await updateMatchScore(
      selectedMatch.id,
      homeGoals,
      awayGoals,
      stats,
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

  const handleGeneratePoster = async (match: Match) => {
  console.log('handleGeneratePoster called for match:', match.id, match.home_team_name, 'vs', match.away_team_name);
  console.log('Match status:', match.status, 'Scores:', match.home_score, match.away_score);

  // Pastikan status played DAN skor tidak null/undefined (termasuk nilai 0)
  const hasValidScore = 
    match.home_score !== null && 
    match.home_score !== undefined && 
    match.away_score !== null && 
    match.away_score !== undefined;

  if (match.status !== 'played' || !hasValidScore) {
    console.log(`Match not eligible for poster. Status: ${match.status} Has scores: ${hasValidScore}`);
    setMessage({ type: 'error', text: 'Poster hanya bisa dibuat untuk pertandingan yang sudah selesai dan memiliki skor.' });
    return;
  }

  setPosterMatch(match);

  try {
    const existingStats = await getMatchStats(match.id);
    const timeline = existingStats
      .filter(stat => stat.type === 'goal' && typeof stat.minute === 'number')
      .map(stat => {
        const isHome = stat.team_name?.trim().toLowerCase() === match.home_team_name?.trim().toLowerCase();
        return {
          team: isHome ? ('home' as const) : ('away' as const),
          playerName: stat.player_name,
          minute: stat.minute!,
          isPenalty: stat.isPenalty || false
        };
      })
      .sort((a, b) => a.minute - b.minute);

    setGoalTimeline(timeline);
    setShowPosterModal(true);
  } catch (error) {
    setMessage({ type: 'error', text: 'Gagal memuat data pertandingan' });
  }
};

  const handleDownloadPoster = async () => {
    if (!posterRef.current || !posterMatch) {
      console.error('Missing posterRef or posterMatch')
      setMessage({ type: 'error', text: 'Data poster tidak tersedia' })
      return
    }

    setIsGeneratingPoster(true)
    try {
      console.log('Starting poster generation for:', posterMatch.home_team_name, 'vs', posterMatch.away_team_name)
      console.log('Poster ref element:', posterRef.current)

      // Wait for all images to load
      const images = posterRef.current.querySelectorAll('img')
      console.log('Found images:', images.length)
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) {
          return Promise.resolve()
        }
        return new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => {
            console.warn('Image failed to load:', img.src)
            resolve() // Continue even if image fails
          }
        })
      })
      await Promise.all(imagePromises)
      console.log('All images loaded')

      // Wait a bit more for rendering
      await new Promise(resolve => setTimeout(resolve, 300))

      // Temporarily remove scale transform for capture
      const parentContainer = posterRef.current.parentElement
      const originalTransform = parentContainer?.style.transform
      if (parentContainer) {
        parentContainer.style.transform = 'scale(1)'
      }

      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 100))

      const dataUrl = await toPng(posterRef.current, {
        quality: 1,
        backgroundColor: '#0a0a0a',
        cacheBust: true,
        pixelRatio: 2,
        skipAutoScale: true
      })

      console.log('Data URL generated, length:', dataUrl.length)

      // Restore original transform
      if (parentContainer && originalTransform) {
        parentContainer.style.transform = originalTransform
      }

      const link = document.createElement('a')
      link.download = `PPLG_${posterMatch.home_team_name}_vs_${posterMatch.away_team_name}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setMessage({ type: 'success', text: 'Poster berhasil didownload!' })
    } catch (error: any) {
      console.error('Error generating poster:', error)
      console.error('Error details:', {
        message: error?.message || (error instanceof Event ? 'Image load error' : 'Unknown'),
        name: error?.name,
        stack: error?.stack
      })
      setMessage({ type: 'error', text: `Gagal generate poster. Coba lagi.` })
    }
    setIsGeneratingPoster(false)
  }

  const handleImportPlayers = async () => {
    setIsLoading(true)
    const result = await importFC26Players()
    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Import berhasil' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal import pemain' })
    }
    setIsLoading(false)
  }

  const handleDeleteAllPlayers = async () => {
    setIsLoading(true)
    const result = await deleteAllGamePlayers()
    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Berhasil menghapus pemain' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menghapus pemain' })
      if (result.error === 'Tidak ada pemain untuk dihapus') {
        setMessage({ type: 'info', text: 'Tidak ada pemain untuk dihapus. Database sudah kosong.' })
      }
    }
    setIsLoading(false)
  }

  const handleResetTournament = async () => {
    setIsLoading(true)
    const result = await resetTournament(adminPin)
    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Berhasil mereset turnamen' })
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal mereset turnamen' })
    }
    setIsLoading(false)
  }

  const handleSwapGroups = async () => {
    setIsLoading(true)
    const result = await swapTeamsAndRegenerate(adminPin, selectedGroupA, selectedGroupB)
    if (result.success) {
      setMessage({ type: 'success', text: result.message || 'Berhasil menukar grup' })
      setShowSwapGroupsModal(false)
      await loadData()
    } else {
      setMessage({ type: 'error', text: result.error || 'Gagal menukar grup' })
    }
    setIsLoading(false)
  }

  const moveTeamToGroup = (userId: string, targetGroup: 'A' | 'B') => {
    if (targetGroup === 'A') {
      setSelectedGroupA([...selectedGroupA, userId])
      setSelectedGroupB(selectedGroupB.filter(id => id !== userId))
    } else {
      setSelectedGroupB([...selectedGroupB, userId])
      setSelectedGroupA(selectedGroupA.filter(id => id !== userId))
    }
  }

  const openSwapGroupsModal = () => {
    // Initialize groups based on current matches
    const groupMatches = matches.filter(m => m.phase === 'group')
    const groupAUsers = new Set<string>()
    const groupBUsers = new Set<string>()

    groupMatches.forEach(match => {
      if (match.group === 'A') {
        groupAUsers.add(match.home_user_id)
        groupAUsers.add(match.away_user_id)
      } else {
        groupBUsers.add(match.home_user_id)
        groupBUsers.add(match.away_user_id)
      }
    })

    setSelectedGroupA(Array.from(groupAUsers))
    setSelectedGroupB(Array.from(groupBUsers))
    setShowSwapGroupsModal(true)
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
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider">STATUS TURNAMEN</h2>
            <div className="flex items-center gap-2">
              {leagueConfig?.tournament_mode && (
                <span className={`px-2 py-1 rounded-sm text-xs font-bold uppercase ${
                  leagueConfig.tournament_mode === 'liga' ? 'bg-[#00FF66]/20 text-[#00FF66]' :
                  leagueConfig.tournament_mode === 'knockout' ? 'bg-red-500/20 text-red-500' :
                  'bg-blue-500/20 text-blue-500'
                }`}>
                  {leagueConfig.tournament_mode}
                </span>
              )}
              <span className={`px-3 py-1 rounded-sm text-xs font-bold uppercase ${
                leagueConfig?.status === 'league_ongoing' ? 'bg-[#00FF66]/20 text-[#00FF66]' :
                leagueConfig?.status === 'league_completed' ? 'bg-blue-500/20 text-blue-500' :
                leagueConfig?.status === 'tournament_ongoing' ? 'bg-purple-500/20 text-purple-500' :
                leagueConfig?.status === 'group_ongoing' ? 'bg-yellow-500/20 text-yellow-500' :
                'bg-gray-500/20 text-gray-500'
              }`}>
                {leagueConfig?.status || 'registration'}
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {leagueConfig?.tournament_mode === 'liga' && leagueConfig?.status === 'league_ongoing' && (
              <button
                onClick={handleCompleteLeague}
                disabled={isLoading}
                className="bg-blue-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Selesaikan Liga & Kualifikasi Top 4
              </button>
            )}

            {leagueConfig?.tournament_mode === 'liga' && leagueConfig?.status === 'league_completed' && !leagueConfig.tournament_started && (
              <button
                onClick={handleStartTournament}
                disabled={isLoading}
                className="bg-purple-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Mulai Turnamen
              </button>
            )}

            {(leagueConfig?.status === 'tournament_ongoing' || leagueConfig?.status === 'group_ongoing') && (
              <button
                onClick={handleGenerateNextRound}
                disabled={isLoading}
                className="bg-purple-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                {leagueConfig?.status === 'group_ongoing' ? 'Selesaikan Grup & Lanjut Knockout' : 'Generate Ronde Berikutnya'}
              </button>
            )}

            {leagueConfig?.status !== 'registration' && (
              <button
                onClick={() => setShowResetTournamentModal(true)}
                disabled={isLoading}
                className="bg-red-500 text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Reset Turnamen
              </button>
            )}

            {leagueConfig?.tournament_mode === 'worldcup' && leagueConfig?.status === 'group_ongoing' && (
              <button
                onClick={openSwapGroupsModal}
                disabled={isLoading}
                className="bg-yellow-500 text-black font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                Tukar Grup
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

          {/* Game Players Section */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-lg font-bold uppercase tracking-wider">PEMAIN GAME ({gamePlayers.length})</h2>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllPlayers}
                    onChange={(e) => setShowAllPlayers(e.target.checked)}
                    className="w-4 h-4 accent-[#00FF66]"
                  />
                  <span>Show All Players</span>
                </label>
                <button
                  onClick={handleImportPlayers}
                  disabled={isLoading}
                  className="bg-[#00FF66] text-black font-bold uppercase tracking-wider py-1 px-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Import FC26
                </button>
                <button
                  onClick={() => setShowDeleteAllPlayersModal(true)}
                  disabled={isLoading}
                  className="bg-red-500 text-white font-bold uppercase tracking-wider py-1 px-3 rounded-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Hapus Semua
                </button>
              </div>
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
                      <div className="font-medium text-white">{player.short_name || player.long_name || player.player_name}</div>
                      <div className="text-xs text-gray-500">{player.team_name} #{player.club_jersey_number || '-'}</div>
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
                      // Tournament rounds: play_in -> quarter_final -> semi_final -> final -> third_place
                      const roundOrder: Record<string, number> = { 'play_in': 1, 'quarter_final': 2, 'semi_final': 3, 'final': 4, 'third_place': 5 }
                      const aRound = a.tournament_round || 'quarter_final'
                      const bRound = b.tournament_round || 'quarter_final'
                      return (roundOrder[aRound] || 2) - (roundOrder[bRound] || 2)
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
                        {match.status === 'played' && (
                          <button
                            onClick={() => handleGeneratePoster(match)}
                            className="bg-purple-500/10 border border-purple-500/50 text-purple-500 px-3 py-1 rounded-sm hover:bg-purple-500/20 transition-colors text-xs"
                          >
                            Poster
                          </button>
                        )}
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

      {/* Generate Schedule Modal */}
      {showGenerateScheduleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-md w-full">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">
                PILIH MODE TURNAMEN
              </h2>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <button
                  onClick={() => setTournamentMode('liga')}
                  className={`w-full text-left p-4 rounded-sm border-2 transition-all ${
                    tournamentMode === 'liga'
                      ? 'border-[#00FF66] bg-[#00FF66]/10'
                      : 'border-[#262626] bg-[#161616] hover:border-[#00FF66]/50'
                  }`}
                >
                  <div className="font-bold text-white mb-1">Mode Liga</div>
                  <div className="text-xs text-gray-400">
                    Full Round-Robin Home-Away. Top 4 kualifikasi ke turnamen.
                  </div>
                </button>
                
                <button
                  onClick={() => setTournamentMode('knockout')}
                  className={`w-full text-left p-4 rounded-sm border-2 transition-all ${
                    tournamentMode === 'knockout'
                      ? 'border-[#00FF66] bg-[#00FF66]/10'
                      : 'border-[#262626] bg-[#161616] hover:border-[#00FF66]/50'
                  }`}
                >
                  <div className="font-bold text-white mb-1">Mode Knockout</div>
                  <div className="text-xs text-gray-400">
                    Sistem gugur Home-Away. Play-in untuk jumlah ganjil.
                  </div>
                </button>
                
                <button
                  onClick={() => setTournamentMode('worldcup')}
                  className={`w-full text-left p-4 rounded-sm border-2 transition-all ${
                    tournamentMode === 'worldcup'
                      ? 'border-[#00FF66] bg-[#00FF66]/10'
                      : 'border-[#262626] bg-[#161616] hover:border-[#00FF66]/50'
                  }`}
                >
                  <div className="font-bold text-white mb-1">Mode Grup Turnamen</div>
                  <div className="text-xs text-gray-400">
                    Grup + Knockout. Semua main di grup dulu, lalu sistem gugur.
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 cursor-pointer">
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
                  Home & Away (2 Leg)
                </label>
              </div>

              {tournamentMode === 'worldcup' && (
                <div className="pt-2">
                  <label className="block text-xs sm:text-sm text-gray-300 mb-2 uppercase tracking-wide">
                    Sistem Kualifikasi
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQualificationSystem('top3')}
                      className={`flex-1 p-3 rounded-sm border-2 transition-all text-left ${
                        qualificationSystem === 'top3'
                          ? 'border-[#00FF66] bg-[#00FF66]/10'
                          : 'border-[#262626] bg-[#161616] hover:border-[#00FF66]/50'
                      }`}
                    >
                      <div className="font-bold text-white text-sm mb-1">Top 3</div>
                      <div className="text-xs text-gray-400">3 tim/grup + bye ke semifinal</div>
                    </button>
                    <button
                      onClick={() => setQualificationSystem('top4')}
                      className={`flex-1 p-3 rounded-sm border-2 transition-all text-left ${
                        qualificationSystem === 'top4'
                          ? 'border-[#00FF66] bg-[#00FF66]/10'
                          : 'border-[#262626] bg-[#161616] hover:border-[#00FF66]/50'
                      }`}
                    >
                      <div className="font-bold text-white text-sm mb-1">Top 4</div>
                      <div className="text-xs text-gray-400">4 tim/grup + quarter final</div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowGenerateScheduleModal(false)}
                  className="flex-1 bg-[#161616] border border-[#262626] text-white font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#1a1a1a] hover:border-[#00FF66] transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={confirmGenerateSchedule}
                  disabled={isLoading}
                  className="flex-1 bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <ConfirmModal
        isOpen={showDeleteAllPlayersModal}
        title="HAPUS SEMUA PEMAIN"
        message="Ini akan menghapus SEMUA pemain game. Tindakan ini tidak bisa dibatalkan!"
        confirmText="Hapus Semua"
        cancelText="Batal"
        onConfirm={handleDeleteAllPlayers}
        onCancel={() => setShowDeleteAllPlayersModal(false)}
        isDangerous={true}
      />

      <ConfirmModal
        isOpen={showResetTournamentModal}
        title="RESET TURNAMEN"
        message="Ini akan menghapus SEMUA pertandingan dan statistik, serta mereset status turnamen ke pendaftaran. Tim dan pemain tidak akan dihapus. Tindakan ini tidak bisa dibatalkan!"
        confirmText="Reset Turnamen"
        cancelText="Batal"
        onConfirm={handleResetTournament}
        onCancel={() => setShowResetTournamentModal(false)}
        isDangerous={true}
      />

      {/* Swap Groups Modal */}
      {showSwapGroupsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-x-hidden">
          <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-wider">
                TUKAR GRUP
              </h2>
              <button
                onClick={() => setShowSwapGroupsModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Group A */}
                <div className="bg-[#161616] border border-[#262626] rounded-sm p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#00FF66] mb-3">
                    GRUP A ({selectedGroupA.length})
                  </h3>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => moveTeamToGroup(user.id, 'A')}
                        className={`p-3 rounded-sm cursor-pointer transition-colors ${
                          selectedGroupA.includes(user.id)
                            ? 'bg-[#00FF66]/20 border border-[#00FF66]/50'
                            : 'bg-[#121212] border border-[#262626] hover:border-[#262626]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {user.team_logo && (
                            <img
                              src={user.team_logo}
                              alt={user.team_name}
                              className="w-8 h-8 object-contain"
                            />
                          )}
                          <div>
                            <div className="font-medium text-white text-sm">{user.team_name}</div>
                            <div className="text-xs text-gray-500">{user.name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Group B */}
                <div className="bg-[#161616] border border-[#262626] rounded-sm p-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-blue-500 mb-3">
                    GRUP B ({selectedGroupB.length})
                  </h3>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => moveTeamToGroup(user.id, 'B')}
                        className={`p-3 rounded-sm cursor-pointer transition-colors ${
                          selectedGroupB.includes(user.id)
                            ? 'bg-blue-500/20 border border-blue-500/50'
                            : 'bg-[#121212] border border-[#262626] hover:border-[#262626]/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {user.team_logo && (
                            <img
                              src={user.team_logo}
                              alt={user.team_name}
                              className="w-8 h-8 object-contain"
                            />
                          )}
                          <div>
                            <div className="font-medium text-white text-sm">{user.team_name}</div>
                            <div className="text-xs text-gray-500">{user.name}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSwapGroups}
                  disabled={isLoading || selectedGroupA.length === 0 || selectedGroupB.length === 0}
                  className="flex-1 bg-[#00FF66] text-black font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? 'Memproses...' : 'Simpan & Regenerate Jadwal'}
                </button>
                <button
                  onClick={() => setShowSwapGroupsModal(false)}
                  disabled={isLoading}
                  className="flex-1 bg-[#262626] text-white font-bold uppercase tracking-wider py-2 px-4 rounded-sm hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 text-right">
                  <div className="font-bold text-white">{selectedMatch.home_team_name}</div>
                </div>
                <div className="mx-4 flex items-center gap-2">
                  <span className="text-gray-400">Skor otomatis dari Goal Timeline</span>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-bold text-white">{selectedMatch.away_team_name}</div>
                </div>
              </div>

              <div className="border-t border-[#262626] pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                    GOAL TIMELINE
                  </h3>
                  <button
                    onClick={handleAddGoal}
                    className="bg-[#00FF66] text-black font-bold uppercase tracking-wider py-1 px-3 rounded-sm hover:bg-[#00CC52] transition-colors text-xs"
                  >
                    + Tambah Gol
                  </button>
                </div>
                
                {goalTimeline.map((goal, index) => (
                  <div key={index} className="bg-[#161616] border border-[#262626] rounded-sm p-3 mb-2">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
                      <select
                        value={goal.team}
                        onChange={(e) => handleUpdateGoal(index, 'team', e.target.value)}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                      >
                        <option value="home">Home ({selectedMatch.home_team_name})</option>
                        <option value="away">Away ({selectedMatch.away_team_name})</option>
                      </select>
                      <input
                        type="text"
                        list={`player-list-${index}`}
                        value={goal.playerName}
                        onChange={(e) => handleUpdateGoal(index, 'playerName', e.target.value)}
                        placeholder="Nama pemain"
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                      />
                      <datalist id={`player-list-${index}`}>
                        {(goal.team === 'home' ? homeTeamPlayers : awayTeamPlayers).map((player) => (
                          <option key={player.id} value={player.short_name || player.long_name || player.player_name}>
                            {player.short_name || player.long_name || player.player_name} ({player.club_jersey_number || '-'})
                          </option>
                        ))}
                      </datalist>
                      <input
                        type="number"
                        placeholder="Menit"
                        value={goal.minute || ''}
                        onChange={(e) => handleUpdateGoal(index, 'minute', parseInt(e.target.value) || 0)}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                        min="0"
                        max="120"
                      />
                      <input
                        type="text"
                        placeholder="Assist (opsional)"
                        value={goal.assistPlayer || ''}
                        onChange={(e) => handleUpdateGoal(index, 'assistPlayer', e.target.value)}
                        className="bg-[#121212] border border-[#262626] text-white px-3 py-2 rounded-sm text-sm focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <CustomCheckbox
                        id={`penalty-${index}`}
                        checked={goal.isPenalty || false}
                        onChange={(checked) => handleUpdateGoal(index, 'isPenalty', checked)}
                        label="Gol Penalti"
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveGoal(index)}
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

      {/* Poster Modal */}
      {showPosterModal && posterMatch && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 overflow-x-auto">
          <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-3xl w-full">
            <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
              <h2 className="text-lg font-bold uppercase tracking-wider">
                POSTER PERTANDINGAN
              </h2>
              <button
                onClick={() => setShowPosterModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Poster Preview */}
              <div className="flex justify-center overflow-x-auto">
                <div className="transform scale-50 origin-top sm:scale-75 md:scale-100" id="poster-preview-container">
                  <div ref={posterRef} className="transform scale-100 origin-top">
                    <MatchPoster
                      homeTeamName={posterMatch.home_team_name}
                      awayTeamName={posterMatch.away_team_name}
                      homeTeamLogo={posterMatch.home_team_logo}
                      awayTeamLogo={posterMatch.away_team_logo}
                      homeScore={posterMatch.home_score || 0}
                      awayScore={posterMatch.away_score || 0}
                      round={posterMatch.round}
                      phase={posterMatch.phase}
                      date={new Date().toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      goalTimeline={goalTimeline}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPosterModal(false)}
                  className="flex-1 bg-[#161616] border border-[#262626] text-white font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#1a1a1a] hover:border-[#00FF66] transition-colors text-sm"
                >
                  Tutup
                </button>
                <button
                  onClick={handleDownloadPoster}
                  disabled={isGeneratingPoster}
                  className="flex-1 bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isGeneratingPoster ? 'Generating...' : 'Download Poster'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}