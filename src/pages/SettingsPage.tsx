import { Link, useNavigate } from 'react-router-dom'
import { Target, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function SettingsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  return (
    <div className="flex-1 flex flex-col gap-4 p-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/60">←</button>
        <h1 className="text-lg font-bold">설정</h1>
      </div>

      <div className="flex flex-col rounded-2xl overflow-hidden bg-routinity-card border border-routinity-border divide-y divide-routinity-border">
        <Link to="/goals" className="px-4 py-3.5 flex items-center gap-2"><Target className="w-4 h-4" /> 목표 설정</Link>
      </div>

      <p className="text-xs text-white/40">브라우저 알림은 웹 버전에서 지원하지 않아요 — iOS 앱에서는 기상·취침 기록을 깜빡했을 때 하루 한 번씩 알려드려요.</p>

      <button
        onClick={async () => { try { await signOut() } catch { /* best-effort sign-out; still navigate away */ } finally { navigate('/') } }}
        className="rounded-2xl bg-routinity-card border border-routinity-border px-4 py-3.5 text-red-400 text-left font-medium flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" /> 로그아웃
      </button>
    </div>
  )
}
