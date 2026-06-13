import { useNavigate, useLocation } from 'react-router'
import { Home01Icon as Home, Search01Icon as Search, UserIcon as User, UserMultiple02Icon as Group, Comment01Icon as ChatBubble } from 'hugeicons-react'
import { useConversations } from '@/features/chat/api'

// Custom icon: groupe d'événements (3 silhouettes)
function EventsIcon({ active }: { active: boolean }) {
  const color = active ? '#FF7A00' : '#4A4A4A'
  return <Group width={24} height={24} strokeWidth={2} style={{ color }} />
}

// Custom icon: diamant central (bouton +)
function DiamondPlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Outline Diamond shape */}
      <path
        d="M12 2.5L21.5 12L12 21.5L2.5 12L12 2.5Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Plus sign inside */}
      <path
        d="M12 8V16M8 12H16"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
              {tab.isCustom
                ? <EventsIcon active={active} />
                : <tab.icon
                    width={24}
                    height={24}
                    strokeWidth={active ? 1.8 : 1.5}
                    style={{ color: active ? '#FF7A00' : '#4A4A4A' }}
                  />
              }
            </div>
            <span
              className="text-[12px] font-semibold leading-none mt-1"
              style={{ color: active ? '#FF7A00' : '#4A4A4A' }}
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
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: '#FF7A00',
            marginBottom: 10,
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
            <div className="flex items-center justify-center w-7 h-7 relative">
              <IconComp
                width={24}
                height={24}
                strokeWidth={active ? 1.8 : 1.5}
                style={{ color: active ? '#FF7A00' : '#4A4A4A' }}
              />
              {tab.path === '/messages' && totalUnread > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#1A1A1A]"
                >
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
            </div>
            <span
              className="text-[12px] font-semibold leading-none mt-1"
              style={{ color: active ? '#FF7A00' : '#4A4A4A' }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}

    </nav>
  )
}

