import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, Platform, useColorScheme, SafeAreaView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from "../../../firebaseConfig"; 
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';

interface Notice {
  id: string;
  title: string;
  author: string;
  createdAt: any;
}

export default function BookmarkNoticeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [bookmarkedNotices, setBookmarkedNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    border: isDark ? '#2C2C2C' : '#F1F3F5',
    accent: '#82A977'
  };

  const loadBookmarkedNotices = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. 사용자의 북마크 중 'notice' 타입인 것들을 가져옴
      const q = query(
        collection(db, "bookmarks"), 
        where("uid", "==", user.uid),
        where("type", "==", "notice") // 공지사항 타입만 필터링
      );
      
      const bookmarkSnap = await getDocs(q);
      const noticeIds = bookmarkSnap.docs.map(doc => doc.data().postId);

      if (noticeIds.length === 0) {
        setBookmarkedNotices([]);
        setLoading(false);
        return;
      }

      // 2. 해당 ID를 가진 실제 공지사항 데이터들을 가져옴
      const noticeList: Notice[] = [];
      for (const id of noticeIds) {
        const docRef = doc(db, "notices", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          noticeList.push({ id: docSnap.id, ...docSnap.data() } as Notice);
        }
      }

      // 최신순 정렬
      noticeList.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setBookmarkedNotices(noticeList);
    } catch (e) {
      console.error("북마크 로드 에러:", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBookmarkedNotices();
    }, [])
  );

  const renderItem = ({ item }: { item: Notice }) => (
    <TouchableOpacity 
      style={[styles.itemCard, { backgroundColor: theme.card }]}
      onPress={() => router.push(`/notice/detail?id=${item.id}`)}
    >
      <View style={styles.contentRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemTitle, { color: theme.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoText, { color: theme.subText }]}>{item.author}</Text>
            <View style={[styles.dot, { backgroundColor: isDark ? '#444' : '#D1D6DB' }]} />
            <Text style={[styles.infoText, { color: theme.subText }]}>
              {item.createdAt?.toDate().toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.subText} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>저장한 공지사항</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={bookmarkedNotices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={60} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>북마크한 공지가 없습니다.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  listContent: { padding: 20 },
  itemCard: { 
    padding: 20, 
    borderRadius: 16, 
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8
  },
  contentRow: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoText: { fontSize: 13 },
  dot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 8 },
  emptyContainer: { marginTop: 100, alignItems: 'center', gap: 16 },
  emptyText: { fontSize: 16, fontWeight: '500' }
});
