import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, 
  ActivityIndicator, ScrollView, useColorScheme, SafeAreaView, FlatList 
} from 'react-native';
import { db } from "../../../firebaseConfig";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { useAdmin } from "../../_layout"; 
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Student {
  id: string;
  name: string;
  schoolNum: string;
  isSchoolNumUpdated?: boolean;
}

export default function YearlyUpdateScreen() {
  const router = useRouter();
  const { isMaster } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const theme = {
    background: isDark ? '#111111' : '#F2F4F6',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1F27',
    subText: isDark ? '#9CA3AF' : '#6B7684',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#E03131', 
  };

  useEffect(() => {
    if (isMaster) {
      fetchStudentStatus();
    }
  }, [isMaster]);

  const fetchStudentStatus = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      
      const studentList: Student[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.isGraduated !== true) {
          const resolvedSchoolNum = data.schoolNum || data.studentId;
          const resolvedName = data.name;

          if (!resolvedName || !resolvedSchoolNum || resolvedName.trim() === "" || resolvedSchoolNum.trim() === "") {
            return; 
          }

          studentList.push({
            id: doc.id,
            name: resolvedName,
            schoolNum: resolvedSchoolNum,
            isSchoolNumUpdated: data.isSchoolNumUpdated || false,
          });
        }
      });

      studentList.sort((a, b) => a.schoolNum.localeCompare(b.schoolNum));
      
      setStudents(studentList);
    } catch (error) {
      console.error(error);
      Alert.alert("오류", "학생 현황을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartRequest = () => {
    Alert.alert(
      "⚠️ 신년도 학번 자가 입력 요청",
      "이 작업은 모든 재학생에게 학번 직접 수정을 요청합니다.\n\n• 기존 3학년은 자동으로 졸업 처리됩니다.\n• 1, 2학년은 앱 접속 시 새 학번을 직접 입력해야 합니다.",
      [
        { text: "취소", style: "cancel" },
        { text: "시작하기", style: "destructive", onPress: processInitialization }
      ]
    );
  };

  const processInitialization = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);

      let batch = writeBatch(db);
      let count = 0;

      querySnapshot.forEach((document) => {
        const data = document.data();
        if (data.isGraduated === true) return;

        const userRef = doc(db, "users", document.id);
        const schoolNumStr = String(data.schoolNum || data.studentId || "");
        
        if (!data.name || schoolNumStr === "") return;

        const currentGrade = parseInt(schoolNumStr.substring(0, 1), 10);

        if (currentGrade === 3) {
          batch.update(userRef, {
            isGraduated: true,
            isAdmin: false,
            isMaster: false
          });
        } else {
          batch.update(userRef, {
            isSchoolNumUpdated: false,
            needsUpdate: true
          });
        }

        count++;
        if (count === 490) {
          batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      });

      if (count > 0) await batch.commit();

      Alert.alert("성공", "학번 직접 입력 요청이 활성화되었습니다. 3학년은 졸업 처리되었습니다.");
      await fetchStudentStatus(); 
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "초기화 작업 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => 
    activeTab === 'pending' ? !student.isSchoolNumUpdated : student.isSchoolNumUpdated
  );

  if (!isMaster) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="lock-closed" size={48} color={theme.accent} />
        <Text style={[styles.errorText, { color: theme.text }]}>접근 권한이 없습니다.</Text>
        <TouchableOpacity style={[styles.backBtnLabel, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.back()}>
          <Text style={{ color: theme.text, fontWeight: '600' }}>돌아가기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 헤더 바 */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>신년도 학번 입력 관리</Text>
        <TouchableOpacity onPress={fetchStudentStatus} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.topControlContainer}>
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.warningIconBox, { backgroundColor: theme.accent + '15' }]}>
            <Ionicons name="warning" size={28} color={theme.accent} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>학번 자가 수정 제어 시스템</Text>
          <Text style={[styles.cardDesc, { color: theme.subText }]}>
            버튼을 누르면 전교생에게 본인의 새 학번을 직접 작성하도록 요청 화면을 강제로 띄웁니다. 아래 탭에서 실시간 수정 현황 명단을 파악할 수 있습니다.
          </Text>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.accent }]} 
            onPress={handleStartRequest}
          >
            <Ionicons name="megaphone-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>새 학년 학번 입력 요청 시작</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'pending' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' ? { color: theme.accent, fontWeight: '700' } : { color: theme.subText }]}>
            미수정 학생 ({students.filter(s => !s.isSchoolNumUpdated).length}명)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'completed' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' ? { color: theme.accent, fontWeight: '700' } : { color: theme.subText }]}>
            수정 완료 ({students.filter(s => s.isSchoolNumUpdated).length}명)
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={[styles.studentCard, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
              <View style={styles.studentInfo}>
                <View style={[styles.idBadge, { backgroundColor: isDark ? '#2D2D2D' : '#E9ECEF' }]}>
                  <Text style={[styles.studentNum, { color: isDark ? '#FFF' : '#495057' }]}>{item.schoolNum}</Text>
                </View>
                <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
              </View>
              <View style={[
                styles.statusBadge, 
                { backgroundColor: item.isSchoolNumUpdated ? '#E3F2FD' : '#FFEBEE' }
              ]}>
                <Text style={[
                  styles.statusText, 
                  { color: item.isSchoolNumUpdated ? '#1E88E5' : '#E53935' }
                ]}>
                  {item.isSchoolNumUpdated ? '변경됨' : '대기중'}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={{ color: theme.subText, fontSize: 14 }}>해당 항목에 소속된 학생이 없습니다.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, justifyContent: 'space-between' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  
  topControlContainer: { padding: 20 },
  infoCard: { width: '100%', padding: 20, borderRadius: 18, borderWidth: 1 },
  warningIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 15 },
  
  actionButton: { height: 48, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  tabContainer: { flexDirection: 'row', height: 48, borderBottomWidth: 1 },
  tabButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '600' },
  
  studentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5 },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  idBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 54, alignItems: 'center' },
  studentNum: { fontSize: 13, fontWeight: '700' },
  studentName: { fontSize: 15, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 60, alignItems: 'center' },
  errorText: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 16 },
  backBtnLabel: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5 }
});