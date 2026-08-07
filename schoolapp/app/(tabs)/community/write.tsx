import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Switch, Alert, KeyboardAvoidingView, Platform, ScrollView, useColorScheme, SafeAreaView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from "../../../firebaseConfig";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore"; // 👈 updateDoc 추가

export default function CommunityWriteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isEditMode = !!params.postId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('자유');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const badWords = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '존나', 'ㅈㄴ', '병신', 'ㅂㅅ', '좆', '개새끼', '새끼', 'ㄱㅅㄲ', 'ㅅㄲ']; 

  const [categories, setCategories] = useState(['1학년', '2학년', '3학년', '자유']);

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    inputBg: isDark ? '#1C1C1E' : '#FFFFFF',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
  };

  useEffect(() => {
    checkUser();
    loadCategories();

    if (isEditMode) {
      if (params.editTitle) setTitle(String(params.editTitle));
      if (params.editContent) setContent(String(params.editContent));
      if (params.editCategory) setCategory(String(params.editCategory));
      if (params.editIsAnonymous) setIsAnonymous(params.editIsAnonymous === "true");
    }
  }, [params.postId]);

  const loadCategories = async () => {
    try {
      const savedCats = await AsyncStorage.getItem('community_categories');
      if (savedCats) {
        const parsedCats = JSON.parse(savedCats) as string[];
        const filtered = parsedCats.filter(c => c !== '전체');
        setCategories(filtered);
      }
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  };

  const checkUser = async () => {
    try {
      const session = await AsyncStorage.getItem('userSession');
      if (!session) {
        Alert.alert("인증 필요", "로그인한 사용자만 글을 쓸 수 있습니다.");
        router.back();
        return;
      }
      setUserData(JSON.parse(session));
    } catch (e) {
      console.error("Session check error:", e);
    }
  };

  const checkBadWords = (text: string) => {
    for (const word of badWords) {
      if (text.includes(word)) {
        return word;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("알림", "제목과 내용을 모두 입력해주세요.");
      return;
    }

    const combinedText = `${title} ${content}`;
    const foundBadWord = checkBadWords(combinedText);
    
    if (foundBadWord) {
      Alert.alert("등록 불가", "부적절한 단어(" + foundBadWord + ")가 포함되어 있습니다.");
      return;
    }

    const activeUid = auth.currentUser?.uid || userData?.uid || userData?.id;

    if (!activeUid) {
      Alert.alert("오류", "사용자 인증 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    setLoading(true);

    try {
      const penaltyRef = doc(db, "penalized_users", activeUid);
      const penaltySnap = await getDoc(penaltyRef);

      if (penaltySnap.exists()) {
        const penaltyData = penaltySnap.data();
        if (penaltyData.count >= 5) {
          Alert.alert(
            "작성 제한", 
            "누적된 신고 횟수가 5회 이상으로, 더 이상 글을 작성할 수 없습니다. 관리자에게 문의하세요."
          );
          setLoading(false);
          return; 
        }
      }

      if (isEditMode) {
        const postRef = doc(db, "posts", String(params.postId));
        await updateDoc(postRef, {
          title: title.trim(),
          content: content.trim(),
          category: category || "자유",
          isAnonymous: isAnonymous,
          updatedAt: serverTimestamp() 
        });
        Alert.alert("성공", "게시글이 수정되었습니다.");
      } else {
        await addDoc(collection(db, "posts"), {
          title: title.trim(),
          content: content.trim(),
          category: category || "자유",
          isAnonymous: isAnonymous,
          authorName: userData?.name || auth.currentUser?.displayName || "이름없음",          
          authorStudentId: userData?.studentId || "학번없음", 
          authorUid: String(activeUid).trim(),
          createdAt: serverTimestamp(),
          reportCount: 0 
        });
        Alert.alert("성공", "게시글이 등록되었습니다.");
      }

      router.back();
    } catch (e: any) {
      console.error("Firebase Submit Error:", e);
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>취소</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{isEditMode ? "글 수정하기" : "글쓰기"}</Text>
          <TouchableOpacity 
            onPress={handleSubmit} 
            disabled={loading}
            style={[styles.submitBtn, { opacity: loading ? 0.5 : 1 }]}
          >
            <Text style={styles.submitBtnText}>{isEditMode ? "수정" : "등록"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.container} 
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Text style={[styles.label, { color: theme.subText }]}>카테고리 선택</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat} 
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  category === cat && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
              >
                <Text style={[
                  styles.categoryChipText, 
                  { color: theme.text },
                  category === cat && { color: '#fff' }
                ]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TextInput 
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.border }]}
            placeholder="제목을 입력하세요"
            placeholderTextColor={theme.subText}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput 
            style={[styles.contentInput, { color: theme.text }]}
            placeholder="커뮤니티 가이드를 준수하여 내용을 입력해주세요."
            placeholderTextColor={theme.subText}
            multiline
            textAlignVertical="top"
            value={content}
            onChangeText={setContent}
          />

          <View style={[styles.optionRow, { borderTopColor: theme.border }]}>
            <View>
              <Text style={[styles.optionTitle, { color: theme.text }]}>익명으로 작성</Text>
              <Text style={styles.optionSub}>{isAnonymous ? "내 정보가 '익명'으로 표시됩니다." : "내 실명이 공개됩니다."}</Text>
            </View>
            <Switch 
              value={isAnonymous} 
              onValueChange={setIsAnonymous}
              trackColor={{ false: "#767577", true: theme.accent }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  header: { height: 50, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 5 },
  submitBtn: { backgroundColor: '#82A977', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 20 },
  categoryRow: { flexDirection: 'row', marginBottom: 20 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  categoryChipText: { fontSize: 14, fontWeight: '600' },
  titleInput: { fontSize: 20, fontWeight: '700', paddingVertical: 15, borderBottomWidth: 1, marginBottom: 15 },
  contentInput: { fontSize: 16, minHeight: 300, lineHeight: 24 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 20, marginTop: 20, borderTopWidth: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSub: { fontSize: 12, color: '#999', marginTop: 2 }
});
