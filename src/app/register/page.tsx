'use client'

import { useState, useEffect } from 'react'
import { registerUser, getUsers } from '@/app/actions/admin'
import { getLeagues, getTeams } from '@/app/actions/football'
import { League, Team } from '@/lib/football-api'
import { User } from '@/types'
import CustomDropdown from '@/components/CustomDropdown'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
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
    setUsers(usersData as User[])
  }

  const loadLeagues = async () => {
    setIsLoadingLeagues(true)
    try {
      // Check localStorage cache first
      const cachedLeagues = localStorage.getItem('pplg_leagues_cache')
      const cachedTime = localStorage.getItem('pplg_leagues_cache_time')
      
      if (cachedLeagues && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime)
        // Use cache if less than 24 hours old
        if (cacheAge < 86400000) {
          setLeagues(JSON.parse(cachedLeagues))
          setIsLoadingLeagues(false)
          return
        }
      }
      
      // Fetch from API if no cache or expired
      const leaguesData = await getLeagues()
      setLeagues(leaguesData)
      
      // Cache in localStorage
      localStorage.setItem('pplg_leagues_cache', JSON.stringify(leaguesData))
      localStorage.setItem('pplg_leagues_cache_time', Date.now().toString())
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memuat liga. Pastikan API key sudah di-set.' })
    }
    setIsLoadingLeagues(false)
  }

  const loadTeams = async (leagueId: string) => {
    setIsLoadingTeams(true)
    try {
      // Check localStorage cache first
      const cacheKey = `pplg_teams_${leagueId}`
      const cachedTeams = localStorage.getItem(cacheKey)
      const cachedTime = localStorage.getItem(`${cacheKey}_time`)
      
      if (cachedTeams && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime)
        // Use cache if less than 1 hour old
        if (cacheAge < 3600000) {
          setTeams(JSON.parse(cachedTeams))
          setIsLoadingTeams(false)
          return
        }
      }
      
      // Fetch from API if no cache or expired
      const teamsData = await getTeams(leagueId)
      setTeams(teamsData)
      
      // Cache in localStorage
      localStorage.setItem(cacheKey, JSON.stringify(teamsData))
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString())
    } catch (error) {
      setMessage({ type: 'error', text: 'Gagal memuat tim.' })
    }
    setIsLoadingTeams(false)
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

    const selectedLeagueData = leagues.find(l => l.league_id === selectedLeague)
    
    const result = await registerUser(name, {
      team_name: selectedTeam.team_name,
      team_id: parseInt(selectedTeam.team_key),
      team_logo: selectedTeam.team_badge,
      team_short_name: selectedTeam.team_name.split(' ').map((w: string) => w[0]).join('').toUpperCase(),
      league_id: parseInt(selectedLeague),
      league_name: selectedLeagueData?.league_name || ''
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
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Pilih Liga
                </label>
                <CustomDropdown
                  value={selectedLeague || ''}
                  onChange={(val) => {
                    setSelectedLeague(val)
                    setSelectedTeam(null)
                    if (val) {
                      loadTeams(val)
                    } else {
                      setTeams([])
                    }
                  }}
                  options={leagues.map(league => ({
                    value: league.league_id,
                    label: league.league_name,
                    subLabel: league.country_name
                  }))}
                  placeholder="Pilih liga"
                  disabled={isLoadingLeagues}
                  isLoading={isLoadingLeagues}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
                  Pilih Tim
                </label>
                <CustomDropdown
                  value={selectedTeam?.team_key || ''}
                  onChange={(val) => {
                    const team = teams.find(t => t.team_key === val)
                    setSelectedTeam(team || null)
                  }}
                  options={teams.map(team => ({
                    value: team.team_key,
                    label: team.team_name
                  }))}
                  placeholder="Pilih tim"
                  disabled={isLoadingTeams || !selectedLeague}
                  isLoading={isLoadingTeams}
                />
              </div>

              {selectedTeam && (
                <div className="bg-[#161616] border border-[#262626] rounded-sm p-3">
                  <div className="flex items-center gap-3">
                    {selectedTeam.team_badge && (
                      <img src={selectedTeam.team_badge} alt={selectedTeam.team_name} className="w-10 h-10 object-contain" />
                    )}
                    <div>
                      <div className="font-bold text-white text-sm">{selectedTeam.team_name}</div>
                      <div className="text-xs text-gray-500">{selectedTeam.team_name.split(' ').map((w: string) => w[0]).join('').toUpperCase()}</div>
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