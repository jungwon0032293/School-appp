import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, 
  Alert, ActivityIndicator, Modal, useColorScheme 
} from 'react-native';
import { db } from "../../firebaseConfig";
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  deleteDoc, addDoc, serverTimestamp 
} from "firebase/firestore";
import { useAdmin } from "../_layout";
import { useRouter } from 'expo-router'; 

export default function ManageUsers() {
  const router = useRouter(); 
  const { isAdmin } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const theme = {
    bg: isDark ? '#111' : '#F2F4F6',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFF' : '#1A1F27',
    subText: isDark ? '#A0A0A0' : '#4E5968',
    accent: '#82A977' 
  };

  const sendPushNotification = async (expoPushToken: string, userName: string) => {
    if (!expoPushToken) return;
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: '🎉 가입 승인 완료',
      body: `${userName}님, 학생 인증이 완료되었습니다!`,
    };
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (e) { console.error(e); }
  };

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("isApproved", "==", false));
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPendingUsers(users);
    } catch (e) {
      Alert.alert("에러", "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchPendingUsers();
  }, [isAdmin]);

  const handleApprove = async (userToApprove: any) => {
    Alert.alert("승인", `${userToApprove.name} 학생을 승인하시겠습니까?`, [
      { text: "취소" },
      { text: "승인", onPress: async () => {
        try {
          const userRef = doc(db, "users", userToApprove.id);
          await updateDoc(userRef, { 
            isApproved: true,
            role: userToApprove.role === "admin_pending" ? "admin" : "user"
          });

          await addDoc(collection(db, "notifications"), {
            targetUid: userToApprove.id,
            type: 'verify',
            postTitle: '회원가입 승인',
            senderName: '관리자',
            content: '회원가입 신청이 승인되었습니다. 이제 모든 서비스를 이용할 수 있습니다!',
            isRead: false,
            postId: 'home',
            createdAt: serverTimestamp(),
          });

          if (userToApprove.pushToken) await sendPushNotification(userToApprove.pushToken, userToApprove.name);
          
          Alert.alert("완료", "승인되었습니다.");
          fetchPendingUsers();
        } catch (e) {
          Alert.alert("오류", "처리에 실패했습니다.");
        }
      }}
    ]);
  };

  const handleReject = async (userId: string) => {
    Alert.alert("거절", "신청을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "거절", style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, "users", userId));
          fetchPendingUsers();
        } catch (e) {
          Alert.alert("오류", "삭제 실패");
        }
      }}
    ]);
  };

  if (!isAdmin) return <View style={styles.center}><Text>권한이 없습니다.</Text></View>;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 15 }}>← 뒤로가기</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>가입 승인 대기 목록</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color="#82A977" />
      ) : (
        <FlatList
          data={pendingUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.userCard, { backgroundColor: theme.card }]}>
              <TouchableOpacity onPress={() => item.idCardImage && setSelectedImage(item.idCardImage)}>
                {item.idCardImage ? (
                  <Image source={{ uri: item.idCardImage }} style={styles.idCardPreview} resizeMode="cover" />
                ) : (
                  <View style={[styles.idCardPreview, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#eee' }]}>
                    <Text style={{ color: '#999' }}>이미지가 없습니다.</Text>
                  </View>
                )}
                <Text style={styles.zoomHint}>🔍 클릭해서 크게 보기</Text>
              </TouchableOpacity>
              
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: theme.text }]}>{item.name} ({item.studentId})</Text>
                <Text style={[styles.userRole, { color: item.role.includes('admin') ? '#FF9500' : '#3182F6' }]}>
                  신청 유형: {item.role.includes('admin') ? '학생회' : '일반학생'}
                </Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => handleApprove(item)}>
                  <Text style={styles.btnText}>승인</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => handleReject(item.id)}>
                  <Text style={styles.btnText}>거절</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>대기 중인 신청이 없습니다.</Text>}
        />
      )}

      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedImage(null)}>
            <Text style={styles.modalCloseText}>✕ 닫기</Text>
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  topNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingVertical: 5 }, 
  header: { justifyContent: 'center', marginBottom: 20, paddingVertical: 4 }, // 레이아웃 정돈
  title: { fontSize: 20, fontWeight: '800' },
  userCard: { borderRadius: 20, padding: 15, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  idCardPreview: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#f9f9f9', overflow: 'hidden' },
  zoomHint: { textAlign: 'center', fontSize: 12, color: '#888', marginTop: 8 },
  userInfo: { marginVertical: 12 },
  userName: { fontSize: 17, fontWeight: '700' },
  userRole: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: '#82A977' },
  rejectBtn: { backgroundColor: '#FF6B6B' },
  btnText: { color: '#FFF', fontWeight: '700' },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#888' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '95%', height: '85%' },
  modalClose: { position: 'absolute', top: 50, right: 20, padding: 10, zIndex: 10 },
  modalCloseText: { color: '#FFF', fontSize: 18, fontWeight: '700' }
});
