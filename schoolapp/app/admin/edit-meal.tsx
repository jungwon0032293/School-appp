import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, useColorScheme 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from "../../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function EditMealScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams(); 
  const colorScheme = useColorScheme(); 
  const isDark = colorScheme === 'dark';
  
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#4E5968',
    inputBg: isDark ? '#2C2C2C' : '#F8F9FA',
    border: isDark ? '#2C2C2C' : '#F1F3F5',
    headerBg: isDark ? '#1E1E1E' : '#fff',
    badge: isDark ? '#333' : '#E9ECEF',
    guide: isDark ? '#1E1E1E' : '#F1F3F5',
    accent: isDark ? '#869489' : '#556B2F',
    button: '#82A977',
  };

  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    if (!date) return;
    setFetching(true);
    try {
      const docSnap = await getDoc(doc(db, "meals", date as string));
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLunch(data.lunch?.join(", ") || '');
        setDinner(data.dinner?.join(", ") || '');
      } else {
        await fetchNiceApiData();
      }
    } catch (e) { 
      console.error(e); 
    } finally {
      setFetching(false);
    }
  };

  const fetchNiceApiData = async () => {
    try {
      const formattedDate = (date as string).replace(/-/g, '');
      const API_KEY = "f49e0037c5e94b30b6a2ec8d1c8f4c3a";
      const ATPT_OFCDC_SC_CODE = "K10";
      const SD_SCHUL_CODE = "7801172";
      const URL = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${formattedDate}`;

      const response = await fetch(URL);
      const json = await response.json();

      if (json.mealServiceDietInfo) {
        const meals = json.mealServiceDietInfo[1].row;
        meals.forEach((item: any) => {
          const cleanMeal = item.DDISH_NM.replace(/[0-9.()]/g, "").replace(/\s+/g, " ").replace(/<br\/>/g, ", ");
          
          if (item.MMEAL_SC_NM === "중식") {
            setLunch(cleanMeal);
          } else if (item.MMEAL_SC_NM === "석식") {
            setDinner(cleanMeal);
          }
        });
      }
    } catch (error) {
      console.log("나이스 API 로드 실패:", error);
    }
  };

  const handleSave = async () => {
    if (!lunch.trim()) return Alert.alert("알림", "중식 메뉴는 반드시 입력해야 합니다.");

    setLoading(true);
    try {
      const lunchArray = lunch.split(',').map(item => item.trim()).filter(item => item !== "");
      const dinnerArray = dinner.split(',').map(item => item.trim()).filter(item => item !== "");

      await setDoc(doc(db, "meals", date as string), {
        lunch: lunchArray,
        dinner: dinnerArray,
        hasDinner: dinnerArray.length > 0,
        date: date
      });

      Alert.alert("저장 완료", "급식 정보가 성공적으로 반영되었습니다.", [
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
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: isDark ? '#fff' : '#4E5968' }]}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>급식 관리</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.button} />
            ) : (
              <Text style={[styles.saveBtnText, { color: theme.button }]}>저장</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.dateBadge, { backgroundColor: theme.badge }]}>
              <Text style={[styles.dateText, { color: theme.subText }]}>{date} 식단 수정</Text>
            </View>
            
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>☀️</Text>
                <Text style={[styles.cardLabel, { color: theme.text }]}>오늘의 중식</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
                placeholder="메뉴를 쉼표(,)로 구분해 주세요.&#10;예) 쌀밥, 미역국, 제육볶음"
                placeholderTextColor={isDark ? "#555" : "#ADB5BD"}
                multiline
                value={lunch}
                onChangeText={setLunch}
              />
            </View>

            <View style={[styles.card, { marginTop: 20, backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>🌙</Text>
                <Text style={[styles.cardLabel, { color: theme.text }]}>오늘의 석식</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
                placeholder="석식이 없는 경우 비워두세요."
                placeholderTextColor={isDark ? "#555" : "#ADB5BD"}
                multiline
                value={dinner}
                onChangeText={setDinner}
              />
            </View>

            <View style={[styles.guideBox, { backgroundColor: theme.guide }]}>
              <Text style={[styles.guideTitle, { color: theme.subText }]}>💡 작성 가이드</Text>
              <Text style={[styles.guideText, { color: isDark ? '#777' : '#8B95A1' }]}>• 메뉴 사이는 반드시 쉼표(,)를 넣어주세요.</Text>
              <Text style={[styles.guideText, { color: isDark ? '#777' : '#8B95A1' }]}>• 석식을 비워두면 앱에서 자동으로 '석식 없음'으로 표시됩니다.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingHorizontal: 24, 
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22 },
  saveBtn: { paddingHorizontal: 4 },
  saveBtnText: { fontSize: 17, fontWeight: '700' },
  scrollContent: { padding: 24 },
  dateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 20,
  },
  dateText: { fontSize: 13, fontWeight: '700' },
  card: { 
    borderRadius: 24, 
    padding: 24,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 12, 
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardEmoji: { fontSize: 18, marginRight: 8 },
  cardLabel: { fontSize: 16, fontWeight: '700' },
  input: { 
    fontSize: 16, 
    minHeight: 120, 
    textAlignVertical: 'top',
    lineHeight: 24,
    borderRadius: 16,
    padding: 16
  },
  guideBox: { 
    marginTop: 24, 
    padding: 20, 
    borderRadius: 20 
  },
  guideTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  guideText: { fontSize: 13, marginBottom: 4, lineHeight: 18 }
});
