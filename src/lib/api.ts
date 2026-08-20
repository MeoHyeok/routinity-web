import { supabase } from './supabase'

const FUNCTIONS_BASE = 'https://noqvrfewkyfdrsoaszmz.supabase.co/functions/v1'

export class ApiError extends Error {}

// The backend's non-429/non-5xx error bodies are English field-validation messages (see
// docs/api-contract.md) — this was being passed straight through to the UI unmodified. Table of
// known messages first, then pattern matches for messages that vary by field (e.g. "goals" vs
// "logs" 400s), then a generic Korean fallback so an unrecognized message never leaks raw English
// — the raw text still goes to the console for debugging instead of disappearing silently.
const KNOWN_ERROR_TRANSLATIONS: Record<string, string> = {
  'log not found': '기록을 찾을 수 없어요.',
  'goal not found': '목표를 찾을 수 없어요.',
  'internal server error': '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
}
const ERROR_PATTERN_TRANSLATIONS: [RegExp, string][] = [
  [/target_value must be at most 1440/i, '공부 시간 목표는 하루 최대 1440분(24시간)까지 입력할 수 있어요.'],
  [/target_value must be a positive integer/i, '공부 시간 목표는 1 이상의 숫자(분)로 입력해주세요.'],
  [/target_value must be HH:MM/i, '기상 목표는 HH:MM(24시간) 형식으로 입력해주세요.'],
  [/type must be one of/i, '기록 종류가 올바르지 않아요.'],
  [/date query param is required|format YYYY-MM-DD/i, '날짜 형식이 올바르지 않아요.'],
]

function translateApiError(raw: string, status: number): string {
  if (KNOWN_ERROR_TRANSLATIONS[raw]) return KNOWN_ERROR_TRANSLATIONS[raw]
  for (const [pattern, translated] of ERROR_PATTERN_TRANSLATIONS) {
    if (pattern.test(raw)) return translated
  }
  console.error(`[api] untranslated error body (status ${status}):`, raw)
  return `요청을 처리하지 못했어요. (${status})`
}

let requestCounter = 0

/** Mirrors RoutinityApp's `friendlyErrorMessage` — edge functions always error with `{ "error": "..." }`. */
async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const requestId = ++requestCounter
  // Every call<T>() invocation logs here first, before anything can short-circuit it — so
  // "did the app's own logic ever attempt this request" is answered by whether an [api#N] line
  // exists at all, distinct from "-> "/"<- " below answering "did it reach the network / server."
  // Backend added structured request logging server-side, so cross-referencing request id and
  // timestamp answers "did this specific call ever arrive" when server instability is reported.
  console.info(`[api#${requestId}] call ${method} ${path}`)

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.error(`[api#${requestId}] BLOCKED BEFORE SENDING — no Supabase session (never reached fetch())`)
    throw new ApiError('로그인이 필요해요.')
  }

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
    const rawMessage = json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
      ? (json as { error: string }).error
      : null
    throw new ApiError(rawMessage ? translateApiError(rawMessage, res.status) : `요청 실패 (${res.status})`)
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

// Shifts a KST date-key by whole days, entirely in date-key space — shared by every caller that
// needs to step a KST calendar date (TodayPage's timeline picker, trend.ts's day windows) so the
// arithmetic (and its correctness) lives in exactly one place. Deliberately not Date.setDate,
// which shifts by a calendar day in the *runtime's* local timezone rather than KST. Reads the
// shifted date back off Date.UTC's own normalized fields instead of round-tripping through
// Intl.DateTimeFormat, since Date.UTC already resolves day-of-month over/underflow correctly.
export function shiftKstDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays))
  const yy = shifted.getUTCFullYear()
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export async function fetchLogs(date: Date): Promise<LogEntry[]> {
  return call<LogEntry[]>(`logs?date=${kstDateKey(date)}`)
}

export async function recordLog(type: LogType, timestamp: Date): Promise<LogEntry> {
  return call<LogEntry>('logs', { method: 'POST', body: { type, timestamp: timestamp.toISOString() } })
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
