import { fetchLogs, fetchScores, kstDateKey, shiftKstDateKey } from './api'
import type { DailyTrendPoint } from './goalSuggestion'

// Ported from RoutinityApp/ViewModels/TrendViewModel.swift. Each day costs one /scores + one
// /logs call (both rate-limited at 60/min), so in-flight requests are capped rather than firing
// all `days` at once — the monthly (30-day) window would otherwise burst past the limit on its
// own, same bug fixed in the iOS client.
const MAX_CONCURRENT_DAYS = 10

// Builds a `days`-length window via shiftKstDateKey (shared with TodayPage's own day-stepping),
// ending `endOffsetDays` before today — 0 (the default) ends on today itself, 1 ends on
// yesterday. The offset lets a caller that already has today's score from elsewhere (TodayPage)
// fetch just the preceding days instead of re-fetching today a second time.
function kstDateWindow(days: number, endOffsetDays = 0): Date[] {
  const todayKey = kstDateKey(new Date())
  return Array.from({ length: days }, (_, i) => {
    const delta = -(days - 1 - i) - endOffsetDays
    return new Date(`${shiftKstDateKey(todayKey, delta)}T00:00:00+09:00`)
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
// analysis (AnalysisPage). `endOffsetDays` forwards to kstDateWindow so a caller that already has
// today's score from elsewhere (TodayPage's own fetchScores(today) call, needed there for the
// full ScoreEntry list a bare ScoreTrendPoint doesn't carry) can fetch just the preceding days
// instead of hitting /scores for today a second time.
export async function loadScoreTrend(days: number, endOffsetDays = 0): Promise<ScoreTrendPoint[]> {
  const results = await fetchInBatches(kstDateWindow(days, endOffsetDays), fetchDayScoreOnly)
  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })

export function weekdayLabel(date: Date): string {
  return weekdayFormatter.format(date)
}
