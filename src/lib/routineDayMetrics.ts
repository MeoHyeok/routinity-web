import type { LogEntry, LogType } from './api'

// Ported from RoutinityApp/Services/RoutineDayMetrics.swift — keep in sync if the iOS logic
// changes. Pure computation over a day's raw logs, no side effects.
export interface RoutineDayMetrics {
  wakeOpenSince: Date | null
  mealOpenSince: Date | null
  studyOpenSince: Date | null
  hasLoggedWake: boolean
  hasLoggedSleep: boolean
  actualWakeTime: Date | null
  totalMealMinutes: number
  totalStudyMinutes: number
  hasClosedMealSession: boolean
  hasClosedStudySession: boolean
  restMinutesSoFar: number | null
}

export function computeRoutineDayMetrics(logs: LogEntry[], now: Date = new Date()): RoutineDayMetrics {
  const sorted = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  function openStart(startType: LogType, endType: LogType): Date | null {
    let open: Date | null = null
    for (const log of sorted) {
      if (log.type === startType) open = new Date(log.timestamp)
      else if (log.type === endType) open = null
    }
    return open
  }

  function totalMinutes(startType: LogType, endType: LogType): number {
    let total = 0
    let openStartTime: Date | null = null
    for (const log of sorted) {
      if (log.type === startType) {
        openStartTime = new Date(log.timestamp)
      } else if (log.type === endType && openStartTime) {
        total += Math.max(0, Math.floor((new Date(log.timestamp).getTime() - openStartTime.getTime()) / 60000))
        openStartTime = null
      }
    }
    return total
  }

  function hasClosedSession(startType: LogType, endType: LogType): boolean {
    let openStartTime: Date | null = null
    for (const log of sorted) {
      if (log.type === startType) openStartTime = new Date(log.timestamp)
      else if (log.type === endType && openStartTime) return true
    }
    return false
  }

  const totalMealMinutes = totalMinutes('meal_start', 'meal_end')
  const totalStudyMinutes = totalMinutes('study_start', 'study_end')
  const actualWakeTime = sorted.find((l) => l.type === 'wake')
  const actualWakeDate = actualWakeTime ? new Date(actualWakeTime.timestamp) : null

  const restMinutesSoFar = actualWakeDate
    ? Math.max(0, Math.floor((now.getTime() - actualWakeDate.getTime()) / 60000) - totalMealMinutes - totalStudyMinutes)
    : null

  return {
    wakeOpenSince: openStart('wake', 'sleep'),
    mealOpenSince: openStart('meal_start', 'meal_end'),
    studyOpenSince: openStart('study_start', 'study_end'),
    hasLoggedWake: logs.some((l) => l.type === 'wake'),
    hasLoggedSleep: logs.some((l) => l.type === 'sleep'),
    actualWakeTime: actualWakeDate,
    totalMealMinutes,
    totalStudyMinutes,
    hasClosedMealSession: hasClosedSession('meal_start', 'meal_end'),
    hasClosedStudySession: hasClosedSession('study_start', 'study_end'),
    restMinutesSoFar,
  }
}

export function durationLabel(minutes: number, hasClosedSession: boolean): string {
  if (minutes > 0) return `${minutes}분`
  if (hasClosedSession) return '1분 미만'
  return '-'
}
