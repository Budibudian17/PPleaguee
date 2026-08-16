'use client'

import { useRef } from 'react'
import { Trophy } from 'lucide-react'

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
  goalTimeline?: { team: 'home' | 'away', playerName: string, minute: number, isPenalty?: boolean }[]
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
    <div ref={posterRef} className="relative bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] w-[450px] h-[600px] overflow-hidden flex flex-col justify-between p-6 select-none">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0, 255, 102, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(0, 255, 102, 0.1) 0%, transparent 50%)'
        }} />
      </div>

      {/* Logo watermark */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5 z-0 pointer-events-none">
        <img 
          src="/img/logoppleague.webp" 
          alt="PPLG League" 
          className="w-64 h-32 object-contain"
        />
      </div>

      {/* Top branding */}
      <div className="flex justify-between items-start z-10 w-full">
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

      {/* Main Content (Teams, Score & Goal Scorers) */}
      <div className="my-auto z-10 w-full flex flex-col gap-6 py-4">
        {/* Teams & Score Section */}
        <div className="grid grid-cols-3 items-center w-full">
          {/* Home team */}
          <div className={`flex flex-col items-center justify-center ${homeScore > awayScore ? 'opacity-100' : 'opacity-75'}`}>
            {homeTeamLogo && (
              <div className={`w-16 h-16 mb-2 rounded-full p-2 flex items-center justify-center backdrop-blur-sm border ${homeScore > awayScore ? 'bg-[#00FF66]/10 border-[#00FF66]/30' : 'bg-white/5 border-white/10'}`}>
                <img src={homeTeamLogo} alt={homeTeamName} className="w-full h-full object-contain" />
              </div>
            )}
            <div className={`font-bold text-center text-sm leading-tight ${homeScore > awayScore ? 'text-[#00FF66]' : 'text-white'}`}>
              {homeTeamName}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center gap-2">
              <div className={`font-black text-4xl ${homeScore > awayScore ? 'text-[#00FF66]' : awayScore > homeScore ? 'text-gray-500' : 'text-[#00FF66]'}`}>{homeScore}</div>
              <div className="text-gray-600 font-black text-2xl">-</div>
              <div className={`font-black text-4xl ${awayScore > homeScore ? 'text-blue-500' : homeScore > awayScore ? 'text-gray-500' : 'text-blue-500'}`}>{awayScore}</div>
            </div>
            <div className="text-gray-500 text-xs uppercase tracking-[0.2em] mt-1">Full Time</div>
          </div>

          {/* Away team */}
          <div className={`flex flex-col items-center justify-center ${awayScore > homeScore ? 'opacity-100' : 'opacity-75'}`}>
            {awayTeamLogo && (
              <div className={`w-16 h-16 mb-2 rounded-full p-2 flex items-center justify-center backdrop-blur-sm border ${awayScore > homeScore ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}>
                <img src={awayTeamLogo} alt={awayTeamName} className="w-full h-full object-contain" />
              </div>
            )}
            <div className={`font-bold text-center text-sm leading-tight ${awayScore > homeScore ? 'text-blue-500' : 'text-white'}`}>
              {awayTeamName}
            </div>
          </div>
        </div>

        {/* Goal Scorers Timeline Section */}
        {goalTimeline.length > 0 && (
          <div className="grid grid-cols-2 gap-4 w-full border-t border-white/5 pt-4">
            {/* Home team goal scorers */}
            <div className="flex flex-col items-end gap-1.5 pr-2">
              {goalTimeline
                .filter(g => g.team === 'home')
                .sort((a, b) => a.minute - b.minute)
                .map((goal, index) => (
                  <div key={index} className="text-xs font-medium flex items-center gap-1.5 justify-end">
                    <span className="text-gray-500 text-[11px]">{goal.minute}'</span>
                    <span className={homeScore > awayScore ? 'text-[#00FF66]' : 'text-gray-300'}>
                      {goal.playerName}
                    </span>
                    {goal.isPenalty ? (
                      <img src="/img/goalspenalti.webp" alt="Penalty" className="w-3.5 h-3.5" />
                    ) : (
                      <img src="/img/golsbiasa.webp" alt="Goal" className="w-3.5 h-3.5" />
                    )}
                  </div>
                ))}
            </div>

            {/* Away team goal scorers */}
            <div className="flex flex-col items-start gap-1.5 pl-2">
              {goalTimeline
                .filter(g => g.team === 'away')
                .sort((a, b) => a.minute - b.minute)
                .map((goal, index) => (
                  <div key={index} className="text-xs font-medium flex items-center gap-1.5 justify-start">
                    {goal.isPenalty ? (
                      <img src="/img/goalspenalti.webp" alt="Penalty" className="w-3.5 h-3.5" />
                    ) : (
                      <img src="/img/golsbiasa.webp" alt="Goal" className="w-3.5 h-3.5" />
                    )}
                    <span className={awayScore > homeScore ? 'text-blue-500' : 'text-gray-300'}>
                      {goal.playerName}
                    </span>
                    <span className="text-gray-500 text-[11px]">{goal.minute}'</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="flex justify-between items-end z-10 w-full">
        {round ? (
          <div>
            <div className="text-gray-600 text-xs uppercase tracking-wider">Round</div>
            <div className="text-white font-bold text-xl">{round}</div>
          </div>
        ) : <div />}
        <div className="text-right">
          <div className="text-[#00FF66] font-black text-sm tracking-wider">MATCH RESULT</div>
          <div className="text-gray-500 text-xs mt-1">Official Score</div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-0 w-1 h-32 bg-gradient-to-b from-transparent via-[#00FF66]/30 to-transparent transform -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-1 h-32 bg-gradient-to-b from-transparent via-[#00FF66]/30 to-transparent transform -translate-y-1/2 pointer-events-none" />
    </div>
  )
}