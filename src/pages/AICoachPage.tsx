import { useEffect, useState } from 'react'
import { Sparkles, Lightbulb } from 'lucide-react'
import { Card } from '../components/Card'
import { GoalSuggestionCard } from '../components/GoalSuggestionCard'
import { fetchReport, type Report, type ReportPeriod } from '../lib/api'
import { loadTrend } from '../lib/trend'
import { computeGoalSuggestion, type DailyTrendPoint, type GoalSuggestion } from '../lib/goalSuggestion'

const periods: { key: ReportPeriod; label: string }[] = [
  { key: 'daily', label: '오늘' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
]

export function AICoachPage() {
  const [period, setPeriod] = useState<ReportPeriod>('daily')
  const [report, setReport] = useState<Report | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [points, setPoints] = useState<DailyTrendPoint[]>([])

  useEffect(() => {
    // Same stale-response guard as AnalysisPage: a slower request for a period the user has
    // since navigated away from shouldn't be able to overwrite what's on screen after a newer
    // one already resolved.
    let ignore = false
    setIsLoading(true)
    setReport(null)
    setErrorMessage(null)
    fetchReport(period)
      .then((result) => { if (!ignore) setReport(result) })
      .catch((e) => { if (!ignore) setErrorMessage(e.message) })
      .finally(() => { if (!ignore) setIsLoading(false) })
    return () => { ignore = true }
  }, [period])

  useEffect(() => {
    // Loaded once, not tied to `period` — purely to ground the goal-suggestion card in real
    // recent data, same 14-day window TodayPage's streak calc already uses.
    loadTrend(14).then(setPoints).catch(() => {})
  }, [])

  const suggestion: GoalSuggestion | null = computeGoalSuggestion(points)

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 pb-24">
      <div>
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-routinity-pink to-routinity-violet bg-clip-text text-transparent">AI 코치</h1>
        <p className="text-sm text-white/60">루틴을 바탕으로 한 코멘트를 받아보세요</p>
      </div>

      <div className="flex rounded-full bg-routinity-card p-1">
        {periods.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${period === key ? 'bg-white/15 text-white' : 'text-white/50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
      ) : report ? (
        <>
          <Card glow>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold text-white/60 flex-1">
                {/* Backend now reports the actual model behind generated_via (e.g. "claude",
                    "gemini") rather than always "claude", so this checks for "not template"
                    instead of hardcoding one provider's name — matches iOS's same fix. */}
                {report.generated_via && report.generated_via !== 'template' ? 'AI 생성 리포트' : '기본 템플릿 리포트'}
              </span>
              {report.cached && <span className="text-[10px] font-semibold text-white/60 bg-white/8 rounded-full px-2 py-0.5">캐시됨</span>}
            </div>
            {report.date_range && (
              <p className="text-[10px] text-white/40 mb-2">{report.date_range.from} ~ {report.date_range.to}</p>
            )}
            <p className="whitespace-pre-wrap text-[15px]">{report.content}</p>
          </Card>

          {report.suggested_action && (
            <Card glow>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-routinity-orange" />
                <span className="text-sm font-semibold">다음 액션 제안</span>
              </div>
              <p className="text-[15px]">{report.suggested_action}</p>
            </Card>
          )}

          {suggestion && <GoalSuggestionCard suggestion={suggestion} />}

          {report.time_breakdown && <TimeBreakdown breakdown={report.time_breakdown} />}
        </>
      ) : errorMessage ? (
        <p className="text-sm text-red-400">{errorMessage}</p>
      ) : null}
    </div>
  )
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

function TimeBreakdown({ breakdown }: { breakdown: NonNullable<Report['time_breakdown']> }) {
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
