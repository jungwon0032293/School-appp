import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, 
  Alert, ActivityIndicator, useColorScheme, Platform, 
  SafeAreaView, Modal, TouchableWithoutFeedback, Dimensions,
  ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from "../../../firebaseConfig"; 
import { 
  collection, query, where, orderBy, getDocs, deleteDoc, doc, writeBatch,
  setDoc, getDoc, addDoc, serverTimestamp
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; 
import { useAdmin } from "../../_layout";
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  authorStudentId: string;
  authorUid: string; 
  isAnonymous: boolean;
  createdAt: any;
  views?: number;
  commentCount?: number;
  likeCount?: number;
  reportCount: number; // 실시간 계산용
}

export default function CommunityScreen() {
  const { isAdmin, isMaster, user } = useAdmin(); 
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  // '인기글' 카테고리 기본값에 추가
  const [categories, setCategories] = useState(['전체', '인기글', '북마크', '1학년', '2학년', '3학년', '자유']);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); 
  const [reportCount, setReportCount] = useState(0); 
  const [bookmarks, setBookmarks] = useState<string[]>([]); 

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    header: isDark ? '#1C1C1E' : '#FFFFFF',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
    red: '#FF4D4D',
    yellow: '#FFD700'
  };

  const loadBookmarks = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const q = query(collection(db, "bookmarks"), where("uid", "==", currentUser.uid));
      const snap = await getDocs(q);
      const bookmarkedIds = snap.docs.map(doc => doc.data().postId);
      setBookmarks(bookmarkedIds);
    } catch (e) { console.error("북마크 로딩 에러:", e); }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) loadBookmarks();
    });
    const loadCategories = async () => {
      const saved = await AsyncStorage.getItem('community_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        // 저장된 카테고리에 '인기글'과 '북마크'가 없으면 순서대로 삽입
        if (!parsed.includes('인기글')) parsed.splice(1, 0, '인기글');
        if (!parsed.includes('북마크')) {
            const hotIndex = parsed.indexOf('인기글');
            parsed.splice(hotIndex + 1, 0, '북마크');
        }
        setCategories(parsed);
      }
    };
    loadCategories();
    return () => unsubscribe();
  }, []);

  const checkReports = async () => {
    if (!isAdmin) return;
    try {
      const q = query(collection(db, "reports"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      setReportCount(snap.size);
    } catch (e) { console.log(e); }
  };

  useFocusEffect(
    useCallback(() => {
      loadPosts();
      checkReports();
      loadBookmarks(); 
    }, [selectedCategory, isMaster])
  );

  const loadPosts = async () => {
    setLoading(true);
    try {
      // 1. 게시글 가져오기
      let q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      
      // '전체', '북마크', '인기글'이 아닐 때만 카테고리 쿼리 적용
      if (selectedCategory !== '전체' && selectedCategory !== '북마크' && selectedCategory !== '인기글') {
        q = query(q, where("category", "==", selectedCategory));
      }
      
      const querySnapshot = await getDocs(q);
      const allPosts = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        views: doc.data().views || 0,
        commentCount: doc.data().commentCount || 0,
        likeCount: doc.data().likeCount || 0,
      } as Post));

      // 2. 신고 내역 가져와서 개수 계산
      const reportsSnapshot = await getDocs(collection(db, "reports"));
      const reportMap: { [key: string]: number } = {};
      reportsSnapshot.docs.forEach(d => {
        const pId = d.data().postId;
        if (pId) reportMap[pId] = (reportMap[pId] || 0) + 1;
      });

      // 3. 신고수 주입 및 필터링
      const processed = allPosts.map(p => ({
        ...p,
        reportCount: reportMap[p.id] || 0
      })).filter(p => {
        // --- 인기글 필터링 기준 설정 ---
        if (selectedCategory === '인기글') {
          const HOT_LIKE_STANDARD = 3;    // 인기글 좋아요 기준
          const HOT_VIEW_STANDARD = 50;   // 인기글 조회수 기준
          const HOT_COMMENT_STANDARD = 5; // 인기글 댓글수 기준

          const isHot = (p.likeCount || 0) >= HOT_LIKE_STANDARD || 
                        (p.views || 0) >= HOT_VIEW_STANDARD || 
                        (p.commentCount || 0) >= HOT_COMMENT_STANDARD;
          
          if (!isHot) return false;
        }
        // ----------------------------

        if (selectedCategory === '북마크' && !bookmarks.includes(p.id)) return false;
        
        // 신고 5개 이상일 때 필터링
        const isHidden = p.reportCount >= 5; 
        if (isHidden) {
          return isMaster === true; 
        }
        return true;
      });

      setPosts(processed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = async (e: any, postId: string) => {
    e.stopPropagation();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("알림", "로그인 후 이용 가능합니다.");
      return;
    }
    const bookmarkDocId = `${currentUser.uid}_${postId}`;
    const bookmarkRef = doc(db, "bookmarks", bookmarkDocId);
    try {
      if (bookmarks.includes(postId)) {
        await deleteDoc(bookmarkRef);
        setBookmarks(prev => prev.filter(id => id !== postId));
        if (selectedCategory === '북마크') {
          setPosts(prev => prev.filter(p => p.id !== postId));
        }
      } else {
        await setDoc(bookmarkRef, {
          uid: currentUser.uid,
          postId: postId,
          createdAt: serverTimestamp()
        });
        setBookmarks(prev => [...prev, postId]);
      }
    } catch (e) { console.error("북마크 업데이트 실패:", e); }
  };

  const handleWritePress = () => {
    if (!user && !auth.currentUser) {
      Alert.alert("인증 필요", "로그인 정보가 유효하지 않습니다. 다시 로그인해주세요.", [
        { text: "취소", style: "cancel" },
        { text: "로그인", onPress: () => router.push('/admin/login') }
      ]);
      return;
    }
    router.push('/community/write');
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) return;
    Alert.alert("게시글 삭제", "정말로 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "posts", id));
          loadPosts();
      }}
    ]);
  };

  const handleDeleteCategory = async (catName: string) => {
    if (['전체', '인기글', '북마크', '자유', '1학년', '2학년', '3학년'].includes(catName)) {
      return Alert.alert("알림", "기본 카테고리는 삭제할 수 없습니다.");
    }
    Alert.alert("카테고리 삭제", `'${catName}' 카테고리와 게시물을 삭제할까요?`, [
      { text: "취소" },
      { text: "삭제", style: "destructive", onPress: async () => {
        setLoading(true);
        try {
          const q = query(collection(db, "posts"), where("category", "==", catName));
          const querySnapshot = await getDocs(q);
          const batch = writeBatch(db);
          querySnapshot.forEach(d => batch.delete(d.ref));
          await batch.commit();
          const updatedCats = categories.filter(c => c !== catName);
          setCategories(updatedCats);
          await AsyncStorage.setItem('community_categories', JSON.stringify(updatedCats));
          setSelectedCategory('전체');
          setIsDrawerOpen(false);
          loadPosts();
        } catch (e) { console.error(e); } finally { setLoading(false); }
      }}
    ]);
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderPost = ({ item }: { item: Post }) => {
    const displayAuthor = item.isAnonymous 
      ? (isMaster ? `익명(${item.authorName})` : "익명") 
      : item.authorName;
    const isBookmarked = bookmarks.includes(item.id);
    const isHiddenPost = item.reportCount >= 5; 

    return (
      <TouchableOpacity 
        style={[
          styles.postCard, 
          { backgroundColor: theme.card, borderColor: theme.border },
          isHiddenPost && { opacity: 0.5, borderStyle: 'dashed', borderColor: theme.red } 
        ]}
        onPress={() => router.push(`/community/${item.id}`)}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.postHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.categoryLabel, { color: theme.accent }]}>{item.category}</Text>
            <Text style={[styles.authorText, { color: theme.subText }]}>{displayAuthor}</Text>
            {isHiddenPost && isMaster && (
              <View style={{ backgroundColor: theme.red, paddingHorizontal: 6, borderRadius: 4 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>신고 누적 숨김됨</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={(e) => toggleBookmark(e, item.id)} style={{ padding: 4 }}>
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={isBookmarked ? theme.yellow : theme.subText} 
            />
          </TouchableOpacity>
        </View>
        <Text style={[styles.postTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.postSummary, { color: theme.subText }]} numberOfLines={1}>{item.content}</Text>
        
        <View style={styles.postFooter}>
           <View style={styles.statRow}>
             <View style={styles.statItem}>
               <Ionicons name="eye-outline" size={14} color={theme.subText} />
               <Text style={[styles.statText, { color: theme.subText }]}>{item.views}</Text>
             </View>
             <View style={styles.statItem}>
               <Ionicons name="chatbubble-outline" size={13} color={theme.subText} />
               <Text style={[styles.statText, { color: theme.subText }]}>{item.commentCount}</Text>
             </View>
             <View style={styles.statItem}>
               <Ionicons name="heart-outline" size={13} color={theme.accent} />
               <Text style={[styles.statText, { color: theme.accent }]}>{item.likeCount}</Text>
             </View>
           </View>
           <Text style={[styles.dateText, { color: theme.subText }]}>
             {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ''}
           </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setIsDrawerOpen(true)} style={styles.menuBtn}>
            <Text style={[styles.menuIcon, { color: theme.text }]}>☰</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity 
              style={styles.reportBtn} 
              onPress={() => router.push('/community/reports')}
            >
              <Ionicons name="alert-circle" size={20} color={reportCount > 0 ? theme.red : theme.subText} />
              {reportCount > 0 && <View style={styles.reportBadge} />}
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{selectedCategory}</Text>
        <TouchableOpacity style={styles.writeBtn} onPress={handleWritePress}>
          <Text style={styles.writeBtnText}>글쓰기</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isDrawerOpen} transparent animationType="fade" onRequestClose={() => setIsDrawerOpen(false)}>
        <View style={styles.drawerOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsDrawerOpen(false)}><View style={styles.drawerCloseArea} /></TouchableWithoutFeedback>
          <View style={[styles.drawerContent, { backgroundColor: theme.header }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <Text style={[styles.drawerTitle, { color: theme.text }]}>카테고리</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {categories.map((cat) => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.categoryItem, selectedCategory === cat && { backgroundColor: theme.accent }]}
                    onPress={() => { setSelectedCategory(cat); setIsDrawerOpen(false); }}
                    onLongPress={() => isAdmin && handleDeleteCategory(cat)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {cat === '북마크' && <Ionicons name="bookmark" size={16} color={selectedCategory === cat ? '#fff' : theme.yellow} />}
                      {cat === '인기글' && <Ionicons name="flame" size={16} color={selectedCategory === cat ? '#fff' : theme.red} />}
                      <Text style={[styles.categoryText, { color: selectedCategory === cat ? '#fff' : theme.text }]}>{cat}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {(user || auth.currentUser) && (
                  <TouchableOpacity style={styles.addCatBtn} onPress={() => {
                    Alert.prompt("새 카테고리", "추가할 카테고리 이름을 입력하세요.", async (name) => {
                      if (name?.trim()) {
                        const trimmedName = name.trim();
                        if (!categories.includes(trimmedName)) {
                          const newCats = [...categories, trimmedName];
                          setCategories(newCats);
                          await AsyncStorage.setItem('community_categories', JSON.stringify(newCats));
                        }
                      }
                    });
                  }}>
                    <Text style={styles.addCatBtnText}>+ 카테고리 추가</Text>
                  </TouchableOpacity>
                )}

                {/* 마스터 계정 전용: 제재 유저 관리 버튼 */}
                {isMaster && (
                  <TouchableOpacity 
                    style={[styles.addCatBtn, { marginTop: 10, borderColor: theme.red }]} 
                    onPress={() => {
                      setIsDrawerOpen(false);
                      router.push('/admin/penalized-users');
                    }}
                  >
                    <Text style={[styles.addCatBtnText, { color: theme.red }]}>🚫 제재 유저 관리</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      <View style={styles.searchBarContainer}>
        <TextInput 
          style={[styles.searchBar, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
          placeholder="게시글 검색..."
          placeholderTextColor={theme.subText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList 
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          renderItem={renderPost}
          ListEmptyComponent={<Text style={styles.emptyText}>{selectedCategory === '북마크' ? "북마크한 게시글이 없습니다." : "게시글이 없습니다."}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  menuBtn: { padding: 5 },
  menuIcon: { fontSize: 24 },
  reportBtn: { marginLeft: 15, padding: 5, position: 'relative' },
  reportBadge: { position: 'absolute', top: 5, right: 5, width: 8, height: 8, backgroundColor: '#FF4D4D', borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
  writeBtn: { backgroundColor: '#82A977', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  writeBtnText: { color: '#fff', fontWeight: '700' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerCloseArea: { flex: 1 },
  drawerContent: { width: SCREEN_WIDTH * 0.75, height: '100%', padding: 25, borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  drawerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 20, marginTop: Platform.OS === 'ios' ? 10 : 30 },
  categoryItem: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 10, marginBottom: 8 },
  categoryText: { fontSize: 16, fontWeight: '600' },
  addCatBtn: { marginTop: 20, padding: 15, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#82A977', borderRadius: 10 },
  addCatBtnText: { color: '#82A977', fontWeight: '700' },
  searchBarContainer: { padding: 15 },
  searchBar: { borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1 },
  listPadding: { paddingHorizontal: 20, paddingBottom: 30 },
  postCard: { padding: 20, borderRadius: 15, marginBottom: 12, borderWidth: 1 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryLabel: { fontSize: 12, fontWeight: '700' },
  authorText: { fontSize: 12 },
  postTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  postSummary: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#eee', paddingTop: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 11 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});
