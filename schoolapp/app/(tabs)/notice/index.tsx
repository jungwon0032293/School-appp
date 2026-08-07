import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, useColorScheme, Alert
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
      if (user) loadBookmarks();
    });
    return () => unsubscribe();
  }, []);

  useFocusEffect(useCallback(() => { 
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
  emptyText: { fontSize: 16, fontWeight: '500' }
});
