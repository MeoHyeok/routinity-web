import { supabase } from './supabase'

const FUNCTIONS_BASE = 'https://noqvrfewkyfdrsoaszmz.supabase.co/functions/v1'

export class ApiError extends Error {}

/** Mirrors RoutinityApp's `friendlyErrorMessage` — edge functions always error with `{ "error": "..." }`. */
async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError('로그인이 필요해요.')

  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const json = text ? JSON.parse(text) : {}

  if (!res.ok) {
    if (res.status === 429) throw new ApiError('요청이 너무 많아요. 잠시 후 다시 시도해주세요.')
    throw new ApiError(typeof json.error === 'string' ? json.error : `요청 실패 (${res.status})`)
  }
  return json as T
}

// ---- /logs ----

export type LogType = 'wake' | 'sleep' | 'meal_start' | 'meal_end' | 'study_start' | 'study_end'

export interface LogEntry {
  id: string
  type: LogType
  timestamp: string
  created_at: string
}

export function logDisplayName(type: LogType): string {
  switch (type) {
    case 'wake': return '기상'
    case 'sleep': return '취침'
    case 'meal_start': return '식사 시작'
    case 'meal_end': return '식사 종료'
    case 'study_start': return '공부 시작'
    case 'study_end': return '공부 종료'
  }
}

// The backend buckets a "day" as a KST-labeled 기상→취침 session rather than UTC midnight, so
// the date param requested here has to be computed in KST too (see docs/api-contract.md in the
// routinity-ios repo — "하루의 정의").
export function kstDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date)
}

export async function fetchLogs(date: Date): Promise<LogEntry[]> {
  return call<LogEntry[]>(`logs?date=${kstDateKey(date)}`)
}

export async function recordLog(type: LogType, timestamp: Date): Promise<LogEntry> {
  return call<LogEntry>('logs', { method: 'POST', body: { type, timestamp: timestamp.toISOString() } })
}

export async function deleteLog(id: string): Promise<void> {
  await call<void>(`logs?id=${id}`, { method: 'DELETE' })
}

// ---- /goals ----

export const GoalTargetType = {
  wakeTime: 'wake_time',
  studyDuration: 'study_duration',
} as const

export interface Goal {
  id: string
  target_type: string
  target_value: string
  updated_at: string
}

export async function fetchGoals(): Promise<Goal[]> {
  return call<Goal[]>('goals')
}

export async function upsertGoal(targetType: string, targetValue: string): Promise<Goal> {
  return call<Goal>('goals', { method: 'POST', body: { target_type: targetType, target_value: targetValue } })
}

export async function deleteGoal(targetType: string): Promise<void> {
  await call<void>(`goals?target_type=${encodeURIComponent(targetType)}`, { method: 'DELETE' })
}

// ---- /scores ----

export interface ScoreEntry {
  target_type: string
  target_value: string
  actual_value: string | null
  status: 'achieved' | 'not_achieved' | 'missing'
}

export interface ScoresResponse {
  date: string
  daily_score: number | null
  scores: ScoreEntry[]
}

export async function fetchScores(date: Date): Promise<ScoresResponse> {
  return call<ScoresResponse>(`scores?date=${kstDateKey(date)}`)
}

// ---- /reports-daily, /reports-weekly, /reports-monthly ----

export interface TimeBreakdown {
  active_minutes: number
  meal_minutes: number
  study_minutes: number
  rest_minutes: number
}

export interface Report {
  period: string
  date?: string
  date_range?: { from: string; to: string }
  content: string
  cached: boolean
  generated_via?: 'claude' | 'template'
  time_breakdown?: TimeBreakdown
  suggested_action?: string
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export async function fetchReport(period: ReportPeriod): Promise<Report> {
  return call<Report>(`reports-${period}`)
}

// ---- /insights ----

export interface WeekdayAverage {
  weekday: number
  label: string
  avg_daily_score: number
  days_counted: number
}

export interface Insights {
  date_range: { from: string; to: string }
  weekday_averages: WeekdayAverage[]
  best_weekday: { weekday: number; label: string; avg_daily_score: number } | null
  worst_weekday: { weekday: number; label: string; avg_daily_score: number } | null
  trend: { direction: 'up' | 'down' | 'flat'; recent_avg: number; previous_avg: number } | null
}

export async function fetchInsights(): Promise<Insights> {
  return call<Insights>('insights')
}
