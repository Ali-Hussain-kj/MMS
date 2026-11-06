import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig, { validateFirebaseConfig } from './firebaseConfig';

function getFirebaseAuth(app) {
  try {
    // React Native Auth stores the signed-in session in AsyncStorage between launches.
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/already-initialized') {
      return getAuth(app);
    }

    throw error;
  }
}

export function getFirebaseServices() {
  validateFirebaseConfig();

  // Reuse the app if Firebase was already initialized elsewhere in the process.
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  return {
    app,
    auth: getFirebaseAuth(app),
    db: getFirestore(app),
  };
}
