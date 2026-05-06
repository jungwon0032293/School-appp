import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, 
  ActivityIndicator, useColorScheme, Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from "../../../firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

interface Suggestion {
  id: string;
  title: string;
  content: string;
  status: string;
  isPrivate: boolean;
  answer?: string;
  createdAt: any;
}

export default function MySuggestionsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    headerBg: isDark ? '#1C1C1E' : '#FFFFFF',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#111111',
    textSecondary: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#F1F3F5',
    accent: '#82A977',
  };

  useFocusEffect(
    useCallback(() => {
      loadMyData();
    }, [])
  );

  const loadMyData = async () => {
    setLoading(true);
    try {
      const session = await AsyncStorage.getItem('userSession');
      if (!session) {
        setLoading(false);
        return;
      }
      const userData = JSON.parse(session);

      // ✅ 본인의 studentId와 일치하는 문서만 쿼리
      const q = query(
        collection(db, "suggestions"),
        where("studentId", "==", userData.studentId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Suggestion));
      
      setSuggestions(data);
    } catch (e) {
      console.error("데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Suggestion }) => (
    <View style={[styles.itemCard, { backgroundColor: theme.card }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusTag, { backgroundColor: item.status === '답변완료' ? theme.accent : (isDark ? '#2C2C2E' : '#E9ECEF') }]}>
          <Text style={[styles.statusText, { color: item.status === '답변완료' ? '#fff' : theme.textSecondary }]}>
            {item.status}
          </Text>
        </View>
        {item.isPrivate && <Text style={styles.privateLabel}>🔒 비공개</Text>}
      </View>

      <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.itemContent, { color: theme.textSecondary }]}>{item.content}</Text>

      {item.answer && (
        <View style={[styles.answerSection, { backgroundColor: isDark ? '#262629' : '#F1F3F5' }]}>
          <Text style={[styles.answerLabel, { color: theme.textPrimary }]}>학생회 답변</Text>
          <Text style={[styles.answerText, { color: theme.textSecondary }]}>{item.answer}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>나의 건의 기록</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.accent} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listPadding}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ color: theme.textSecondary }}>아직 작성한 건의사항이 없습니다.</Text>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingHorizontal: 20, paddingBottom: 15, 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1 
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 10 },
  backText: { fontSize: 24, fontWeight: '300' },
  listPadding: { padding: 20 },
  itemCard: { borderRadius: 20, padding: 20, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  privateLabel: { fontSize: 12, color: '#999' },
  itemTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  itemContent: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  answerSection: { marginTop: 10, padding: 15, borderRadius: 12 },
  answerLabel: { fontSize: 13, fontWeight: '700', marginBottom: 5 },
  answerText: { fontSize: 13, lineHeight: 18 },
  emptyContainer: { alignItems: 'center', marginTop: 100 }
});
