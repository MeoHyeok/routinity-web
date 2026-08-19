import { fetchLogs, type LogEntry } from './api'
import { computeRoutineDayMetrics } from './routineDayMetrics'

/**
 * Same fallback as RoutinityApp's `LogsViewModel.loadTodayIncludingCarryover`: a session is
 * labeled by the KST date of the 기상 log that opened it, so a user who never logs 취침 and
 * reopens the app after KST midnight would otherwise see an empty "오늘". If today's own fetch
 * has no 기상 at all, check yesterday for a still-open session (via the same
 * computeRoutineDayMetrics used for on-screen metrics, not a re-derived check) and show that
 * instead.
 */
export async function fetchTodayLogsWithCarryover(): Promise<{ logs: LogEntry[]; isCarryover: boolean }> {
  const today = await fetchLogs(new Date())
  if (today.some((l) => l.type === 'wake')) return { logs: today, isCarryover: false }

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const priorLogs = await fetchLogs(yesterday).catch(() => [] as LogEntry[])
  if (computeRoutineDayMetrics(priorLogs).wakeOpenSince === null) return { logs: today, isCarryover: false }
  return { logs: priorLogs, isCarryover: true }
}
