import { GoalTargetType, type ScoreEntry } from './api'

// Ported from RoutinityApp/Services/GoalSuggestion.swift.
export interface DailyTrendPoint {
  date: Date
  dailyScore: number | null
  scores: ScoreEntry[]
  hadMeal: boolean
}

function entryFor(point: DailyTrendPoint, targetType: string): ScoreEntry | undefined {
  return point.scores.find((s) => s.target_type === targetType)
}

export interface GoalSuggestion {
  lossTitle: string
  missRate: number
  suggestedLabel: string
  suggestedWakeTime: string | null
  suggestedStudyMinutes: string | null
}

function missRate(targetType: string, points: DailyTrendPoint[]): number | null {
  const entries = points.map((p) => entryFor(p, targetType)).filter((e): e is ScoreEntry => !!e)
  if (entries.length === 0) return null
  const missed = entries.filter((e) => e.status !== 'achieved').length
  return missed / entries.length
}

function minutesFromTimeString(value: string): number | null {
  const parts = value.split(':')
  if (parts.length !== 2) return null
  const hour = Number(parts[0])
  const minute = Number(parts[1])
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

function timeStringFromMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function averageActualWakeMinutes(points: DailyTrendPoint[]): number | null {
  const values = points
    .map((p) => entryFor(p, GoalTargetType.wakeTime)?.actual_value)
    .filter((v): v is string => !!v)
    .map(minutesFromTimeString)
    .filter((v): v is number => v !== null)
  if (values.length < 3) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function averageActualStudyMinutes(points: DailyTrendPoint[]): number | null {
  const values = points
    .map((p) => entryFor(p, GoalTargetType.studyDuration)?.actual_value)
    .filter((v): v is string => !!v)
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v))
  if (values.length < 3) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

export function computeGoalSuggestion(points: DailyTrendPoint[]): GoalSuggestion | null {
  const wakeMissRate = missRate(GoalTargetType.wakeTime, points) ?? 0
  const studyMissRate = missRate(GoalTargetType.studyDuration, points) ?? 0
  const overallMissRate = Math.max(wakeMissRate, studyMissRate)
  if (overallMissRate < 0.3) return null

  if (wakeMissRate >= studyMissRate) {
    const minutes = averageActualWakeMinutes(points)
    if (minutes === null) return null
    const label = timeStringFromMinutes(minutes)
    return { lossTitle: '기상 지연', missRate: wakeMissRate, suggestedLabel: label, suggestedWakeTime: label, suggestedStudyMinutes: null }
  } else {
    const minutes = averageActualStudyMinutes(points)
    if (minutes === null || minutes <= 0) return null
    return {
      lossTitle: '공부 시간 부족', missRate: studyMissRate, suggestedLabel: `${minutes}분`,
      suggestedWakeTime: null, suggestedStudyMinutes: String(minutes),
    }
  }
}

export function computeTrendMissRate(targetType: string, points: DailyTrendPoint[]): number | null {
  return missRate(targetType, points)
}

export function computeMealIrregularityRate(points: DailyTrendPoint[]): number | null {
  if (points.length === 0) return null
  const missed = points.filter((p) => !p.hadMeal).length
  return missed / points.length
}

// Takes just the score-bearing shape rather than the full DailyTrendPoint, so callers that only
// loaded scores (e.g. TodayPage via loadScoreTrend, which skips the /logs fetch DailyTrendPoint's
// `scores`/`hadMeal` fields would need) can pass their lighter points straight through.
interface ScoredPoint {
  dailyScore: number | null
}

export function computeStreakDays(points: ScoredPoint[]): number {
  let count = 0
  for (let i = points.length - 1; i >= 0; i--) {
    const score = points[i].dailyScore
    if (score === null || score < 80) break
    count++
  }
  return count
}

export function computePersonalAverageScore(points: ScoredPoint[]): number | null {
  const priorScores = points.slice(0, -1).map((p) => p.dailyScore).filter((s): s is number => s !== null)
  if (priorScores.length === 0) return null
  return Math.round(priorScores.reduce((a, b) => a + b, 0) / priorScores.length)
}
