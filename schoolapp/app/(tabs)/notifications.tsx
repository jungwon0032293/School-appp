import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, useColorScheme, SafeAreaView 
} from 'react-native';
import { db, auth } from "../../firebaseConfig"; 
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, updateDoc, writeBatch, Timestamp 
} from "firebase/firestore"; 
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAdmin } from "../_layout"; 

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'notice' | 'verify';
  postTitle: string;
  senderName: string;
  content: string;
  isRead: boolean;
  postId: string;
  createdAt: Timestamp | any;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAdmin();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
  };

  useEffect(() => {
    // auth.currentUser와 useAdmin의 user 중 확실한 것을 사용
    const currentUid = auth.currentUser?.uid || user?.uid;
    
    if (!currentUid) {
      console.log("로그인된 사용자가 없습니다.");
      setLoading(false);
      return;
    }

    // 💡 참고: orderBy가 포함된 쿼리는 Firestore 콘솔에서 '인덱스'를 생성해야 작동할 수 있습니다.
    // 만약 목록이 아예 안 나온다면 orderBy를 잠시 지우고 테스트해보세요.
    const q = query(
      collection(db, "notifications"),
      where("targetUid", "==", currentUid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]); // 의존성 배열 구체화

  const handleNotificationPress = async (noti: Notification) => {
    try {
      const notiRef = doc(db, "notifications", noti.id);
      await updateDoc(notiRef, { isRead: true });

      if (noti.type === 'notice') {
        router.push(`/notice/${noti.postId}` as any);
      } else if (noti.type === 'verify') {
        router.replace('/'); 
      } else {
        // postId가 없는 경우를 대비한 방어 코드
        if (noti.postId) {
          router.push(`/community/${noti.postId}`);
        }
      }
    } catch (e) {
      console.error("알림 처리 오류:", e);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotis = notifications.filter(n => !n.isRead);
    if (unreadNotis.length === 0) return;

    const batch = writeBatch(db);
    unreadNotis.forEach(noti => {
      const ref = doc(db, "notifications", noti.id);
      batch.update(ref, { isRead: true });
    });
    await batch.commit();
  };

  const renderItem = ({ item }: { item: Notification }) => {
    let iconName: any = 'megaphone';
    let iconColor = theme.accent;

    if (item.type === 'like') {
      iconName = 'heart';
      iconColor = '#FF4D4D';
    } else if (item.type === 'comment') {
      iconName = 'chatbubble';
      iconColor = '#3182F6';
    } else if (item.type === 'verify') {
      iconName = 'person-add';
      iconColor = '#82A977';
    }

    // 시간 표시 로직 보강
    const displayTime = item.createdAt?.seconds 
      ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      : "방금 전";

    return (
      <TouchableOpacity 
        style={[
          styles.notiCard, 
          { backgroundColor: theme.card, borderBottomColor: theme.border },
          !item.isRead && { backgroundColor: isDark ? '#1C251C' : '#F0F7F0' } 
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        
        <View style={styles.contentContainer}>
          <Text style={[styles.notiTitle, { color: theme.text }]} numberOfLines={1}>
            {item.postTitle || "알림"}
          </Text>
          <Text style={[styles.notiBody, { color: theme.subText }]} numberOfLines={2}>
            <Text style={{ fontWeight: 'bold' }}>{item.senderName}</Text> {item.content}
          </Text>
          <Text style={styles.timeText}>{displayTime}</Text>
        </View>

        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>알림</Text>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text style={[styles.readAllBtn, { color: theme.accent }]}>전체 읽음</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={theme.accent} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={50} color={theme.subText} />
              <Text style={[styles.emptyText, { color: theme.subText }]}>알림이 없습니다.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    height: 60, flexDirection: 'row', alignItems: 'center', 
    justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  backBtn: { padding: 4 },
  readAllBtn: { fontSize: 13, fontWeight: '600' },
  notiCard: { 
    flexDirection: 'row', padding: 16, borderBottomWidth: 1, 
    alignItems: 'center', position: 'relative' 
  },
  iconContainer: { 
    width: 40, height: 40, borderRadius: 20, 
    justifyContent: 'center', alignItems: 'center', marginRight: 12 
  },
  contentContainer: { flex: 1 },
  notiTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  notiBody: { fontSize: 13, lineHeight: 18 },
  timeText: { fontSize: 11, color: '#999', marginTop: 4 },
  unreadDot: { 
    width: 8, height: 8, borderRadius: 4, 
    backgroundColor: '#82A977', position: 'absolute', right: 16, top: 16 
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 150 },
  emptyText: { marginTop: 10, fontSize: 15, fontWeight: '500' }
});
