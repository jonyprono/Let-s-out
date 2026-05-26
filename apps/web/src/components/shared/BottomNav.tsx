import { useNavigate, useLocation } from 'react-router'
import { Search, Message, User } from 'iconoir-react'
import { useConversations } from '@/features/chat/api'

// Custom icon: groupe d'événements (3 silhouettes)
function EventsIcon({ active }: { active: boolean }) {
  const color = active ? '#FF9F1C' : 'currentColor'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color: active ? '#FF9F1C' : 'var(--neutral-gray-600)' }}>
      {/* Personne du milieu */}
      <circle cx="12" cy="7" r="2.5" fill={color} />
      <path d="M7 19c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Personne de gauche */}
      <circle cx="6" cy="8" r="2" fill={color} opacity="0.6" />
      <path d="M2 19c0-2.21 1.79-4 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* Personne de droite */}
      <circle cx="18" cy="8" r="2" fill={color} opacity="0.6" />
      <path d="M22 19c0-2.21-1.79-4-4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  )
}

// Custom icon: diamant central (bouton +)
function DiamondPlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      {/* Diamond shape */}
      <path
        d="M13 3L23 13L13 23L3 13L13 3Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="rgba(255,255,255,0.15)"
      />
      {/* Plus sign inside */}
      <line x1="13" y1="9" x2="13" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="9" y1="13" x2="17" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
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
  { path: '/home',      icon: Search,        label: 'Explorer' },
  { path: '/my-events', isCustom: true,      label: 'Evénements' },
]
const rightTabs: NavTab[] = [
  { path: '/messages',  icon: Message,       label: 'Messages' },
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
      className="absolute bottom-0 left-0 right-0 bg-card dark:bg-[#1A1A1A] flex items-end justify-around border-t border-border dark:border-[#2A2A2A]"
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
            <div className="flex items-center justify-center w-6 h-6">
              {tab.isCustom
                ? <EventsIcon active={active} />
                : <tab.icon
                    width={22}
                    height={22}
                    strokeWidth={active ? 2 : 1.6}
                    style={{ color: active ? '#FF9F1C' : 'var(--neutral-gray-600)' }}
                  />
              }
            </div>
            <span
              className="text-[10px] font-semibold leading-none mt-1"
              style={{ color: active ? '#FF9F1C' : 'var(--neutral-gray-600)' }}
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
            background: 'linear-gradient(145deg, #FF9F1C, #FF8C00)',
            boxShadow: '0 4px 16px rgba(255, 159, 28, 0.45)',
            marginBottom: 2,
            marginTop: -8,
          }}
        >
          <DiamondPlusIcon />
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
            <div className="flex items-center justify-center w-6 h-6 relative">
              <IconComp
                width={22}
                height={22}
                strokeWidth={active ? 2 : 1.6}
                style={{ color: active ? '#FF9F1C' : 'var(--neutral-gray-600)' }}
              />
              {tab.path === '/messages' && totalUnread > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-1 ring-white"
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-semibold leading-none mt-1"
              style={{ color: active ? '#FF9F1C' : 'var(--neutral-gray-600)' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}

      {/* Home indicator pill */}
      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full"
      />
    </nav>
  )
}

