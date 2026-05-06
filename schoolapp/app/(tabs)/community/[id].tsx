import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, 
  useColorScheme, SafeAreaView 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from "../../../firebaseConfig"; 
import { 
  doc, getDoc, collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp, deleteDoc, updateDoc, increment,
  setDoc, where, getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; 
import { useAdmin } from "../../_layout";
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface Comment {
  id: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  authorUid: string;
  createdAt: any;
  reportCount?: number; // 신고 횟수 추가
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { isAdmin, isMaster, user } = useAdmin();

  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isAnonComment, setIsAnonComment] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false); 
  const [currentUser, setCurrentUser] = useState<any>(null);

  const badWords = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '존나', 'ㅈㄴ', '병신', 'ㅂㅅ', '좆', '개새끼', '새끼', 'ㄱㅅㄲ', 'ㅅㄲ'];

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
    red: '#FF4D4D',
    yellow: '#FFD700' 
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        checkLikeStatus(firebaseUser.uid);
        checkBookmarkStatus(firebaseUser.uid); 
      } else {
        setCurrentUser(null);
        setIsLiked(false);
        setIsBookmarked(false);
      }
    });

    if (!id) return;

    const postRef = doc(db, "posts", String(id));
    
    const unsubscribePost = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    const q = query(
      collection(db, "posts", String(id), "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(data);
    });

    updateDoc(postRef, { views: increment(1) }).catch(() => {});

    return () => {
      unsubscribeAuth();
      unsubscribePost();
      unsubscribeComments();
    };
  }, [id]);

  const checkLikeStatus = async (uid: string) => {
    if (!uid || !id) return;
    try {
      const likeDoc = await getDoc(doc(db, "posts", String(id), "likes", String(uid)));
      setIsLiked(likeDoc.exists());
    } catch (e) { console.log("Like check error"); }
  };

  const checkBookmarkStatus = async (uid: string) => {
    if (!uid || !id) return;
    try {
      const bookmarkDocId = `${uid}_${id}`;
      const bookmarkDoc = await getDoc(doc(db, "bookmarks", bookmarkDocId));
      setIsBookmarked(bookmarkDoc.exists());
    } catch (e) { console.log("Bookmark check error"); }
  };

  const createNotification = async (type: 'like' | 'comment', targetUid: string, pushContent: string) => {
    const myUid = auth.currentUser?.uid || user?.uid;
    const myName = isAnonComment ? "익명" : (user?.name || "사용자");
    
    if (!targetUid || targetUid === myUid) return;

    try {
      const targetUserDoc = await getDoc(doc(db, "users", targetUid));
      if (targetUserDoc.exists()) {
        const targetData = targetUserDoc.data();
        if (type === 'like' && targetData.settings?.likeNoti === false) return;
        if (type === 'comment' && targetData.settings?.commentNoti === false) return;

        await addDoc(collection(db, "notifications"), {
          targetUid, 
          type,
          postId: id,
          postTitle: post?.title || "게시글",
          senderName: myName,
          content: pushContent,
          isRead: false,
          createdAt: serverTimestamp(),
        });

        if (targetData.pushToken) {
          try {
            await axios.post('https://exp.host/--/api/v2/push/send', {
              to: targetData.pushToken,
              sound: 'default',
              title: type === 'like' ? "❤️ 새로운 좋아요" : "💬 새로운 댓글",
              body: type === 'like' ? `${myName}님이 게시글을 좋아합니다.` : `${myName}님: ${pushContent}`,
              data: { screen: 'community_detail', postId: id },
            });
          } catch (err) { console.error("푸시 전송 실패:", err); }
        }
      }
    } catch (e) { console.log("알림 생성 실패:", e); }
  };

  const handleToggleLike = async () => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");
    const postRef = doc(db, "posts", String(id));
    const likeRef = doc(db, "posts", String(id), "likes", String(activeUid));

    try {
      if (isLiked) {
        setIsLiked(false);
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likeCount: increment(-1) });
      } else {
        setIsLiked(true);
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likeCount: increment(1) });
        createNotification('like', post.authorUid, "회원님의 게시글을 좋아합니다.");
      }
    } catch (e) { setIsLiked(!isLiked); }
  };

  const handleToggleBookmark = async () => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");
    const bookmarkDocId = `${activeUid}_${id}`;
    const bookmarkRef = doc(db, "bookmarks", bookmarkDocId);

    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, { uid: activeUid, postId: id, createdAt: serverTimestamp() });
        setIsBookmarked(true);
      }
    } catch (e) { console.error("북마크 실패:", e); }
  };

  // 게시글 신고
  const handleReport = () => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    const reporterRealName = user?.name || "사용자";
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");

    Alert.prompt("게시글 신고", "신고 사유를 입력해주세요.", async (reason) => {
      if (!reason?.trim()) return;
      try {
        const reportId = `${activeUid}_${id}`;
        const reportRef = doc(db, "reports", reportId);
        if ((await getDoc(reportRef)).exists()) return Alert.alert("알림", "이미 신고한 게시글입니다.");

        await setDoc(reportRef, {
          postId: id, postTitle: post?.title, reporterName: reporterRealName, reporterUid: activeUid,
          reason: reason.trim(), status: 'pending', createdAt: serverTimestamp(), isNotified: false 
        });
        await updateDoc(doc(db, "posts", String(id)), { reportCount: increment(1) });
        Alert.alert("신고 접수", "정상적으로 접수되었습니다.");
      } catch (e) { Alert.alert("오류", "신고 실패"); }
    });
  };

  // ✅ 댓글 신고 기능 추가
  const handleCommentReport = (comment: Comment) => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");

    Alert.prompt("댓글 신고", "신고 사유를 입력해주세요.", async (reason) => {
      if (!reason?.trim()) return;
      try {
        const reportId = `${activeUid}_${comment.id}`;
        const reportRef = doc(db, "comment_reports", reportId);
        
        if ((await getDoc(reportRef)).exists()) return Alert.alert("알림", "이미 신고한 댓글입니다.");

        await setDoc(reportRef, {
          postId: id, commentId: comment.id, content: comment.content,
          reporterUid: activeUid, reason: reason.trim(), createdAt: serverTimestamp()
        });

        // 댓글 신고수 증가
        const commentRef = doc(db, "posts", String(id), "comments", comment.id);
        await updateDoc(commentRef, { reportCount: increment(1) });

        Alert.alert("신고 접수", "댓글 신고가 접수되었습니다.");
      } catch (e) { Alert.alert("오류", "신고 처리 실패"); }
    });
  };

  const handleAddComment = async () => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");
    if (!commentInput.trim()) return;

    // ✅ [추가] 5회 이상 신고 계정 차단 로직
    try {
      const penaltyRef = doc(db, "penalized_users", activeUid);
      const penaltySnap = await getDoc(penaltyRef);
      if (penaltySnap.exists() && penaltySnap.data().count >= 5) {
        Alert.alert("작성 제한", "누적된 신고 횟수가 5회 이상으로, 더 이상 댓글을 작성할 수 없습니다.");
        return;
      }
    } catch (e) { console.log("Penalty check error"); }

    const foundBadWord = badWords.find(word => commentInput.includes(word));
    if (foundBadWord) return Alert.alert("등록 불가", `부적절한 단어(${foundBadWord})가 포함되어 있습니다.`);

    try {
      const postRef = doc(db, "posts", String(id));
      await addDoc(collection(db, "posts", String(id), "comments"), {
        content: commentInput.trim(),
        authorName: user?.name || "이름없음",
        authorUid: activeUid,
        isAnonymous: isAnonComment,
        createdAt: serverTimestamp(),
        reportCount: 0 // 초기 신고수 0
      });
      await updateDoc(postRef, { commentCount: increment(1) });
      createNotification('comment', post.authorUid, commentInput.trim());
      setCommentInput('');
    } catch (e) { Alert.alert("오류", "댓글 등록 실패"); }
  };

  const handleDeleteComment = (commentId: string) => {
    if (!isAdmin) return; 
    Alert.alert("삭제", "댓글을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "posts", String(id), "comments", commentId));
          await updateDoc(doc(db, "posts", String(id)), { commentCount: increment(-1) });
      }}
    ]);
  };

  const renderHeader = () => {
    if (!post) return null;
    return (
      <View style={styles.postSection}>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: theme.accent, fontWeight: '700' }}>← 뒤로가기</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <TouchableOpacity onPress={handleToggleBookmark}><Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={isBookmarked ? theme.yellow : theme.subText} /></TouchableOpacity>
            <TouchableOpacity onPress={handleReport}><Text style={{ color: theme.red, fontSize: 12 }}>신고하기</Text></TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.category, { color: theme.accent }]}>{post.category || "일반"}</Text>
        <Text style={[styles.title, { color: theme.text }]}>{post.title || "제목 없음"}</Text>
        <View style={styles.authorRow}>
          <Text style={[styles.author, { color: theme.subText }]}>{post.isAnonymous ? (isMaster ? `익명(${post.authorName})` : "익명") : (post.authorName || "사용자")}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={[styles.date, { color: theme.subText }]}>{(post.views || 0)} 조회</Text>
        </View>
        <Text style={[styles.content, { color: theme.text }]}>{post.content || "내용이 없습니다."}</Text>
        <TouchableOpacity style={[styles.likeBtn, isLiked && { borderColor: theme.accent, backgroundColor: theme.accent + '10' }]} onPress={handleToggleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? theme.accent : theme.subText} />
          <Text style={[styles.likeText, { color: isLiked ? theme.accent : theme.subText }]}>좋아요 {post.likeCount || 0}</Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.commentCount, { color: theme.text }]}>댓글 {comments.length}</Text>
      </View>
    );
  };

  if (loading) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator color={theme.accent} /></View>;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            const isPostAuthor = item.authorUid === post?.authorUid;
            const isReported = (item.reportCount || 0) >= 5; // ✅ 5회 이상 신고 시 가리기 조건

            return (
              <View style={[styles.commentItem, { borderBottomColor: theme.border }]}>
                <View style={styles.commentHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.commentAuthor, { color: isReported ? theme.subText : theme.text }]}>
                      {item.isAnonymous ? (isMaster ? `익명(${item.authorName})` : "익명") : item.authorName}
                    </Text>
                    {isPostAuthor && <View style={styles.authorBadge}><Text style={styles.authorBadgeText}>글쓴이</Text></View>}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {!isReported && <TouchableOpacity onPress={() => handleCommentReport(item)}><Text style={{ color: theme.subText, fontSize: 11 }}>신고</Text></TouchableOpacity>}
                    {isAdmin && <TouchableOpacity onPress={() => handleDeleteComment(item.id)}><Text style={{ color: theme.red, fontSize: 11 }}>삭제</Text></TouchableOpacity>}
                  </View>
                </View>
                {/* ✅ 가려진 댓글 처리 */}
                <Text style={[styles.commentContent, { color: isReported ? theme.subText : theme.text, fontStyle: isReported ? 'italic' : 'normal' }]}>
                  {isReported ? "⚠️ 여러 사용자의 신고에 의해 가려진 댓글입니다." : item.content}
                </Text>
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.inputContainer}>
            <View style={styles.inputOptions}>
              <Text style={{ color: theme.subText, fontSize: 10 }}>익명</Text>
              <Switch value={isAnonComment} onValueChange={setIsAnonComment} trackColor={{ false: "#767577", true: theme.accent }} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
            </View>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="댓글을 입력하세요..." placeholderTextColor={theme.subText} value={commentInput} onChangeText={setCommentInput} multiline />
            <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment}><Text style={styles.sendBtnText}>등록</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 0 },
  postSection: { paddingHorizontal: 20, paddingBottom: 20 },
  category: { fontSize: 13, fontWeight: '700', marginBottom: 5, marginTop: 10 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  author: { fontSize: 13, fontWeight: '600' },
  dot: { marginHorizontal: 8, color: '#CCC' },
  date: { fontSize: 12 },
  content: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#eee', gap: 6, marginBottom: 10 },
  likeText: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 20 },
  commentCount: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  commentItem: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 0.5 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  authorBadge: { backgroundColor: '#82A97715', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: '#82A977' },
  authorBadgeText: { color: '#82A977', fontSize: 10, fontWeight: '800' },
  commentContent: { fontSize: 14, lineHeight: 20 },
  inputWrapper: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 10, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  inputOptions: { alignItems: 'center', marginRight: 5 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 80, fontSize: 14 },
  sendBtn: { marginLeft: 10, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#82A977', borderRadius: 20 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
