import { Card } from './Card'
import type { Report } from '../lib/api'

// Shared by AICoachPage and SleepReportModal — donut chart of 식사/공부/휴식 within the day's
// 기상~취침 window.
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export function TimeBreakdown({ breakdown }: { breakdown: NonNullable<Report['time_breakdown']> }) {
  const segments = [
    { label: '식사', minutes: breakdown.meal_minutes, color: '#ed619e' },
    { label: '공부', minutes: breakdown.study_minutes, color: '#4dc7ed' },
    { label: '휴식', minutes: breakdown.rest_minutes, color: '#8c5cf5' },
  ]
  const total = segments.reduce((sum, s) => sum + s.minutes, 0)
  let cumulative = 0
  return (
    <Card>
      <p className="text-sm font-semibold text-white/60 mb-4">24시간 시간 분배</p>
      <div className="flex gap-6 items-center">
        <div className="relative w-[110px] h-[110px] shrink-0">
          {total > 0 ? (
            <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
              {segments.map((s) => {
                const r = 48
                const c = 2 * Math.PI * r
                const dash = (s.minutes / total) * c
                const offset = (cumulative / total) * c
                cumulative += s.minutes
                return (
                  <circle key={s.label} cx="55" cy="55" r={r} fill="none" stroke={s.color} strokeWidth="14"
                    strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} />
                )
              })}
            </svg>
          ) : (
            <svg viewBox="0 0 110 110" className="w-full h-full">
              <circle cx="55" cy="55" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            </svg>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-bold">{formatDuration(breakdown.active_minutes)}</span>
            <span className="text-[10px] text-white/50">활동 시간</span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-white/60 w-10">{s.label}</span>
              <span className="font-semibold">{formatDuration(s.minutes)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
