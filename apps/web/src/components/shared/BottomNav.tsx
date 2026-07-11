import { useNavigate, useLocation } from 'react-router'
import {
  Home04Icon as Home,
  Search01Icon as Search,
  UserCircle02Icon as User,
} from 'hugeicons-react'
import { useConversations } from '@/features/chat/api'

// Icône de messagerie (récupérée de Figma)
function ChatBubbleIcon({ color = '#56514F', strokeWidth = 1.25, width = 20, height = 20, ...props }: any) {
  return (
    <svg width={width} height={height} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M1.66663 8.74992C1.66663 8.10759 1.67784 7.48058 1.6992 6.87517C1.76898 4.89728 1.80387 3.90833 2.60835 3.09779C3.41283 2.28726 4.42971 2.24375 6.46346 2.15674C7.57927 2.109 8.76738 2.08325 9.99996 2.08325C11.2325 2.08325 12.4206 2.109 13.5365 2.15674C15.5702 2.24375 16.5871 2.28726 17.3915 3.09779C18.196 3.90833 18.231 4.89728 18.3007 6.87517C18.322 7.48058 18.3333 8.10759 18.3333 8.74992C18.3333 9.39225 18.322 10.0193 18.3007 10.6247C18.231 12.6026 18.196 13.5915 17.3915 14.4021C16.5871 15.2126 15.5702 15.2561 13.5364 15.3431C12.9248 15.3693 12.2915 15.3888 11.641 15.4012C11.0235 15.4128 10.7146 15.4188 10.4433 15.5221C10.172 15.6254 9.94371 15.8212 9.48704 16.2127L7.67082 17.7701C7.56057 17.8646 7.42012 17.9166 7.27488 17.9166C6.93895 17.9166 6.66663 17.6443 6.66663 17.3083V15.3515C6.59864 15.3488 6.53092 15.346 6.46345 15.3431C4.4297 15.2561 3.41283 15.2126 2.60835 14.402C1.80387 13.5915 1.76898 12.6026 1.6992 10.6247C1.67784 10.0193 1.66663 9.39225 1.66663 8.74992Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.1048 8.75008H10.0006M6.77087 8.75008H6.66671M13.4375 8.75008H13.3334M10.209 8.75008C10.209 8.86516 10.1157 8.95841 10.0006 8.95841C9.88562 8.95841 9.79229 8.86516 9.79229 8.75008C9.79229 8.635 9.88562 8.54175 10.0006 8.54175C10.1157 8.54175 10.209 8.635 10.209 8.75008ZM6.87504 8.75008C6.87504 8.86516 6.78177 8.95841 6.66671 8.95841C6.55165 8.95841 6.45837 8.86516 6.45837 8.75008C6.45837 8.635 6.55165 8.54175 6.66671 8.54175C6.78177 8.54175 6.87504 8.635 6.87504 8.75008ZM13.5417 8.75008C13.5417 8.86516 13.4485 8.95841 13.3334 8.95841C13.2183 8.95841 13.125 8.86516 13.125 8.75008C13.125 8.635 13.2183 8.54175 13.3334 8.54175C13.4485 8.54175 13.5417 8.635 13.5417 8.75008Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

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
  { path: '/messages',  icon: ChatBubbleIcon,    label: 'Messages' },
  { path: '/profile',   icon: User,          label: 'Compte' },
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
      className="w-full flex flex-col items-center flex-shrink-0 bg-white/75 dark:bg-[#1A1A1A]/85 backdrop-blur-[25px] border-t border-black/30 dark:border-white/10 z-50 transition-colors"
      style={{
        height: 'calc(62px + env(safe-area-inset-bottom))',
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
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
                className={active ? 'text-[#FF7A00]' : 'text-[#404040] dark:text-gray-400'}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '10px',
                  lineHeight: '16px',
                  textAlign: 'center'
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
                className={active ? 'text-[#FF7A00]' : 'text-[#404040] dark:text-gray-400'}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontWeight: 500,
                  fontSize: '10px',
                  lineHeight: '16px',
                  textAlign: 'center'
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


