import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom'
import { CircleDashed, BarChart3, Sparkles, type LucideIcon } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Spinner } from './components/Spinner'
import { AuthPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { TodayPage } from './pages/TodayPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { AICoachPage } from './pages/AICoachPage'
import { GoalsPage } from './pages/GoalsPage'
import { SettingsPage } from './pages/SettingsPage'

// Shown once — the very first time a given *account* reaches the authenticated app on this
// browser, whether that's right after signup or the first sign-in after confirming an email.
// localStorage (not a server round trip) so a one-time tutorial doesn't cost a network call, but
// keyed per-account rather than one fixed device-wide key — a fixed key meant a second account
// signing in on the same browser silently inherited the first account's "already seen" state and
// never saw onboarding (or the default-goals auto-set it triggers) at all. Read directly off
// localStorage each render instead of caching in state, so it re-evaluates correctly whenever
// `session.user.id` changes (e.g. one account signs out and a different one signs in without a
// full page reload); `onboardingVersion` is just a dummy trigger to force a re-render after
// onFinish writes to localStorage, since that write alone doesn't cause React to re-render.
function onboardingKeyFor(userId: string): string {
  return `hasSeenOnboarding:${userId}`
}

function RootGate() {
  const { session, hasLoadedInitialSession } = useAuth()
  const [, setOnboardingVersion] = useState(0)

  if (!hasLoadedInitialSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!session) return <AuthPage />

  const onboardingKey = onboardingKeyFor(session.user.id)
  const hasSeenOnboarding = localStorage.getItem(onboardingKey) === 'true'
  if (!hasSeenOnboarding) {
    return <OnboardingPage onFinish={() => { localStorage.setItem(onboardingKey, 'true'); setOnboardingVersion((v) => v + 1) }} />
  }

  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/ai-coach" element={<AICoachPage />} />
      </Route>
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function TabLayout() {
  return (
    <>
      <Outlet />
      <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto flex justify-around bg-routinity-card/90 backdrop-blur border-t border-routinity-border py-2.5">
        <TabLink to="/" icon={CircleDashed} label="오늘" />
        <TabLink to="/analysis" icon={BarChart3} label="분석" />
        <TabLink to="/ai-coach" icon={Sparkles} label="AI 코치" />
      </nav>
    </>
  )
}

function TabLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `flex flex-col items-center gap-1 text-xs px-4 ${isActive ? 'text-routinity-violet' : 'text-white/50'}`}
    >
      <Icon className="w-4.5 h-4.5" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <RootGate />
      </HashRouter>
    </AuthProvider>
  )
}
