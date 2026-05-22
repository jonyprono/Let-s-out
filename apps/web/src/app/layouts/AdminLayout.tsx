import { Outlet, NavLink, useNavigate } from 'react-router'
import { LayoutDashboard, ShieldCheck, ArrowLeft, Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuthStore } from '@/stores/auth.store'

const navItems = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/kyc', end: false, label: 'Vérifications KYC', icon: ShieldCheck },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)

  const handleLogout = () => {
    logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] text-[#f5f5f5] flex overflow-hidden">
      {/* ── Sidebar desktop ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#111113] h-full">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF9F1C]/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#FF9F1C]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FF9F1C]">Let&apos;s Out</p>
            <p className="text-sm font-bold leading-tight truncate">Administration</p>
          </div>
        </div>

        {/* Admin info */}
        <div className="px-4 py-3 mx-3 mt-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
          <p className="text-[11px] text-white/40 uppercase tracking-wide font-semibold">Connecté en tant que</p>
          <p className="text-sm font-semibold mt-0.5 truncate">{user?.profile?.displayName || 'Admin'}</p>
          <p className="text-[11px] text-white/40 truncate">{user?.email || ''}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 mt-2 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#FF9F1C]/15 text-[#FF9F1C] shadow-inner'
                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            Thème
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;app
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Mobile header */}
        <header className="lg:hidden shrink-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#111113]/90 backdrop-blur-md">
          <button type="button" onClick={() => navigate('/home')} className="text-white/60 hover:text-white transition-colors p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm">Admin KYC</span>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-white/60 hover:text-white transition-colors p-1">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile nav pills */}
        <nav className="lg:hidden shrink-0 flex gap-2 px-4 py-2.5 border-b border-white/10 overflow-x-auto bg-[#111113]/60 backdrop-blur-sm">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                  isActive ? 'bg-[#FF9F1C] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
