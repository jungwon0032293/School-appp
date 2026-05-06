import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// 1. 새로운 프로젝트(schoolapp-bedd4) 정보로 교체됨
const firebaseConfig = {
  apiKey: "AIzaSyC3ulxIM5JM42giEz-zg3_ia7VNx4kDj-U",
  authDomain: "schoolapp-bedd4.firebaseapp.com",
  projectId: "schoolapp-bedd4",
  storageBucket: "schoolapp-bedd4.firebasestorage.app",
  messagingSenderId: "21793355013",
  appId: "1:21793355013:web:30307cd17432f4a41f336c",
  measurementId: "G-Q9F656S95D"
};

// 2. Firebase 초기화
const app = initializeApp(firebaseConfig);

// 3. 앱에서 사용할 서비스 내보내기 (기존 코드의 로직 유지)
export const db = getFirestore(app);

// Auth 설정: 앱을 껐다 켜도 로그인이 유지되도록 설정
export const auth = initializeAuth(app, { 
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});