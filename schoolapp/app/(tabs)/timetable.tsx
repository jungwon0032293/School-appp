import { View, Text, StyleSheet, TextInput, ScrollView, Platform, useColorScheme, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router'; 
import { db, auth } from "../../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons'; 
// ✅ 수정: 동작하지 않던 expo-widgets(updateSnapshot) 대신 @bacons/apple-targets 사용
import ExtensionStorage from '@bacons/apple-targets';

const widgetStorage = new ExtensionStorage('group.com.ymk.schoolapp');

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const NEIS_API_KEY = 'f49e0037c5e94b30b6a2ec8d1c8f4c3a'; 
const ATPT_CODE = 'K10'; 
const SCHUL_CODE = '7801172'; 

interface TimetableData {
  [key: string]: {
    subject: string;
    room: string;
  };
}

export default function TimetableScreen() {
  const router = useRouter();
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [grade, setGrade] = useState('');
  const [classNm, setClassNm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); 

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    border: isDark ? '#2C2C2E' : '#F1F3F5',
    inputBg: isDark ? '#2C2C2E' : '#F8F9FA',
    inputText: isDark ? '#E5E8EB' : '#4E5968',
    placeholder: isDark ? '#555' : '#ADB5BD',
    accent: isDark? '#869489' : '#556B2F'
  };

  useEffect(() => { 
    loadInitialData(); 
  }, []);

  // 하드코딩된 날짜 대신, 오늘 기준 이번 주 월~금 날짜를 YYYYMMDD로 동적 계산
  const getCurrentWeekDates = (): string[] => {
    const today = new Date();
    const day = today.getDay(); // 0: 일, 1: 월, ..., 6: 토
    const diffToMonday = day === 0 ? 1 : day === 6 ? 2 : 1 - day;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${y}${m}${dd}`);
    }
    return dates;
  };

  // ✅ 수정: widgetStorage.set()으로 값 저장 후 ExtensionStorage.reloadWidget()으로 위젯 새로고침
  const updateWidgetTimetable = (currentTable: TimetableData, currentGrade: string, currentClass: string) => {
    try {
      const dayIndex = new Date().getDay();
      
      const targetDay = (dayIndex >= 1 && dayIndex <= 5) ? DAYS[dayIndex - 1] : '월';
      
      const lines: string[] = [];
      PERIODS.forEach(period => {
        const cell = currentTable[`${targetDay}-${period}`];
        if (cell && cell.subject.trim()) {
          const roomInfo = cell.room.trim() ? ` (${cell.room.trim()})` : '';
          lines.push(`${period}교시: ${cell.subject.trim()}${roomInfo}`);
        }
      });

      const resultString = lines.length > 0 ? lines.join('\n') : '오늘 등록된\n시간표가 없습니다.';
      const headerTitle = currentGrade && currentClass ? `육민관고 ${currentGrade}-${currentClass}` : '오늘의 시간표';

      widgetStorage.set('gradeClass', headerTitle);
      widgetStorage.set('timetableList', resultString);
      ExtensionStorage.reloadWidget();
    } catch (e) {
      console.error("위젯 업데이트 중 오류 발생:", e);
    }
  };

  const loadInitialData = async () => {
    const savedTable = await AsyncStorage.getItem('TIMETABLE');
    const savedGrade = await AsyncStorage.getItem('MY_GRADE');
    const savedClass = await AsyncStorage.getItem('MY_CLASS');
    
    let activeTable = savedTable ? JSON.parse(savedTable) : {};
    let activeGrade = savedGrade || '';
    let activeClass = savedClass || '';

    if (savedTable) setTimetable(activeTable);
    if (savedGrade) setGrade(activeGrade);
    if (savedClass) setClassNm(activeClass);

    const currentUserUid = auth.currentUser?.uid;
    if (currentUserUid) {
      try {
        const userRef = doc(db, "users", currentUserUid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const serverData = userSnap.data();
          if (serverData.timetable) {
            activeTable = serverData.timetable;
            setTimetable(activeTable);
            await AsyncStorage.setItem('TIMETABLE', JSON.stringify(serverData.timetable));
          }
          if (serverData.grade) {
            activeGrade = serverData.grade;
            setGrade(activeGrade);
            await AsyncStorage.setItem('MY_GRADE', serverData.grade);
          }
          if (serverData.classNm) {
            activeClass = serverData.classNm;
            setClassNm(activeClass);
            await AsyncStorage.setItem('MY_CLASS', serverData.classNm);
          }
        }
      } catch (e) {
        console.error("서버 데이터 로드 실패:", e);
      }
    }

    updateWidgetTimetable(activeTable, activeGrade, activeClass);
  };

  const syncTimetableToCloud = async () => {
    const currentUserUid = auth.currentUser?.uid;
    if (!currentUserUid) {
      Alert.alert("인증 필요", "로그인한 사용자만 계정 연동을 사용할 수 있습니다.");
      return;
    }

    setUploading(true);
    try {
      const userRef = doc(db, "users", currentUserUid);
      await setDoc(userRef, {
        timetable: timetable,
        grade: grade.trim(),
        classNm: classNm.trim(),
        timetableUpdatedAt: new Date()
      }, { merge: true });

      Alert.alert("연동 완료", "시간표가 계정에 저장되었습니다. 다른 기기에서도 로그인 시 자동 연동됩니다.");
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "클라우드 저장 도중 문제가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const saveTimetable = async (newTable: TimetableData) => {
    setTimetable(newTable);
    await AsyncStorage.setItem('TIMETABLE', JSON.stringify(newTable));
    updateWidgetTimetable(newTable, grade, classNm);
  };

  const fetchNeisTimetable = async () => {
    if (!grade || !classNm) {
      Alert.alert('입력 확인', '학년과 반을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      let newTable: TimetableData = { ...timetable };
      const weekDates = getCurrentWeekDates();
      let receivedAny = false;

      for (let i = 0; i < weekDates.length; i++) {
        const date = weekDates[i];
        const dayName = DAYS[i];

        const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_CODE}&SD_SCHUL_CODE=${SCHUL_CODE}&ALL_TI_YMD=${date}&GRADE=${grade}&CLASS_NM=${classNm}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.hisTimetable) {
          const rows = data.hisTimetable[1].row;
          rows.forEach((row: any) => {
            newTable[`${dayName}-${row.PERIO}`] = {
              subject: row.ITRT_CNTNT,
              room: newTable[`${dayName}-${row.PERIO}`]?.room ?? ''
            };
          });
          receivedAny = true;
        }
      }

      if (!receivedAny) {
        Alert.alert('알림', '이번 주 시간표 정보를 찾을 수 없어요. 학년/반을 다시 확인해주세요.');
        return;
      }

      await saveTimetable(newTable);
      await AsyncStorage.setItem('MY_GRADE', grade);
      await AsyncStorage.setItem('MY_CLASS', classNm);
      Alert.alert('성공', `${grade}학년 ${classNm}반 시간표로 업데이트되었습니다.\n(클라우드에 연동하려면 오른쪽 위 저장 버튼을 눌러주세요)`);
      
    } catch (error: any) {
      Alert.alert('오류', '데이터를 가져오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updateCell = (key: string, type: 'subject' | 'room', value: string) => {
    const updated = { 
      ...timetable, 
      [key]: { 
        ...(timetable[key] || { subject: '', room: '' }), 
        [type]: value 
      } 
    };
    saveTimetable(updated);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.topNavRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>나의 시간표</Text>
          <TouchableOpacity 
            onPress={syncTimetableToCloud} 
            disabled={uploading}
            style={[styles.cloudSyncBtn, { backgroundColor: theme.accent, opacity: uploading ? 0.6 : 1 }]}
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.cloudSyncBtnText}>{uploading ? '저장 중' : '계정 연동'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.setupRow}>
          <TextInput 
            style={[styles.smallInput, { backgroundColor: theme.inputBg, color: theme.inputText }]}
            placeholder="학년"
            placeholderTextColor={theme.placeholder}
            value={grade}
            onChangeText={setGrade}
            keyboardType="number-pad"
          />
          <TextInput 
            style={[styles.smallInput, { backgroundColor: theme.inputBg, color: theme.inputText }]}
            placeholder="반"
            placeholderTextColor={theme.placeholder}
            value={classNm}
            onChangeText={setClassNm}
            keyboardType="number-pad"
          />
          <TouchableOpacity 
            style={[styles.syncButton,{backgroundColor: '#82A977'}]}
            onPress={fetchNeisTimetable}
          >
            <Text style={styles.syncButtonText}>{loading ? '통신 중...' : '나이스 동기화'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.tableCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.row}>
            <View style={styles.timeLabelCell} />
            {DAYS.map(day => (
              <View key={day} style={styles.dayHeaderCell}>
                <Text style={[styles.dayHeaderText, { color: theme.subText }]}>{day}</Text>
              </View>
            ))}
          </View>

          {PERIODS.map(period => (
            <View key={period} style={styles.row}>
              <View style={styles.timeLabelCell}>
                <Text style={styles.periodText}>{period}</Text>
              </View>
              {DAYS.map(day => {
                const key = `${day}-${period}`;
                const cellData = timetable[key] || { subject: '', room: '' };
                const hasData = !!cellData.subject;

                return (
                  <View key={key} style={styles.cellContainer}>
                    <View style={[
                      styles.verticalCell,
                      { backgroundColor: theme.inputBg },
                      hasData && { borderColor: theme.accent, borderWidth: 1, backgroundColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#fff' }
                    ]}>
                      <TextInput
                        style={[
                          styles.subjectInput, 
                          { color: hasData ? theme.accent : theme.inputText, fontWeight: hasData ? '800' : '600' }
                        ]}
                        value={cellData.subject}
                        onChangeText={text => updateCell(key, 'subject', text)}
                        textAlign="center"
                        placeholder="과목"
                        placeholderTextColor={theme.placeholder}
                      />
                      <TextInput
                        style={[styles.roomInput, { color: theme.subText }]}
                        value={cellData.room}
                        onChangeText={text => updateCell(key, 'room', text)}
                        textAlign="center"
                        placeholder="교실"
                        placeholderTextColor={theme.placeholder}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        
        <View style={styles.infoBox}>
          <Text style={[styles.infoText, { color: theme.subText }]}>
            💡 2·3학년 공통과목 외 <Text style={{fontWeight: '800', color: theme.accent}}>선택과목 시간표</Text>는 직접 입력해주세요.
          </Text>
          <Text style={[styles.subInfoText, { color: theme.placeholder, marginTop: 4 }]}>
            기기에 자동 저장되며, 상단 [계정 연동] 버튼 클릭 시 실시간 동기화됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 55 : 15, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  topNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  navButton: { padding: 4, marginLeft: -8 },
  headerTitle: { fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 6 },
  cloudSyncBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15 },
  cloudSyncBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  setupRow: { flexDirection: 'row', gap: 8 },
  smallInput: { width: 60, height: 44, borderRadius: 12, textAlign: 'center', fontWeight: '600', fontSize: 16 },
  syncButton: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  syncButtonText: { color: '#fff', fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 40 },
  tableCard: { borderRadius: 20, padding: 8, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timeLabelCell: { width: 25, alignItems: 'center' },
  periodText: { fontSize: 12, fontWeight: '700', color: '#ADB5BD' },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayHeaderText: { fontSize: 13, fontWeight: '800' },
  cellContainer: { flex: 1, paddingHorizontal: 2 },
  verticalCell: { height: 70, borderRadius: 10, justifyContent: 'center', paddingVertical: 4 },
  subjectInput: { flex: 1.5, fontSize: 12, padding: 0 },
  roomInput: { flex: 1, fontSize: 10, fontWeight: '500', padding: 0 },
  infoBox: { marginTop: 24, alignItems: 'center', paddingHorizontal: 20 },
  infoText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  subInfoText: { fontSize: 11, fontWeight: '400' }
});