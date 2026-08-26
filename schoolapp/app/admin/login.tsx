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

const TERMS_DATA = {
  service: "제1조(목적)\n본 약관은 육민관고등학교 커뮤니티 앱이 제공하는 제반 서비스의 이용조건 및 절차, 이용자의 권리와 의무 등 기본적인 사항을 규정함을 목적으로 합니다.\n\n제2조(서비스 이용)\n본 육민관 고등학교 어플리케이션의 모든 권한은 육민관고등학교 학생회애 종속되어 있으며, 어플리케이션 이용자는 본 앱을 통해 학교 공지, 급식, 건의함 등을 이용할 수 있으며, 타인을 비방하거나 부적절한 게시물을 작성할 경우 육민관 고등학교 규정에 의하여 서비스 이용 제한 및 선도위원회에 회부될 수 있습니다.",
  privacy: "1. 수집하는 항목: 이름, 학번, 비밀번호, 본인 확인용 학생증(리로스쿨) 사진.\n2. 수집 목적: 학교 구성원 인증 및 서비스 부정 이용 방지.\n3. 보유 및 이용 기간: 회원 탈퇴 시까지 또는 서비스 종료 시까지 보관하며 이후 즉시 파기합니다.",
  eula: "제1조(부적절한 콘텐츠 및 악성 이용자 제한 - EULA)\n1. 본 앱은 익명 소통을 지원하지만 무분별한 비방, 욕설, 음란물, 도배 및 타인에게 불쾌감을 주는 부적절한 사용자 생성 콘텐츠(UGC)의 게시를 절대 허용하지 않습니다.\n2. 모든 이용자는 부적절한 게시글이나 악성 이용자를 앱 내 기능을 통해 즉시 신고 및 차단할 수 있습니다.\n3. 운영진(학생회)은 신고 접수 후 24시간 이내에 해당 콘텐츠를 검토하여 삭제하고, 부적절한 콘텐츠를 제공한 이용자를 강제 탈퇴 및 영구 이용 제한 조치를 취합니다."
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

  const [isAgreedService, setIsAgreedService] = useState(false);
  const [isAgreedPrivacy, setIsAgreedPrivacy] = useState(false);
  const [isAgreedEula, setIsAgreedEula] = useState(false); 
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", text: "" });

  const theme = {
    bg: isDark ? '#121212' : '#F2F4F6',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#4E5968',
    placeholder: isDark ? '#555' : '#ADB5BD',
    accent: '#82A977',
    danger: '#F04452', 
    border: isDark ? '#2C2C2E' : '#E5E8EB', 
  };

  const getDummyEmail = (id: string) => `${id.trim()}@school.com`;

  const openTerms = (type: 'service' | 'privacy' | 'eula') => {
    setModalContent({
      title: type === 'service' ? "서비스 이용약관" : type === 'privacy' ? "개인정보 처리방침" : "커뮤니티 이용 정책 (EULA)",
      text: TERMS_DATA[type]
    });
    setModalVisible(true);
  };

  const getPushToken = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log("⚠️ 푸시 알림 권한이 거부되어 토큰을 가져올 수 없습니다.");
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log("✅ 발급된 Expo Push Token:", tokenData.data);
      return tokenData.data;
    } catch (e) {
      console.error("❌ Expo Push Token 발급 오류:", e);
      return null;
    }
  };

  const notifyAdmins = async (newUserName: string) => {
    try {
      const adminQuery = query(
        collection(db, "users"), 
        where("role", "==", "admin"),
        where("settings.newJoinRequestNoti", "==", true)
      );
      const masterQuery = query(
        collection(db, "users"), 
        where("role", "==", "master"),
        where("settings.newJoinRequestNoti", "==", true)
      );

      const [adminSnap, masterSnap] = await Promise.all([
        getDocs(adminQuery),
        getDocs(masterQuery)
      ]);

      const tokens: string[] = [];
      adminSnap.forEach((doc) => {
        const token = doc.data().expoPushToken || doc.data().pushToken;
        if (token) tokens.push(token);
      });
      masterSnap.forEach((doc) => {
        const token = doc.data().expoPushToken || doc.data().pushToken;
        if (token) tokens.push(token);
      });

      const uniqueTokens = Array.from(new Set(tokens));

      if (uniqueTokens.length === 0) return;
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(uniqueTokens.map(token => ({
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

  const handleFirebaseError = (error: any, defaultMessage: string) => {
    console.error(error);
    const errorCode = error?.code;
    
    switch(errorCode) {
      case 'auth/invalid-email':
        return Alert.alert("오류", "올바르지 않은 학번 형식입니다.");
      case 'auth/weak-password':
        return Alert.alert("오류", "비밀번호가 너무 취약합니다. 더 길게 설정해주세요.");
      case 'auth/network-request-failed':
        return Alert.alert("네트워크 오류", "인터넷 연결 상태를 확인 후 다시 시도해주세요.");
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return Alert.alert("로그인 실패", "등록되지 않은 학번이거나 비밀번호가 틀렸습니다.");
      case 'auth/too-many-requests':
        return Alert.alert("접근 제한", "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.");
      default:
        return Alert.alert("오류", defaultMessage);
    }
  };

  const handleSignUp = async () => {
    const cleanStudentId = studentId.trim();
    const cleanName = name.trim();
    const cleanPassword = password.trim();
    const cleanCouncilPw = councilPw.trim();

    if (!cleanStudentId || !cleanName || !cleanPassword || !image) {
      return Alert.alert("알림", "모든 정보를 입력하고 사진을 등록해주세요.");
    }
    
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(cleanPassword)) {
      return Alert.alert("양식 불일치", "비밀번호 양식이 올바르지 않습니다.\n영문과 숫자를 혼합하여 6자 이상 입력해주세요.");
    }

    if (!isAgreedService || !isAgreedPrivacy || !isAgreedEula) {
      return Alert.alert("알림", "모든 필수 약관에 동의하셔야 가입이 가능합니다.");
    }
    if (isCouncil && cleanCouncilPw !== "dbralsrhks2026") {
      return Alert.alert("인증 실패", "학생회 비밀번호가 일치하지 않습니다.");
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", cleanStudentId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.isApproved || userData.role === "user_pending" || userData.role === "admin_pending") {
          setLoading(false);
          return Alert.alert("오류", "이미 등록되었거나 승인 대기 중인 학번입니다.");
        }
      }

      try {
        await createUserWithEmailAndPassword(auth, getDummyEmail(cleanStudentId), cleanPassword);
      } catch (authError: any) {
        if (authError.code !== 'auth/email-already-in-use') {
          setLoading(false);
          return handleFirebaseError(authError, "인증 계정 생성 중 문제가 발생했습니다.");
        }
      }

      const pushToken = await getPushToken();
      const manipResult = await ImageManipulator.manipulateAsync(
        image, [{ resize: { width: 400 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      await setDoc(userRef, {
        studentId: cleanStudentId, 
        name: cleanName, 
        password: cleanPassword,
        idCardImage: `data:image/jpeg;base64,${manipResult.base64}`,
        expoPushToken: pushToken || null,
        pushToken: pushToken || null,
        role: isCouncil ? "admin_pending" : "user_pending",
        isApproved: false,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      await notifyAdmins(cleanName);
      Alert.alert("신청 완료", "학생회 확인 후 승인될 예정입니다!");
      setIsSignUp(false);
      setImage(null); setStudentId(""); setName(""); setPassword(""); setCouncilPw("");
      setIsAgreedService(false); setIsAgreedPrivacy(false); setIsAgreedEula(false); 
    } catch (e: any) {
      handleFirebaseError(e, "가입 신청 처리 중 예기치 못한 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const cleanStudentId = studentId.trim();
    const cleanName = name.trim();
    const cleanPassword = password.trim();

    if (!cleanStudentId || !cleanName || !cleanPassword) return Alert.alert("알림", "정보를 입력해주세요.");
    setLoading(true);
    try {
      const userRef = doc(db, "users", cleanStudentId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || userSnap.data().password !== cleanPassword || userSnap.data().name !== cleanName) {
        setLoading(false);
        return Alert.alert("실패", "정보가 일치하지 않습니다.");
      }
      if (!userSnap.data().isApproved) {
        setLoading(false);
        return Alert.alert("승인 대기", "아직 학생회 승인 대기 중입니다.");
      }

      try {
        await signInWithEmailAndPassword(auth, getDummyEmail(cleanStudentId), cleanPassword);
      } catch (e) {
        try {
          await createUserWithEmailAndPassword(auth, getDummyEmail(cleanStudentId), cleanPassword);
        } catch (createErr: any) {
          setLoading(false);
          return handleFirebaseError(createErr, "인증 세션 동기화 중 문제가 발생했습니다.");
        }
      }

      const currentPushToken = await getPushToken();
      const existingData = userSnap.data();

      const validToken = currentPushToken || existingData.expoPushToken || existingData.pushToken || null;

      await setDoc(userRef, {
        name: cleanName,
        expoPushToken: validToken,
        pushToken: validToken,
        lastLoginAt: new Date().toISOString()
      }, { merge: true });

      const userInfo = { studentId: cleanStudentId, uid: cleanStudentId, name: existingData.name, role: existingData.role };
      await AsyncStorage.setItem('userSession', JSON.stringify(userInfo));
      if (existingData.role === "admin") setIsAdmin(true);
      setUser(userInfo);
      router.replace('/');
    } catch (e: any) {
      handleFirebaseError(e, "로그인 중 에러가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: theme.text }]}>{isSignUp ? "회원가입 신청" : "로그인"}</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>{isSignUp ? "학생 인증을 위해 사진 등록이 필요합니다." : "반가워요! 정보를 입력해주세요."}</Text>
          
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="학번" placeholderTextColor={theme.placeholder} value={studentId} onChangeText={setStudentId} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} />
            <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="이름" placeholderTextColor={theme.placeholder} value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} />
            <View>
              <TextInput style={[styles.input, { backgroundColor: theme.card, color: theme.text }]} placeholder="비밀번호" placeholderTextColor={theme.placeholder} secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} />
              {isSignUp && (
                <Text style={[styles.passwordNotice, { color: theme.subText }]}>* 영문+숫자로 이루어진 혼합 형태여야 합니다. (6자 이상)</Text>
              )}
            </View>

            {isSignUp && (
              <>
                <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.card, borderColor: theme.accent }]} onPress={pickImage}>
                  {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : <Text style={{ color: theme.accent, fontWeight: '600' }}>📸 학생증(리로스쿨) 사진 등록</Text>}
                </TouchableOpacity>

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

                  <View style={styles.termsRow}>
                    <TouchableOpacity style={styles.termsLabel} onPress={() => setIsAgreedEula(!isAgreedEula)}>
                      <Text style={[styles.termsText, { color: theme.text }]}>[필수] 커뮤니티 이용 정책 동의 (EULA)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openTerms('eula')}><Text style={styles.detailBtn}>자세히</Text></TouchableOpacity>
                    <Switch value={isAgreedEula} onValueChange={setIsAgreedEula} trackColor={{ false: "#767577", true: theme.accent }} />
                  </View>
                </View>

                <View style={styles.toggleRow}>
                  <Text style={[styles.toggleText, { color: theme.text }]}>학생회이신가요?</Text>
                  <Switch value={isCouncil} onValueChange={setIsCouncil} trackColor={{ false: "#767577", true: theme.accent }} />
                </View>
                {isCouncil && (
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.accent, borderWidth: 1 }]} 
                    placeholder="학생회 인증 비밀번호" 
                    placeholderTextColor={theme.placeholder} 
                    secureTextEntry 
                    value={councilPw} 
                    onChangeText={setCouncilPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </>
            )}
          </View>

          <TouchableOpacity style={[styles.mainButton, { backgroundColor: theme.accent, opacity: (isSignUp && (!isAgreedService || !isAgreedPrivacy || !isAgreedEula)) ? 0.6 : 1 }]} onPress={isSignUp ? handleSignUp : handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{isSignUp ? "가입 신청하기" : "로그인하기"}</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.subText }]}>또는</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity 
            style={[styles.switchButton, { backgroundColor: theme.card, borderColor: theme.accent }]} 
            onPress={() => { setIsSignUp(!isSignUp); setIsAgreedService(false); setIsAgreedPrivacy(false); setIsAgreedEula(false); }}
          >
            <Text style={[styles.switchButtonText, { color: theme.text }]}>
              {isSignUp ? "이미 계정이 있으신가요? 로그인하기" : "처음이신가요? 회원가입 신청하기"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  passwordNotice: { fontSize: 12, fontWeight: '500', marginTop: 4, paddingHorizontal: 4 }, 
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
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, paddingHorizontal: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { marginHorizontal: 12, fontSize: 13, fontWeight: '600' },
  switchButton: { height: 56, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  switchButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 30 },
  modalContent: { borderRadius: 24, padding: 24, maxHeight: '70%' },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalScroll: { marginBottom: 20 },
  modalText: { fontSize: 14, lineHeight: 22 },
  modalCloseBtn: { height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
