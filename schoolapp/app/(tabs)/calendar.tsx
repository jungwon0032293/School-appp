import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, Modal, 
  TextInput, TouchableOpacity, Alert, Keyboard, TouchableWithoutFeedback,
  Platform, ScrollView, useColorScheme, Dimensions
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from 'expo-router'; 
import { db } from "../../firebaseConfig";
import { collection, getDocs, query, addDoc, serverTimestamp, where, doc, updateDoc, deleteDoc, orderBy, writeBatch } from "firebase/firestore";
import { useAdmin } from "../_layout";
import * as Application from 'expo-application'; 
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DATE_HEADER_HEIGHT = 21; 
const EVENT_CARD_HEIGHT = 80;  
const GROUP_MARGIN_BOTTOM = 20;

LocaleConfig.locales['kr'] = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'], 
  today: '오늘'
};
LocaleConfig.defaultLocale = 'kr';

interface Subject { id: string; name: string; grade: string; }
interface Event { id: string; date: string; title: string; type: 'school' | 'personal' | 'subject'; userId?: string; subjectName?: string; grade?: string; isNotified?: boolean; }

export default function CalendarScreen() {
  const router = useRouter(); 
  const { isAdmin } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const flatListRef = useRef<FlatList>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [eventType, setEventType] = useState<'school' | 'personal' | 'subject'>('personal');
  const [isListView, setIsListView] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isAddingNewSubject, setIsAddingNewSubject] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterGradeTab, setFilterGradeTab] = useState('1');
  const [selectedFilterSubjects, setSelectedFilterSubjects] = useState<string[]>([]); 
  
  const [showOnlyNotified, setShowOnlyNotified] = useState(false);

  const themeColors = {
    bg: isDark ? '#121212' : '#F8F9FA',
    card: isDark ? '#1E1E1E' : '#fff',
    text: isDark ? '#FFFFFF' : '#191F28',
    subText: isDark ? '#A0A0A0' : '#8B95A1',
    inputBg: isDark ? '#2C2C2C' : '#F8F9FA',
    border: isDark ? '#333333' : '#F1F3F5',
    ddayBadge: isDark ? '#86948920' : '#556B2F10',
    ddayText: isDark ? '#869489' : '#556B2F',
  };

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem('selectedFilterSubjects');
        if (saved) setSelectedFilterSubjects(JSON.parse(saved));
      } catch (e) { console.error(e); }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('selectedFilterSubjects', JSON.stringify(selectedFilterSubjects));
  }, [selectedFilterSubjects]);

  const fetchNeisEventsRange = async () => {
    const years = [2025, 2026, 2027];
    const API_KEY = "f49e0037c5e94b30b6a2ec8d1c8f4c3a";
    const ATPT_OFCDC_SC_CODE = "K10"; 
    const SD_SCHUL_CODE = "7801172"; 

    try {
      for (const year of years) {
        for (let month = 1; month <= 12; month++) {
          const formattedMonth = month < 10 ? `0${month}` : `${month}`;
          const targetYm = `${year}${formattedMonth}`;
          const response = await fetch(`https://open.neis.go.kr/hub/SchoolSchedule?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AA_YMD=${targetYm}`);
          const data = await response.json();
          if (data.SchoolSchedule) {
            const neisList = data.SchoolSchedule[1].row;
            const batch = writeBatch(db);
            for (const item of neisList) {
              const date = `${item.AA_YMD.substring(0,4)}-${item.AA_YMD.substring(4,6)}-${item.AA_YMD.substring(6,8)}`;
              const q = query(collection(db, "events"), where("date", "==", date), where("title", "==", item.EVENT_NM));
              const snap = await getDocs(q);
              if (snap.empty) {
                const newDocRef = doc(collection(db, "events"));
                batch.set(newDocRef, { title: item.EVENT_NM, date: date, type: 'school', createdAt: serverTimestamp() });
              }
            }
            await batch.commit();
          }
        }
      }
      loadEvents();
    } catch (e) { console.log("NEIS API Error:", e); }
  };

  useEffect(() => {
    fetchNeisEventsRange();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const fetched: Event[] = [];
      const deviceId = await getDeviceId();
      const schoolSnap = await getDocs(collection(db, "events"));
      schoolSnap.forEach((doc) => fetched.push({ id: doc.id, ...doc.data(), type: 'school' } as Event));
      const personalSnap = await getDocs(query(collection(db, "user_events"), where("userId", "==", deviceId)));
      personalSnap.forEach((doc) => fetched.push({ id: doc.id, ...doc.data(), type: 'personal' } as Event));
      const subjectSnap = await getDocs(collection(db, "subject_events"));
      subjectSnap.forEach((doc) => fetched.push({ id: doc.id, ...doc.data(), type: 'subject' } as Event));
      setEvents(fetched);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { loadEvents(); }, [isAdmin, isDark]));

  const loadSubjectsByGrade = async (grade: string) => {
    try {
      const q = query(collection(db, "subjects"), where("grade", "==", grade), orderBy("name"));
      const snap = await getDocs(q);
      const list: Subject[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(list);
    } catch (e) { setSubjects([]); }
  };

  const handleDeleteSubject = (subject: Subject) => {
    Alert.alert("과목 삭제", `"${subject.name}" (${subject.grade}학년) 과목과 관련된 모든 일정이 삭제됩니다.`, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, "subjects", subject.id));
            const q = query(collection(db, "subject_events"), where("subjectName", "==", subject.name), where("grade", "==", subject.grade));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
            const otherGradeHasSameSubject = events.some(e => e.type === 'subject' && e.subjectName === subject.name && e.grade !== subject.grade);
            if (!otherGradeHasSameSubject) setSelectedFilterSubjects(prev => prev.filter(name => name !== subject.name));
            loadSubjectsByGrade(selectedGrade); loadEvents();
          } catch (e) { Alert.alert("오류", "삭제에 실패했습니다."); }
      }}
    ]);
  };

  useEffect(() => {
    if (modalVisible && eventType === 'subject') loadSubjectsByGrade(selectedGrade);
  }, [selectedGrade, eventType, modalVisible]);

  const getDeviceId = async () => {
    return Platform.OS === 'ios' ? await Application.getIosIdForVendorAsync() : Application.getAndroidId();
  };

  const calculateDday = (targetDate: string) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(targetDate); target.setHours(0,0,0,0);
    const diff = target.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
  };

  const markedDates = useMemo(() => {
    const marks: any = {};
    events.forEach(event => {
      if (event.type === 'subject' && (!event.subjectName || !selectedFilterSubjects.includes(event.subjectName))) return;
      if (showOnlyNotified && !event.isNotified) return;

      if (!marks[event.date]) marks[event.date] = { dots: [] };
      let dotColor = event.type === 'school' ? (isDark ? '#869489' : '#556B2F') : event.type === 'subject' ? '#82A977' : '#B0B8C1';
      marks[event.date].dots.push({ key: event.id, color: dotColor });
    });
    marks[selectedDate] = { ...marks[selectedDate], selected: true };
    return marks;
  }, [events, selectedFilterSubjects, selectedDate, isDark, showOnlyNotified]);

  const allAvailableSubjects = useMemo(() => {
    const subs: {name: string, grade: string}[] = [];
    events.forEach(e => {
      if (e.type === 'subject' && e.subjectName && e.grade && !subs.find(s => s.name === e.subjectName && s.grade === e.grade)) subs.push({ name: e.subjectName, grade: e.grade });
    });
    return subs.sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  const handleSaveEvent = async () => {
    if (!newTitle.trim()) return Alert.alert("내용 입력", "일정 제목을 입력해주세요.");
    if (eventType === 'subject' && !selectedSubject.trim()) return Alert.alert("과목 선택", "과목을 선택하거나 입력해주세요.");
    try {
      const deviceId = await getDeviceId();
      let finalSubject = selectedSubject.trim();
      if (eventType === 'subject' && !subjects.find(s => s.name === finalSubject)) await addDoc(collection(db, "subjects"), { name: finalSubject, grade: selectedGrade });
      if (editingEvent) {
        const coll = editingEvent.type === 'school' ? "events" : editingEvent.type === 'personal' ? "user_events" : "subject_events";
        await updateDoc(doc(db, coll, editingEvent.id), { title: newTitle.trim() });
      } else {
        let coll = eventType === 'school' ? "events" : eventType === 'subject' ? "subject_events" : "user_events";
        const eventData: any = { title: newTitle.trim(), date: selectedDate, createdAt: serverTimestamp(), type: eventType, userId: deviceId };
        if (eventType === 'subject') { eventData.subjectName = finalSubject; eventData.grade = selectedGrade; }
        await addDoc(collection(db, coll), eventData);
      }
      closeModal(); loadEvents();
    } catch (e) { Alert.alert("오류", "실패했습니다."); }
  };

  const openEditModal = async (event: Event) => {
    const deviceId = await getDeviceId();
    const hasPermission = isAdmin || (event.userId === deviceId);
    const options: any[] = [{ text: "닫기", style: "cancel" }];
    
    options.unshift({ 
      text: event.isNotified ? "알림 해제" : "알림 설정", 
      onPress: async () => {
        const coll = event.type === 'school' ? "events" : event.type === 'personal' ? "user_events" : "subject_events";
        await updateDoc(doc(db, coll, event.id), { isNotified: !event.isNotified });
        loadEvents();
      }
    });

    if (hasPermission) {
      options.unshift(
        { text: "수정", onPress: () => { setEditingEvent(event); setNewTitle(event.title); setEventType(event.type); if(event.type === 'subject') { setSelectedGrade(event.grade || '1'); setSelectedSubject(event.subjectName || ''); } setModalVisible(true); }},
        { text: "삭제", style: "destructive", onPress: async () => { const coll = event.type === 'school' ? "events" : event.type === 'personal' ? "user_events" : "subject_events"; await deleteDoc(doc(db, coll, event.id)); loadEvents(); }}
      );
    }
    Alert.alert("일정 관리", `"${event.title}"`, options);
  };

  const closeModal = () => { setModalVisible(false); setEditingEvent(null); setNewTitle(''); setEventType('personal'); setSelectedSubject(''); setIsAddingNewSubject(false); };

  const groupedData = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const baseEvents = isListView ? [...events].sort((a, b) => a.date.localeCompare(b.date)) : events.filter(e => e.date === selectedDate);
    
    const filtered = baseEvents.filter(event => {
      const subjectMatch = event.type === 'subject' ? (event.subjectName && selectedFilterSubjects.includes(event.subjectName)) : true;
      const notiMatch = showOnlyNotified ? event.isNotified === true : true;
      return subjectMatch && notiMatch;
    });
    
    const groups = filtered.reduce((acc: any, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});

    const sortedDates = Object.keys(groups).sort();
    let initialIndex = 0;
    if (isListView) {
      const idx = sortedDates.findIndex(date => date >= todayStr);
      initialIndex = idx === -1 ? 0 : idx;
    }

    return { 
      list: sortedDates.map(date => ({ date, events: groups[date] })),
      initialIndex 
    };
  }, [events, isListView, selectedDate, selectedFilterSubjects, showOnlyNotified]);

  useEffect(() => {
    if (isListView && groupedData.list.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: groupedData.initialIndex,
          animated: false,
          viewPosition: 0
        });
      }, 50);
    }
  }, [isListView, groupedData.initialIndex]);

  const renderGroupItem = ({ item }: { item: { date: string, events: Event[] } }) => (
    <View style={styles.dateGroup}>
      {isListView && <Text style={[styles.groupDateHeader, { color: isDark ? '#869489' : '#556B2F' }]}>{item.date.replace(/-/g, '.')}</Text>}
      {item.events.map((event) => (
        <TouchableOpacity key={event.id} style={[styles.eventCard, { backgroundColor: themeColors.card }]} onPress={() => openEditModal(event)} activeOpacity={0.7}>
          <View style={[styles.typeIndicator, {backgroundColor: event.type === 'school' ? (isDark ? '#869489' : '#556B2F') : event.type === 'subject' ? '#82A977' : (isDark ? '#444' : '#E5E8EB')}]} />
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <Text style={[styles.eventTitle, { color: themeColors.text }]}>{event.title}</Text>
              {event.isNotified && <Ionicons name="notifications" size={12} color="#82A977" />}
            </View>
            <Text style={[styles.typeText, { color: themeColors.subText }]}>{event.type === 'school' ? "학교 소식" : event.type === 'subject' ? `[${event.grade}학년] ${event.subjectName}` : "개인 일정"}</Text>
          </View>
          <View style={[styles.ddayBadge, { backgroundColor: themeColors.ddayBadge }]}><Text style={[styles.ddayText, { color: themeColors.ddayText }]}>{calculateDday(event.date)}</Text></View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const handleToggleAllFilter = () => {
    const currentGradeSubjects = allAvailableSubjects.filter(s => s.grade === filterGradeTab).map(s => s.name);
    const isAllSelected = currentGradeSubjects.every(name => selectedFilterSubjects.includes(name));
    setSelectedFilterSubjects(prev => isAllSelected ? prev.filter(name => !currentGradeSubjects.includes(name)) : Array.from(new Set([...prev, ...currentGradeSubjects])));
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
      
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>일정 관리</Text>
            <Text style={[styles.headerSubTitle, { color: themeColors.subText }]} numberOfLines={1}>
              {showOnlyNotified ? "🔔 알림 설정된 일정" : (isListView ? "전체 일정" : "학년별 과목 및 나의 일정")}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setFilterModalVisible(true)}>
            <Ionicons name="filter" size={18} color={selectedFilterSubjects.length === 0 && !showOnlyNotified ? themeColors.subText : '#82A977'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => setIsListView(!isListView)}><Text style={styles.iconText}>{isListView ? "📅" : "☰"}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: themeColors.inputBg }]} onPress={() => { setEditingEvent(null); setModalVisible(true); }}><Text style={styles.addBtnText}>추가</Text></TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={groupedData.list}
        keyExtractor={(item) => item.date}
        renderItem={renderGroupItem}
        getItemLayout={(data, index) => {
          if (!data || !data[index]) return { length: 0, offset: 0, index };
          const items = data as any[];
          const offset = items.slice(0, index).reduce((acc:number, item: any ) => {
            return acc + DATE_HEADER_HEIGHT + (item.events.length * EVENT_CARD_HEIGHT) + GROUP_MARGIN_BOTTOM;
          }, 0);
          const length = DATE_HEADER_HEIGHT + (data[index].events.length * EVENT_CARD_HEIGHT) + GROUP_MARGIN_BOTTOM;
          return { length, offset, index };
        }}
        onScrollToIndexFailed={(info) => {
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        }}
        contentContainerStyle={styles.eventListContainer}
        ListHeaderComponent={
          !isListView ? (
            <View style={[styles.calendarCard, { backgroundColor: themeColors.card, marginHorizontal: -24, marginTop: -24, marginBottom: 24 }]}>
              <Calendar onDayPress={(day: any) => setSelectedDate(day.dateString)} markingType={'multi-dot'} markedDates={markedDates} 
                theme={{
                  backgroundColor: themeColors.card, calendarBackground: themeColors.card,
                  selectedDayBackgroundColor: isDark ? '#869489' : '#556B2F', todayTextColor: isDark ? '#869489' : '#556B2F',
                  dayTextColor: themeColors.text, monthTextColor: themeColors.text,
                  arrowColor: themeColors.text, textDisabledColor: isDark ? '#444' : '#E5E8EB',
                  selectedDayTextColor: '#ffffff', textDayHeaderFontSize: 13, textDayHeaderFontWeight: '600'
                }}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={loading ? <ActivityIndicator size="small" color={isDark ? '#869489' : '#556B2F'} style={{marginTop: 50}} /> : <Text style={[styles.emptyText, { color: isDark ? '#555' : '#ADB5BD' }]}>{showOnlyNotified ? "알림 설정된 일정이 없어요." : "등록된 일정이 없어요."}</Text>}
      />

      <Modal visible={modalVisible} animationType="fade" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}><View style={styles.modalOverlay}><View style={[styles.modalView, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>{editingEvent ? "일정 수정" : "새 일정 추가"}</Text>
          <View style={[styles.typeSelector, { backgroundColor: themeColors.inputBg }]}>
            {isAdmin && <TouchableOpacity style={[styles.typeOpt, eventType === 'school' && [styles.typeActive, {backgroundColor: themeColors.card}]]} onPress={() => setEventType('school')}><Text style={[styles.typeOptText, { color: eventType === 'school' ? '#82A977' : (isDark ? '#A0A0A0' : '#8B95A1') }]}>🏫 학사</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.typeOpt, eventType === 'subject' && [styles.typeActive, {backgroundColor: themeColors.card}]]} onPress={() => setEventType('subject')}><Text style={[styles.typeOptText, { color: eventType === 'subject' ? '#82A977' : (isDark ? '#A0A0A0' : '#8B95A1') }]}>📚 과목</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.typeOpt, eventType === 'personal' && [styles.typeActive, {backgroundColor: themeColors.card}]]} onPress={() => setEventType('personal')}><Text style={[styles.typeOptText, { color: eventType === 'personal' ? '#82A977' : (isDark ? '#A0A0A0' : '#8B95A1') }]}>👤 개인</Text></TouchableOpacity>
          </View>
          {eventType === 'subject' && (
            <View style={{ marginBottom: 15, paddingHorizontal: 26 }}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 15 }}>{['1', '2', '3'].map(g => (<TouchableOpacity key={g} onPress={() => { setSelectedGrade(g); setSelectedSubject(''); }} style={[styles.gradeBtn, { backgroundColor: selectedGrade === g ? '#82A977' : themeColors.inputBg, borderColor: selectedGrade === g ? '#82A977' : 'transparent' }]}><Text style={{ color: selectedGrade === g ? '#fff' : themeColors.subText, fontWeight: '700', fontSize: 12 }}>{g}학년</Text></TouchableOpacity>))}</View>
              {isAddingNewSubject ? (<View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><TextInput style={[styles.input, { flex: 1, marginBottom: 0, paddingVertical: 8, paddingHorizontal: 12, fontSize: 14, marginHorizontal: 0, color: themeColors.text }]} placeholder="과목명" placeholderTextColor={isDark ? "#666" : "#ADB5BD"} value={selectedSubject} onChangeText={setSelectedSubject} autoFocus /><TouchableOpacity onPress={() => setIsAddingNewSubject(false)}><Ionicons name="close-circle" size={24} color={themeColors.subText}/></TouchableOpacity></View>) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>{subjects.map(s => (<TouchableOpacity key={s.id} onPress={() => setSelectedSubject(s.name)} onLongPress={() => isAdmin && handleDeleteSubject(s)} style={[styles.subjectTag, { borderColor: selectedSubject === s.name ? '#82A977' : themeColors.border, backgroundColor: selectedSubject === s.name ? '#82A97720' : 'transparent' }]}><Text style={{ color: selectedSubject === s.name ? '#82A977' : themeColors.subText, fontSize: 11, fontWeight: selectedSubject === s.name ? '700' : '500' }}>{s.name}</Text></TouchableOpacity>))}<TouchableOpacity onPress={() => setIsAddingNewSubject(true)} style={[styles.addSubjectTag, { borderColor: themeColors.border }]}><Text style={{ color: themeColors.subText, fontSize: 11 }}>+ 추가</Text></TouchableOpacity></View>
              )}
            </View>
          )}
          <TextInput style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.text }]} placeholder="내용을 입력해주세요" placeholderTextColor={isDark ? "#666" : "#ADB5BD"} value={newTitle} onChangeText={setNewTitle} />
          <View style={[styles.modalBtns, { paddingHorizontal: 26 }]}><TouchableOpacity onPress={closeModal} style={styles.cancelBtn}><Text style={[styles.cancelBtnText, { color: themeColors.subText }]}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSaveEvent} style={[styles.saveBtn, { backgroundColor: '#82A977' }]}><Text style={styles.saveBtnText}>저장하기</Text></TouchableOpacity></View>
        </View></View></TouchableWithoutFeedback>
      </Modal>

      <Modal visible={filterModalVisible} animationType="slide" transparent><View style={styles.modalOverlay}><View style={[styles.modalView, { backgroundColor: themeColors.card, maxHeight: '80%', paddingHorizontal: 0 }]}>
        <Text style={[styles.modalTitle, { color: themeColors.text, paddingHorizontal: 26, marginBottom: 5 }]}>필터링 설정</Text>
        
        <View style={[styles.typeSelector, { backgroundColor: themeColors.inputBg, marginVertical: 15 }]}>
          <TouchableOpacity style={[styles.typeOpt, !showOnlyNotified && [styles.typeActive, {backgroundColor: themeColors.card}]]} onPress={() => setShowOnlyNotified(false)}>
            <Text style={[styles.typeOptText, { color: !showOnlyNotified ? '#82A977' : themeColors.subText }]}>전체 보기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeOpt, showOnlyNotified && [styles.typeActive, {backgroundColor: themeColors.card}]]} onPress={() => setShowOnlyNotified(true)}>
            <Text style={[styles.typeOptText, { color: showOnlyNotified ? '#82A977' : themeColors.subText }]}>🔔 알림 일정만</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.filterGradeTabs, { borderBottomColor: themeColors.border }]}>{['1', '2', '3'].map(g => (<TouchableOpacity key={g} onPress={() => setFilterGradeTab(g)} style={[styles.filterGradeTab, filterGradeTab === g && { borderBottomColor: '#82A977' }]}><Text style={[styles.filterGradeTabText, { color: filterGradeTab === g ? '#82A977' : themeColors.subText }]}>{g}학년</Text></TouchableOpacity>))}</View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 16 }}>{allAvailableSubjects.filter(s => s.grade === filterGradeTab).map(s => { const isSelected = selectedFilterSubjects.includes(s.name); return (
          <TouchableOpacity key={`${s.grade}-${s.name}`} onPress={() => setSelectedFilterSubjects(prev => isSelected ? prev.filter(p => p !== s.name) : [...prev, s.name])} style={[styles.filterItemRow, { borderBottomColor: themeColors.border }]}><Text style={[styles.filterItemText, { color: isSelected ? '#82A977' : themeColors.text }]}>{s.name}</Text><Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? '#82A977' : themeColors.subText} /></TouchableOpacity>
        ); })}</ScrollView>
        <View style={[styles.modalBtns, { paddingHorizontal: 26, marginTop: 20, paddingBottom: 26 }]}><TouchableOpacity onPress={handleToggleAllFilter} style={styles.cancelBtn}><Text style={{ color: themeColors.subText, fontWeight: '700' }}>{allAvailableSubjects.filter(s => s.grade === filterGradeTab).every(name => selectedFilterSubjects.includes(name.name)) ? "전체 해제" : "전체 선택"}</Text></TouchableOpacity><TouchableOpacity onPress={() => setFilterModalVisible(false)} style={[styles.saveBtn, { backgroundColor: '#82A977' }]}><Text style={styles.saveBtnText}>확인</Text></TouchableOpacity></View>
      </View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    paddingTop: Platform.OS === 'ios' ? 55 : 15, 
    paddingHorizontal: 20, 
    paddingBottom: 16, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomWidth: 1 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  navButton: { padding: 4, marginLeft: -8, marginRight: 4 },
  titleContainer: { flexDirection: 'column', maxWidth: SCREEN_WIDTH * 0.45 }, // 가로 폭 확보 및 텍스트 말림 방지
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSubTitle: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 18, color: '#82A977' },
  addBtn: { height: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#82A977', fontWeight: '800', fontSize: 14 },
  calendarCard: { paddingBottom: 10, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 2 },
  eventListContainer: { padding: 24 },
  dateGroup: { marginBottom: GROUP_MARGIN_BOTTOM },
  groupDateHeader: { fontSize: 13, fontWeight: '800', height: DATE_HEADER_HEIGHT },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, height: 72, marginBottom: 8, elevation: 1 },
  typeIndicator: { width: 3, height: 20, marginRight: 12, borderRadius: 2 },
  eventTitle: { fontSize: 15, fontWeight: '700' },
  typeText: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  ddayBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ddayText: { fontSize: 11, fontWeight: '800' },
  emptyText: { textAlign: 'center', marginTop: 30, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalView: { width: '85%', paddingVertical: 20, borderRadius: 25 },
  modalTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 15 },
  typeSelector: { flexDirection: 'row', marginBottom: 15, borderRadius: 12, padding: 3, marginHorizontal: 26 },
  typeOpt: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  typeActive: { shadowOpacity: 0.1, elevation: 1 },
  typeOptText: { fontWeight: '700', fontSize: 13 },
  input: { padding: 12, borderRadius: 12, fontSize: 14, marginBottom: 15, marginHorizontal: 26 },
  gradeBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 55, alignItems: 'center', borderWidth: 1, marginBottom: 10 },
  subjectTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginBottom: 5, marginRight: 4 },
  addSubjectTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', marginBottom: 5 },
  modalBtns: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 15 },
  cancelBtnText: { fontWeight: '700', fontSize: 14 },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, minWidth: 100, alignItems: 'center' },
  saveBtnText: { fontWeight: '800', fontSize: 14, color: '#fff' },
  filterGradeTabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  filterGradeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterGradeTabText: { fontSize: 14, fontWeight: '700' },
  filterItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  filterItemText: { fontSize: 15, fontWeight: '600' }
});
