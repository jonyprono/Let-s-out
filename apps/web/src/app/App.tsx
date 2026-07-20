import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
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
      return isDark ? '#1a1a1a' : '#ffffff'
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
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { PrivacyPolicy } from '@/app/components/PrivacyPolicy'
import { TermsOfService } from '@/app/components/TermsOfService'
import { LandingPage } from '@/app/components/LandingPage'
import HelpSupport from './components/HelpSupport'

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
import { EventValidatorsVote } from '@/app/pages/EventValidatorsVote'
import { AppBootstrap } from '@/app/components/AppBootstrap'
import { UserProfileProvider } from '@/features/users/UserProfileContext'
import { CallOverlay } from '@/features/chat/components/CallOverlay'
import { AdminLayout } from '@/app/layouts/AdminLayout'
import { AdminRoute } from '@/app/components/admin/AdminRoute'
import { AdminLoginPage } from '@/app/components/admin/AdminLoginPage'
import { AdminDashboardPage } from '@/app/components/admin/AdminDashboardPage'
import { AdminKycListPage } from '@/app/components/admin/AdminKycListPage'
import { AdminKycDetailPage } from '@/app/components/admin/AdminKycDetailPage'
import { AdminAdminsPage } from '@/app/components/admin/AdminAdminsPage'
import { AdminSupportChats } from './components/admin/AdminSupportChats'
import { AdminBotPrompts } from './components/admin/AdminBotPrompts'
import { AdminAuditLogsPage } from './components/admin/AdminAuditLogsPage'
import { AdminPayoutsPage } from './components/admin/AdminPayoutsPage'
import { EventPoolValidation } from './components/EventPoolValidation';
import { AdminResetPasswordPage } from '@/app/components/admin/AdminResetPasswordPage'
import AdminFeatureFlagsPage from './components/admin/AdminFeatureFlagsPage'
import { AdminBadgesPage } from './components/admin/AdminBadgesPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace />

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
  
  if (token) {
    const pendingGoogleSignup = localStorage.getItem('pending_google_signup') === 'true'
    if (pendingGoogleSignup) {
      if (location.pathname !== '/signup') return <Navigate to="/signup?mode=google" replace />
      return <>{children}</>
    }

    const p: any = user?.profile || {}
    const isProfileIncomplete = !p.displayName
    if (user?.role !== 'ADMIN' && isProfileIncomplete) return <Navigate to="/onboarding" replace />
    return <Navigate to="/home" replace />
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
    return <Navigate to="/home" replace />
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

  useEffect(() => {
    const handleBackButton = ({ canGoBack }: { canGoBack: boolean }) => {
      // If we are on the main tab screens or login, exit the app
      const exitRoutes = ['/app', '/home', '/login', '/welcome']
      if (exitRoutes.includes(location.pathname) || !canGoBack) {
        CapacitorApp.exitApp()
      } else {
        navigate(-1)
      }
    }
    
    CapacitorApp.addListener('backButton', handleBackButton)

    return () => {
      CapacitorApp.removeAllListeners()
    }
  }, [navigate, location])

  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <BrowserRouter>
        <CapacitorThemeSync />
        <AppBootstrap />
        <CapacitorBackButton />
        <UserProfileProvider>
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
            <Route path="kyc" element={<AdminKycListPage />} />
            <Route path="kyc/:userId" element={<AdminKycDetailPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="support" element={<AdminSupportChats />} />
            <Route path="bots" element={<AdminBotPrompts />} />
            <Route path="audit" element={<AdminAuditLogsPage />} />
            <Route path="payouts" element={<AdminPayoutsPage />} />
            <Route path="feature-flags" element={<AdminFeatureFlagsPage />} />
            <Route path="badges" element={<AdminBadgesPage />} />
          </Route>

          {/* Protected app */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/home" element={<Home />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/events/create" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/events/:id/manage" element={<ManageEvent />} />
            <Route path="/events/:id/validators-vote" element={<EventValidatorsVote />} />
            <Route path="/events/:id/pool-validation" element={<EventPoolValidation />} />
            <Route path="/events/:id/success" element={<EventSuccessScreen />} />
            <Route path="/scan-qr" element={<JoinPrivateEvent />} />
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
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/support" element={<HelpSupport />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
        <CallOverlay />
        </UserProfileProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors toastOptions={{ style: { marginTop: 'env(safe-area-inset-top, 44px)' } }} />

      </ThemeProvider>
    </QueryClientProvider>
  )
}
