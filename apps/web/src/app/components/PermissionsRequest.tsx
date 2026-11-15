import { useState } from 'react'
import i18n from '@/lib/i18n'
import { Bell, MapPin } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { Geolocation } from '@capacitor/geolocation'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { useTranslation } from 'react-i18next'

interface PermissionsRequestProps {
  onComplete: () => void
}

export function PermissionsRequest({ onComplete }: PermissionsRequestProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)

  const isNative = Capacitor.isNativePlatform()

  const requestPush = async () => {
    setLoading(true)
    try {
      if (!isNative) {
        toast.info(t('permissionsRequest.notificationsNonSupporteesSurLe'))
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

        // Create the default channel on Android 8+
        if (Capacitor.getPlatform() === 'android') {
          PushNotifications.createChannel({
            id: 'default',
            name: i18n.t('permissionsRequest.generalNotifications'),
            description: t('permissionsRequest.toutesLesNotificationsImportantesDe'),
            importance: 5,
            visibility: 1,
          }).catch(() => {})
        }

        // Always register for push notifications. The capacitor plugin uses google-services.json, not VITE_ variables.
        await PushNotifications.register();
      } else {
        toast.error(t('permissionsRequest.vousDevezAutoriserLesNotifications'))
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
      <div className="w-full max-w-sm bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
        <button
          onClick={finish}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 font-bold"
        >
          Ignorer
        </button>

        {step === 1 ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#F3E8FF] rounded-full flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-action-primary" />
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2"><span>{t('permissionsRequest.restezInforme')}</span></h2>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
              <span>{t('permissionsRequest.autorisezLesNotificationsPourNe')}</span>
            </p>
            <button
              onClick={requestPush}
              disabled={loading}
              style={{ backgroundColor: '#FF7F50', color: 'white', minHeight: '56px' }}
              className="w-full mt-4 bg-action-primary text-white py-4 rounded-xl font-bold text-[16px] active:scale-[0.98] transition-transform shadow-lg"
            >
              {loading ? 'Activation...' : t('permissionsRequest.activerLesNotifications')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#FFF4E5] rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-action-primary" />
            </div>
            <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2"><span>{t('permissionsRequest.autourDeVous')}</span></h2>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              <span>{t('permissionsRequest.activezLaLocalisationPourDecouvrir')}</span>
            </p>
            <button
              onClick={requestGeo}
              disabled={loading}
              style={{ backgroundColor: '#FF7F50', color: 'white', minHeight: '56px' }}
              className="w-full mt-4 bg-action-primary text-white py-4 rounded-xl font-bold text-[16px] active:scale-[0.98] transition-transform shadow-lg"
            >
              {loading ? 'Activation...' : t('permissionsRequest.activerLaLocalisation')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
