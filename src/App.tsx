import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom'
import { CircleDashed, BarChart3, Sparkles, type LucideIcon } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { TodayPage } from './pages/TodayPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { AICoachPage } from './pages/AICoachPage'
import { GoalsPage } from './pages/GoalsPage'
import { SettingsPage } from './pages/SettingsPage'

// Shown once — the very first time this browser reaches the authenticated app, whether that's
// right after signup or the first sign-in after confirming an email. Deliberately device-local
// (localStorage) rather than per-account, same tradeoff RootView.swift makes on iOS: a fresh
// browser re-showing it for an existing account beats needing a server round trip just to gate a
// one-time tutorial.
const ONBOARDING_KEY = 'hasSeenOnboarding'

function RootGate() {
  const { session, hasLoadedInitialSession } = useAuth()
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => localStorage.getItem(ONBOARDING_KEY) === 'true')

  if (!hasLoadedInitialSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return <AuthPage />
  if (!hasSeenOnboarding) {
    return <OnboardingPage onFinish={() => { localStorage.setItem(ONBOARDING_KEY, 'true'); setHasSeenOnboarding(true) }} />
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
