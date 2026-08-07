import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, 
  Modal, Alert, ActivityIndicator, Keyboard, TouchableWithoutFeedback, 
  KeyboardAvoidingView, Platform, Switch, ScrollView, useColorScheme 
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from 'expo-router'; 
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from "../../../firebaseConfig";
import { 
  collection, query, orderBy, getDocs, addDoc, serverTimestamp, 
  updateDoc, doc, deleteDoc, getDoc, where
} from "firebase/firestore";
import { useAdmin } from "../../_layout";
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons'; 

interface Suggestion {
  id: string;
  title: string;
  content: string;
  studentId: string;
  name: string;
  status: string;
  isPrivate: boolean;
  answer?: string;
  likes: string[];
  pushToken?: string;
  uid: string; 
  createdAt: any;
}

export default function SuggestionScreen() {
  const router = useRouter(); 
  const { isAdmin, user } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notices, setNotices] = useState<any[]>([]); 
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false); 
  const [selectedItem, setSelectedItem] = useState<Suggestion | null>(null);
  
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const [adminAnswer, setAdminAnswer] = useState('');
  const [adminStatus, setAdminStatus] = useState('답변완료');

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    headerBg: isDark ? '#1C1C1E' : '#FFFFFF',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    textPrimary: isDark ? '#FFFFFF' : '#111111',
    textSecondary: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#F1F3F5',
    inputBg: isDark ? '#2C2C2E' : '#F8F9FA',
    privateCard: isDark ? '#161618' : '#F1F3F5',
    accent: '#82A977'
  };

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      loadData();
    }
    return () => { isMounted = false; };
  }, [showOnlyUnanswered]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    if (loading) return; 
    setLoading(true);
    try {
      let q;
      if (isAdmin && showOnlyUnanswered) {
        q = query(
          collection(db, "suggestions"), 
          where("status", "==", "검토중"),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
      }
      
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Suggestion));
      setSuggestions([...data]);
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (targetUid: string, pushToken: string, title: string, body: string, settingKey: string, postId: string) => {
    if (!targetUid) return;
    try {
      const userDoc = await getDoc(doc(db, "users", targetUid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userSettings = userData.settings;
        if (userSettings && userSettings[settingKey] === false) return;

        await addDoc(collection(db, "notifications"), {
          targetUid: targetUid,
          type: 'suggestion',
          postTitle: '건의사항 답변',
          senderName: '학생회',
          content: body,
          isRead: false,
          postId: postId,
          createdAt: serverTimestamp(),
        });

        if (pushToken) {
          await axios.post('https://exp.host/--/api/v2/push/send', {
            to: pushToken, sound: 'default', title, body,
            data: { screen: 'suggestion', id: postId },
          });
        }
      }
    } catch (e) { console.error("알림 로직 실패:", e); }
  };

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) {
      return Alert.alert("알림", "제목과 내용을 모두 입력해주세요.");
    }
    
    Keyboard.dismiss();
    
    const submittedTitle = title.trim();
    const submittedContent = content.trim();
    const submittedIsPrivate = isPrivate;
    const submittedName = name;

    setModalVisible(false);
    setTitle(''); 
    setContent(''); 
    setIsPrivate(false);

    try {
      const myToken = await AsyncStorage.getItem('pushToken');
      const newSuggestionRef = await addDoc(collection(db, "suggestions"), {
        uid: user.uid,
        studentId: studentId,
        name: submittedName,
        title: submittedTitle,
        content: submittedContent,
        status: '검토중',
        isPrivate: submittedIsPrivate,
        likes: [],
        pushToken: myToken || "",
        createdAt: serverTimestamp(),
      });

      const adminQuery = query(collection(db, "users"), where("role", "in", ["admin", "master"]));
      const adminSnap = await getDocs(adminQuery);

      for (const adminDoc of adminSnap.docs) {
        const adminData = adminDoc.data();
        const isNotiEnabled = adminData.settings?.newSuggestionNoti !== false;

        if (adminDoc.id !== user.uid && isNotiEnabled) {
          await addDoc(collection(db, "notifications"), {
            targetUid: adminDoc.id,
            type: 'suggestion',
            postTitle: '새로운 건의사항',
            senderName: submittedName,
            content: `"${submittedTitle}" 건의가 접수되었습니다.`,
            isRead: false,
            postId: newSuggestionRef.id,
            createdAt: serverTimestamp(),
          });

          if (adminData.pushToken) {
            try {
              await axios.post('https://exp.host/--/api/v2/push/send', {
                to: adminData.pushToken,
                sound: 'default',
                title: "📩 새로운 건의사항 접수",
                body: `${submittedName}님의 새로운 건의가 등록되었습니다.`,
                data: { screen: 'suggestion', id: newSuggestionRef.id },
              });
            } catch (err) { console.error("학생회 푸시 실패:", err); }
          }
        }
      }
      
      Alert.alert("성공", "건의사항이 정상적으로 등록되었습니다.");
      loadData();
    } catch (e) { 
      Alert.alert("오류", "저장 실패"); 
    }
  };

  const handleAdminSubmit = async () => {
    if (!selectedItem) return;
    Keyboard.dismiss();
    try {
      await updateDoc(doc(db, "suggestions", selectedItem.id), {
        answer: adminAnswer.trim(),
        status: adminStatus,
      });

      if (selectedItem.uid) {
        let pushTitle = adminStatus === '답변완료' ? "✅ 건의사항 답변 완료" : "👀 건의사항 검토 중";
        let pushBody = adminStatus === '답변완료' 
          ? "작성하신 건의사항에 답변이 등록되었습니다." 
          : "학생회에서 건의사항 검토를 시작했습니다.";
        
        await sendNotification(
          selectedItem.uid, 
          selectedItem.pushToken || "", 
          pushTitle, pushBody, 'suggestionNoti', selectedItem.id
        );
      }

      setAdminModalVisible(false);
      setAdminAnswer('');
      loadData();
      Alert.alert("성공", "처리가 완료되었습니다.");
    } catch (e) { Alert.alert("오류", "답변 저장 실패"); }
  };

  const handleAdminAction = (item: Suggestion) => {
    if (!isAdmin) return;
    Alert.alert("관리자 메뉴", "작업을 선택하세요.", [
      { text: "취소", style: "cancel" },
      { text: "답변 달기/상태 변경", onPress: () => {
          setSelectedItem(item);
          setAdminAnswer(item.answer || '');
          setAdminStatus(item.status);
          setAdminModalVisible(true);
      }},
      { text: item.isPrivate ? "공개 전환" : "비공개 전환", onPress: async () => {
          await updateDoc(doc(db, "suggestions", item.id), { isPrivate: !item.isPrivate });
          loadData();
      }},
      { text: "삭제", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "suggestions", item.id));
          loadData();
      }}
    ]);
  };

  const renderItem = ({ item }: { item: Suggestion }) => {
    const showContent = isAdmin || !item.isPrivate || item.uid === user?.uid;
    return (
      <TouchableOpacity 
        style={[styles.itemCard, { backgroundColor: theme.card }, item.isPrivate && { backgroundColor: theme.privateCard, opacity: 0.8 }]} 
        onLongPress={() => handleAdminAction(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusTag, { backgroundColor: item.status === '답변완료' ? theme.accent : (isDark ? '#2C2C2E' : '#E9ECEF') }]}>
            <Text style={[styles.statusText, { color: item.status === '답변완료' ? '#fff' : (isDark ? '#9CA3AF' : '#666') }]}>
              {item.isPrivate ? "🔒 " : ""}{item.status}
            </Text>
          </View>
          {isAdmin && (
            <View style={styles.adminInfoTag}>
              <Text style={styles.adminInfoText}>{item.studentId} {item.name}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>{showContent ? item.title : "비공개 건의사항입니다."}</Text>
        <Text style={[styles.itemContent, { color: theme.textSecondary }]} numberOfLines={showContent ? undefined : 2}>
          {showContent ? item.content : "작성자와 학생회만 내용을 확인할 수 있습니다."}
        </Text>
        {showContent && item.answer && (
          <View style={[styles.answerSection, { backgroundColor: isDark ? '#262629' : '#F1F3F5' }]}>
            <View style={styles.answerHeader}><Text style={[styles.answerIcon, { color: theme.accent }]}>A.</Text><Text style={[styles.answerLabel, { color: theme.textPrimary }]}>학생회 답변</Text></View>
            <Text style={[styles.answerText, { color: theme.textSecondary }]}>{item.answer}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const handleOpenWriteModal = async () => {
    if (!user) {
      Alert.alert("권한 없음", "로그인 후 건의함을 이용하실 수 있습니다.");
      return;
    }
    setStudentId(user.studentId);
    setName(user.name);
    setModalVisible(true);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>건의함</Text>
              {isAdmin && (
                 <TouchableOpacity onPress={() => setShowOnlyUnanswered(!showOnlyUnanswered)} style={{ marginTop: 2 }}>
                    <Text style={{ color: showOnlyUnanswered ? theme.accent : theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
                      {showOnlyUnanswered ? "● 미답변 필터" : "○ 전체 보기"}
                    </Text>
                 </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.headerBtns}>
            <TouchableOpacity style={styles.myBtn} onPress={() => router.push('/suggestion/my-suggestions' as any)}>
              <Text style={styles.myBtnText}>나의 건의</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.writeBtn} onPress={handleOpenWriteModal}>
              <Text style={styles.writeBtnText}>건의하기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && suggestions.length === 0 ? <ActivityIndicator size="large" color={theme.accent} style={{ flex: 1 }} /> : (
          <FlatList 
            data={suggestions} 
            keyExtractor={(item, index) => item.id ? String(item.id) : `fallback-${index}`} 
            renderItem={renderItem} 
            contentContainerStyle={styles.listPadding} 
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 100 }}>
                <Text style={{ color: theme.textSecondary }}>
                  {isAdmin && showOnlyUnanswered ? "미답변 건의가 없습니다!" : "등록된 건의가 없습니다."}
                </Text>
              </View>
            }
          />
        )}

        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>의견 보내기</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                </View>
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
                  <View style={styles.userInfoRow}>
                    <TextInput style={[styles.modalInputSmall, { flex: 1, marginRight: 8, borderBottomColor: theme.border, color: theme.textSecondary, opacity: 0.6 }]} value={studentId} editable={false} />
                    <TextInput style={[styles.modalInputSmall, { flex: 1, borderBottomColor: theme.border, color: theme.textSecondary, opacity: 0.6 }]} value={name} editable={false} />
                  </View>
                  <TextInput style={[styles.modalInputTitle, { borderBottomWidth: 1, borderBottomColor: theme.border, color: theme.textPrimary }]} placeholder="제목" placeholderTextColor={theme.textSecondary} value={title} onChangeText={setTitle} />
                  <TextInput style={[styles.modalInputContent, { color: theme.textPrimary }]} placeholder="내용을 입력해주세요." placeholderTextColor={theme.textSecondary} multiline value={content} onChangeText={setContent} />
                  <View style={[styles.privateRow, { borderTopColor: theme.border }]}>
                    <Text style={[styles.privateLabel, { color: theme.textSecondary }]}>비공개 제출</Text>
                    <Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ false: isDark ? "#3A3A3C" : "#E9ECEF", true: theme.accent }} />
                  </View>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleAdd}><Text style={styles.submitBtnText}>건의 등록하기</Text></TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal visible={adminModalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
              <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>답변 및 상태 관리</Text>
                  <TouchableOpacity onPress={() => setAdminModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
                </View>
                <View style={styles.statusSelectRow}>
                  <TouchableOpacity style={[styles.statusOption, { backgroundColor: isDark ? '#2C2C2E' : '#F1F3F5' }, adminStatus === '검토중' && styles.statusActive]} onPress={() => setAdminStatus('검토중')}>
                    <Text style={[styles.statusOptionText, adminStatus === '검토중' && styles.statusActiveText]}>검토중</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.statusOption, { backgroundColor: isDark ? '#2C2C2E' : '#F1F3F5' }, adminStatus === '답변완료' && styles.statusActive]} onPress={() => setAdminStatus('답변완료')}>
                    <Text style={[styles.statusOptionText, adminStatus === '답변완료' && styles.statusActiveText]}>답변완료</Text>
                  </TouchableOpacity>
                </View>
                <TextInput style={[styles.adminAnswerInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.textPrimary }]} placeholder="작성자에게 전달할 답변을 적어주세요." placeholderTextColor={theme.textSecondary} multiline value={adminAnswer} onChangeText={setAdminAnswer} />
                <TouchableOpacity style={styles.submitBtn} onPress={handleAdminSubmit}><Text style={styles.submitBtnText}>저장 및 알림 전송</Text></TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 55 : 15, 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomWidth: 1 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  navButton: { padding: 4, marginLeft: -8, marginRight: 4 },
  titleContainer: { flexDirection: 'column' },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  myBtn: { backgroundColor: '#F1F3F5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E9ECEF', justifyContent: 'center', alignItems: 'center' },
  myBtnText: { color: '#4E5968', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  writeBtn: { backgroundColor: '#82A977', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, justifyContent: 'center', alignItems: 'center'},
  writeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  listPadding: { padding: 20, paddingBottom: 40 },
  itemCard: { borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  adminInfoTag: { backgroundColor: '#FFF0F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adminInfoText: { fontSize: 12, color: '#FF4D4F', fontWeight: '700' },
  itemTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  itemContent: { fontSize: 15, lineHeight: 22 },
  answerSection: { marginTop: 18, padding: 16, borderRadius: 16 },
  answerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  answerIcon: { fontSize: 16, fontWeight: '900', marginRight: 6 },
  answerLabel: { fontSize: 14, fontWeight: '700' },
  answerText: { fontSize: 14, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  closeBtn: { fontSize: 24, color: '#ADB5BD' },
  userInfoRow: { flexDirection: 'row', marginBottom: 5 },
  modalInputSmall: { fontSize: 14, borderBottomWidth: 1, paddingVertical: 5 },
  modalInputTitle: { fontSize: 16, fontWeight: '700', borderBottomWidth: 1, paddingVertical: 8, marginBottom: 8 },
  modalInputContent: { fontSize: 15, minHeight: 80, maxHeight: 120, textAlignVertical: 'top', marginBottom: 10 },
  privateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  privateLabel: { fontSize: 14, fontWeight: '600' },
  submitBtn: { backgroundColor: '#82A977', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 5 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusSelectRow: { flexDirection: 'row', marginBottom: 20 },
  statusOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, marginRight: 8 },
  statusActive: { backgroundColor: '#82A977' },
  statusOptionText: { color: '#666', fontWeight: '700' },
  statusActiveText: { color: '#fff' },
  adminAnswerInput: { borderRadius: 15, padding: 16, minHeight: 120, textAlignVertical: 'top', fontSize: 15, marginBottom: 15, borderWidth: 1 }
});
