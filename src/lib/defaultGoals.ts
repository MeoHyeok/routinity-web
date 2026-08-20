import { fetchGoals, upsertGoal, GoalTargetType } from './api'

export const DEFAULT_WAKE_TIME = '08:00'
export const DEFAULT_STUDY_MINUTES = '300'

/**
 * Auto-sets starter goals (기상 08:00, 공부 300분) for a user who hasn't set any — product
 * decision to stop making goal-less users manually opt in, since /reports-* and the score ring
 * are far more useful once *some* goal exists. Only fills in whichever of the two is actually
 * missing, so it never overwrites goals the user (or an earlier call to this same function) has
 * already set — safe to call every time onboarding finishes, including for an account that has
 * goals from elsewhere (e.g. iOS) by the time it first reaches onboarding on this browser.
 */
export async function ensureDefaultGoals(): Promise<void> {
  const goals = await fetchGoals()
  const hasWakeGoal = goals.some((g) => g.target_type === GoalTargetType.wakeTime)
  const hasStudyGoal = goals.some((g) => g.target_type === GoalTargetType.studyDuration)

  const tasks: Promise<unknown>[] = []
  if (!hasWakeGoal) tasks.push(upsertGoal(GoalTargetType.wakeTime, DEFAULT_WAKE_TIME))
  if (!hasStudyGoal) tasks.push(upsertGoal(GoalTargetType.studyDuration, DEFAULT_STUDY_MINUTES))
  await Promise.all(tasks)
}
