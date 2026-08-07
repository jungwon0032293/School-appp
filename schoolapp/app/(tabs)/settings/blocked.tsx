import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Alert, ActivityIndicator, useColorScheme, SafeAreaView 
} from 'react-native';
import { db, auth } from "../../../firebaseConfig"; 
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from "../../_layout"; 

interface BlockedUser {
  uid: string;
  context: string;
  blockedAt: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { user } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    background: isDark ? '#111111' : '#F2F4F6',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1F27',
    subText: isDark ? '#9CA3AF' : '#6B7684',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
    red: '#FF4D4D',
  };

  useEffect(() => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) {
      Alert.alert("알림", "로그인이 필요합니다.", [{ text: "확인", onPress: () => router.back() }]);
      return;
    }

    setLoading(true);
    const userRef = doc(db, "users", activeUid);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const rawBlocked = userData.blockedUsers || [];
        
        const formattedList: BlockedUser[] = rawBlocked.map((item: any, index: number) => {
          if (typeof item === 'object' && item !== null) {
            return {
              uid: item.uid || String(index),
              context: item.context || "차단된 사용자",
              blockedAt: item.blockedAt || "날짜 정보 없음"
            };
          }
          return {
            uid: String(item),
            context: "이전 버전에서 차단된 유저",
            blockedAt: "날짜 정보 없음"
          };
        });

        setBlockedList(formattedList);
      }
      setLoading(false);
    }, (error) => {
      console.error("차단 목록 로드 실패:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleUnblock = (targetUid: string) => {
    const activeUid = auth.currentUser?.uid || user?.uid;
    if (!activeUid) return;

    Alert.alert(
      "차단 해제",
      "이 사용자의 차단을 해제하시겠습니까?\n이제 이 사람이 작성한 글과 댓글이 다시 노출됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "해제",
          style: "destructive",
          onPress: async () => {
            try {
              const userRef = doc(db, "users", activeUid);
              
              const newBlockedList = blockedList.filter(item => item.uid !== targetUid);
              
              await updateDoc(userRef, {
                blockedUsers: newBlockedList
              });

              Alert.alert("알림", "차단이 해제되었습니다.");
            } catch (e) {
              Alert.alert("오류", "차단 해제 처리에 실패했습니다.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>차단 사용자 관리</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <FlatList
        data={blockedList}
        keyExtractor={(item) => item.uid}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={48} color={theme.subText} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: theme.subText }]}>차단한 사용자가 없습니다.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <View style={styles.infoSection}>
              <Text style={[styles.contextText, { color: theme.text }]} numberOfLines={1}>
                "{item.context}" 관련 작성자
              </Text>
              <Text style={[styles.dateText, { color: theme.subText }]}>
                차단일: {item.blockedAt}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.unblockBtn, { borderColor: theme.border }]} 
              onPress={() => handleUnblock(item.uid)}
            >
              <Text style={[styles.unblockBtnText, { color: theme.red }]}>해제</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    height: 56, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    borderBottomWidth: 1 
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  headerRightPlaceholder: { width: 32 },
  listContent: { paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
  },
  infoSection: { flex: 1, marginRight: 15 },
  contextText: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  dateText: { fontSize: 12 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  unblockBtnText: { fontSize: 13, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, fontWeight: '500', textAlign: 'center' }
});
