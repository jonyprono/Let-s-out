import { lazy, Suspense, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/auth.store'
import { apiClient } from '@/lib/api-client'

// ── Page loader (lightweight spinner shown between route transitions) ──────────
function PageLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-white dark:bg-[#111]">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF9F1C] animate-spin" />
    </div>
  )
}

// ── Tiny pages kept as direct imports (< 5KB each, no benefit to lazy-load) ──
import { Splashscreen as SplashscreenBase } from '@/app/components/Splashscreen'
import { Welcome as WelcomeBase } from '@/app/components/Welcome'

// ── Heavy pages: lazy-loaded — each gets its own JS chunk in the build ─────────
const LoginBase         = lazy(() => import('@/app/components/Login').then(m => ({ default: m.Login })))
const ForgotPasswordBase= lazy(() => import('@/app/components/ForgotPassword').then(m => ({ default: m.ForgotPassword })))
const SignupBase         = lazy(() => import('@/app/components/Signup').then(m => ({ default: m.Signup })))
const OnboardingBase    = lazy(() => import('@/app/components/Onboarding').then(m => ({ default: m.Onboarding })))
const HomeBase          = lazy(() => import('@/app/components/Home').then(m => ({ default: m.Home })))
const ExplorerBase      = lazy(() => import('@/app/components/Explorer').then(m => ({ default: m.Explorer })))
const MyEventsBase      = lazy(() => import('@/app/components/MyEvents').then(m => ({ default: m.MyEvents })))
const MessagesBase      = lazy(() => import('@/app/components/Messages').then(m => ({ default: m.Messages })))
const ProfileBase       = lazy(() => import('@/app/components/Profile').then(m => ({ default: m.Profile })))
const EventDetailsBase  = lazy(() => import('@/app/components/EventDetails').then(m => ({ default: m.EventDetails })))
const CreateEventBase   = lazy(() => import('@/app/components/CreateEvent').then(m => ({ default: m.CreateEvent })))
const NotificationsBase = lazy(() => import('@/app/components/Notifications').then(m => ({ default: m.Notifications })))
const SettingsBase      = lazy(() => import('@/app/components/Settings').then(m => ({ default: m.Settings })))
const ChatDetailsBase   = lazy(() => import('@/features/chat/components/ChatDetails').then(m => ({ default: m.ChatDetails })))
const PaymentPageBase   = lazy(() => import('@/app/components/PaymentPage').then(m => ({ default: m.PaymentPage })))
const FriendRequestsBase= lazy(() => import('@/app/components/FriendRequests').then(m => ({ default: m.FriendRequests })))
const VerifyProfileBase = lazy(() => import('@/app/components/VerifyProfile').then(m => ({ default: m.VerifyProfile })))
const PaymentReceiptBase= lazy(() => import('@/app/components/PaymentReceipt').then(m => ({ default: m.PaymentReceipt })))
const FriendsListBase   = lazy(() => import('@/app/components/FriendsList').then(m => ({ default: m.FriendsList })))
const JoinPrivateBase   = lazy(() => import('@/app/components/JoinPrivateEvent').then(m => ({ default: m.JoinPrivateEvent })))

// ─── Splashscreen ─────────────────────────────────────────────────────────────
export function Splashscreen() {
  const nav = useNavigate()
  const token = useAuthStore((s) => s.accessToken)
  const hasSeenOnboarding = localStorage.getItem('letsout_onboarding_done')

  useEffect(() => {
    if (token) {
      nav('/home', { replace: true })
    } else if (hasSeenOnboarding) {
      nav('/welcome', { replace: true })
    }
  }, [token, hasSeenOnboarding, nav])

  if (token || hasSeenOnboarding) return null

  return <SplashscreenBase onComplete={() => nav('/welcome', { replace: true })} />
}

// ─── Welcome ──────────────────────────────────────────────────────────────────
export function Welcome() {
  const nav = useNavigate()
  return <WelcomeBase onLogin={() => nav('/login')} onSignup={() => nav('/signup')} />
}

// ─── Login ────────────────────────────────────────────────────────────────────
export function Login() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <LoginBase onSignup={() => nav('/signup')} onForgotPassword={() => nav('/forgot-password')} />
    </Suspense>
  )
}

// ─── ForgotPassword ───────────────────────────────────────────────────────────
export function ForgotPassword() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <ForgotPasswordBase onBack={() => nav('/login')} onComplete={() => nav('/login')} />
    </Suspense>
  )
}

// ─── Signup ───────────────────────────────────────────────────────────────────
export function Signup() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <SignupBase onBack={() => nav('/login')} />
    </Suspense>
  )
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
export function Onboarding() {
  const nav = useNavigate()
  const refreshUser = useAuthStore((s) => s.refreshUser)

  return (
    <Suspense fallback={<PageLoader />}>
      <OnboardingBase
        onComplete={async (data: any) => {
          try {
            const displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim()
            await apiClient.patch('/users/me/profile', {
              displayName: displayName || undefined,
              city: data.city || undefined,
              country: data.country || undefined,
              interests: data.interests?.length ? data.interests : undefined,
            })
            await refreshUser()
          } catch (e) {
            console.error('Failed to update profile during onboarding', e)
          } finally {
            nav('/home')
          }
        }}
      />
    </Suspense>
  )
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export function Home() {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  return (
    <Suspense fallback={<PageLoader />}>
      <HomeBase
        userData={{ firstName: user?.profile?.displayName, avatarUrl: user?.profile?.avatarUrl }}
        onNavigate={(screen: string, id?: string) => {
          const map: Record<string, string> = {
            'explorer': '/explorer',
            'create-event': '/events/create',
            'messages': '/messages',
            'notifications': '/notifications',
            'profile': '/profile',
            'scan-qr': '/scan-qr'
          }
          if (screen === 'event-details' && id) nav(`/events/${id}`)
          else if (map[screen]) nav(map[screen])
        }}
      />
    </Suspense>
  )
}

// ─── Explorer ─────────────────────────────────────────────────────────────────
export function Explorer() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <ExplorerBase
        onNavigate={(screen: string, id?: string) => {
          const map: Record<string, string> = {
            'home': '/home', 'messages': '/messages',
            'profile': '/profile', 'create-event': '/events/create'
          }
          if (screen === 'event-details' && id) nav(`/events/${id}`)
          else if (map[screen]) nav(map[screen])
        }}
      />
    </Suspense>
  )
}

// ─── MyEvents ─────────────────────────────────────────────────────────────────
export function MyEvents() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <MyEventsBase
        onNavigate={(screen: string, id?: string) => {
          if (screen === 'event-details' && id) nav(`/events/${id}`)
        }}
      />
    </Suspense>
  )
}

// ─── Messages ─────────────────────────────────────────────────────────────────
export function Messages() {
  return (
    <Suspense fallback={<PageLoader />}>
      <MessagesBase />
    </Suspense>
  )
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export function Profile() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <ProfileBase
        onNavigate={(screen: string) => {
          const map: Record<string, string> = {
            'home': '/home', 'explorer': '/explorer', 'messages': '/messages',
            'create-event': '/events/create', 'settings': '/settings',
            'welcome': '/welcome', 'friends': '/friends'
          }
          if (map[screen]) nav(map[screen])
        }}
      />
    </Suspense>
  )
}

// ─── EventDetails ─────────────────────────────────────────────────────────────
export function EventDetails() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <EventDetailsBase onBack={() => nav(-1)} />
    </Suspense>
  )
}

// ─── CreateEvent ──────────────────────────────────────────────────────────────
export function CreateEvent() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <CreateEventBase onBack={() => nav(-1)} />
    </Suspense>
  )
}

// ─── Notifications ────────────────────────────────────────────────────────────
export function Notifications() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <NotificationsBase onBack={() => nav(-1)} />
    </Suspense>
  )
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export function Settings() {
  const nav = useNavigate()
  return (
    <Suspense fallback={<PageLoader />}>
      <SettingsBase onBack={() => nav(-1)} />
    </Suspense>
  )
}

// ─── ChatDetails ──────────────────────────────────────────────────────────────
export function ChatDetails() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ChatDetailsBase />
    </Suspense>
  )
}

// ─── PaymentPage ──────────────────────────────────────────────────────────────
export function PaymentPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PaymentPageBase />
    </Suspense>
  )
}

// ─── FriendRequests ───────────────────────────────────────────────────────────
export function FriendRequests() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FriendRequestsBase />
    </Suspense>
  )
}

// ─── VerifyProfile ────────────────────────────────────────────────────────────
export function VerifyProfile() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyProfileBase />
    </Suspense>
  )
}

// ─── PaymentReceipt ───────────────────────────────────────────────────────────
export function PaymentReceipt() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PaymentReceiptBase />
    </Suspense>
  )
}

// ─── FriendsList ──────────────────────────────────────────────────────────────
export function FriendsList() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FriendsListBase />
    </Suspense>
  )
}

// ─── JoinPrivateEvent ─────────────────────────────────────────────────────────
export function JoinPrivateEvent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <JoinPrivateBase />
    </Suspense>
  )
}
