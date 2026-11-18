import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

import { ThemeProvider, useTheme } from 'next-themes'

function CapacitorThemeSync() {
  const { resolvedTheme } = useTheme()
  const location = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const isDark = resolvedTheme === 'dark'

    // Icon style: dark background = white icons (Style.Dark), light background = dark icons (Style.Light)
    const style = isDark ? Style.Dark : Style.Light

    // Try to read the actual background color from the top element in the DOM
    // This adapts automatically to each screen without hardcoding
    const getBgColor = () => {
      // Try to find the main app inner wrapper first
      const appInner = document.getElementById('app-layout-inner')
      if (appInner) {
        const computed = window.getComputedStyle(appInner)
        const bg = computed.backgroundColor
        // Convert rgb(r,g,b) to #rrggbb
        const match = bg.match(/(\d+),\s*(\d+),\s*(\d+)/)
        if (match) {
          const r = parseInt(match[1]).toString(16).padStart(2, '0')
          const g = parseInt(match[2]).toString(16).padStart(2, '0')
          const b = parseInt(match[3]).toString(16).padStart(2, '0')
          return `#${r}${g}${b}`
        }
      }
      // Fallback to theme-based colors
      return isDark ? '#111111' : '#ffffff'
    }

    // Wait a tick for the DOM to update after navigation
    const timer = setTimeout(async () => {
      try {
        const bgColor = getBgColor()
        await StatusBar.setStyle({ style })
        await StatusBar.setBackgroundColor({ color: bgColor })
      } catch (e) {
        console.warn('StatusBar update failed:', e)
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [resolvedTheme, location.pathname])

  return null
}
import { Toaster, toast } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { authLinkWithReturn, captureRedirectParam, clearReturnTo, peekReturnTo, postAuthPath } from '@/lib/return-to'
import { SharedContentRoute } from '@/features/social/deeplink/SharedContent'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { SmartAppBanner } from '@/components/shared/SmartAppBanner'
import { initializePushNotifications } from '@/lib/push-notifications'
import { lazyRoute } from '@/app/components/lazy-route'

// ── Écrans chargés à la demande (hors bundle de démarrage) ──────────────────
const PrivacyPolicy = lazyRoute(() => import('@/app/components/PrivacyPolicy').then(m => m.PrivacyPolicy))
const TermsOfService = lazyRoute(() => import('@/app/components/TermsOfService').then(m => m.TermsOfService))
const LandingPage = lazyRoute(() => import('@/app/components/LandingPage').then(m => m.LandingPage))
const HelpSupport = lazyRoute(() => import('./components/HelpSupport').then(m => m.default))
const OutRadar = lazyRoute(() => import('@/features/radar/components/OutRadar').then(m => m.OutRadar))
const MyTicketsPage = lazyRoute(() => import('@/features/ticketing/components/MyTicketsPage').then(m => m.MyTicketsPage))
const EventValidatorsVote = lazyRoute(() => import('@/app/pages/EventValidatorsVote').then(m => m.EventValidatorsVote))
const TicketScanner = lazyRoute(() => import('@/features/events/components/TicketScanner').then(m => m.TicketScanner))
const EventPoolValidation = lazyRoute(() => import('./components/EventPoolValidation').then(m => m.EventPoolValidation))
const PayoutRequestScreen = lazyRoute(() => import('./components/PayoutRequestScreen').then(m => m.PayoutRequestScreen))
const PayoutApprovalScreen = lazyRoute(() => import('./components/PayoutApprovalScreen').then(m => m.PayoutApprovalScreen))
const EventCommentsPage = lazyRoute(() => import('@/app/pages/EventCommentsPage').then(m => m.EventCommentsPage))
const VideosPage = lazyRoute(() => import('@/app/pages/VideosPage').then(m => m.VideosPage))
// Pages
const CreatePage = lazyRoute(() => import('@/features/pages/components/CreatePage').then(m => m.CreatePage))
const PageView = lazyRoute(() => import('@/features/pages/components/PageView').then(m => m.PageView))
const ManagePage = lazyRoute(() => import('@/features/pages/components/ManagePage').then(m => m.ManagePage))
const PagesHub = lazyRoute(() => import('@/features/pages/components/PagesHub').then(m => m.PagesHub))
const MyPagesHub = lazyRoute(() => import('@/features/pages/components/MyPagesHub').then(m => m.MyPagesHub))
// Administration
const AdminLayout = lazyRoute(() => import('@/app/layouts/AdminLayout').then(m => m.AdminLayout))
const AdminLoginPage = lazyRoute(() => import('@/app/components/admin/AdminLoginPage').then(m => m.AdminLoginPage))
const AdminResetPasswordPage = lazyRoute(() => import('@/app/components/admin/AdminResetPasswordPage').then(m => m.AdminResetPasswordPage))
const AdminDashboardPage = lazyRoute(() => import('@/app/components/admin/AdminDashboardPage').then(m => m.AdminDashboardPage))
const AdminKycListPage = lazyRoute(() => import('@/app/components/admin/AdminKycListPage').then(m => m.AdminKycListPage))
const AdminKycDetailPage = lazyRoute(() => import('@/app/components/admin/AdminKycDetailPage').then(m => m.AdminKycDetailPage))
const AdminAdminsPage = lazyRoute(() => import('@/app/components/admin/AdminAdminsPage').then(m => m.AdminAdminsPage))
const AdminSupportChats = lazyRoute(() => import('./components/admin/AdminSupportChats').then(m => m.AdminSupportChats))
const AdminBotPrompts = lazyRoute(() => import('./components/admin/AdminBotPrompts').then(m => m.AdminBotPrompts))
const AdminAuditLogsPage = lazyRoute(() => import('./components/admin/AdminAuditLogsPage').then(m => m.AdminAuditLogsPage))
const AdminPayoutsPage = lazyRoute(() => import('./components/admin/AdminPayoutsPage').then(m => m.AdminPayoutsPage))
const AdminFeatureFlagsPage = lazyRoute(() => import('./components/admin/AdminFeatureFlagsPage').then(m => m.default))
const AdminBadgesPage = lazyRoute(() => import('./components/admin/AdminBadgesPage').then(m => m.AdminBadgesPage))
const AdminSettingsPage = lazyRoute(() => import('./components/admin/AdminSettingsPage').then(m => m.default))
const AdminUsersPage = lazyRoute(() => import('./components/admin/AdminUsersPage').then(m => m.default))
const AdminEventsPage = lazyRoute(() => import('./components/admin/AdminEventsPage').then(m => m.default))

// All screens via adapter bridge (prop-based → React Router)
import {
  Splashscreen,
  Login,
  Signup,
  ForgotPassword,
  Onboarding,
  Home,
  Explorer,
  EventDetails,
  CreateEvent,
  Messages,
  Notifications,
  Profile,
  Settings,
  ChatDetails,
  PaymentPage,
  FriendRequests,
  FriendsList,
  PaymentReceipt,
  JoinPrivateEvent,
  VerifyProfile,
  MyEvents,
  EventSuccessScreen,
  Wallet,
  CreatedEventsList,
  JoinedEventsList,
  ManageEvent,
  AccountMenu,
  BadgesPage,
} from '@/app/components/adapters'
import { AppBootstrap } from '@/app/components/AppBootstrap'
import { UserProfileProvider } from '@/features/users/UserProfileContext'
import { ConfirmProvider } from '@/components/shared/ConfirmContext'
import { CallOverlay } from '@/features/chat/components/CallOverlay'
import { AdminRoute } from '@/app/components/admin/AdminRoute'
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  // Non connecté : la page demandée est retenue → on y revient après connexion / inscription
  if (!token) return <Navigate to={authLinkWithReturn('/login', location.pathname + location.search)} replace />

  const pendingGoogleSignup = localStorage.getItem('pending_google_signup') === 'true'
  if (pendingGoogleSignup) {
    if (location.pathname !== '/signup') return <Navigate to="/signup?mode=google" replace />
    return <>{children}</>
  }

  const p: any = user?.profile || {}
  const isProfileIncomplete = !p.displayName
  if (user?.role !== 'ADMIN' && isProfileIncomplete) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  // ?redirect= (lien partagé, page protégée) : mémorisé pour survivre aux étapes d'inscription / Google
  useEffect(() => { captureRedirectParam(location.search) }, [location.search])

  if (token) {
    const pendingGoogleSignup = localStorage.getItem('pending_google_signup') === 'true'
    if (pendingGoogleSignup) {
      if (location.pathname !== '/signup') return <Navigate to="/signup?mode=google" replace />
      return <>{children}</>
    }

    const p: any = user?.profile || {}
    const isProfileIncomplete = !p.displayName
    if (user?.role !== 'ADMIN' && isProfileIncomplete) return <Navigate to="/onboarding" replace />
    return <Navigate to={postAuthPath()} replace />
  }
  return <>{children}</>
}

function RootRoute() {
  const token = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)

  if (token) {
    const pendingGoogleSignup = localStorage.getItem('pending_google_signup') === 'true'
    if (pendingGoogleSignup) return <Navigate to="/signup?mode=google" replace />

    const p: any = user?.profile || {}
    const isProfileIncomplete = !p.displayName
    if (user?.role !== 'ADMIN' && isProfileIncomplete) return <Navigate to="/onboarding" replace />
    return <Navigate to={postAuthPath()} replace />
  }

  // Detect native Capacitor WebView
  const isNative = Capacitor.isNativePlatform()

  // Android WebView always has "wv" in UA
  const ua = navigator.userAgent || ''
  const isAndroidWebView = /wv/.test(ua) && /Android/.test(ua)

  // iOS WKWebView has no "Safari" token
  const isIOSWebView = /iPhone|iPad|iPod/.test(ua) && !/Safari/.test(ua) && /AppleWebKit/.test(ua)

  // Generic mobile/tablet browser
  const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|CriOS|FxiOS/i.test(ua)

  // Small screen (tablet / phone in browser)
  const isSmallScreen = window.matchMedia('(max-width: 1024px)').matches

  const isMobile = isNative || isAndroidWebView || isIOSWebView || isMobileBrowser || isSmallScreen

  return isMobile ? <Navigate to="/app" replace /> : <LandingPage />
}

function CapacitorBackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const lastBackPressRef = useRef<number>(0)

  useEffect(() => {
    const handleBackButton = ({ canGoBack }: { canGoBack: boolean }) => {
      const pathname = location.pathname
      const exitRoutes = ['/app', '/home', '/login', '/welcome']
      const secondaryTabs = ['/explorer', '/my-events', '/messages', '/profile', '/account']

      // If user is on an exit route (or has nowhere to go back)
      if (exitRoutes.includes(pathname) || (!canGoBack && !secondaryTabs.includes(pathname))) {
        const now = Date.now()
        if (now - lastBackPressRef.current < 2000) {
          CapacitorApp.exitApp()
        } else {
          lastBackPressRef.current = now
          toast('Appuyez à nouveau pour quitter l\'application', {
            id: 'exit-app-toast',
            duration: 2000,
          })
        }
        return
      }

      // If user is on a secondary bottom tab and history cannot go back further
      if (secondaryTabs.includes(pathname) && (!canGoBack || (window.history.state && window.history.state.idx <= 0))) {
        navigate('/home')
        return
      }

      // Otherwise standard back navigation
      navigate(-1)
    }
    
    // Retire UNIQUEMENT cet écouteur : removeAllListeners() supprimait aussi celui des liens
    // entrants (DeepLinkHandler) à chaque navigation → les liens partagés n'ouvraient plus l'app.
    const handle = CapacitorApp.addListener('backButton', handleBackButton)

    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [navigate, location])

  return null
}

function DeepLinkHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handleDeepLink = (data: any) => {
      // Ex. https://letsout.app/event/join/XYZ, /videos/:id, /vlogs/:id, /posts/:id
      try {
        const u = new URL(String(data?.url ?? ''))
        if (u.hostname !== 'letsout.app' && u.hostname !== 'www.letsout.app') return
        const target = u.pathname + u.search
        if (target && target !== '/') navigate(target)
      } catch { /* URL invalide : ignorée */ }
    }

    const handle = CapacitorApp.addListener('appUrlOpen', handleDeepLink)

    return () => {
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [navigate])

  return null
}

/** La page de retour mémorisée (lien partagé, page protégée) est consommée une fois atteinte */
function ReturnToTracker() {
  const location = useLocation()
  useEffect(() => {
    const target = peekReturnTo()
    if (target && (target === location.pathname || target === location.pathname + location.search)) clearReturnTo()
  }, [location.pathname, location.search])
  return null
}

function GlobalVideoPlaybackCoordinator() {
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const currentVideo = e.target as HTMLVideoElement;
      if (!currentVideo || currentVideo.tagName !== 'VIDEO') return;

      document.querySelectorAll('video').forEach((v) => {
        if (v !== currentVideo && !v.paused) {
          v.pause();
        }
      });
    };

    document.addEventListener('play', handleGlobalPlay, true);
    return () => {
      document.removeEventListener('play', handleGlobalPlay, true);
    };
  }, []);

  return null;
}

function PushNotificationCoordinator() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (token) {
      initializePushNotifications(navigate)
    }
  }, [token, navigate])

  return null
}

/**
 * Masque le splash natif dès que l'app a peint son premier écran (double requestAnimationFrame =
 * après la peinture réelle). Le splash a la même couleur que l'app : la transition est invisible.
 * Sans effet sur le web et sur les anciennes versions de l'app (plugin absent → rejet ignoré).
 */
function NativeSplashHider() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cancelled) return
      SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {})
    }))
    return () => { cancelled = true }
  }, [])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <NativeSplashHider />
        <PushNotificationCoordinator />
        <GlobalVideoPlaybackCoordinator />
        <DeepLinkHandler />
        <ReturnToTracker />
        <CapacitorThemeSync />
        <AppBootstrap />
        <SmartAppBanner />
        <CapacitorBackButton />
        <UserProfileProvider>
        <ConfirmProvider>
        <Routes>
          <Route path="/" element={<RootRoute />} />

          {/* Splash + Guest only */}
          <Route element={<AuthLayout />}>
            <Route path="/app" element={<Splashscreen />} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          </Route>

          {/* Onboarding — accessible to authenticated users after signup */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Liens partagés (deep links) : visiteur → inscription obligatoire ; connecté → plein écran.
              /vlogs/:id = alias de /videos/:id (liens déjà diffusés). */}
          <Route path="/videos/:id" element={<SharedContentRoute kind="video" protect={(n) => <ProtectedRoute>{n}</ProtectedRoute>} />} />
          <Route path="/vlogs/:id" element={<SharedContentRoute kind="video" protect={(n) => <ProtectedRoute>{n}</ProtectedRoute>} />} />
          <Route path="/posts/:id" element={<SharedContentRoute kind="post" protect={(n) => <ProtectedRoute>{n}</ProtectedRoute>} />} />

          {/* Legal routes */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* Administration KYC */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="kyc" element={<AdminKycListPage />} />
            <Route path="kyc/:userId" element={<AdminKycDetailPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="support" element={<AdminSupportChats />} />
            <Route path="bots" element={<AdminBotPrompts />} />
            <Route path="audit" element={<AdminAuditLogsPage />} />
            <Route path="payouts" element={<AdminPayoutsPage />} />
            <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="badges" element={<AdminBadgesPage />} />
          </Route>

          {/* Protected app */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/home" element={<Home />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/my-events" element={<MyEvents />} />
            {/* Rubrique « Mes billets » : tous les billets d'accès (QR) de l'utilisateur */}
            <Route path="/my-tickets" element={<MyTicketsPage />} />
            <Route path="/events/create" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/events/:id/manage" element={<ManageEvent />} />
            <Route path="/events/:id/payout-request" element={<PayoutRequestScreen />} />
            <Route path="/events/:id/payout-approval/:payoutId" element={<PayoutApprovalScreen />} />
            <Route path="/events/:id/validators-vote" element={<EventValidatorsVote />} />
            <Route path="/events/:id/pool-validation" element={<EventPoolValidation />} />
            <Route path="/events/:id/success" element={<EventSuccessScreen />} />
            <Route path="/events/:id/comments" element={<EventCommentsPage />} />
            {/* Contrôle des billets à l'entrée — créateur / co-organisateurs (vérifié côté serveur) */}
            <Route path="/events/:id/check-in" element={<TicketScanner />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/scan-qr" element={<JoinPrivateEvent />} />
            <Route path="/event/join/:code" element={<JoinPrivateEvent />} />
            <Route path="/events/join/:code" element={<JoinPrivateEvent />} />
            <Route path="/events/:id/pay" element={<PaymentPage />} />
            <Route path="/payments/:bookingId" element={<PaymentReceipt />} />
            <Route path="/verify-profile" element={<VerifyProfile />} />
            <Route path="/friend-requests" element={<FriendRequests />} />
            <Route path="/friends" element={<FriendsList />} />
            <Route path="/friends/:userId" element={<FriendsList />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/chat/:id" element={<ChatDetails />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/account" element={<AccountMenu />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/profile/events-created" element={<CreatedEventsList />} />
            <Route path="/profile/:userId/events-created" element={<CreatedEventsList />} />
            <Route path="/profile/events-joined" element={<JoinedEventsList />} />
            <Route path="/profile/:userId/events-joined" element={<JoinedEventsList />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/radar" element={<OutRadar />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/support" element={<HelpSupport />} />
            <Route path="/pages" element={<PagesHub />} />
            <Route path="/pages/create" element={<CreatePage />} />
            <Route path="/pages/mine" element={<MyPagesHub />} />
            <Route path="/pages/:id" element={<PageView />} />
            <Route path="/pages/:id/manage" element={<ManagePage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        <CallOverlay />
        </ConfirmProvider>
        </UserProfileProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors toastOptions={{ style: { marginTop: 'env(safe-area-inset-top, 44px)' } }} />

      </ThemeProvider>
    </QueryClientProvider>
  )
}
