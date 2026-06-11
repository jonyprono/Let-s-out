import { initializeApp } from "firebase/app";
import { getAuth, indexedDBLocalPersistence, browserLocalPersistence, initializeAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyAm1SfhGln_Zc7ZboqFT74RfwLGaBn0hYk",
  authDomain: "let-s-out.firebaseapp.com",
  projectId: "let-s-out",
  storageBucket: "let-s-out.firebasestorage.app",
  messagingSenderId: "259737951981",
  appId: "1:259737951981:web:969cfd43152d4c73deb6e4",
  measurementId: "G-3N2Q8C11WH"
};

export const app = initializeApp(firebaseConfig);

// Configuration de App Check (Uniquement pour le Web)
if (!Capacitor.isNativePlatform()) {
  // Permet de tester en local (localhost) sans bloquer App Check
  if (import.meta.env && import.meta.env.DEV) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    // Clé reCAPTCHA v3 ajoutée automatiquement !
    provider: new ReCaptchaV3Provider("6LfEFRotAAAAANEr9vxKWeKUC23_DAfyD8JBry1s"),
    isTokenAutoRefreshEnabled: true
  });
}

// Use indexedDB on native (Capacitor) for persistence, localStorage on web
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] })
  : getAuth(app);

