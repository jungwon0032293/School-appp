import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  Alert, ActivityIndicator, SafeAreaView, useColorScheme 
} from 'react-native';
import { db } from "../../../../firebaseConfig";
import { 
  collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, 
  increment, getDoc, setDoc, serverTimestamp 
} from "firebase/firestore";
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Report {
  id: string;
  postId: string;
  commentId?: string; 
  postTitle?: string;
  content?: string;   
  reason: string;
  reporterName?: string;
  reporterUid: string;
  status: 'pending' | 'resolved';
  createdAt: any;
  type: 'post' | 'comment'; 
}

export default function ReportListScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
    red: '#FF4D4D'
  };

  useEffect(() => {
    const qPost = query(collection(db, "reports"), orderBy("createdAt", "desc"));
    const unsubscribePost = onSnapshot(qPost, (snapshot) => {
      const postReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'post' } as Report));
      updateCombinedReports(postReports, 'post');
    });

    const qComment = query(collection(db, "comment_reports"), orderBy("createdAt", "desc"));
    const unsubscribeComment = onSnapshot(qComment, (snapshot) => {
      const commentReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'comment' } as Report));
      updateCombinedReports(commentReports, 'comment');
    });

    return () => { unsubscribePost(); unsubscribeComment(); };
  }, []);

  const [allReports, setAllReports] = useState<{post: Report[], comment: Report[]}>({post: [], comment: []});
  
  const updateCombinedReports = (data: Report[], type: 'post' | 'comment') => {
    setAllReports(prev => {
      const newState = { ...prev, [type]: data };
      const combined = [...newState.post, ...newState.comment].sort((a, b) => 
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setReports(combined);
      setLoading(false);
      return newState;
    });
  };

  const recordUserPenalty = async (uid: string, name: string, studentId: string) => {
    if (!uid || uid === "unknown_uid") {
      console.error("유효하지 않은 UID입니다. 기록을 취소합니다.");
      return;
    }

    const userRef = doc(db, "penalized_users", uid);
    try {
      const snap = await getDoc(userRef);
      
      if (snap.exists()) {
        await updateDoc(userRef, { 
          count: increment(1),
          name: name || snap.data().name,
          studentId: studentId !== "학번 정보 없음" ? studentId : snap.data().studentId,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(userRef, {
          uid: uid,
          name: name || "이름 없음",
          studentId: studentId || "학번 정보 없음",
          count: 1,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Penalty recording error:", e);
    }
  };

  const handleResolveReport = async (report: Report) => {
    const isPost = report.type === 'post';
    
    Alert.alert(
      "신고 처리", 
      isPost ? "이 게시글을 삭제하고 벌점을 부여하시겠습니까?" : "이 댓글을 삭제하고 벌점을 부여하시겠습니까?", 
      [
        { text: "취소", style: "cancel" },
        { 
          text: "삭제 및 벌점부여", 
          style: "destructive",
          onPress: async () => {
            try {
              const targetPath = isPost 
                ? doc(db, "posts", report.postId) 
                : doc(db, "posts", report.postId, "comments", report.commentId!);
              
              const targetSnap = await getDoc(targetPath);
              
              if (targetSnap.exists()) {
                const data = targetSnap.data();
                
                const authorUid = data.authorUid || data.uid || data.userId || "unknown_uid";
                const authorName = data.authorName || data.name || "이름 없음";
                
                const studentId = data.StudentId || data.studentId || data.authorStudentId || "학번 정보 없음";
                
                await recordUserPenalty(authorUid, authorName, studentId);

                if (isPost) {
                  await deleteDoc(doc(db, "posts", report.postId));
                  await updateDoc(doc(db, "reports", report.id), { status: 'resolved' });
                } else {
                  await deleteDoc(doc(db, "posts", report.postId, "comments", report.commentId!));
                  await deleteDoc(doc(db, "comment_reports", report.id));
                }
                Alert.alert("완료", "삭제 및 벌점이 기록되었습니다.");
              } else {
                Alert.alert("알림", "정보를 불러올 수 없습니다. 이미 삭제된 글일 수 있습니다.");
              }
            } catch (e) { 
              console.error(e);
              Alert.alert("오류", "처리 중 문제가 발생했습니다."); 
            }
          }
        },
        { 
          text: "신고 반려", 
          onPress: async () => {
            try {
              const col = isPost ? "reports" : "comment_reports";
              await deleteDoc(doc(db, col, report.id));
              Alert.alert("완료", "신고가 반려되었습니다.");
            } catch (e) { Alert.alert("오류", "반려 처리 실패"); }
          }
        }
      ]
    );
  };

  const deleteReportRecord = async (report: Report) => {
    Alert.alert("기록 삭제", "이 신고 기록만 목록에서 지우시겠습니까?", [
      { text: "취소" },
      { text: "삭제", style: "destructive", onPress: async () => {
          const col = report.type === 'post' ? "reports" : "comment_reports";
          await deleteDoc(doc(db, col, report.id));
      }}
    ]);
  };

  const renderReport = ({ item }: { item: Report }) => (
    <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: item.type === 'post' ? theme.accent : '#5D8BF4' }]}>
            <Text style={styles.typeText}>{item.type === 'post' ? '게시글' : '댓글'}</Text>
          </View>
          <Text style={[styles.status, { color: item.status === 'pending' || !item.status ? theme.red : theme.subText }]}>
            {item.status === 'resolved' ? '○ 처리완료' : '● 처리대기'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => deleteReportRecord(item)}>
          <Ionicons name="trash-outline" size={18} color={theme.subText} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={1}>
        대상: {item.type === 'post' ? item.postTitle : item.content}
      </Text>
      <Text style={[styles.reason, { color: theme.text }]}>사유: {item.reason}</Text>
      
      <View style={styles.infoRow}>
        <Text style={[styles.infoText, { color: theme.subText }]}>신고자: {item.reporterName || '익명'}</Text>
        <Text style={[styles.infoText, { color: theme.subText }]}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : ''}
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: theme.accent }]}
          onPress={() => router.push(`/community/${item.postId}`)}
        >
          <Text style={styles.btnText}>원본 보기</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: theme.subText }]}
          onPress={() => handleResolveReport(item)}
        >
          <Text style={styles.btnText}>처리 하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.accent} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.titleBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>신고 관리</Text>
        <TouchableOpacity onPress={() => router.push('/admin/penalized-users')}>
          <Ionicons name="people-circle" size={28} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderReport}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.emptyText}>신고 내역이 없습니다.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  title: { fontSize: 20, fontWeight: '800' },
  reportCard: { padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '700' },
  postTitle: { fontSize: 15, fontWeight: '700', marginBottom: 5 },
  reason: { fontSize: 14, marginBottom: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoText: { fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#999' }
});
