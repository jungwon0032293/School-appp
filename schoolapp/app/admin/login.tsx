import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, 
  KeyboardAvoidingView, Platform, useColorScheme, ScrollView, Image, Switch, ActivityIndicator, Modal 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAdmin } from '../_layout'; 
import { db, auth } from "../../firebaseConfig";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// 약관 데이터
const TERMS_DATA = {
  service: "제1조(목적)\n본 약관은 육민관고등학교 커뮤니티 앱이 제공하는 제반 서비스의 이용조건 및 절차, 이용자의 권리와 의무 등 기본적인 사항을 규정함을 목적으로 합니다.\n\n제2조(서비스 이용)\n본 육민관 고등학교 어플리케이션의 모든 권한은 육민관고등학교 학생회애 종속되어 있으며, 어플리케이션 이용자는 본 앱을 통해 학교 공지, 급식, 건의함 등을 이용할 수 있으며, 타인을 비방하거나 부적절한 게시물을 작성할 경우 육민관 고등학교 규정에 의하여 서비스 이용 제한 및 선도위원회에 회부될 수 있습니다.",
  privacy: "1. 수집하는 항목: 이름, 학번, 비밀번호, 본인 확인용 학생증(리로스쿨) 사진.\n2. 수집 목적: 학교 구성원 인증 및 서비스 부정 이용 방지.\n3. 보유 및 이용 기간: 회원 탈퇴 시까지 또는 서비스 종료 시까지 보관하며 이후 즉시 파기합니다."
};

export default function AdminLogin() {
  const router = useRouter();
  const { setIsAdmin, setUser } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isCouncil, setIsCouncil] = useState(false);
  const [councilPw, setCouncilPw] = useState("");

  // ✅ 동의 관련 상태
  const [isAgreedService, setIsAgreedService] = useState(false);
  const [isAgreedPrivacy, setIsAgreedPrivacy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", text: "" });

  const theme = {
    bg: isDark ? '#121212' : '#F2F4F6',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#4E5968',
    placeholder: isDark ? '#555' : '#ADB5BD',
    accent: '#82A977',
  };

  const getDummyEmail = (id: string) => `${id}@school.com`;

  const openTerms = (type: 'service' | 'privacy') => {
    setModalContent({
      title: type === 'service' ? "서비스 이용약관" : "개인정보 처리방침",
      text: TERMS_DATA[type]
    });
    setModalVisible(true);
  };

  const getPushToken = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    try {
      return (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) { return null; }
  };

  const notifyAdmins = async (newUserName: string) => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "admin"));
      const querySnapshot = await getDocs(q);
      const adminTokens: string[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().pushToken) adminTokens.push(doc.data().pushToken);
      });
      if (adminTokens.length === 0) return;
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(adminTokens.map(token => ({
          to: token, sound: 'default', title: '🔔 신규 가입 신청', body: `${newUserName} 학생의 가입 신청이 도착했습니다.`,
        }))),
      });
    } catch (e) { console.error(e); }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSignUp = async () => {
    if (!studentId || !name || !password || !image) {
      return Alert.alert("알림", "모든 정보를 입력하고 사진을 등록해주세요.");
    }
    if (!isAgreedService || !isAgreedPrivacy) {
      return Alert.alert("알림", "모든 필수 약관에 동의하셔야 가입이 가능합니다.");
    }
    if (isCouncil && councilPw !== "ymk1234") {
      return Alert.alert("인증 실패", "학생회 비밀번호가 일치하지 않습니다.");
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setLoading(false);
        return Alert.alert("오류", "이미 등록된 학번입니다.");
      }

      await createUserWithEmailAndPassword(auth, getDummyEmail(studentId), password);
      const pushToken = await getPushToken();
      const manipResult = await ImageManipulator.manipulateAsync(
        image, [{ resize: { width: 400 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      await setDoc(userRef, {
        studentId, name, password,
        idCardImage: `data:image/jpeg;base64,${manipResult.base64}`,
        pushToken,
        role: isCouncil ? "admin_pending" : "user_pending",
        isApproved: false,
        createdAt: new Date().toISOString(),
      });

      await notifyAdmins(name);
      Alert.alert("신청 완료", "학생회 확인 후 승인될 예정입니다!");
      setIsSignUp(false);
      setImage(null); setStudentId(""); setName(""); setPassword("");
      setIsAgreedService(false); setIsAgreedPrivacy(false);
    } catch (e) {
      Alert.alert("오류", "신청 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!studentId || !name || !password) return Alert.alert("알림", "정보를 입력해주세요.");
    setLoading(true);
    try {
      const userRef = doc(db, "users", studentId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || userSnap.data().password !== password || userSnap.data().name !== name) {
        setLoading(false);
        return Alert.alert("실패", "정보가 일치하지 않습니다.");
      }
      if (!userSnap.data().isApproved) {
        setLoading(false);
        return Alert.alert("승인 대기", "아직 학생회 승인 대기 중입니다.");
      }

      try {
        await signInWithEmailAndPassword(auth, getDummyEmail(studentId), password);
      } catch (e) {
        await createUserWithEmailAndPassword(auth, getDummyEmail(studentId), password);
      }

      const userInfo = { studentId, uid: studentId, name: userSnap.data().name, role: userSnap.data().role };
      await AsyncStorage.setItem('userSession', JSON.stringify(userInfo));
      if (userSnap.data().role === "admin") setIsAdmin(true);
      setUser(userInfo);
      router.replace('/');
    } catch (e) {
      Alert.alert("오류", "로그인 중 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.text }]}>{isSignUp ? "회원가입 신청" : "로그인"}</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>{isSignUp ? "학생 인증을 위해 사진 등록이 필요합니다." : "반가워요! 정보를 입력해주세요."}</Text>
          
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="학번" placeholderTextColor={theme.placeholder} value={studentId} onChangeText={setStudentId} keyboardType="number-pad" />
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="이름" placeholderTextColor={theme.placeholder} value={name} onChangeText={setName} />
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="비밀번호" placeholderTextColor={theme.placeholder} secureTextEntry value={password} onChangeText={setPassword} />

            {isSignUp && (
              <>
                <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.card, borderColor: theme.accent }]} onPress={pickImage}>
                  {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : <Text style={{ color: theme.accent }}>📸 학생증(리로스쿨) 사진 등록</Text>}
                </TouchableOpacity>

                {/* 약관 동의 영역 */}
                <View style={[styles.termsContainer, { backgroundColor: theme.card }]}>
                  <View style={styles.termsRow}>
                    <TouchableOpacity style={styles.termsLabel} onPress={() => setIsAgreedService(!isAgreedService)}>
                      <Text style={[styles.termsText, { color: theme.text }]}>[필수] 서비스 이용약관 동의</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openTerms('service')}><Text style={styles.detailBtn}>자세히</Text></TouchableOpacity>
                    <Switch value={isAgreedService} onValueChange={setIsAgreedService} trackColor={{ false: "#767577", true: theme.accent }} />
                  </View>
                  <View style={styles.termsRow}>
                    <TouchableOpacity style={styles.termsLabel} onPress={() => setIsAgreedPrivacy(!isAgreedPrivacy)}>
                      <Text style={[styles.termsText, { color: theme.text }]}>[필수] 개인정보 처리방침 동의</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openTerms('privacy')}><Text style={styles.detailBtn}>자세히</Text></TouchableOpacity>
                    <Switch value={isAgreedPrivacy} onValueChange={setIsAgreedPrivacy} trackColor={{ false: "#767577", true: theme.accent }} />
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleText, { color: theme.text }]}>학생회이신가요?</Text>
                  <Switch value={isCouncil} onValueChange={setIsCouncil} trackColor={{ false: "#767577", true: theme.accent }} />
                </View>
                {isCouncil && (
                  <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.accent, borderWidth: 1 }]} placeholder="학생회 인증 비밀번호" placeholderTextColor={theme.placeholder} secureTextEntry value={councilPw} onChangeText={setCouncilPw} />
                )}
              </>
            )}
          </View>

          <TouchableOpacity style={[styles.mainButton, { backgroundColor: theme.accent, opacity: (isSignUp && (!isAgreedService || !isAgreedPrivacy)) ? 0.6 : 1 }]} onPress={isSignUp ? handleSignUp : handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{isSignUp ? "가입 신청하기" : "로그인하기"}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchButton} onPress={() => { setIsSignUp(!isSignUp); setIsAgreedService(false); setIsAgreedPrivacy(false); }}>
            <Text style={{ color: theme.subText }}>{isSignUp ? "이미 계정이 있으신가요? 로그인" : "처음이신가요? 회원가입 신청하기"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 약관 보기 모달 */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{modalContent.title}</Text>
            <ScrollView style={styles.modalScroll}><Text style={[styles.modalText, { color: theme.subText }]}>{modalContent.text}</Text></ScrollView>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: theme.accent }]} onPress={() => setModalVisible(false)}><Text style={styles.modalCloseText}>확인</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  inner: { padding: 24 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 32 },
  inputContainer: { gap: 12, marginBottom: 24 },
  input: { height: 60, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '500' },
  imagePicker: { height: 100, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  termsContainer: { padding: 16, borderRadius: 16, gap: 12 },
  termsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  termsLabel: { flex: 1 },
  termsText: { fontSize: 13, fontWeight: '600' },
  detailBtn: { fontSize: 12, color: '#82A977', textDecorationLine: 'underline', marginRight: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginVertical: 4 },
  toggleText: { fontSize: 15, fontWeight: '600' },
  mainButton: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  switchButton: { marginTop: 20, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 30 },
  modalContent: { borderRadius: 24, padding: 24, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalScroll: { marginBottom: 20 },
  modalText: { fontSize: 14, lineHeight: 22 },
  modalCloseBtn: { height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
