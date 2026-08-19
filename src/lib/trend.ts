import { fetchLogs, fetchScores, kstDateKey } from './api'
import type { DailyTrendPoint } from './goalSuggestion'

// Ported from RoutinityApp/ViewModels/TrendViewModel.swift. Each day costs one /scores + one
// /logs call (both rate-limited at 60/min), so in-flight requests are capped rather than firing
// all `days` at once — the monthly (30-day) window would otherwise burst past the limit on its
// own, same bug fixed in the iOS client.
const MAX_CONCURRENT_DAYS = 10

function kstStartOfDay(date: Date): Date {
  // Rebuild "today at KST midnight" from the KST date-key, so day-stepping below stays in KST
  // regardless of the browser's local time zone.
  return new Date(`${kstDateKey(date)}T00:00:00+09:00`)
}

async function fetchDay(date: Date): Promise<DailyTrendPoint> {
  const [scoresResponse, logs] = await Promise.all([fetchScores(date), fetchLogs(date)])
  const hadMeal = logs.some((l) => l.type === 'meal_end')
  return { date, dailyScore: scoresResponse.daily_score, scores: scoresResponse.scores, hadMeal }
}

export async function loadTrend(days: number): Promise<DailyTrendPoint[]> {
  const today = kstStartOfDay(new Date())
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    return d
  })

  const results: DailyTrendPoint[] = []
  for (let i = 0; i < dates.length; i += MAX_CONCURRENT_DAYS) {
    const batch = dates.slice(i, i + MAX_CONCURRENT_DAYS)
    results.push(...(await Promise.all(batch.map(fetchDay))))
  }
  return results.sort((a, b) => a.date.getTime() - b.date.getTime())
}

const weekdayFormatter = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' })

export function weekdayLabel(date: Date): string {
  return weekdayFormatter.format(date)
}
