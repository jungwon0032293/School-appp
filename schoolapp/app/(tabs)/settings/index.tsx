import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Alert, useColorScheme, SafeAreaView, TextInput, Modal
} from 'react-native';
import { db, auth } from "../../../firebaseConfig";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { useAdmin } from "../../_layout"; 
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, setUser, isAdmin, setIsAdmin, isMaster, setIsMaster } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [settings, setSettings] = useState({
    likeNoti: true,
    commentNoti: true,
    suggestionNoti: true,
    majorSuggestionNoti: true,
    newSuggestionNoti: true,
    newJoinRequestNoti: true,
    reportNoti: true
  });

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [targetRole, setTargetRole] = useState<'user' | 'admin' | 'master'>('user');
  const [passwordInput, setPasswordInput] = useState('');

  const theme = {
    background: isDark ? '#111111' : '#F2F4F6',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1F27',
    subText: isDark ? '#9CA3AF' : '#6B7684',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user?.uid) return;
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().settings) {
        setSettings({ ...settings, ...userDoc.data().settings });
      }
    } catch (e) { console.log("설정 로드 실패", e); }
  };

  const toggleSetting = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), { settings: newSettings });
      } catch (e) { Alert.alert("오류", "설정 저장에 실패했습니다."); }
    }
  };

  const handleRoleChangeRequest = (role: 'user' | 'admin' | 'master') => {
    if (user?.role === role) return;

    if (role === 'master' && user?.role !== 'admin') {
      return Alert.alert("권한 제한", "학생회(Admin) 계정만 마스터로 승격할 수 있습니다.");
    }

    if (role === 'user') {
      Alert.alert("권한 변경", "일반학생으로 돌아가시겠습니까?", [
        { text: "취소" },
        { text: "확인", onPress: () => processRoleUpdate('user') }
      ]);
      return;
    }

    setTargetRole(role);
    setRoleModalVisible(true);
  };

  const confirmRoleChange = async () => {
    if (targetRole === 'admin' && passwordInput === "dbralsrhks2026") {
      await processRoleUpdate('admin');
    } 
    else if (targetRole === 'master' && passwordInput === "dbrrhgkrtodghl2026") {
      await processRoleUpdate('master');
    } 
    else {
      Alert.alert("인증 실패", "비밀번호가 일치하지 않습니다.");
    }
  };

  const processRoleUpdate = async (role: 'user' | 'admin' | 'master') => {
    try {
      const userRef = doc(db, "users", user.uid);
      const newIsAdmin = role === 'admin' || role === 'master';
      const newIsMaster = role === 'master';

      const newRoleData = {
        role: role,
        isAdmin: newIsAdmin,
        isMaster: newIsMaster
      };

      await updateDoc(userRef, newRoleData);
      
      setIsAdmin(newIsAdmin);
      setIsMaster(newIsMaster);
      setUser({ ...user, ...newRoleData });

      Alert.alert("성공", `권한이 ${role}로 변경되었습니다.`);
      setRoleModalVisible(false);
      setPasswordInput('');
    } catch (e) {
      Alert.alert("오류", "권한 변경 실패");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "회원 탈퇴",
      "정말로 탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { 
          text: "탈퇴하기", 
          style: "destructive", 
          onPress: async () => {
            try {
              const currentUser = auth.currentUser;
              if (!currentUser) {
                Alert.alert("알림", "인증 정보가 없습니다. 다시 로그인 해주세요.");
                return;
              }

              await deleteDoc(doc(db, "users", user.uid));
              await deleteUser(currentUser);
              await AsyncStorage.removeItem('userSession');
              setUser(null);
              setIsAdmin(false);
              setIsMaster(false);

              Alert.alert("알림", "그동안 이용해주셔서 감사합니다.");
              router.replace('/');
            } catch (error: any) {
              console.error(error);
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert("보안 알림", "개인정보 보호를 위해 재로그인 후 다시 시도해주세요.");
              } else {
                Alert.alert("오류", "탈퇴 처리 중 문제가 발생했습니다.");
              }
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({ title, value, onToggle, icon, color }: any) => (
    <View style={[styles.settingItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.settingLabel}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle}
        trackColor={{ false: "#767577", true: theme.accent }}
        thumbColor={"#fff"}
      />
    </View>
  );

  const SettingLinkItem = ({ title, onPress, icon, color }: any) => (
    <TouchableOpacity 
      style={[styles.settingItem, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.settingLabel}>
        <View style={[styles.iconBox, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.subText} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>설정</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>일반 알림</Text>
        <SettingItem title="좋아요 알림" value={settings.likeNoti} onToggle={() => toggleSetting('likeNoti')} icon="heart" color="#FF4D4D" />
        <SettingItem title="댓글 알림" value={settings.commentNoti} onToggle={() => toggleSetting('commentNoti')} icon="chatbubble" color="#3182F6" />
        <SettingItem title="건의 답변 알림" value={settings.suggestionNoti} onToggle={() => toggleSetting('suggestionNoti')} icon="mail" color="#FF9500" />
        <SettingItem title="주요 공지사항 알림" value={settings.majorSuggestionNoti} onToggle={() => toggleSetting('majorSuggestionNoti')} icon="star" color="#FACC15" />

        <Text style={styles.sectionTitle}>사용자 보호 및 사생활</Text>
        <SettingLinkItem 
          title="차단 사용자 관리" 
          icon="shield-alert" 
          color="#6B7684" 
          onPress={() => router.push('../../settings/blocked')} 
        />
        <SettingLinkItem 
          title="숨김 콘텐츠 관리" 
          icon="eye-off" 
          color="#4E5968" 
          onPress={() => router.push('../../settings/hidden')} 
        />

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>학생회 전용 알림</Text>
            <SettingItem title="새 건의 등록 알림" value={settings.newSuggestionNoti} onToggle={() => toggleSetting('newSuggestionNoti')} icon="document-text" color="#82A977" />
            <SettingItem title="회원가입 신청 알림" value={settings.newJoinRequestNoti} onToggle={() => toggleSetting('newJoinRequestNoti')} icon="person-add" color="#6366F1" />
            <SettingItem title="커뮤니티 신고 알림" value={settings.reportNoti} onToggle={() => toggleSetting('reportNoti')} icon="alert-circle" color="#FF4D4D" />
          </>
        )}

        {isMaster && (
          <>
            <Text style={[styles.sectionTitle, { color: '#E03131' }]}>관리자 전용 제어</Text>
            <SettingLinkItem 
              title="신년도 학번 일괄 갱신 관리" 
              icon="calendar-outline" 
              color="#E03131" 
              onPress={() => router.push('../../settings/yearly-update' as any)} 
            />
          </>
        )}

        <Text style={styles.sectionTitle}>계정 권한 관리</Text>
        <View style={[styles.roleContainer, { backgroundColor: theme.card }]}>
          <TouchableOpacity 
            style={[styles.roleButton, user?.role === 'user' && { backgroundColor: theme.accent }]}
            onPress={() => handleRoleChangeRequest('user')}
          >
            <Text style={[styles.roleText, user?.role === 'user' && { color: '#fff' }]}>일반학생</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, user?.role === 'admin' && { backgroundColor: theme.accent }]}
            onPress={() => handleRoleChangeRequest('admin')}
          >
            <Text style={[styles.roleText, user?.role === 'admin' && { color: '#fff' }]}>학생회</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, user?.role === 'master' && { backgroundColor: theme.accent }]}
            onPress={() => handleRoleChangeRequest('master')}
          >
            <Text style={[styles.roleText, user?.role === 'master' && { color: '#fff' }]}>마스터</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>회원 탈퇴</Text>
          </TouchableOpacity>
          <Text style={[styles.versionText, { color: theme.subText }]}>Version 1.0.0</Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={roleModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>권한 변경 인증</Text>
            <Text style={[styles.modalSub, { color: theme.subText }]}>
              {targetRole === 'admin' ? "학생회 전용 비밀번호를 입력해주세요." : "마스터 전용 비밀번호를 입력해주세요."}
            </Text>
            <TextInput 
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Password"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setRoleModalVisible(false); setPasswordInput(''); }}>
                <Text style={{ color: theme.subText }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.accent }]} onPress={confirmRoleChange}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>변경하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    height: 56, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16,
    borderBottomWidth: 1 
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerRightPlaceholder: { width: 32 }, 
  
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#82A977', marginLeft: 24, marginTop: 25, marginBottom: 10, textTransform: 'uppercase' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 0.5 },
  settingLabel: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingTitle: { fontSize: 16, fontWeight: '600' },
  roleContainer: { flexDirection: 'row', marginHorizontal: 20, padding: 6, borderRadius: 15, gap: 6, marginTop: 5 },
  roleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  roleText: { fontSize: 14, fontWeight: '700', color: '#8E8E93' },
  footer: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
  deleteAccountBtn: { padding: 10 },
  deleteAccountText: { color: '#FF4D4D', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline', opacity: 0.8 },
  versionText: { fontSize: 12, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 25 },
  modalContent: { padding: 24, borderRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  modalSub: { fontSize: 14, marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 12 },
  confirmBtn: { flex: 2, padding: 15, alignItems: 'center', borderRadius: 12 }
});
