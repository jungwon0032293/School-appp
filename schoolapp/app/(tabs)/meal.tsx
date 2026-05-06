import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  ActivityIndicator, Platform, Dimensions, useColorScheme 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { useAdmin } from "../_layout";
import { Ionicons } from '@expo/vector-icons'; 

const { width } = Dimensions.get('window');

const SCHOOL_CONFIG = {
  ATPT_OFCDC_SC_CODE: "K10",
  SD_SCHUL_CODE: "7801172",
  API_KEY: "f49e0037c5e94b30b6a2ec8d1c8f4c3a" 
};

export default function MealScreen() {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(false);
  const [mealData, setMealData] = useState<any>(null);
  
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState("");
  const [weekDates, setWeekDates] = useState<string[]>([]);

  // 🎨 요청하신 컬러 설정 반영
  const theme = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    content: isDark ? '#E5E8EB' : '#4E5968',
    btn: isDark ? '#2C2C2C' : '#F1F3F5',
    border: isDark ? '#2C2C2C' : '#F1F3F5',
    // 포인트 컬러: 라이트 556B2F / 다크 869489
    accent: isDark ? '#869489' : '#556B2F',
    // 버튼 컬러: 82A977
    button: '#82A977',
    badgeLunch: isDark ? 'rgba(134, 148, 137, 0.15)' : 'rgba(85, 107, 47, 0.1)',
    badgeDinner: isDark ? 'rgba(255, 184, 0, 0.15)' : '#FFF9E6',
  };

  const formatDate = (date: Date) => {
    const d = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    const current = new Date(baseDate);
    const day = current.getDay(); 
    const diffToMonday = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
    
    const monday = new Date(current);
    monday.setDate(current.getDate() + diffToMonday);

    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(formatDate(d));
    }
    setWeekDates(dates);

    const todayStr = formatDate(new Date());
    if (dates.includes(todayStr)) {
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(dates[0]);
    }
  }, [baseDate]);

  const changeWeek = (offset: number) => {
    const newDate = new Date(baseDate);
    newDate.setDate(baseDate.getDate() + (offset * 7));
    setBaseDate(newDate);
  };

  const fetchNeisMeal = async (date: string) => {
    const formattedDate = date.replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${SCHOOL_CONFIG.API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${SCHOOL_CONFIG.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SCHOOL_CONFIG.SD_SCHUL_CODE}&MLSV_YMD=${formattedDate}`;

    try {
      const response = await fetch(url);
      const json = await response.json();
      if (json.mealServiceDietInfo) {
        const rows = json.mealServiceDietInfo[1].row;
        let lunch: string[] = [];
        let dinner: string[] = [];
        rows.forEach((item: any) => {
          const menu = item.DDISH_NM.replace(/\([^)]*\)/g, "").replace(/<br\/>/g, "\n").split("\n").map((m: string) => m.trim()).filter((m: string) => m !== "");
          if (item.MMEAL_SC_NM === "중식") lunch = menu;
          if (item.MMEAL_SC_NM === "석식") dinner = menu;
        });
        return { lunch, dinner, hasDinner: dinner.length > 0 };
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const loadMeal = async (date: string) => {
    if (!date) return;
    setLoading(true);
    try {
      const docRef = doc(db, "meals", date);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setMealData(docSnap.data());
      } else {
        const neisData = await fetchNeisMeal(date);
        setMealData(neisData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMeal(selectedDate);
    }, [selectedDate])
  );

  const getDayName = (dateStr: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date(dateStr).getDay()];
  };

  const currentMonth = selectedDate ? selectedDate.split('-')[1] : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View>
          <Text style={[styles.monthText, { color: theme.subText }]}>{parseInt(currentMonth)}월</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>오늘의 급식</Text>
        </View>
        {isAdmin && (
          <TouchableOpacity 
            style={[styles.editBtn, { backgroundColor: theme.btn }]} 
            onPress={() => router.push({ pathname: "/admin/edit-meal", params: { date: selectedDate } } as any)}
          >
            <Text style={[styles.editBtnText, { color: theme.content }]}>수정하기</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.dateSelectorContainer, { backgroundColor: theme.card }]}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={() => changeWeek(-1)} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={theme.subText} />
          </TouchableOpacity>
          
          <View style={styles.dateSelector}>
            {weekDates.map((date) => {
              const isSelected = selectedDate === date;
              return (
                <TouchableOpacity 
                  key={date} 
                  style={[
                    styles.dateItem, 
                    isSelected && [styles.selectedDateItem, { backgroundColor: theme.button }]
                  ]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.dateDay, { color: isSelected ? '#fff' : theme.subText }]}>{getDayName(date)}</Text>
                  <Text style={[styles.dateNum, { color: isSelected ? '#fff' : theme.text }]}>{date.split('-')[2]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity onPress={() => changeWeek(1)} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={theme.subText} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 50 }} />
        ) : (
          <View style={styles.cardContainer}>
            <Text style={[styles.infoText, { color: theme.subText }]}>{selectedDate?.replace(/-/g, '.')} {getDayName(selectedDate)}요일</Text>
            
            <View style={[styles.mealCard, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.typeBadge, { backgroundColor: theme.badgeLunch }]}>
                  <Text style={[styles.typeText, { color: theme.accent }]}>점심</Text>
                </View>
              </View>
              <Text style={[styles.mealContent, { color: theme.content }]}>
                {mealData?.lunch?.join(", ") || "오늘은 급식 정보가 없어요."}
              </Text>
            </View>

            {(mealData?.hasDinner || (mealData?.dinner && mealData.dinner.length > 0)) && (
              <View style={[styles.mealCard, { marginTop: 16, backgroundColor: theme.card }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: theme.badgeDinner }]}>
                    <Text style={[styles.typeText, { color: '#FFB800' }]}>저녁</Text>
                  </View>
                </View>
                <Text style={[styles.mealContent, { color: theme.content }]}>
                  {mealData?.dinner?.join(", ") || "저녁 급식 정보가 없습니다."}
                </Text>
              </View>
            )}

            {!mealData && !loading && (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: isDark ? '#444' : '#ADB5BD' }]}>맛있는 급식을 준비 중이에요! 🥣</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingHorizontal: 24, 
    paddingBottom: 10,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end',
  },
  monthText: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginBottom: 4 },
  editBtnText: { fontWeight: '700', fontSize: 13 },

  dateSelectorContainer: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  navBtn: { padding: 10 },
  dateSelector: { flexDirection: 'row', flex: 1, justifyContent: 'space-around' },
  dateItem: { alignItems: 'center', paddingVertical: 10, borderRadius: 18, width: 50 },
  selectedDateItem: { },
  dateDay: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  dateNum: { fontSize: 16, fontWeight: '800' },

  scrollContent: { padding: 24 },
  infoText: { fontSize: 14, marginBottom: 16, fontWeight: '600' },
  cardContainer: { width: '100%' },
  mealCard: { 
    borderRadius: 24, 
    padding: 24, 
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  cardHeader: { flexDirection: 'row', marginBottom: 16 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  typeText: { fontSize: 13, fontWeight: '800' },
  mealContent: { fontSize: 17, lineHeight: 28, fontWeight: '500' },
  emptyState: { marginTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600' }
});
