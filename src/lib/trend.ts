import { fetchLogs, fetchScores, kstDateKey } from './api'
import type { DailyTrendPoint } from './goalSuggestion'

// Ported from RoutinityApp/ViewModels/TrendViewModel.swift. Each day costs one /scores + one
// /logs call (both rate-limited at 60/min), so in-flight requests are capped rather than firing
// all `days` at once — the monthly (30-day) window would otherwise burst past the limit on its
// own, same bug fixed in the iOS client.
const MAX_CONCURRENT_DAYS = 10

// Builds the `days`-length window ending today, entirely via KST date-key arithmetic (not
// Date.setDate, which shifts by a calendar day in the *runtime's* local timezone) — same
// reasoning as TodayPage's shiftKstDate: a day-step must land on the same KST date regardless of
// what timezone the browser itself is in, including across a DST transition in that timezone.
function kstDateWindow(days: number): Date[] {
  const [y, m, d] = kstDateKey(new Date()).split('-').map(Number)
  return Array.from({ length: days }, (_, i) => {
    const delta = days - 1 - i
    const utcMidnight = new Date(Date.UTC(y, m - 1, d - delta))
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(utcMidnight)
    return new Date(`${dateKey}T00:00:00+09:00`)
  })
}

async function fetchInBatches<T>(dates: Date[], fetchOne: (date: Date) => Promise<T>): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < dates.length; i += MAX_CONCURRENT_DAYS) {
    const batch = dates.slice(i, i + MAX_CONCURRENT_DAYS)
    results.push(...(await Promise.all(batch.map(fetchOne))))
  }
  return results
}

async function fetchDay(date: Date): Promise<DailyTrendPoint> {
  const [scoresResponse, logs] = await Promise.all([fetchScores(date), fetchLogs(date)])
  const hadMeal = logs.some((l) => l.type === 'meal_end')
  return { date, dailyScore: scoresResponse.daily_score, scores: scoresResponse.scores, hadMeal }
}

export async function loadTrend(days: number): Promise<DailyTrendPoint[]> {
  const results = await fetchInBatches(kstDateWindow(days), fetchDay)
  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export interface ScoreTrendPoint {
  date: Date
  dailyScore: number | null
}

async function fetchDayScoreOnly(date: Date): Promise<ScoreTrendPoint> {
  const scoresResponse = await fetchScores(date)
  return { date, dailyScore: scoresResponse.daily_score }
}

// Same window as loadTrend but skips the /logs fetch per day — for callers (TodayPage) that only
// need each day's score (streak/personal-average), not its meal history. Halves the request count
// for those callers instead of piggy-backing on the heavier fetchDay used for meal-irregularity
// analysis (AnalysisPage).
export async function loadScoreTrend(days: number): Promise<ScoreTrendPoint[]> {
  const results = await fetchInBatches(kstDateWindow(days), fetchDayScoreOnly)
  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })

export function weekdayLabel(date: Date): string {
  return weekdayFormatter.format(date)
}
