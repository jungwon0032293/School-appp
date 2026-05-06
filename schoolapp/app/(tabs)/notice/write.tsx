import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, 
  Switch, ActivityIndicator, useColorScheme 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from "../../../firebaseConfig";
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, getDocs } from "firebase/firestore";
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

export default function NoticeWriteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const colorScheme = useColorScheme(); 
  const isDark = colorScheme === 'dark';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('학생회'); 
  const [isPinned, setIsPinned] = useState(false);
  const [isBanner, setIsBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    loadUserSession(); 
    if (id) loadNotice();
  }, [id]);

  const loadUserSession = async () => {
    try {
      const session = await AsyncStorage.getItem('userSession');
      if (session) {
        const userData = JSON.parse(session);
        if (userData.name) {
          setAuthor(userData.name); 
        }
      }
    } catch (e) {
      console.error("세션 불러오기 실패", e);
    }
  };

  const loadNotice = async () => {
    setFetching(true);
    try {
      const docSnap = await getDoc(doc(db, "notices", id as string));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTitle(data.title);
        setContent(data.content);
        setAuthor(data.author);
        setIsPinned(data.isPinned || false);
        setIsBanner(data.isBanner || false);
      }
    } catch (e) {
      Alert.alert("오류", "데이터를 불러오지 못했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const sendPushNotification = async (tokens: string[], noticeTitle: string) => {
    if (tokens.length === 0) return;
    const uniqueTokens = Array.from(new Set(tokens)).filter(t => t.startsWith('ExponentPushToken'));
    const messages = uniqueTokens.map(token => ({
      to: token,
      sound: 'default',
      title: '📢 새로운 공지사항',
      body: noticeTitle,
      data: { screen: 'notice' },
    }));

    try {
      await axios.post('https://exp.host/--/api/v2/push/send', messages, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error("푸시 알림 발송 실패:", error);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      return Alert.alert("알림", "제목과 내용을 모두 입력해주세요.");
    }

    setLoading(true);
    try {
      const noticeData = {
        title: title.trim(),
        content: content.trim(),
        author: author, 
        isPinned: isPinned,
        isBanner: isBanner,
        updatedAt: serverTimestamp(),
      };

      if (id) {
        await updateDoc(doc(db, "notices", id as string), noticeData);
      } else {
        await addDoc(collection(db, "notices"), {
          ...noticeData,
          createdAt: serverTimestamp(),
        });

        // ✅ 알림 설정 연동 로직
        const userDocs = await getDocs(collection(db, "users"));
        const pushTokens: string[] = [];
        
        userDocs.forEach(doc => {
          const data = doc.data();
          // 사용자의 pushToken이 있고, 설정에서 majorSuggestionNoti가 true인 경우만 포함
          // (설정값이 명시적으로 false가 아닐 때만 발송)
          if (data.pushToken && data.settings?.majorSuggestionNoti !== false) {
            pushTokens.push(data.pushToken);
          }
        });

        if (pushTokens.length > 0) {
          await sendPushNotification(pushTokens, title.trim());
        }
      }

      Alert.alert("성공", id ? "수정되었습니다." : "등록되었습니다.", [
        { text: "확인", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("오류", "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#111' : '#F8F9FA' }]}>
        <ActivityIndicator size="large" color={isDark ? '#869489' : '#556B2F'} />
      </View>
    );
  }

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#191F28',
    textSecondary: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#F1F3F5',
    divider: isDark ? '#2C2C2E' : '#F8F9FA',
    inputPlaceholder: isDark ? '#4E5968' : '#ADB5BD'
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: theme.textSecondary }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>{id ? "공지 수정" : "공지 작성"}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
          {loading ? (
            <ActivityIndicator size="small" color={isDark ? '#869489' : '#556B2F'} />
          ) : (
            <Text style={styles.saveBtnText}>완료</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.inputCard, { backgroundColor: theme.card }]}>
            <TextInput 
              style={[styles.titleInput, { color: theme.textPrimary }]}
              placeholder="제목"
              placeholderTextColor={theme.inputPlaceholder}
              value={title}
              onChangeText={setTitle}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <TextInput 
              style={[styles.contentInput, { color: theme.textPrimary }]}
              placeholder="공지 내용을 작성해주세요."
              placeholderTextColor={theme.inputPlaceholder}
              multiline
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
            />
          </View>

          <View style={[styles.settingCard, { backgroundColor: theme.card }]}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>상단 고정</Text>
                <Text style={styles.settingDesc}>목록 최상단에 고정합니다.</Text>
              </View>
              <Switch 
                value={isPinned}
                onValueChange={setIsPinned}
                trackColor={{ false: isDark ? "#3A3A3C" : "#E9ECEF", true: "#82A977" }}
              />
            </View>
            
            <View style={[styles.innerDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>홈 배너 노출</Text>
                <Text style={styles.settingDesc}>홈 화면 배너에 띄웁니다.</Text>
              </View>
              <Switch 
                value={isBanner}
                onValueChange={(val) => {
                  setIsBanner(val);
                  if(val) setIsPinned(true);
                }}
                trackColor={{ false: isDark ? "#3A3A3C" : "#E9ECEF", true: "#82A977" }}
              />
            </View>

            <View style={[styles.innerDivider, { backgroundColor: theme.divider }]} />

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>작성자</Text>
              <TextInput 
                style={[styles.authorInput, { color: theme.textSecondary, opacity: 0.6 }]} 
                value={author} 
                editable={false} 
              />
            </View>
          </View>

          <Text style={[styles.guideText, { color: theme.inputPlaceholder }]}>
            ※ 작성자 정보는 계정 이름으로 자동 고정됩니다.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingHorizontal: 24, paddingBottom: 20, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, fontWeight: '300' },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { fontSize: 17, fontWeight: '700', color: '#82A977' },
  scrollContent: { padding: 24 },
  inputCard: { borderRadius: 22, padding: 24, elevation: 2 },
  titleInput: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  divider: { height: 1 },
  contentInput: { fontSize: 16, marginTop: 16, minHeight: 300, lineHeight: 24 },
  settingCard: { borderRadius: 22, padding: 24, marginTop: 20, elevation: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: 16, fontWeight: '700' },
  settingDesc: { fontSize: 13, color: '#8B95A1', marginTop: 4 },
  innerDivider: { height: 1, marginVertical: 16 },
  authorInput: { fontSize: 15, textAlign: 'right', flex: 1, fontWeight: '500' },
  guideText: { textAlign: 'center', fontSize: 13, marginTop: 24, marginBottom: 40 }
});
