import { supabase } from './supabase'

const FUNCTIONS_BASE = 'https://noqvrfewkyfdrsoaszmz.supabase.co/functions/v1'

export class ApiError extends Error {}

let requestCounter = 0

/** Mirrors RoutinityApp's `friendlyErrorMessage` — edge functions always error with `{ "error": "..." }`. */
async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError('로그인이 필요해요.')

  const method = options.method ?? 'GET'
  const requestId = ++requestCounter
  // Distinguishes "the request never left the browser" (fetch() itself throws — a network
  // failure, CORS block, or something upstream like an extension/CSP intercepting it before it
  // ever reaches Supabase) from "the request reached the server and it responded" (fetch()
  // resolves with a Response, even for 4xx/5xx). Backend added structured request logging
  // server-side, so cross-referencing request id/timestamp here against their logs answers
  // "did this specific call ever arrive" when server instability is reported.
  console.info(`[api#${requestId}] -> ${method} ${path}`)

  let res: Response
  try {
    res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch (e) {
    console.error(`[api#${requestId}] NETWORK-LEVEL FAILURE — request never reached the server (fetch() itself threw):`, e)
    throw e
  }
  console.info(`[api#${requestId}] <- ${res.status} ${method} ${path}`)

  if (res.status === 204) return undefined as T
  if (res.status === 429) throw new ApiError('요청이 너무 많아요. 잠시 후 다시 시도해주세요.')

  const text = await res.text()
  let json: unknown = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // Non-JSON body (e.g. an infra-level error page) shouldn't leak a raw parse error to the UI.
      throw new ApiError(res.ok ? '서버 응답을 처리하지 못했어요.' : `요청 실패 (${res.status})`)
    }
  }

  if (!res.ok) {
    const message = json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
      ? (json as { error: string }).error
      : `요청 실패 (${res.status})`
    throw new ApiError(message)
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
  // The actual generation engine (e.g. "claude", "gemini") when a fresh report was generated,
  // or "template" for the rule-based fallback — not narrowed to a fixed union since the backend
  // can swap engines without a client update as long as callers treat anything but "template" as
  // AI-generated (see AICoachPage).
  generated_via?: string
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
  // Consecutive days (counting back from today) with at least one log — unlike TodayPage's
  // computeStreakDays (which requires daily_score >= 80 and so is always 0 without goals), this
  // counts activity regardless of whether any goal is set. 0 if today has no logs yet.
  current_streak_days: number
}

export async function fetchInsights(): Promise<Insights> {
  return call<Insights>('insights')
}
