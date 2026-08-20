import { Sun, MoonStar, Utensils, BookOpen, CheckCircle, Lock, type LucideIcon } from 'lucide-react'
import type { LogType } from '../lib/api'

// Mirrors RoutinityApp's LogEntry.LogType.symbolName (SF Symbols) so 오늘/타임라인 use the same
// icon per log type as iOS, just via Lucide's closest equivalent instead of SF Symbols directly.
const iconByType: Record<LogType, LucideIcon> = {
  wake: Sun,
  sleep: MoonStar,
  meal_start: Utensils,
  meal_end: CheckCircle,
  study_start: BookOpen,
  study_end: CheckCircle,
}

export function LogTypeIcon({ type, locked, className }: { type: LogType; locked?: boolean; className?: string }) {
  const Icon = locked ? Lock : iconByType[type]
  return <Icon className={className} />
}
