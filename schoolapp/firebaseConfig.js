import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyC3ulxIM5JM42giEz-zg3_ia7VNx4kDj-U",
  authDomain: "schoolapp-bedd4.firebaseapp.com",
  projectId: "schoolapp-bedd4",
  storageBucket: "schoolapp-bedd4.firebasestorage.app",
  messagingSenderId: "21793355013",
  appId: "1:21793355013:web:30307cd17432f4a41f336c",
  measurementId: "G-Q9F656S95D"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const auth = initializeAuth(app, { 
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});