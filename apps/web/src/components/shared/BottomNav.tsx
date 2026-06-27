import { useNavigate, useLocation } from 'react-router'
import {
  Home01Icon as Home,
  Search01Icon as Search,
  User02Icon as User,
  Comment01Icon as ChatBubble,
} from 'hugeicons-react'
import { useConversations } from '@/features/chat/api'

// Icône centrale : rounded square orange avec + (conformément à la maquette Figma)
function PlusButtonIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <line x1="13" y1="6" x2="13" y2="20" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="6" y1="13" x2="20" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

type NavTab = {
  path: string
  icon?: any
  label: string
  isCustom?: boolean
}

const leftTabs: NavTab[] = [
  { path: '/home',      icon: Home,          label: 'Accueil' },
  { path: '/explorer',  icon: Search,        label: 'Explorer' },
]
const rightTabs: NavTab[] = [
  { path: '/messages',  icon: ChatBubble,    label: 'Messages' },
  { path: '/profile',   icon: User,          label: 'Profil' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: conversations } = useConversations()
  const totalUnread = conversations
    ? conversations.reduce((acc: number, c: any) => acc + (c.unread || 0), 0)
    : 0

  const isActive = (path: string) => location.pathname === path

  return (
    <nav
      className="w-full bg-card dark:bg-[#1A1A1A] flex items-end justify-around border-t border-border dark:border-[#2A2A2A] flex-shrink-0"
      style={{
        height: 'calc(64px + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
        zIndex: 50,
      }}
    >
      {/* ── Left tabs ── */}
      {leftTabs.map((tab) => {
        const active = isActive(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex flex-col items-center justify-end gap-[3px] pb-2"
            style={{ flex: 1, minWidth: 0 }}
            aria-label={tab.label}
          >
            <div className="flex items-center justify-center w-7 h-7">
              <tab.icon
                width={24}
                height={24}
                strokeWidth={active ? 1.8 : 1.5}
                style={{ color: active ? 'var(--color-icon-brand-primary)' : 'var(--color-icon-tertiary)' }}
              />
            </div>
            <span
              className="text-[var(--font-size-body-small)] font-medium leading-none mt-1"
              style={{ color: active ? 'var(--color-text-brand-primary)' : 'var(--color-text-tertiary)' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}

      {/* ── Central create button ── */}
      <button
        onClick={() => navigate('/events/create')}
        className="flex flex-col items-center justify-end pb-2"
        style={{ flex: 1, minWidth: 0 }}
        aria-label="Créer un événement"
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: 'var(--color-action-primary)',
            marginBottom: 6,
            boxShadow: '0 4px 12px rgba(255, 122, 0, 0.35)',
          }}
        >
          <PlusButtonIcon />
        </div>
      </button>

      {/* ── Right tabs ── */}
      {rightTabs.map((tab) => {
        const active = isActive(tab.path)
        const IconComp = tab.icon
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex flex-col items-center justify-end gap-[3px] pb-2"
            style={{ flex: 1, minWidth: 0 }}
            aria-label={tab.label}
          >
            <div className="flex items-center justify-center w-7 h-7 relative">
              <IconComp
                width={24}
                height={24}
                strokeWidth={active ? 1.8 : 1.5}
                style={{ color: active ? 'var(--color-icon-brand-primary)' : 'var(--color-icon-tertiary)' }}
              />
              {tab.path === '/messages' && totalUnread > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-background-negative)] px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#1A1A1A]"
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <span
              className="text-[var(--font-size-body-small)] font-medium leading-none mt-1"
              style={{ color: active ? 'var(--color-text-brand-primary)' : 'var(--color-text-tertiary)' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}

    </nav>
  )
}

