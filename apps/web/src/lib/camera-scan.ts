import { Capacitor } from '@capacitor/core'

/**
 * Outils communs aux écrans de scan QR (contrôle des billets, rejoindre un événement privé).
 *
 * Cause du bouton « Paramètres » inactif sur iPhone : il appelait `BarcodeScanner.openSettings()`
 * du plugin `@capacitor-mlkit/barcode-scanning`, qui n'existe qu'en CocoaPods (pas de Package.swift).
 * Le projet iOS utilise Swift Package Manager : `cap sync ios` (CI) ne l'embarque pas, donc sur iPhone
 * chaque appel du plugin échoue — et l'échec était avalé par `.catch(() => {})`.
 * `capacitor-native-settings`, lui, est bien embarqué sur iOS (SPM) et Android.
 * Le scan iPhone passe désormais par `@capacitor/barcode-scanner` (voir scanQrWithIosScanner).
 */

/** Ouvre la page Réglages de l'app (iOS : Réglages › Let's Out ; Android : infos de l'application). */
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings')
    const res = await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    })
    return res?.status !== false
  } catch (e) {
    console.error('[camera-scan] ouverture des réglages impossible', e)
    return false
  }
}

/**
 * Rend la page transparente (ou opaque) pendant le scan ML Kit (Android) : la caméra est affichée
 * SOUS la WebView. La classe est posée sur <html> ET <body> (cf. index.css) : <html> porte le fond
 * anti-flash du démarrage, qui sinon remplissait le cadre de visée en blanc.
 */
export function setScannerBackdrop(active: boolean): void {
  for (const el of [document.documentElement, document.body]) {
    el.classList.toggle('barcode-scanner-active', active)
  }
}

/** Le plugin ML Kit (scan en direct sous l'interface de l'app) est-il présent ? Android uniquement. */
export function isNativeScannerAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('BarcodeScanner')
}

/**
 * iPhone : scanner officiel `@capacitor/barcode-scanner` (compatible SPM, exclu d'Android via
 * capacitor.config.ts). Il ouvre son propre écran caméra natif plein écran ; au 1er scan iOS
 * affiche la vraie fenêtre de permission (NSCameraUsageDescription).
 */
export function isIosNativeScannerAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('CapacitorBarcodeScanner')
}

export type IosScanResult =
  | { status: 'ok'; value: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' }

/** Codes d'erreur du plugin iOS (OSBarcodeError.swift) */
const IOS_SCAN_CANCELLED = 'OS-PLUG-BARC-0006'
const IOS_CAMERA_DENIED = 'OS-PLUG-BARC-0007'

export async function scanQrWithIosScanner(instructions: string): Promise<IosScanResult> {
  try {
    // Import dynamique : le module (et sa dépendance web html5-qrcode) n'est chargé que sur iPhone
    const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint, CapacitorBarcodeScannerCameraDirection } =
      await import('@capacitor/barcode-scanner')
    const res = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: instructions,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    })
    const value = res?.ScanResult?.trim()
    return value ? { status: 'ok', value } : { status: 'cancelled' }
  } catch (e: any) {
    const code = String(e?.code ?? '')
    if (code === IOS_SCAN_CANCELLED) return { status: 'cancelled' }
    if (code === IOS_CAMERA_DENIED) return { status: 'denied' }
    console.error('[camera-scan] scan iOS impossible', e)
    return { status: 'error' }
  }
}

/** Plateforme pour choisir le texte d'aide (chemin des réglages différent iOS / Android). */
export function settingsPlatform(): 'ios' | 'android' {
  return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
}
