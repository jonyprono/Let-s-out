import { useNavigate, useLocation } from 'react-router'
import {
  Home04Icon as Home,
  Search01Icon as Search,
  UserCircle02Icon as User,
  Comment01Icon as ChatBubble,
} from 'hugeicons-react'
import { useConversations } from '@/features/chat/api'

// Icône centrale : rounded square orange avec + (conformément à la maquette Figma)
function PlusButtonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 4V16M4 10H16" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type NavTab = {
  path: string
  icon?: any
  label: string
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
      className="w-full flex flex-col items-center flex-shrink-0"
      style={{
        height: 'calc(62px + env(safe-area-inset-bottom))',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        background: 'rgba(255, 255, 255, 0.75)',
        backgroundBlendMode: 'hard-light',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderTop: '0.333px solid rgba(0, 0, 0, 0.3)',
        zIndex: 50,
      }}
    >
      <div className="w-full max-w-[390px] mx-auto flex flex-row items-center justify-between gap-[10px]" style={{ height: '38px' }}>
        {/* Left tabs */}
        {leftTabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-[2px]"
              style={{ width: '78px', height: '38px' }}
              aria-label={tab.label}
            >
              <div className="flex items-center justify-center w-5 h-5">
                <tab.icon
                  width={20}
                  height={20}
                  strokeWidth={1.25}
                  color={active ? '#FF7A00' : '#56514F'}
                />
              </div>
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '10px',
                  lineHeight: '16px',
                  textAlign: 'center',
                  color: active ? '#FF7A00' : '#404040'
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* Central create button */}
        <button
          onClick={() => navigate('/events/create')}
          className="flex flex-col items-center justify-center"
          style={{ width: '78px', height: '32px' }}
          aria-label="Créer un événement"
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(360deg, #FF7A00 0%, #FF991C 100%)',
              borderRadius: 8,
              padding: 6,
            }}
          >
            <PlusButtonIcon />
          </div>
        </button>

        {/* Right tabs */}
        {rightTabs.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center gap-[2px]"
              style={{ width: '78px', height: '38px' }}
              aria-label={tab.label}
            >
              <div className="flex items-center justify-center w-5 h-5 relative">
                <tab.icon
                  width={20}
                  height={20}
                  strokeWidth={1.25}
                  color={active ? '#FF7A00' : '#56514F'}
                />
                {tab.path === '/messages' && totalUnread > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-background-negative)] px-1 text-[9px] font-bold text-white ring-1 ring-white"
                  >
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '10px',
                  lineHeight: '16px',
                  textAlign: 'center',
                  color: active ? '#FF7A00' : '#404040'
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}


