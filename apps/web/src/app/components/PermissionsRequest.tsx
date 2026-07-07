import { useState } from 'react'
import { Bell, MapPin } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { Geolocation } from '@capacitor/geolocation'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'

interface PermissionsRequestProps {
  onComplete: () => void
}

export function PermissionsRequest({ onComplete }: PermissionsRequestProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)

  const isNative = Capacitor.isNativePlatform()

  const requestPush = async () => {
    setLoading(true)
    try {
      if (!isNative) {
        toast.info('Notifications non supportées sur le web.')
        setStep(2)
        return
      }

      let permStatus = await PushNotifications.checkPermissions()
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }
      
      if (permStatus.receive === 'granted') {
        // Écouter le token FCM généré et l'envoyer au serveur
        PushNotifications.addListener('registration', async (token) => {
          console.log('[PushNotifications] FCM Token received:', token.value)
          try {
            await apiClient.post('/notifications/device-token', {
              token: token.value,
              platform: Capacitor.getPlatform(),
            })
            console.log('[PushNotifications] Token registered on server ✅')
          } catch (e) {
            console.error('[PushNotifications] Failed to register token on server:', e)
          }
        })

        PushNotifications.addListener('registrationError', (err) => {
          console.error('[PushNotifications] Registration error:', err.error)
        })

        const hasFirebaseConfig = !!import.meta.env.VITE_FIREBASE_API_KEY || !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
        if (hasFirebaseConfig) {
          await PushNotifications.register();
        } else {
          console.warn('[PushNotifications] Firebase not configured, skipping registration to prevent crash.');
        }
      } else {
        toast.error('Vous devez autoriser les notifications pour recevoir des alertes.')
      }
    } catch (e) {
      console.error('Push request error', e)
    } finally {
      setLoading(false)
      setStep(2)
    }
  }

  const requestGeo = async () => {
    setLoading(true)
    try {
      if (!isNative) {
        // web fallback
        navigator.geolocation.getCurrentPosition(() => {}, () => {})
      } else {
        const permStatus = await Geolocation.checkPermissions()
        if (permStatus.location === 'prompt') {
          await Geolocation.requestPermissions()
        }
      }
    } catch (e) {
      console.error('Geo request error', e)
    } finally {
      setLoading(false)
      finish()
    }
  }

  const finish = () => {
    localStorage.setItem('letsout_permissions_requested', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-6 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
        <button
          onClick={finish}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold"
        >
          Ignorer
        </button>

        {step === 1 ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#F3E8FF] rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-action-primary" />
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 mb-2">Restez informé</h2>
            <p className="text-[14px] text-gray-500 mb-8 leading-relaxed">
              Autorisez les notifications pour ne rater aucune invitation, message ou mise à jour de vos événements.
            </p>
            <button
              onClick={requestPush}
              disabled={loading}
              className="w-full bg-action-primary text-white py-4 rounded-xl font-bold text-[16px] active:scale-[0.98] transition-transform"
            >
              {loading ? 'Activation...' : 'Activer les notifications'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#FFF4E5] rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-action-primary" />
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 mb-2">Autour de vous</h2>
            <p className="text-[14px] text-gray-500 mb-8 leading-relaxed">
              Activez la localisation pour découvrir les événements proches et calculer les itinéraires.
            </p>
            <button
              onClick={requestGeo}
              disabled={loading}
              className="w-full bg-action-primary text-white py-4 rounded-xl font-bold text-[16px] active:scale-[0.98] transition-transform"
            >
              {loading ? 'Activation...' : 'Activer la localisation'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
