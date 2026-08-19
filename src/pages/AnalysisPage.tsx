import { useEffect, useState } from 'react'
import { Card } from '../components/Card'
import { loadTrend, weekdayLabel } from '../lib/trend'
import { fetchInsights, GoalTargetType, type Insights } from '../lib/api'
import {
  computeGoalSuggestion, computeMealIrregularityRate, computeTrendMissRate,
  type DailyTrendPoint, type GoalSuggestion,
} from '../lib/goalSuggestion'
import { GoalSuggestionCard } from '../components/GoalSuggestionCard'

type Window = 'weekly' | 'monthly'

export function AnalysisPage() {
  const [window, setWindow] = useState<Window>('weekly')
  const [points, setPoints] = useState<DailyTrendPoint[] | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setPoints(null)
    setErrorMessage(null)
    loadTrend(window === 'weekly' ? 7 : 30).then(setPoints).catch((e) => setErrorMessage(e.message))
  }, [window])

  useEffect(() => {
    fetchInsights().then(setInsights).catch(() => {})
  }, [])

  const averageScore = points?.length
    ? (() => {
        const scored = points.map((p) => p.dailyScore).filter((s): s is number => s !== null)
        return scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null
      })()
    : null

  const suggestion: GoalSuggestion | null = points ? computeGoalSuggestion(points) : null

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 pb-24">
      <div>
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-routinity-pink to-routinity-violet bg-clip-text text-transparent">루틴 분석</h1>
        <p className="text-sm text-white/60">기록을 바탕으로 패턴을 확인해보세요</p>
      </div>

      <div className="flex rounded-full bg-routinity-card p-1">
        {(['weekly', 'monthly'] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${window === w ? 'bg-white/15 text-white' : 'text-white/50'}`}
          >
            {w === 'weekly' ? '주간' : '월간'}
          </button>
        ))}
      </div>

      {!points ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          <Card glow>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-white/50">{window === 'weekly' ? '주간' : '월간'} 평균</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-routinity-violet to-routinity-pink bg-clip-text text-transparent">{averageScore ?? '-'}</p>
              </div>
              <ProgressRow title="루틴 준수" value={averageScore ?? 0} color="bg-routinity-violet" />
              <ProgressRow title="기상 규칙성" value={consistency(computeTrendMissRate(GoalTargetType.wakeTime, points))} color="bg-routinity-orange" />
              <ProgressRow title="공부 목표 달성도" value={consistency(computeTrendMissRate(GoalTargetType.studyDuration, points))} color="bg-routinity-cyan" />
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-white/60 mb-3">루틴 점수 추이</p>
            <TrendChart points={points} />
          </Card>

          <Card>
            <p className="text-sm font-semibold text-white/60 mb-3">루틴 로스 분석</p>
            <div className="flex flex-col gap-4">
              <LossRow title="기상 지연" rate={computeTrendMissRate(GoalTargetType.wakeTime, points)} color="bg-routinity-pink" />
              <LossRow title="공부 시작 지연" rate={computeTrendMissRate(GoalTargetType.studyDuration, points)} color="bg-routinity-orange" />
              <LossRow title="식사 불규칙" rate={computeMealIrregularityRate(points)} color="bg-routinity-violet" />
            </div>
          </Card>

          {insights?.best_weekday && insights.worst_weekday && insights.weekday_averages.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              <WeekdaySummary title="가장 좋은 요일" label={insights.best_weekday.label} score={insights.best_weekday.avg_daily_score} color="text-routinity-green" />
              <WeekdaySummary title="가장 아쉬운 요일" label={insights.worst_weekday.label} score={insights.worst_weekday.avg_daily_score} color="text-routinity-pink" />
            </div>
          )}

          {suggestion && <GoalSuggestionCard suggestion={suggestion} />}
        </>
      )}

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
    </div>
  )
}

function consistency(missRate: number | null): number {
  if (missRate === null) return 0
  return Math.round((1 - missRate) * 100)
}

function Spinner() {
  return <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
}

function ProgressRow({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/60 w-20 shrink-0">{title}</span>
      <div className="flex-1 h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
      <span className="text-xs font-semibold w-7 text-right">{value}</span>
    </div>
  )
}

function LossRow({ title, rate, color }: { title: string; rate: number | null; color: string }) {
  if (rate === null) return null
  const percent = Math.round(rate * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{title}</span>
        <span className="font-bold">{percent}%</span>
      </div>
      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function WeekdaySummary({ title, label, score, color }: { title: string; label: string; score: number; color: string }) {
  return (
    <Card className="!p-3">
      <p className="text-[10px] text-white/50">{title}</p>
      <p className="text-lg font-bold">{label}</p>
      <p className={`text-xs font-semibold ${color}`}>{score}점</p>
    </Card>
  )
}

function TrendChart({ points }: { points: DailyTrendPoint[] }) {
  const width = 320
  const height = 140
  const scored = points.filter((p) => p.dailyScore !== null) as (DailyTrendPoint & { dailyScore: number })[]
  if (scored.length < 2) {
    return <div className="h-[140px] flex items-center justify-center text-white/40 text-sm">데이터가 더 필요해요</div>
  }
  const xFor = (i: number) => (i / (points.length - 1)) * width
  const yFor = (score: number) => height - (score / 100) * height
  const path = scored.map((p) => `${xFor(points.indexOf(p))},${yFor(p.dailyScore)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[140px]">
      {[0, 25, 50, 75, 100].map((y) => (
        <line key={y} x1={0} x2={width} y1={height - (y / 100) * height} y2={height - (y / 100) * height} stroke="rgba(255,255,255,0.06)" />
      ))}
      <polyline points={path} fill="none" stroke="#8c5cf5" strokeWidth={2} />
      {scored.map((p) => (
        <circle key={p.date.toISOString()} cx={xFor(points.indexOf(p))} cy={yFor(p.dailyScore)} r={3} fill="#8c5cf5" />
      ))}
      {points.map((p, i) => (
        <text key={p.date.toISOString()} x={xFor(i)} y={height - 4} fontSize={9} fill="rgba(255,255,255,0.4)" textAnchor="middle">
          {i % Math.ceil(points.length / 7) === 0 ? weekdayLabel(p.date) : ''}
        </text>
      ))}
    </svg>
  )
}
