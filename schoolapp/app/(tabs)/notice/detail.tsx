import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Platform, useColorScheme 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from "../../../firebaseConfig";
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAdmin } from "../../_layout";
import { Ionicons } from '@expo/vector-icons'; // ✅ 아이콘 추가

export default function NoticeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { isAdmin } = useAdmin();
  const colorScheme = useColorScheme(); 
  const isDark = colorScheme === 'dark';
  
  const [notice, setNotice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false); // ✅ 북마크 상태 추가

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    content: isDark ? '#E5E8EB' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#F1F3F5',
    headerBg: isDark ? '#1E1E1E' : '#fff',
    yellow: '#FFD700', // ✅ 북마크 색상
  };

  // ✅ 북마크 상태 확인
  const checkBookmarkStatus = async (uid: string) => {
    if (!uid || !id) return;
    try {
      const bookmarkDocId = `${uid}_${id}`;
      const bookmarkDoc = await getDoc(doc(db, "bookmarks", bookmarkDocId));
      setIsBookmarked(bookmarkDoc.exists());
    } catch (e) { console.log("Bookmark check error"); }
  };

  const loadNotice = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const docSnap = await getDoc(doc(db, "notices", id as string));
      if (docSnap.exists()) {
        setNotice(docSnap.data());
      } else {
        Alert.alert("알림", "존재하지 않거나 삭제된 게시글입니다.");
        router.back();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) checkBookmarkStatus(user.uid);
    });
    return () => unsubscribe();
  }, [id]);

  useFocusEffect(useCallback(() => { 
    loadNotice(); 
    if (auth.currentUser) checkBookmarkStatus(auth.currentUser.uid);
  }, [id]));

  // ✅ 북마크 토글 함수
  const handleToggleBookmark = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return Alert.alert("알림", "로그인이 필요합니다.");
    if (!id) return;

    const bookmarkDocId = `${currentUser.uid}_${id}`;
    const bookmarkRef = doc(db, "bookmarks", bookmarkDocId);

    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, {
          uid: currentUser.uid,
          postId: id,
          type: 'notice',
          createdAt: serverTimestamp()
        });
        setIsBookmarked(true);
      }
    } catch (e) { console.error("북마크 처리 실패:", e); }
  };

  const handleDelete = () => {
    Alert.alert("공지 삭제", "이 공지사항을 정말로 삭제할까요?", [
      { text: "취소", style: "cancel" },
      { 
        text: "삭제하기", 
        style: "destructive", 
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "notices", id as string));
            router.back();
          } catch (e) {
            Alert.alert("오류", "삭제에 실패했습니다.");
          }
        } 
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={isDark ? '#869489' : '#556B2F'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* 헤더 */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: isDark ? '#fff' : '#4E5968' }]}>〈</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>공지사항</Text>
        
        {/* ✅ 북마크 버튼 추가 */}
        <TouchableOpacity onPress={handleToggleBookmark} style={styles.bookmarkBtn}>
          <Ionicons 
            name={isBookmarked ? "bookmark" : "bookmark-outline"} 
            size={22} 
            color={isBookmarked ? theme.yellow : (isDark ? '#fff' : '#4E5968')} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.detailCard, { backgroundColor: theme.card }]}>
          <View style={styles.titleSection}>
            {notice?.isPinned && (
              <View style={[styles.pinBadge, { backgroundColor: '#82A977' }]}>
                <Text style={styles.pinText}>중요</Text>
              </View>
            )}
            <Text style={[styles.title, { color: theme.text }]}>{notice?.title}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.author, { color: theme.text }]}>{notice?.author}</Text>
            <View style={[styles.dot, { backgroundColor: isDark ? '#444' : '#D1D6DB' }]} />
            <Text style={[styles.date, { color: theme.subText }]}>
              {notice?.createdAt?.toDate().toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Text style={[styles.content, { color: theme.content }]}>{notice?.content}</Text>
        </View>

        {isAdmin && (
          <View style={styles.adminActionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.editBtn, isDark && { backgroundColor: '#82A977' }]}
              onPress={() => router.push({ pathname: "/notice/write", params: { id } } as any)}
            >
              <Text style={styles.editBtnText}>수정하기</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionBtn, styles.deleteBtn, isDark && { backgroundColor: 'transparent', borderColor: '#FF4D4D' }]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteBtnText}>삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingHorizontal: 24, 
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, fontWeight: '400' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  bookmarkBtn: { padding: 4 }, // ✅ 북마크 버튼 스타일 추가

  scrollContent: { padding: 24, paddingBottom: 60 },

  detailCard: { 
    borderRadius: 24, 
    padding: 24,
    minHeight: 350,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    elevation: 2
  },
  titleSection: { marginBottom: 12 },
  pinBadge: { 
    alignSelf: 'flex-start', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8, 
    marginBottom: 10 
  },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 34 },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  author: { fontSize: 14, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 10 },
  date: { fontSize: 14, fontWeight: '500' },

  divider: { height: 1, marginBottom: 24 },
  content: { fontSize: 16, lineHeight: 26, fontWeight: '400' },

  adminActionRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  actionBtn: { flex: 1, height: 58, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  editBtn: { backgroundColor: '#82A977' },
  editBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#FF4D4D' },
  deleteBtnText: { color: '#FF4D4D', fontSize: 16, fontWeight: '700' },
});
