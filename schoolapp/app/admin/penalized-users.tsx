import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, SafeAreaView, 
  TouchableOpacity, useColorScheme, ActivityIndicator 
} from 'react-native';
import { db } from "../../firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface PenalizedUser {
  id: string;
  name: string;
  studentId?: string;    // 소문자 대응
  StudentId?: string;    // 대문자 대응
  authorStudentId?: string; // 게시글 저장 필드 대응
  count: number;
}

export default function PenalizedUserListScreen() {
  const [users, setUsers] = useState<PenalizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    // 횟수가 많은 순서대로 정렬하여 실시간 감시
    const q = query(collection(db, "penalized_users"), orderBy("count", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PenalizedUser));
      
      console.log("불러온 유저 수:", userData.length);
      setUsers(userData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderUser = ({ item }: { item: PenalizedUser }) => {
    const isWarning = item.count >= 5;
    
    // ✅ 어떤 필드명으로 저장되어 있든 학번을 가져오도록 처리
    const displayStudentId = item.studentId || item.StudentId || item.authorStudentId || "학번 정보 없음";

    return (
      <View style={[
        styles.userCard, 
        { 
          backgroundColor: isDark ? '#1C1C1E' : '#FFF', 
          borderColor: isWarning ? '#FF4D4D' : (isDark ? '#2C2C2E' : '#E9ECEF')
        }
      ]}>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: isDark ? '#FFF' : '#111' }]}>
            {item.name || "이름 없음"} {isWarning && <Ionicons name="alert-circle" size={16} color="#FF4D4D" />}
          </Text>
          <Text style={styles.studentId}>{displayStudentId}</Text>
        </View>
        
        <View style={[
          styles.countBadge, 
          { backgroundColor: isWarning ? '#FF4D4D' : (isDark ? '#333' : '#F1F3F5') }
        ]}>
          <Text style={[styles.countText, { color: isWarning ? '#FFF' : (isDark ? '#BBB' : '#4E5968') }]}>
            {item.count}회 삭제됨
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111' : '#F8F9FA', justifyContent: 'center' }]}>
        <ActivityIndicator color="#82A977" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#111' : '#F8F9FA' }]}>
      <View style={[styles.header, { borderBottomColor: isDark ? '#333' : '#EEE' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFF' : '#111'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#FFF' : '#111' }]}>누적 신고 계정</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={60} color={isDark ? '#333' : '#E9ECEF'} />
            <Text style={styles.emptyText}>벌점이 누적된 사용자가 없습니다.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 10, paddingVertical: 15, borderBottomWidth: 1
  },
  backBtn: { padding: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  userCard: { 
    flexDirection: 'row', alignItems: 'center', padding: 18, 
    borderRadius: 16, marginBottom: 12, borderWidth: 1.5,
    justifyContent: 'space-between',
    // 그림자 효과 (선택사항)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  studentId: { fontSize: 14, color: '#888', fontWeight: '500' },
  countBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  countText: { fontSize: 13, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 120 },
  emptyText: { textAlign: 'center', marginTop: 15, color: '#999', fontSize: 15 }
});
