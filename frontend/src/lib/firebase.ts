import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate required config at startup
const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
for (const key of requiredKeys) {
    if (!firebaseConfig[key]) {
        console.error(`Missing required Firebase config: VITE_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}. Check your .env file.`);
    }
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to enable persistent Firebase auth session:', error);
});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize analytics only in browser environments that support it
isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
        getAnalytics(app);
    }
});

export default app;
