import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'

import { ThemeProvider, useTheme } from 'next-themes'

function CapacitorThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const updateStatusBar = async () => {
        try {
          if (resolvedTheme === 'dark') {
            await StatusBar.setStyle({ style: Style.Dark })
          } else {
            await StatusBar.setStyle({ style: Style.Light })
          }
        } catch (e) {
          console.warn('Failed to update status bar style:', e)
        }
      }
      updateStatusBar()
    }
  }, [resolvedTheme])

  return null
}
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth.store'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'

// All screens via adapter bridge (prop-based → React Router)
import {
  Splashscreen,
  Welcome,
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
} from '@/app/components/adapters'
import { AppBootstrap } from '@/app/components/AppBootstrap'
import { UserProfileProvider } from '@/features/users/UserProfileContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  if (token) return <Navigate to="/home" replace />
  return <>{children}</>
}

function CapacitorBackButton() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleBackButton = ({ canGoBack }: { canGoBack: boolean }) => {
      // If we are on the main tab screens or login, exit the app
      const exitRoutes = ['/', '/home', '/login', '/welcome']
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
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <BrowserRouter>
        <CapacitorThemeSync />
        <AppBootstrap />
        <CapacitorBackButton />
        <UserProfileProvider>
        <Routes>
          {/* Splash + Guest only */}
          <Route element={<AuthLayout />}>
            <Route path="/" element={<Splashscreen />} />
            <Route path="/welcome" element={<GuestRoute><Welcome /></GuestRoute>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          </Route>

          {/* Onboarding — accessible to authenticated users after signup */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected app */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/home" element={<Home />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/events/create" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/scan-qr" element={<JoinPrivateEvent />} />
            <Route path="/events/:id/pay" element={<PaymentPage />} />
            <Route path="/payments/:bookingId" element={<PaymentReceipt />} />
            <Route path="/verify-profile" element={<VerifyProfile />} />
            <Route path="/friend-requests" element={<FriendRequests />} />
            <Route path="/friends" element={<FriendsList />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/chat/:id" element={<ChatDetails />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </UserProfileProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors />

      </ThemeProvider>
    </QueryClientProvider>
  )
}
