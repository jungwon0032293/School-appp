import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, useColorScheme, Alert, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from "expo-router/react-navigation";
import { db, auth } from "../../../firebaseConfig"; 
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, getDoc, serverTimestamp, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useAdmin } from "../../_layout";
import { Ionicons } from '@expo/vector-icons'; 

interface Notice {
  id: string; title: string; author: string; content: string;
  isPinned: boolean; createdAt: any;
}

export default function NoticeScreen() {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<string[]>([]); 

  // 회원가입 거절 모달 관련 상태
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    headerBg: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    border: isDark ? '#2C2C2C' : '#F1F3F5',
    badge: isDark ? '#2C2C2C' : '#F1F3F5',
    yellow: '#FFD700', 
  };

  // 회원가입 거절 상태 체크 로직
  const checkUserRejection = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.isApproved === "rejected") {
          setRejectReason(userData.rejectReason || "입력된 거절 사유가 없습니다.");
          setRejectModalVisible(true);
        }
      }
    } catch (e) {
      console.error("유저 거절 상태 체크 오류:", e);
    }
  };

  // 다시 회원가입 진행 처리
  const handleReSignup = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // 기존 거절된 문서 삭제
      await deleteDoc(doc(db, "users", currentUser.uid));
      setRejectModalVisible(false);
      // 회원가입 페이지로 이동
      router.replace("/signup" as any);
    } catch (e) {
      console.error("거절 정보 초기화 오류:", e);
      Alert.alert("오류", "회원가입 페이지로 이동 중 오류가 발생했습니다.");
    }
  };

  const loadBookmarks = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const q = query(collection(db, "bookmarks"), where("uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      const bookmarkedIds = snap.docs.map(doc => doc.data().postId);
      setBookmarks(bookmarkedIds);
    } catch (e) { console.error(e); }
  };

  const loadNotices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notice[];

      const sorted = fetched.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
      setNotices(sorted);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        checkUserRejection();
        loadBookmarks();
      }
    });
    return () => unsubscribe();
  }, []);

  useFocusEffect(useCallback(() => { 
    checkUserRejection();
    loadNotices(); 
    loadBookmarks();
  }, []));

  const toggleBookmark = async (noticeId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("알림", "로그인 후 이용 가능합니다.");
      return;
    }

    const bookmarkDocId = `${currentUser.uid}_${noticeId}`;
    const bookmarkRef = doc(db, "bookmarks", bookmarkDocId);

    try {
      if (bookmarks.includes(noticeId)) {
        await deleteDoc(bookmarkRef);
        setBookmarks(prev => prev.filter(id => id !== noticeId));
      } else {
        await setDoc(bookmarkRef, {
          uid: currentUser.uid,
          postId: noticeId,
          type: 'notice', 
          createdAt: serverTimestamp()
        });
        setBookmarks(prev => [...prev, noticeId]);
      }
    } catch (e) { console.error(e); }
  };

  const renderItem = ({ item }: { item: Notice }) => {
    const isBookmarked = bookmarks.includes(item.id);
    
    return (
      <TouchableOpacity 
        style={[
          styles.itemCard, 
          { backgroundColor: theme.card },
          item.isPinned && [styles.pinnedCard, { borderColor: isDark ? '#333' : '#E9ECEF', backgroundColor: theme.card }]
        ]}
        onPress={() => router.push(`/notice/detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.contentRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              {item.isPinned && (
                <View style={[styles.pinBadge, { backgroundColor: theme.badge }]}>
                  <Text style={[styles.pinText, { color: isDark ? '#869489' : '#556B2F' }]}>중요</Text>
                </View>
              )}
              <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoText, { color: theme.subText }]}>{item.author}</Text>
              <View style={[styles.dot, { backgroundColor: isDark ? '#444' : '#D1D6DB' }]} />
              <Text style={[styles.infoText, { color: theme.subText }]}>
                {item.createdAt?.toDate().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity 
            onPress={() => toggleBookmark(item.id)}
            style={{ padding: 10 }}
          >
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={isBookmarked ? theme.yellow : (isDark ? '#444' : '#D1D6DB')} 
            />
          </TouchableOpacity>
          <Text style={[styles.arrowIcon, { color: isDark ? '#444' : '#D1D6DB' }]}>〉</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>공지사항</Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => router.push("/notice/bookmark" as any)} 
            style={styles.bookmarkListBtn}
          >
            <Ionicons name="bookmarks-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity onPress={() => router.push("/notice/write")} style={styles.writeBtn}>
              <Text style={styles.writeBtnText}>글쓰기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={isDark ? '#869489' : '#556B2F'} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDark ? '#444' : '#ADB5BD' }]}>등록된 공지사항이 없어요.</Text>
            </View>
          }
        />
      )}

      {/* 회원가입 거절 안내 커스텀 모달 */}
      <Modal
        visible={rejectModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // 닫기 방지 (반드시 다시 가입하도록)
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning-outline" size={36} color="#FF6B6B" />
              <Text style={[styles.modalTitle, { color: theme.text }]}>회원가입 신청 거절</Text>
            </View>

            <Text style={[styles.modalSubTitle, { color: theme.subText }]}>
              회원가입 신청이 아래와 같은 사유로 반려되었습니다. 내용 확인 후 다시 회원가입을 진행해 주세요.
            </Text>

            <View style={[styles.reasonBox, { backgroundColor: isDark ? '#2A2A2A' : '#F1F3F5' }]}>
              <Text style={[styles.reasonText, { color: theme.text }]}>{rejectReason}</Text>
            </View>

            <TouchableOpacity 
              style={styles.reSignupBtn} 
              onPress={handleReSignup}
              activeOpacity={0.8}
            >
              <Text style={styles.reSignupBtnText}>다시 회원가입하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 55 : 15, 
    paddingHorizontal: 20, 
    paddingBottom: 20,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  navButton: { padding: 4, marginLeft: -8, marginRight: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 }, 
  bookmarkListBtn: { padding: 8 }, 
  writeBtn: { 
    backgroundColor: '#82A977', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  writeBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },

  listContent: { padding: 20, paddingBottom: 40 },
  
  itemCard: { 
    padding: 22, 
    borderRadius: 24, 
    marginBottom: 14,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 10, 
    elevation: 2
  },
  pinnedCard: { 
    borderWidth: 1,
  },
  contentRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  pinBadge: { 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8, 
    marginRight: 10 
  },
  pinText: { fontSize: 11, fontWeight: '800' },
  itemTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 13, fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 8 },
  arrowIcon: { fontSize: 18, marginLeft: 2 },

  emptyContainer: { marginTop: 120, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '500' },

  // 거절 안내 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubTitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  reasonBox: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  reSignupBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#82A977',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reSignupBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
