'use client'

import { useState, useEffect } from 'react'
import { registerUser, getUsers } from '@/app/actions/admin'
import { getLeagues, getTeams } from '@/app/actions/football'
import { League, Team } from '@/lib/football-api'
import { User } from '@/types'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [leagues, setLeagues] = useState<League[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false)
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)

  const loadUsers = async () => {
    const usersData = await getUsers()
    setUsers(usersData)
  }

  const loadLeagues = async () => {
    setIsLoadingLeagues(true)
    try {
      const leaguesData = await getLeagues()
      setLeagues(leaguesData)
    } catch (error) {
      console.error('Error loading leagues:', error)
      setMessage({ type: 'error', text: 'Gagal memuat liga. Pastikan API key sudah di-set.' })
    }
    setIsLoadingLeagues(false)
  }

  const loadTeams = async (leagueId: number) => {
    setIsLoadingTeams(true)
    try {
      const teamsData = await getTeams(leagueId)
      setTeams(teamsData)
    } catch (error) {
      console.error('Error loading teams:', error)
      setMessage({ type: 'error', text: 'Gagal memuat tim.' })
    }
    setIsLoadingTeams(false)
  }

  const handleLeagueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const leagueId = parseInt(e.target.value)
    setSelectedLeague(leagueId)
    setSelectedTeam(null)
    if (leagueId) {
      loadTeams(leagueId)
    } else {
      setTeams([])
    }
  }

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = parseInt(e.target.value)
    const team = teams.find(t => t.id === teamId)
    setSelectedTeam(team || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    if (!selectedTeam || !selectedLeague) {
      setMessage({ type: 'error', text: 'Pilih liga dan tim terlebih dahulu' })
      setIsLoading(false)
      return
    }

    const selectedLeagueData = leagues.find(l => l.id === selectedLeague)
    
    const result = await registerUser(name, {
      team_name: selectedTeam.name,
      team_id: selectedTeam.id,
      team_logo: selectedTeam.crest,
      team_short_name: selectedTeam.shortName,
      league_id: selectedLeague,
      league_name: selectedLeagueData?.name || ''
    })
    
    if (result.success) {
      setMessage({ type: 'success', text: 'Pendaftaran berhasil!' })
      setName('')
      setSelectedLeague(null)
      setSelectedTeam(null)
      setTeams([])
      await loadUsers()
    } else {
      setMessage({ type: 'error', text: result.error || 'Pendaftaran gagal' })
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    loadUsers()
    loadLeagues()
  }, [])

  return (
    <div className="min-h-screen bg-[#000000] text-white p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-wider mb-2">
            PPLG LEAGUE
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-wide">
            Pendaftaran Turnamen FC 26
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
          {/* Registration Form */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">FORMULIR PENDAFTARAN</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Nama Kamu
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors"
                  placeholder="Masukkan nama"
                />
              </div>

              <div>
                <label htmlFor="league" className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Pilih Liga
                </label>
                <select
                  id="league"
                  value={selectedLeague || ''}
                  onChange={handleLeagueChange}
                  disabled={isLoadingLeagues}
                  required
                  className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih liga</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} ({league.areaName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="team" className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Pilih Tim
                </label>
                <select
                  id="team"
                  value={selectedTeam?.id || ''}
                  onChange={handleTeamChange}
                  disabled={isLoadingTeams || !selectedLeague}
                  required
                  className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-2 text-white focus:outline-none focus:border-[#00FF66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Pilih tim</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeam && (
                <div className="bg-[#161616] border border-[#262626] rounded-sm p-3">
                  <div className="flex items-center gap-3">
                    {selectedTeam.crest && (
                      <img src={selectedTeam.crest} alt={selectedTeam.name} className="w-10 h-10 object-contain" />
                    )}
                    <div>
                      <div className="font-bold text-white text-sm">{selectedTeam.name}</div>
                      <div className="text-xs text-gray-500">{selectedTeam.shortName}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !selectedTeam}
                className="w-full bg-[#00FF66] text-black font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#00CC52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Memproses...' : 'Daftar'}
              </button>
            </form>

            {message && (
              <div className={`px-4 py-3 mt-4 ${
                message.type === 'success' ? 'bg-[#00FF66]/10 text-[#00FF66]' : 'bg-red-500/10 text-red-500'
              }`}>
                {message.text}
              </div>
            )}
          </div>

          {/* Registered Users */}
          <div className="bg-[#121212] border border-[#262626] rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-[#262626]">
              <h2 className="text-lg font-bold uppercase tracking-wider">TIM TERDAFTAR ({users.length})</h2>
            </div>
            
            <div className="divide-y divide-[#262626] max-h-80 overflow-y-auto">
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
                        <div className="font-medium text-white">{user.team_name}</div>
                        <div className="text-xs text-gray-500">{user.name}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-[#121212] border border-[#262626] rounded-sm p-4">
          <p className="text-sm text-gray-400">
            <span className="text-[#00FF66] font-bold">INFO:</span> Pilih liga dan tim dari data FC 26 real. Admin akan mengelola jadwal pertandingan dan pemain game melalui halaman Admin.
          </p>
        </div>
      </div>
    </div>
  )
}