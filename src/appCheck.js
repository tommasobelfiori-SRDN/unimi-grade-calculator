// ---------------------------------------------------------------------------
// Firebase App Check (lato client)
// ---------------------------------------------------------------------------
// Garantisce che a chiamare /api/extract sia davvero il tuo sito (token reCAPTCHA
// v3 verificato dal backend). I valori sono pubblici e si impostano via env Vite:
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
//   VITE_FIREBASE_APP_ID, VITE_RECAPTCHA_SITE_KEY
// Se NON sono impostati, App Check resta disattivato e l'app funziona comunque
// (utile in sviluppo); l'enforcement vero avviene comunque solo lato backend.
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
} from "firebase/app-check";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

let appCheck = null;
if (cfg.apiKey && cfg.projectId && siteKey) {
  try {
    const app = initializeApp(cfg);
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // Config incompleta o duplicata: si prosegue senza App Check lato client.
    appCheck = null;
  }
}

// Ritorna un token App Check, oppure null se non configurato/indisponibile.
export async function getAppCheckToken() {
  if (!appCheck) return null;
  try {
    const { token } = await getToken(appCheck, false);
    return token || null;
  } catch (e) {
    return null;
  }
}
