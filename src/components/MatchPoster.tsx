'use client'

import { useRef } from 'react'
import { Trophy, Circle } from 'lucide-react'

interface MatchPosterProps {
  homeTeamName: string
  awayTeamName: string
  homeTeamLogo?: string
  awayTeamLogo?: string
  homeScore: number
  awayScore: number
  round?: number
  phase?: string
  date?: string
  goalTimeline?: { team: 'home' | 'away', playerName: string, minute: number }[]
}

export default function MatchPoster({
  homeTeamName,
  awayTeamName,
  homeTeamLogo,
  awayTeamLogo,
  homeScore,
  awayScore,
  round,
  phase,
  date,
  goalTimeline = []
}: MatchPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={posterRef} className="relative bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] w-[800px] h-[450px] overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0, 255, 102, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(0, 255, 102, 0.1) 0%, transparent 50%)'
        }} />
      </div>

      {/* Logo watermark */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 z-0">
        <img 
          src="/img/logoppleague.webp" 
          alt="PPLG League" 
          className="w-64 h-32 object-contain"
        />
      </div>

      {/* Top branding */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
        <div>
          <div className="text-[#00FF66] font-black text-2xl tracking-wider">PPLG LEAGUE</div>
          {phase && (
            <div className="text-gray-400 text-sm font-medium uppercase tracking-widest mt-1 flex items-center gap-2">
              {phase === 'tournament' ? (
                <>
                  <Trophy className="w-4 h-4" />
                  TOURNAMENT
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4" />
                  LEAGUE
                </>
              )}
            </div>
          )}
        </div>
        {date && (
          <div className="text-right">
            <div className="text-gray-500 text-xs uppercase tracking-wider">Matchday</div>
            <div className="text-white font-bold">{date}</div>
          </div>
        )}
      </div>

      {/* VS / Score section */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="flex items-center gap-8">
          {/* Home team */}
          <div className="flex flex-col items-center w-48">
            {homeTeamLogo && (
              <div className="w-24 h-24 mb-4 bg-white/5 rounded-full p-3 flex items-center justify-center backdrop-blur-sm border border-white/10">
                <img src={homeTeamLogo} alt={homeTeamName} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="text-white font-bold text-center text-lg leading-tight">
              {homeTeamName}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-4">
              <div className="text-[#00FF66] font-black text-6xl">{homeScore}</div>
              <div className="text-gray-600 font-black text-4xl">-</div>
              <div className="text-[#00FF66] font-black text-6xl">{awayScore}</div>
            </div>
            <div className="text-gray-500 text-xs uppercase tracking-[0.3em] mt-3">Full Time</div>
          </div>

          {/* Away team */}
          <div className="flex flex-col items-center w-48">
            {awayTeamLogo && (
              <div className="w-24 h-24 mb-4 bg-white/5 rounded-full p-3 flex items-center justify-center backdrop-blur-sm border border-white/10">
                <img src={awayTeamLogo} alt={awayTeamName} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="text-white font-bold text-center text-lg leading-tight">
              {awayTeamName}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Timeline */}
      {goalTimeline.length > 0 && (
        <div className="absolute bottom-20 left-6 right-6 z-10">
          <div className="bg-black/30 backdrop-blur-sm rounded-sm p-3 border border-white/10">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Goal Timeline</div>
            <div className="flex flex-wrap gap-2">
              {goalTimeline.map((goal, index) => (
                <div
                  key={index}
                  className={`text-xs px-2 py-1 rounded-sm ${
                    goal.team === 'home' 
                      ? 'bg-[#00FF66]/20 text-[#00FF66]' 
                      : 'bg-blue-500/20 text-blue-500'
                  }`}
                >
                  {goal.playerName} {goal.minute}'
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end z-10">
        {round && (
          <div>
            <div className="text-gray-600 text-xs uppercase tracking-wider">Round</div>
            <div className="text-white font-bold text-xl">{round}</div>
          </div>
        )}
        <div className="text-right">
          <div className="text-[#00FF66] font-black text-sm tracking-wider">MATCH RESULT</div>
          <div className="text-gray-500 text-xs mt-1">Official Score</div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-1 h-32 bg-gradient-to-b from-transparent via-[#00FF66]/30 to-transparent transform -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-1 h-32 bg-gradient-to-b from-transparent via-[#00FF66]/30 to-transparent transform -translate-y-1/2" />
    </div>
  )
}
