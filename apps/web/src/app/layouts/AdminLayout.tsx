import { Outlet, NavLink, useNavigate } from 'react-router'
import { LayoutDashboard, ShieldCheck, ArrowLeft, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/auth.store'

const nav = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/kyc', end: false, label: 'Vérifications KYC', icon: ShieldCheck },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const user = useAuthStore(s => s.user)

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f5f5f5] flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/10 bg-[#111113]/80 backdrop-blur-xl shrink-0">
        <div className="p-6 border-b border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#FF9F1C]">Let&apos;s Out</p>
          <h1 className="text-lg font-bold mt-1">Administration</h1>
          <p className="text-xs text-white/50 mt-1 truncate">{user?.profile?.displayName || 'Admin'}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-[#FF9F1C]/15 text-[#FF9F1C]' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/60 hover:bg-white/5"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            Thème
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/60 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;app
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111113]/90 backdrop-blur-md">
          <button type="button" onClick={() => navigate('/home')} className="text-white/60">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm">Admin KYC</span>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-white/60">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <nav className="lg:hidden flex gap-2 px-4 py-3 border-b border-white/10 overflow-x-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 rounded-full text-xs font-semibold ${
                  isActive ? 'bg-[#FF9F1C] text-black' : 'bg-white/5 text-white/60'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
