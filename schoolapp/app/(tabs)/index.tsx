import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  Dimensions, ActivityIndicator, Alert, Platform, useColorScheme 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { db, auth } from "../../firebaseConfig";
import { 
  doc, getDoc, collection, query, orderBy, getDocs, where, updateDoc 
} from "firebase/firestore";
import { useAdmin } from "../_layout";
import { Ionicons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { isAdmin, setIsAdmin, user, setUser } = useAdmin(); 
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [todayMeal, setTodayMeal] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  const accentColor = isDark ? '#869489' : '#556B2F';
  const buttonColor = '#82A977';

  const pagerRef = useRef<PagerView>(null);

  useEffect(() => {
    if (loading || banners.length <= 1) return;
    const interval = setInterval(() => {
      const nextPage = (currentPage + 1) % banners.length;
      pagerRef.current?.setPage(nextPage);
    }, 3500);
    return () => clearInterval(interval);
  }, [currentPage, loading, banners]);

  const getKSTDate = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return kst.toISOString().split('T')[0];
  };

  const checkReportNotifications = async () => {
    const activeUid = user?.uid || auth.currentUser?.uid;
    if (!activeUid) return;

    try {
      const q = query(
        collection(db, "reports"),
        where("reporterUid", "==", activeUid),
        where("status", "==", "resolved"),
        where("isNotified", "==", false)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) return;

      for (const reportDoc of snap.docs) {
        const data = reportDoc.data();
        Alert.alert(
          "📢 신고 처리 알림",
          `회원님이 신고하신 '${data.postTitle}' 게시글이 처리되었습니다.`,
          [{ 
            text: "확인", 
            onPress: async () => {
              try {
                await updateDoc(doc(db, "reports", reportDoc.id), { isNotified: true });
              } catch (err) {
                console.error("알림 상태 업데이트 실패:", err);
              }
            } 
          }]
        );
      }
    } catch (e) {
      console.log("알림 체크 에러:", e);
    }
  };

  const loadHomeData = async () => {
    setLoading(true);
    const todayDate = getKSTDate();
    try {
      const mealSnap = await getDoc(doc(db, "meals", todayDate));
      if (mealSnap.exists()) setTodayMeal(mealSnap.data());

      const bannerQuery = query(collection(db, "notices"), where("isBanner", "==", true), orderBy("createdAt", "desc"));
      const bannerSnap = await getDocs(bannerQuery);
      const fetchedBanners = bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBanners(fetchedBanners);

      await checkReportNotifications();

    } catch (e) {
      console.error("데이터 로딩 에러:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { 
    loadHomeData(); 
  }, [user])); 

  const handleSignOut = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠습니까?", [
      { text: "취소" },
      { text: "확인", onPress: () => {
        setUser(null); 
        setIsAdmin(false);
        Alert.alert("알림", "로그아웃 되었습니다.");
      }}
    ]);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: isDark ? '#111111' : '#F2F4F6' }]} 
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoCircle, isDark && { backgroundColor: '#222' }]}>
            <Text style={styles.logoEmoji}>🏫</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.schoolName, { color: isDark ? '#FFFFFF' : '#1A1F27' }]}>육민관고등학교</Text>
              {isAdmin && (
                <View style={[styles.adminBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.adminBadgeText}>학생회</Text>
                </View>
              )}
            </View>
            <Text style={[styles.welcomeText, { color: isDark ? '#9CA3AF' : '#6B7684' }]}>
              {user ? `${user.name}님, 반갑습니다!` : "Welcome to YMK High School!"}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* ✅ 알림 버튼: 로그인 상태일 때만 노출 */}
          {user && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={() => router.push('/notifications' as any)}
            >
              <Ionicons name="notifications-outline" size={24} color={isDark ? '#FFFFFF' : '#4E5968'} />
            </TouchableOpacity>
          )}

          {/* ✅ 설정 버튼: 로그인 상태일 때만 노출 */}
          {user && (
            <TouchableOpacity 
              style={styles.headerIconBtn} 
              onPress={() => router.push('/settings' as any)}
            >
              <Ionicons name="settings-outline" size={24} color={isDark ? '#FFFFFF' : '#4E5968'} />
            </TouchableOpacity>
          )}
          
          {/* ✅ 로그인/로그아웃 버튼: 아이콘 스타일로 수정 */}
          <TouchableOpacity 
            style={styles.headerIconBtn} 
            onPress={user ? handleSignOut : () => router.push("/admin/login")}
          >
            <Ionicons 
              name={user ? "log-out-outline" : "log-in-outline"} 
              size={24} 
              color={user ? (isDark ? '#FF6B6B' : '#E03131') : (isDark ? '#FFFFFF' : '#4E5968')} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.pagerContainer}>
        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color={buttonColor} /></View>
        ) : (
          <PagerView 
            ref={pagerRef}
            style={styles.pagerView} 
            initialPage={0}
            onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
          >
            {banners.length > 0 ? banners.map((notice, index) => (
              <View key={notice.id} style={styles.page}>
                <TouchableOpacity 
                  style={[styles.bannerCard, { backgroundColor: index % 2 === 0 ? buttonColor : '#6B705C' }]}
                  onPress={() => router.push({ pathname: "/notice/detail", params: { id: notice.id } } as any)}
                >
                  <View>
                    <Text style={styles.bannerTag}>📌 실시간 주요 소식</Text>
                    <Text style={styles.bannerMainTitle} numberOfLines={1}>{notice.title}</Text>
                    <Text style={styles.bannerSubText} numberOfLines={1}>{notice.content}</Text>
                  </View>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold'}}>{index + 1} / {banners.length}</Text>
                    <Text style={styles.bannerFooter}>자세히 보기 〉</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )) : (
              <View key="empty" style={styles.page}>
                <View style={[styles.bannerCard, { backgroundColor: buttonColor }]}>
                  <Text style={styles.bannerMainTitle}>새로운 공지가 없습니다.</Text>
                </View>
              </View>
            )}
          </PagerView>
        )}
      </View>

      <View style={styles.menuList}>
        {isAdmin && (
          <TouchableOpacity 
            style={[styles.adminCompactButton, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: accentColor }]}
            onPress={() => router.push('/admin/manage-users' as any)}
          >
            <Text style={styles.adminCompactEmoji}>✅</Text>
            <Text style={[styles.adminCompactTitle, { color: isDark ? '#FFFFFF' : '#333D4B' }]}>가입 승인 대기 목록 확인</Text>
            <Text style={[styles.adminCompactArrow, { color: accentColor }]}>〉</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#1A1F27' }]}>학교 생활</Text>
        
        <View style={styles.buttonRow}>
          <HomeSquareButton title="공지사항" icon="📣" onPress={() => router.push('/notice')} color={isDark ? "rgba(134, 148, 137, 0.15)" : "rgba(85, 107, 47, 0.08)"} iconColor={accentColor} isDark={isDark} />
          <HomeSquareButton title="건의함" icon="💬" onPress={() => router.push('/suggestion')} color={isDark ? "#451A03" : "#FFF5E6"} iconColor="#FF9500" isDark={isDark} />
        </View>

        <View style={styles.buttonRow}>
          <HomeSquareButton title="커뮤니티" icon="👥" onPress={() => router.push('/community' as any )} color={isDark ? "#1E293B" : "#F0F0FF"} iconColor="#6366F1" isDark={isDark} />
          <HomeSquareButton title="학사일정" icon="📅" onPress={() => router.push('/calendar')} color={isDark ? "#1E293B" : "#E8F3FF"} iconColor="#3182F6" isDark={isDark} />
        </View>

        <View style={styles.buttonRow}>
          <HomeSquareButton title="시간표" icon="⏰" onPress={() => router.push('/timetable')} color={isDark ? "#2D2D2D" : "#F0F4F7"} iconColor={isDark ? "#9CA3AF" : "#4E5968"} isDark={isDark} />
          <HomeSquareButton title="급식" icon="🍱" onPress={() => router.push('/meal')} color={isDark ? "#2D2A22" : "#FBFAEE"} iconColor={isDark ? "#CBB48E" : "#8A785D"} isDark={isDark} />
        </View>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function HomeSquareButton({ title, icon, onPress, color, iconColor, isDark }: any) {
  return (
    <TouchableOpacity 
      style={[styles.squareButton, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]} 
      onPress={onPress} 
      activeOpacity={0.6}
    >
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <Text style={[styles.iconText, { color: iconColor }]}>{icon}</Text>
      </View>
      <Text style={[styles.squareButtonTitle, { color: isDark ? '#FFFFFF' : '#333D4B' }]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginTop: Platform.OS === 'ios' ? 60 : 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' }, 
  headerIconBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  logoCircle: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  logoEmoji: { fontSize: 22 },
  headerTextContainer: { marginLeft: 12 },
  schoolName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  welcomeText: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  adminBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  adminBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  pagerContainer: { height: 180, marginBottom: 25 },
  pagerView: { flex: 1 },
  page: { paddingHorizontal: 20, justifyContent: 'center' },
  loadingBox: { height: 160, justifyContent: 'center' },
  bannerCard: { height: 160, borderRadius: 24, padding: 24, justifyContent: 'space-between', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 12 },
  bannerTag: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  bannerMainTitle: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  bannerSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 6, fontWeight: '500' },
  bannerFooter: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  menuList: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, marginLeft: 4 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  squareButton: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 24, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
  squareButtonTitle: { fontSize: 15, fontWeight: '700', marginTop: 12 },
  iconBox: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 26 },
  adminCompactButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderStyle: 'dashed' },
  adminCompactEmoji: { fontSize: 16, marginRight: 10 },
  adminCompactTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  adminCompactArrow: { fontSize: 14, fontWeight: '800' },
});
