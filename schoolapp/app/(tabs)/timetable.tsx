import { View, Text, StyleSheet, TextInput, ScrollView, Platform, useColorScheme, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

// 설정값
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
  const [timetable, setTimetable] = useState<TimetableData>({});
  const [grade, setGrade] = useState('');
  const [classNm, setClassNm] = useState('');
  const [loading, setLoading] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    border: isDark ? '#2C2C2C' : '#F1F3F5',
    inputBg: isDark ? '#2C2C2C' : '#F8F9FA',
    inputText: isDark ? '#E5E8EB' : '#4E5968',
    placeholder: isDark ? '#555' : '#ADB5BD',
    accent: isDark? '#869489' : '#556B2F'
  };

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    const savedTable = await AsyncStorage.getItem('TIMETABLE');
    const savedGrade = await AsyncStorage.getItem('MY_GRADE');
    const savedClass = await AsyncStorage.getItem('MY_CLASS');
    if (savedTable) setTimetable(JSON.parse(savedTable));
    if (savedGrade) setGrade(savedGrade);
    if (savedClass) setClassNm(savedClass);
  };

  const saveTimetable = async (newTable: TimetableData) => {
    setTimetable(newTable);
    await AsyncStorage.setItem('TIMETABLE', JSON.stringify(newTable));
  };

  const fetchNeisTimetable = async () => {
    if (!grade || !classNm) {
      Alert.alert('입력 확인', '학년과 반을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      let newTable: TimetableData = {};
      const testDates = ["20260309", "20260310", "20260311", "20260312", "20260313"];

      for (let i = 0; i < testDates.length; i++) {
        const date = testDates[i];
        const dayName = DAYS[i];

        const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_CODE}&SD_SCHUL_CODE=${SCHUL_CODE}&ALL_TI_YMD=${date}&GRADE=${grade}&CLASS_NM=${classNm}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.hisTimetable) {
          const rows = data.hisTimetable[1].row;
          rows.forEach((row: any) => {
            newTable[`${dayName}-${row.PERIO}`] = {
              subject: row.ITRT_CNTNT,
              room: '' // 교실 정보는 수동 입력을 위해 비워둠
            };
          });
        }
      }

      await saveTimetable(newTable);
      await AsyncStorage.setItem('MY_GRADE', grade);
      await AsyncStorage.setItem('MY_CLASS', classNm);
      Alert.alert('성공', `${grade}학년 ${classNm}반 시간표로 업데이트되었습니다.`);
      
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>나의 시간표</Text>
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
            입력한 내용은 기기 내에 자동으로 저장됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 20, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', marginBottom: 15 },
  setupRow: { flexDirection: 'row', gap: 8 },
  smallInput: { width: 60, height: 44, borderRadius: 12, textAlign: 'center', fontWeight: '600', fontSize: 16 },
  syncButton: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor : '#64748B' },
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
