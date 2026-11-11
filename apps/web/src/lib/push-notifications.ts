import { PushNotifications, ActionPerformed, PushNotificationSchema, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { apiClient } from './api-client';
import { toast } from 'sonner';

let isInitialized = false;

/**
 * Initialize Push Notifications on mobile devices (Android / iOS).
 * Creates notification channels, requests permissions, registers FCM token,
 * and handles background/foreground notification interactions.
 */
export async function initializePushNotifications(navigate?: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  try {
    // 1. Create Android Notification Channels with HIGH importance (heads-up banner + sound)
    if (Capacitor.getPlatform() === 'android') {
      try {
        await PushNotifications.createChannel({
          id: 'default',
          name: 'Notifications générales',
          description: "Alertes d'événements, invitations et rappels",
          importance: 5, // IMPORTANCE_HIGH (heads-up banner)
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#FF7A00',
        });

        await PushNotifications.createChannel({
          id: 'messages',
          name: 'Messages & Amis',
          description: 'Nouveaux messages et demandes d’amis',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#FF7A00',
        });

        await PushNotifications.createChannel({
          id: 'events',
          name: 'Sorties & Vlogs',
          description: 'Nouveaux événements, rappels et Out vlogs',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#FF7A00',
        });
      } catch (channelErr) {
        console.warn('[Push] Channel creation error (non-fatal):', channelErr);
      }
    }

    // 2. Check and request permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Permission not granted:', permStatus.receive);
      return;
    }

    // 3. Register with Apple / Google FCM
    await PushNotifications.register();

    // 4. Listeners
    // Registration success: send token to backend
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Registration successful. FCM Token:', token.value?.slice(0, 20) + '...');
      try {
        await apiClient.post('/notifications/device-token', {
          token: token.value,
          platform: Capacitor.getPlatform(),
        });
        localStorage.setItem('letsout_device_token', token.value);
      } catch (tokenErr) {
        console.warn('[Push] Failed to save device token on server:', tokenErr);
      }
    });

    // Registration error
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[Push] Registration error:', error);
    });

    // Foreground notification received: display custom in-app notification / toast
    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[Push] Notification received in foreground:', notification);
      const title = notification.title || "Let's Out";
      const body = notification.body || '';

      toast(title, {
        description: body,
        duration: 5000,
        action: notification.data?.eventId || notification.data?.screen ? {
          label: 'Voir',
          onClick: () => handleNotificationRouting(notification.data, navigate),
        } : undefined,
      });
    });

    // Notification action performed (user tapped the notification in system tray)
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('[Push] Notification tapped:', notification);
      const data = notification.notification?.data;
      handleNotificationRouting(data, navigate);
    });

  } catch (err) {
    console.error('[Push] Initialization error:', err);
  }
}

/**
 * Handle navigation when a notification is clicked.
 */
export function handleNotificationRouting(data: any, navigate?: (path: string) => void) {
  if (!data || !navigate) return;

  if (data.type === 'RADAR_INVITE' || data.type === 'RADAR_INVITE_ACCEPTED' || data.screen === 'radar') {
    navigate('/radar?tab=invites');
    return;
  }

  const screen = data.screen;
  const eventId = data.eventId;
  const conversationId = data.conversationId || data.chatId;

  if (screen === 'event-details' && eventId) {
    navigate(`/events/${eventId}`);
  } else if (screen === 'videos') {
    navigate('/videos');
  } else if (screen === 'friend-requests') {
    navigate('/friend-requests');
  } else if (screen === 'friends') {
    navigate('/friends');
  } else if (screen === 'user-profile' && data.initiatorId) {
    navigate(`/profile/${data.initiatorId}`);
  } else if ((screen === 'chat' || screen === 'message') && conversationId) {
    navigate(`/chat/${conversationId}`);
  } else if (screen === 'notifications') {
    navigate('/notifications');
  } else if (eventId) {
    navigate(`/events/${eventId}`);
  }
}

/**
 * Unregister push notifications on logout
 */
export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const savedToken = localStorage.getItem('letsout_device_token');
    if (savedToken) {
      await apiClient.delete('/notifications/device-token', {
        data: { token: savedToken },
      }).catch(() => {});
      localStorage.removeItem('letsout_device_token');
    }
    await PushNotifications.removeAllListeners();
  } catch (e) {
    console.warn('[Push] Unregister error:', e);
  }
}
