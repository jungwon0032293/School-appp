import { Stack, useRouter } from "expo-router";
import { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar'; 
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from "react-native-safe-area-context"; 

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { db } from "../firebaseConfig"; 
import { doc, setDoc, serverTimestamp } from "firebase/firestore"; 
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";

// Notifications 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<any> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// AdminContext 타입 정의
interface AdminContextType {
  isAdmin: boolean;
  isMaster: boolean; 
  setIsAdmin: (val?: boolean, role?: string) => void;
  setIsMaster: (val?: boolean, role?: string) => void;
  user: any;
  setUser: (user: any) => void;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  isMaster: false, 
  setIsAdmin: (val?: boolean, role?: string) => {},
  setIsMaster: (val?: boolean, role?: string) => {},
  user: null,
  setUser: (user: any) => {},
});

export const useAdmin = () => useContext(AdminContext);

export default function RootLayout() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMaster, setIsMaster] = useState(false); 
  const [user, setUser] = useState<any>(null); 
  
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    const initApp = async () => {
      // 1. 일반 유저 세션 복구 및 권한 계산
      const savedUser = await AsyncStorage.getItem('userSession');
      await new Promise((resolve) => { 
        const unsubscribe = onAuthStateChanged(auth, (u) => { 
          unsubscribe(); 
          resolve(u);
        });
      });

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        const masterCheck = parsedUser.role === 'master';
        const adminCheck = parsedUser.isAdmin === true || parsedUser.role === 'admin';
        
        setIsMaster(masterCheck);
        setIsAdmin(masterCheck || adminCheck);
      } else {
        const status = await AsyncStorage.getItem('adminStatus');
        if (status === 'true') setIsAdmin(true);
      }
      
      // ✅ 수정: NavigationBar.setBackgroundColorAsync 제거 (최신 expo-navigation-bar 호환)
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync("visible").catch(() => {});
      }
    };
    initApp();

    registerForPushNotificationsAsync().then(async (token) => {
      if (token) {
        await AsyncStorage.setItem('pushToken', token);
        
        try {
            const tokenKey = token.replace(/\[|\]|:/g, ""); 
            await setDoc(doc(db, "users", `user_${tokenKey.substring(tokenKey.length - 10)}`), {
              pushToken: token,
              lastActive: serverTimestamp(),
              platform: Platform.OS
            }, { merge: true });
        } catch (e) {
            console.error("❌ 토큰 DB 저장 실패:", e);
        }
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      if (data) {
        if (data.screen === 'notice' && data.id) {
          router.push({
            pathname: '/../notice/detail',
            params: { id: data.id }
          } as any);
          
        } else if (data.screen === 'community' && data.id) {
          router.push(`/community/${data.id}` as any);
          
        } else if (data.screen === 'suggestion') {
          router.push('/suggestion' as any);
        }
      }
    });

    return () => {
      if (notificationListener.current?.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current?.remove) {
        responseListener.current.remove();
      }
    };
  }, []);

  const updateAdminStatus = async (val?: boolean, role?: string) => {
    const masterCheck = role === 'master';
    const adminCheck = role === 'admin' || val === true;
    
    const finalAdminStatus = masterCheck || adminCheck;
    
    setIsAdmin(finalAdminStatus);
    setIsMaster(masterCheck);
    await AsyncStorage.setItem('adminStatus', finalAdminStatus.toString());
  };

  const handleSetUser = async (userData: any) => {
    setUser(userData);
    if (userData) {
      await AsyncStorage.setItem('userSession', JSON.stringify(userData));
      const isM = userData.role === 'master';
      const isA = userData.isAdmin === true || userData.role === 'admin';
      setIsMaster(isM);
      setIsAdmin(isM || isA);
      await AsyncStorage.setItem('adminStatus', (isM || isA).toString());
    } else {
      await AsyncStorage.removeItem('userSession');
      setIsAdmin(false);
      setIsMaster(false);
      await AsyncStorage.setItem('adminStatus', 'false');
    }
  };

  return (
    <SafeAreaProvider>
      <AdminContext.Provider value={{ isAdmin, isMaster, setIsAdmin: updateAdminStatus, setIsMaster: updateAdminStatus, user, setUser: handleSetUser }}>
        {/* ✅ 수정: translucent 속성 제거 */}
        <StatusBar style="dark" />
        
        <Stack
          screenOptions={{
            headerShown: false,
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerBackTitle: "",
            headerTintColor: '#1A1F27',
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
            headerStyle: { backgroundColor: '#fff' }
          }}
        >
          <Stack.Screen name="(tabs)/index" options={{ title: "홈", headerShown: false }} />
          <Stack.Screen name="(tabs)/meal" options={{ title: "오늘의 급식" }} />
          <Stack.Screen name="admin/edit-meal" options={{ title: "급식 수정" }} />
          <Stack.Screen name="(tabs)/calendar" options={{ title: "학사일정" }} />
          <Stack.Screen name="(tabs)/notice/index" options={{ title: "공지사항" }} />
          <Stack.Screen name="(tabs)/notice/write" options={{ title: "공지 작성" }} />
          <Stack.Screen name="(tabs)/notice/detail" options={{ title: "공지 상세" }} />
          <Stack.Screen name="(tabs)/suggestion/index" options={{ title: "학생 건의함" }} />
          <Stack.Screen name="admin/login" options={{ title: "학생회 로그인", presentation: 'modal' }} />
        </Stack>
      </AdminContext.Provider>
    </SafeAreaProvider>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00D1A0',
    });
  }
  if (Device.isDevice) {
    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.granted;

    if (!finalStatus) {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.granted;
    }

    if (!finalStatus) return;
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
    })).data;
  }
  return token;
}
