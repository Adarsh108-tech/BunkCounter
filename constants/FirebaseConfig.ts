import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Initialize Firebase using environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Debug check for missing variables
if (!firebaseConfig.apiKey) {
  console.error(
    "Firebase Configuration Error: EXPO_PUBLIC_FIREBASE_API_KEY is missing! Check your .env file and restart Expo with 'npx expo start --clear'",
  );
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with persistence
let auth: ReturnType<typeof getAuth>;
try {
  if (Platform.OS !== "web") {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    auth = getAuth(app);
  }
} catch (error) {
  // If auth was already initialized (hot reload), just get the existing instance
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
