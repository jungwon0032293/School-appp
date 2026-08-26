import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch, 
  useColorScheme, SafeAreaView 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db, auth } from "../../../firebaseConfig"; 
import { 
  doc, getDoc, collection, addDoc, query, orderBy, 
  onSnapshot, serverTimestamp, deleteDoc, updateDoc, increment,
  setDoc, arrayUnion, arrayRemove
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; 
import { useAdmin } from "../../_layout";
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Notifications from 'expo-notifications';

interface Reply {
  id: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  authorUid: string;
  createdAt: any;
  reportCount?: number;
}

interface Comment {
  id: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  authorUid: string;
  createdAt: any;
  reportCount?: number; 
  replies?: Reply[];
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { isAdmin, isMaster, user } = useAdmin();

  const [post, setPost] = useState<any>(null);
  const postRefState = useRef<any>(null); // 최신 post 상태 참조용 Ref

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isAnonComment, setIsAnonComment] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false); 
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [hiddenPosts, setHiddenPosts] = useState<string[]>([]);
  const [hiddenComments, setHiddenComments] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]); 

  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [isAnonReply, setIsAnonReply] = useState(true);

  const badWords = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '존나', 'ㅈㄴ', '병신', 'ㅂㅅ', '좆', '개새끼', '새끼', 'ㄱㅅㄲ', 'ㅅㄲ'];

  const theme = {
    background: isDark ? '#111111' : '#F8F9FA',
    card: isDark ? '#1C1C1E' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#111111',
    subText: isDark ? '#9CA3AF' : '#4E5968',
    border: isDark ? '#2C2C2E' : '#E9ECEF',
    accent: '#82A977',
    red: '#FF4D4D',
    yellow: '#FFD700',
    writerBg: isDark ? '#2C2C2E' : '#E8F5E9',
    writerText: '#82A977'
  };

  // 🔄 [다기기 지원 푸시 토큰 배열 갱신]
  const refreshUserPushToken = async (uid: string) => {
    if (!uid) return;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const currentToken = tokenData.data;

      if (!currentToken) return;

      // arrayUnion을 사용하여 기존 토큰 목록 유지 및 신규 토큰 추가
      const userRef = doc(db, "users", String(uid));
      await setDoc(userRef, {
        pushTokens: arrayUnion(currentToken), // 다기기 전송용 배열
        expoPushToken: currentToken,          // 하위 호환 단일 토큰
        pushToken: currentToken,
        lastTokenUpdatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`✅ [토큰 자동 갱신 완료] UID(${uid}):`, currentToken);
    } catch (error) {
      console.log("⚠️ 토큰 자동 갱신 중 스킵/에러:", error);
    }
  };

  useEffect(() => {
    postRefState.current = post;
  }, [post]);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return '';
    const dateObj = timestamp.toDate();
    const dateString = dateObj.toLocaleDateString();
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateString} ${timeString}`;
  };

  const handleBlockUserAction = async (targetUid: string, targetName: string, contentPreview: string) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");
    if (activeUid === targetUid) return Alert.alert("알림", "본인을 차단할 수 없습니다.");

    Alert.alert(
      "사용자 차단",
      `이 사용자(${targetName})를 차단하시겠습니까?\n차단된 사용자의 모든 게시글과 댓글이 화면에서 즉시 제외됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "차단",
          style: "destructive",
          onPress: async () => {
            try {
              const userRef = doc(db, "users", activeUid);
              const cleanPreview = contentPreview.length > 20 ? contentPreview.substring(0, 20) + "..." : contentPreview;
              
              const blockData = {
                uid: String(targetUid),
                context: cleanPreview,
                blockedAt: new Date().toLocaleDateString()
              };

              await setDoc(userRef, {
                blockedUsers: arrayUnion(blockData)
              }, { merge: true });

              Alert.alert("알림", "사용자가 차단되었습니다.");
              if (post && post.authorUid === targetUid) {
                router.back();
              }
            } catch (e) {
              Alert.alert("오류", "사용자 차단 처리에 실패했습니다.");
            }
          }
        }
      ]
    );
  };

  const handleHidePostAction = async () => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid; 
    if (!activeUid || !id) return Alert.alert("알림", "로그인이 필요합니다.");

    const isAlreadyHidden = hiddenPosts.includes(String(id));

    if (isAlreadyHidden) {
      Alert.alert(
        "게시물 숨김 해제",
        "이 게시글의 숨김을 해제하고 다시 홈 피드에 노출하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          { 
            text: "다시 보이기", 
            onPress: async () => {
              try {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, {
                  hiddenPosts: arrayRemove(String(id))
                }, { merge: true });
                Alert.alert("알림", "게시글 숨김이 취소되었습니다.");
              } catch (e) {
                Alert.alert("오류", "숨김 취소 처리에 실패했습니다.");
              }
            } 
          }
        ]
      );
    } else {
      Alert.alert(
        "게시물 숨기기",
        "이 게시물을 홈 피드 및 내 화면에서 즉시 숨기시겠습니까?\n(계정에 저장되어 기기가 바뀌어도 유지됩니다)",
        [
          { text: "취소", style: "cancel" },
          { 
            text: "숨기기", 
            style: "destructive", 
            onPress: async () => {
              try {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, {
                  hiddenPosts: arrayUnion(String(id))
                }, { merge: true });
                Alert.alert("알림", "게시물이 숨겨졌습니다.", [
                  { text: "확인", onPress: () => router.back() }
                ]);
              } catch (e) {
                Alert.alert("오류", "게시물 숨기기 처리에 실패했습니다.");
              }
            } 
          }
        ]
      );
    }
  };

  const handleHideCommentAction = async (commentId: string) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid; 
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");

    const isAlreadyHidden = hiddenComments.includes(String(commentId));

    if (isAlreadyHidden) {
      Alert.alert(
        "댓글 숨김 해제",
        "이 댓글의 숨김을 해제하고 다시 화면에 표시하시겠습니까?",
        [
          { text: "취소", style: "cancel" },
          {
            text: "다시 보이기",
            onPress: async () => {
              try {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, {
                  hiddenComments: arrayRemove(String(commentId))
                }, { merge: true });
                Alert.alert("알림", "댓글 숨김이 해제되었습니다.");
              } catch (e) {
                Alert.alert("오류", "댓글 숨김 해제에 실패했습니다.");
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        "댓글 숨기기",
        "이 댓글을 화면에서 즉시 숨기시겠습니까?\n(계정에 저장되어 다른 기기에서도 숨김이 유지됩니다)",
        [
          { text: "취소", style: "cancel" },
          { 
            text: "숨기기", 
            style: "destructive", 
            onPress: async () => {
              try {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, {
                  hiddenComments: arrayUnion(String(commentId))
                }, { merge: true });
                Alert.alert("알림", "댓글이 숨김 처리되었습니다.");
              } catch (e) {
                Alert.alert("오류", "댓글 숨기기 처리에 실패했습니다.");
              }
            } 
          }
        ]
      );
    }
  };

  const handleEditPost = () => {
    if (!post || !id) return;
    
    router.push({
      pathname: "/community/write", 
      params: {
        postId: String(id),
        editTitle: post.title,
        editContent: post.content,
        editCategory: post.category || "자유",
        editIsAnonymous: post.isAnonymous ? "true" : "false"
      }
    });
  };

  const handleDeletePost = () => {
    if (!id) return;
    Alert.alert("게시글 삭제", "정말로 이 게시글을 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "posts", String(id)));
            Alert.alert("알림", "게시글이 삭제되었습니다.", [
              { text: "확인", onPress: () => router.back() }
            ]);
          } catch (e) {
            Alert.alert("오류", "게시글 삭제 실패");
          }
        }
      }
    ]);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setCurrentUser(firebaseUser);
        refreshUserPushToken(firebaseUser.uid);
      } else {
        setCurrentUser(null);
        setIsLiked(false);
        setIsBookmarked(false);
        setHiddenPosts([]);
        setHiddenComments([]);
        setBlockedUsers([]); 
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!id) return;
    
    setLoading(true); 
    const activeUid = user?.uid || currentUser?.uid || auth.currentUser?.uid;
    
    let cleanUserNotis: (() => void) | undefined;

    if (activeUid) {
      checkLikeStatus(activeUid);
      checkBookmarkStatus(activeUid);
      refreshUserPushToken(activeUid);

      const userRef = doc(db, "users", activeUid);
      cleanUserNotis = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setHiddenPosts(userData.hiddenPosts || []);
          setHiddenComments(userData.hiddenComments || []);
          setBlockedUsers(userData.blockedUsers || []); 
        }
      });
    }

    const postRef = doc(db, "posts", String(id));
    
    const unsubscribePost = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedPost = { id: docSnap.id, ...docSnap.data() };
        setPost(fetchedPost);
        postRefState.current = fetchedPost;
      } else {
        Alert.alert("알림", "존재하지 않거나 삭제된 게시글입니다.");
        router.back();
      }
      setLoading(false);
    }, (error) => {
      console.error("Post fetch error:", error);
      setLoading(false);
    });

    const q = query(
      collection(db, "posts", String(id), "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribeComments = onSnapshot(q, (snapshot) => {
      const unsubscribes: (() => void)[] = [];

      const commentList = snapshot.docs.map((docSnap) => {
        const commentData = { 
          id: docSnap.id, 
          ...(docSnap.data() as any),
          replies: []
        } as Comment;

        const rq = query(
          collection(db, "posts", String(id), "comments", docSnap.id, "replies"),
          orderBy("createdAt", "asc")
        );

        const unsubReplies = onSnapshot(rq, (replySnapshot) => {
          const replyList = replySnapshot.docs.map(rd => ({ id: rd.id, ...rd.data() } as Reply));
          setComments(prev => prev.map(c => c.id === docSnap.id ? { ...c, replies: replyList } : c));
        });

        unsubscribes.push(unsubReplies);
        return commentData;
      });

      setComments(commentList);

      return () => {
        unsubscribes.forEach(unsub => unsub());
      };
    }, (error) => {
      console.error("Comments fetch error:", error);
    });

    updateDoc(postRef, { views: increment(1) }).catch(() => {});

    return () => {
      unsubscribePost();
      unsubscribeComments();
      if (cleanUserNotis) cleanUserNotis();
    };
  }, [id, currentUser?.uid]);

  const checkLikeStatus = async (uid: string) => {
    if (!uid || !id) return;
    try {
      const likeDoc = await getDoc(doc(db, "posts", String(id), "likes", String(uid)));
      setIsLiked(likeDoc.exists());
    } catch (e) { console.log("Like check error"); }
  };

  const checkBookmarkStatus = async (uid: string) => {
    if (!uid || !id) return;
    try {
      const bookmarkDocId = `${uid}_${id}`;
      const bookmarkDoc = await getDoc(doc(db, "bookmarks", bookmarkDocId));
      setIsBookmarked(bookmarkDoc.exists());
    } catch (e) { console.log("Bookmark check error"); }
  };

  // 🔔 [다기기 배열 푸시 전송 지원 알림 생성 함수]
  const createNotification = async (type: 'like' | 'comment', targetUid: string, pushContent: string, isAnonymousAction: boolean) => {
    const myUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    const senderDisplayName = isAnonymousAction ? "익명" : (user?.name || "사용자");
    
    if (!targetUid || String(targetUid) === String(myUid)) return;

    try {
      const targetUserDoc = await getDoc(doc(db, "users", String(targetUid)));
      if (!targetUserDoc.exists()) return;

      const targetData = targetUserDoc.data();
      
      if (type === 'like' && targetData.settings?.likeNoti === false) return;
      if (type === 'comment' && targetData.settings?.commentNoti === false) return;

      const currentPostTitle = post?.title || postRefState.current?.title || "게시글";

      // 1. In-App Notification 저장
      await addDoc(collection(db, "notifications"), {
        targetUid: String(targetUid), 
        type,
        postId: String(id),
        postTitle: currentPostTitle,
        senderName: senderDisplayName,
        content: pushContent,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // 2. 다기기 토큰 배열 추출 (pushTokens 우선, 없으면 하위 호환 필드)
      let rawTokens: string[] = [];
      if (Array.isArray(targetData.pushTokens) && targetData.pushTokens.length > 0) {
        rawTokens = targetData.pushTokens;
      } else if (targetData.expoPushToken) {
        rawTokens = [targetData.expoPushToken];
      } else if (targetData.pushToken) {
        rawTokens = [targetData.pushToken];
      }

      const validTokens = Array.from(new Set(rawTokens.filter(t => typeof t === 'string' && t.trim() !== '')));
      if (validTokens.length === 0) return;

      const pushTitle = type === 'like' ? "❤️ 새로운 좋아요" : "💬 새로운 댓글";
      const pushBody = type === 'like' 
        ? `${senderDisplayName}님이 회원님의 글을 좋아합니다.` 
        : `${senderDisplayName}: ${pushContent}`;

      // 3. Expo Push API 동시 전송 배열 구성
      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: pushTitle,
        body: pushBody,
        data: { screen: 'community', id: String(id) },
        priority: 'high',
        badge: 1,
      }));

      await axios.post('https://exp.host/--/api/v2/push/send', messages, {
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        }
      });

      console.log(`✅ [푸시 알림 전송 성공] 대상: ${targetUid}, 토큰 개수: ${validTokens.length}`);

    } catch (e: any) { 
      console.error("❌ 알림 전송 에러:", e?.response?.data || e.message || e); 
    }
  };

  const handleToggleLike = async () => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");
    const postRef = doc(db, "posts", String(id));
    const likeRef = doc(db, "posts", String(id), "likes", String(activeUid));

    try {
      if (isLiked) {
        setIsLiked(false);
        await deleteDoc(likeRef);
        await updateDoc(postRef, { likeCount: increment(-1) });
      } else {
        setIsLiked(true);
        await setDoc(likeRef, { createdAt: serverTimestamp() });
        await updateDoc(postRef, { likeCount: increment(1) });
        
        const targetAuthorUid = post?.authorUid || postRefState.current?.authorUid;
        if (targetAuthorUid) {
          createNotification('like', targetAuthorUid, "게시글을 좋아합니다.", false);
        }
      }
    } catch (e) { setIsLiked(!isLiked); }
  };

  const handleToggleBookmark = async () => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인이 필요합니다.");
    const bookmarkDocId = `${activeUid}_${id}`;
    const bookmarkRef = doc(db, "bookmarks", bookmarkDocId);

    try {
      if (isBookmarked) {
        await deleteDoc(bookmarkRef);
        setIsBookmarked(false);
      } else {
        await setDoc(bookmarkRef, { uid: activeUid, postId: id, createdAt: serverTimestamp() });
        setIsBookmarked(true);
      }
    } catch (e) { console.error("북마크 실패:", e); }
  };

  const handleReport = () => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    const reporterRealName = user?.name || "사용자";
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");

    Alert.prompt("게시글 신고", "신고 사유를 입력해주세요.", async (reason) => {
      if (!reason?.trim()) return;
      try {
        const reportId = `${activeUid}_${id}`;
        const reportRef = doc(db, "reports", reportId);
        if ((await getDoc(reportRef)).exists()) return Alert.alert("알림", "이미 신고한 게시글입니다.");

        await setDoc(reportRef, {
          postId: id, postTitle: post?.title, reporterName: reporterRealName, reporterUid: activeUid,
          reason: reason.trim(), status: 'pending', createdAt: serverTimestamp(), isNotified: false 
        });
        await updateDoc(doc(db, "posts", String(id)), { reportCount: increment(1) });
        
        Alert.alert(
          "신고 완료", 
          "정상적으로 접수되었습니다.\n이 게시물을 다시 보지 않으시겠습니까? (숨기기 처리)",
          [
            { text: "아니오", style: "cancel" },
            { 
              text: "예", 
              style: "destructive", 
              onPress: async () => {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, { hiddenPosts: arrayUnion(String(id)) }, { merge: true });
                router.back();
              } 
            }
          ]
        );
      } catch (e) { Alert.alert("오류", "신고 실패"); }
    });
  };

  const handleCommentReport = (comment: Comment) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");

    Alert.prompt("댓글 신고", "신고 사유를 입력해주세요.", async (reason) => {
      if (!reason?.trim()) return;
      try {
        const reportId = `${activeUid}_${comment.id}`;
        const reportRef = doc(db, "comment_reports", reportId);
        
        if ((await getDoc(reportRef)).exists()) return Alert.alert("알림", "이미 신고한 댓글입니다.");

        await setDoc(reportRef, {
          postId: id, commentId: comment.id, content: comment.content,
          reporterUid: activeUid, reason: reason.trim(), createdAt: serverTimestamp()
        });

        const commentRef = doc(db, "posts", String(id), "comments", comment.id);
        await updateDoc(commentRef, { reportCount: increment(1) });

        Alert.alert(
          "신고 완료", 
          "댓글 신고가 접수되었습니다.\n이 댓글을 다시 보지 않으시겠습니까? (숨기기 처리)",
          [
            { text: "아니오", style: "cancel" },
            { 
              text: "예", 
              style: "destructive", 
              onPress: async () => {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, { hiddenComments: arrayUnion(String(comment.id)) }, { merge: true });
              } 
            }
          ]
        );
      } catch (e) { Alert.alert("오류", "신고 처리 실패"); }
    });
  };

  const handleReplyReport = (commentId: string, reply: Reply) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");

    Alert.prompt("답글 신고", "신고 사유를 입력해주세요.", async (reason) => {
      if (!reason?.trim()) return;
      try {
        const reportId = `${activeUid}_${reply.id}`;
        const reportRef = doc(db, "comment_reports", reportId);
        
        if ((await getDoc(reportRef)).exists()) return Alert.alert("알림", "이미 신고한 답글입니다.");

        await setDoc(reportRef, {
          postId: id, commentId: reply.id, content: reply.content,
          reporterUid: activeUid, reason: reason.trim(), createdAt: serverTimestamp()
        });

        const replyRef = doc(db, "posts", String(id), "comments", commentId, "replies", reply.id);
        await updateDoc(replyRef, { reportCount: increment(1) });

        Alert.alert(
          "신고 완료", 
          "답글 신고가 접수되었습니다.\n이 답글을 다시 보지 않으시겠습니까? (숨기기 처리)",
          [
            { text: "아니오", style: "cancel" },
            { 
              text: "예", 
              style: "destructive", 
              onPress: async () => {
                const userRef = doc(db, "users", activeUid);
                await setDoc(userRef, { hiddenComments: arrayUnion(String(reply.id)) }, { merge: true });
              } 
            }
          ]
        );
      } catch (e) { Alert.alert("오류", "신고 처리 실패"); }
    });
  };

  const handleAddComment = async () => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");
    
    if (!user?.name || !user.name.trim()) {
      return Alert.alert("알림", "이름 정보를 확인할 수 없어 댓글을 작성할 수 없습니다.");
    }

    if (!commentInput.trim()) return;

    try {
      const penaltyRef = doc(db, "penalized_users", activeUid);
      const penaltySnap = await getDoc(penaltyRef);
      if (penaltySnap.exists() && penaltySnap.data().count >= 5) {
        Alert.alert("작성 제한", "누적된 신고 횟수가 5회 이상으로, 더 이상 댓글을 작성할 수 없습니다.");
        return;
      }

      const targetAuthorUid = post?.authorUid || postRefState.current?.authorUid;
      if (targetAuthorUid) {
        const postAuthorRef = doc(db, "users", targetAuthorUid);
        const postAuthorSnap = await getDoc(postAuthorRef);
        
        if (postAuthorSnap.exists()) {
          const authorData = postAuthorSnap.data();
          const authorBlockedList = authorData.blockedUsers || [];
          
          const isMeBlocked = authorBlockedList.some((b: any) => {
            const blockedUid = typeof b === 'object' && b !== null ? b.uid : b;
            return String(blockedUid) === String(activeUid);
          });
          
          if (isMeBlocked) {
            Alert.alert("작성 제한", "글 작성자에 의해 차단된 사용자는 댓글을 작성할 수 없습니다.");
            return;
          }
        }
      }
    } catch (e) { console.log("Penalty or Block check error"); }

    const foundBadWord = badWords.find(word => commentInput.includes(word));
    if (foundBadWord) return Alert.alert("등록 불가", `부적절한 단어(${foundBadWord})가 포함되어 있습니다.`);

    try {
      const postRef = doc(db, "posts", String(id));
      const textToComment = commentInput.trim();
      
      await addDoc(collection(db, "posts", String(id), "comments"), {
        content: textToComment,
        authorName: user.name,
        authorUid: activeUid,
        isAnonymous: isAnonComment,
        createdAt: serverTimestamp(),
        reportCount: 0 
      });
      await updateDoc(postRef, { commentCount: increment(1) });
      
      const targetAuthorUid = post?.authorUid || postRefState.current?.authorUid;
      if (targetAuthorUid) {
        createNotification('comment', targetAuthorUid, textToComment, isAnonComment);
      }
      
      setCommentInput('');
    } catch (e) { Alert.alert("오류", "댓글 등록 실패"); }
  };

  const handleAddReply = async (commentId: string, commentAuthorUid: string) => {
    const activeUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    if (!activeUid) return Alert.alert("알림", "로그인 후 이용 가능합니다.");
    
    if (!user?.name || !user.name.trim()) {
      return Alert.alert("알림", "이름 정보를 확인할 수 없어 답글을 작성할 수 없습니다.");
    }

    if (!replyInput.trim()) return;

    try {
      const penaltyRef = doc(db, "penalized_users", activeUid);
      const penaltySnap = await getDoc(penaltyRef);
      if (penaltySnap.exists() && penaltySnap.data().count >= 5) {
        Alert.alert("작성 제한", "누적된 신고 횟수가 5회 이상으로, 더 이상 답글을 작성할 수 없습니다.");
        return;
      }
    } catch (e) { console.log("Penalty check error"); }

    const foundBadWord = badWords.find(word => replyInput.includes(word));
    if (foundBadWord) return Alert.alert("등록 불가", `부적절한 단어(${foundBadWord})가 포함되어 있습니다.`);

    try {
      const postRef = doc(db, "posts", String(id));
      const textToReply = replyInput.trim();

      await addDoc(collection(db, "posts", String(id), "comments", commentId, "replies"), {
        content: textToReply,
        authorName: user.name,
        authorUid: activeUid,
        isAnonymous: isAnonReply,
        createdAt: serverTimestamp(),
        reportCount: 0
      });
      await updateDoc(postRef, { commentCount: increment(1) });
      
      const postAuthorUid = post?.authorUid || postRefState.current?.authorUid;

      if (commentAuthorUid) {
        createNotification('comment', commentAuthorUid, textToReply, isAnonReply);
      }

      if (postAuthorUid && String(postAuthorUid) !== String(commentAuthorUid)) {
        createNotification('comment', postAuthorUid, textToReply, isAnonReply);
      }
      
      setReplyInput('');
      setActiveReplyCommentId(null);
    } catch (e) { Alert.alert("오류", "답글 등록 실패"); }
  };

  const handleDeleteComment = (commentId: string, authorUid: string) => {
    const myCurrentUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    const isMyComment = myCurrentUid && authorUid && String(authorUid) === String(myCurrentUid);

    if (!isAdmin && !isMyComment) return; 

    Alert.alert("삭제", "댓글을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", style: "destructive", onPress: async () => {
          await deleteDoc(doc(doc(db, "posts", String(id)), "comments", commentId));
          await updateDoc(doc(db, "posts", String(id)), { commentCount: increment(-1) });
      }}
    ]);
  };

  const handleDeleteReply = (commentId: string, replyId: string, authorUid: string) => {
    const myCurrentUid = currentUser?.uid || auth.currentUser?.uid || user?.uid;
    const isMyReply = myCurrentUid && authorUid && String(authorUid) === String(myCurrentUid);

    if (!isAdmin && !isMyReply) return;

    Alert.alert("삭제", "답글을 삭제하시겠습니까?", [
      { text: "취소" },
      { text: "삭제", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "posts", String(id), "comments", commentId, "replies", replyId));
          await updateDoc(doc(db, "posts", String(id)), { commentCount: increment(-1) });
      }}
    ]);
  };

  const renderHeader = () => {
    if (!post) return null;
    
    const isAuthorBlocked = blockedUsers.some((b: any) => {
      const blockedUid = typeof b === 'object' && b !== null ? b.uid : b;
      return String(blockedUid) === String(post.authorUid);
    });

    const isPostHidden = hiddenPosts.includes(String(id));

    if (isPostHidden || isAuthorBlocked) {
      return (
        <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.subText }}>화면에서 제외된 게시글입니다.</Text>
          {isPostHidden && (
            <TouchableOpacity onPress={handleHidePostAction}>
              <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>숨김 취소</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    
    const myCurrentUid = (currentUser?.uid || auth.currentUser?.uid || user?.uid || "").trim(); 
    const postAuthorUid = (post.authorUid || "").trim();

    const isMyPost = myCurrentUid && postAuthorUid && String(postAuthorUid) === String(myCurrentUid);

    return (
      <View style={styles.postSection}>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: theme.accent, fontWeight: '700' }}>← 뒤로가기</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
            <TouchableOpacity onPress={handleToggleBookmark}><Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={isBookmarked ? theme.yellow : theme.subText} /></TouchableOpacity>
            
            {isMyPost ? (
              <>
                <TouchableOpacity onPress={handleEditPost}><Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>수정</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleDeletePost}><Text style={{ color: theme.red, fontSize: 13, fontWeight: '700' }}>삭제</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={handleHidePostAction}>
                  <Text style={{ color: theme.subText, fontSize: 12 }}>
                    {isPostHidden ? "숨김 취소" : "숨기기"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReport}><Text style={{ color: theme.red, fontSize: 12 }}>신고하기</Text></TouchableOpacity>
                
                <TouchableOpacity onPress={() => handleBlockUserAction(post.authorUid, post.isAnonymous ? "익명" : post.authorName, post.title || "제목 없는 게시글")}>
                  <Text style={{ color: theme.red, fontSize: 12, fontWeight: '700' }}>차단</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        <Text style={[styles.category, { color: theme.accent }]}>{post.category || "일반"}</Text>
        <Text style={[styles.title, { color: theme.text }]}>{post.title || "제목 없음"}</Text>
        <View style={styles.authorRow}>
          <Text style={[styles.author, { color: theme.subText }]}>
            {post.isAnonymous ? (isMaster ? `익명(${post.authorName})` : "익명") : (post.authorName || "사용자")}
          </Text>

          {isMyPost && (
            <View style={[styles.inlineWriterBadge, { backgroundColor: theme.writerBg }]}>
              <Text style={[styles.inlineWriterBadgeText, { color: theme.writerText }]}>작성자</Text>
            </View>
          )}

          <Text style={styles.dot}>•</Text>
          <Text style={[styles.date, { color: theme.subText }]}>{(post.views || 0)} 조회</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={[styles.date, { color: theme.subText }]}>{formatDateTime(post.createdAt)}</Text>
        </View>
        <Text style={[styles.content, { color: theme.text }]}>{post.content || "내용이 없습니다."}</Text>
        <TouchableOpacity style={[styles.likeBtn, isLiked && { borderColor: theme.accent, backgroundColor: theme.accent + '10' }]} onPress={handleToggleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? theme.accent : theme.subText} />
          <Text style={[styles.likeText, { color: isLiked ? theme.accent : theme.subText }]}>좋아요 {post.likeCount || 0}</Text>
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.commentCount, { color: theme.text }]}>댓글 {comments.length}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  const visibleComments = comments.filter(comment => {
    const isCommentHidden = hiddenComments.includes(String(comment.id));
    const isAuthorBlocked = blockedUsers.some((b: any) => {
      const blockedUid = typeof b === 'object' && b !== null ? b.uid : b;
      return String(blockedUid) === String(comment.authorUid);
    });
    return !isCommentHidden && !isAuthorBlocked;
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={visibleComments} 
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            const isPostAuthor = post && post.authorUid && item.authorUid && String(item.authorUid) === String(post.authorUid); 
            const myCurrentUid = currentUser?.uid || auth.currentUser?.uid || user?.uid; 
            const isMyComment = myCurrentUid && item.authorUid && String(item.authorUid) === String(myCurrentUid); 
            
            const isReported = (item.reportCount || 0) >= 5;
            const isThisCommentHidden = hiddenComments.includes(String(item.id));

            const visibleReplies = (item.replies || []).filter(reply => {
              const isReplyHidden = hiddenComments.includes(String(reply.id));
              const isReplyAuthorBlocked = blockedUsers.some((b: any) => {
                const blockedUid = typeof b === 'object' && b !== null ? b.uid : b;
                return String(blockedUid) === String(reply.authorUid);
              });
              return !isReplyHidden && !isReplyAuthorBlocked;
            });

            return (
              <View style={[styles.commentContainer, { borderBottomColor: theme.border }]}>
                <View style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.commentAuthor, { color: isReported ? theme.subText : theme.text }]}>
                        {item.isAnonymous ? (isMaster ? `익명(${item.authorName})` : "익명") : item.authorName}
                      </Text>
                      
                      {isMyComment ? (
                        <View style={[styles.authorBadge, { borderColor: theme.subText, backgroundColor: 'transparent' }]}>
                          <Text style={[styles.authorBadgeText, { color: theme.subText }]}>나</Text>
                        </View>
                      ) : (
                        isPostAuthor && (
                          <View style={styles.authorBadge}>
                            <Text style={styles.authorBadgeText}>글쓴이</Text>
                          </View>
                        )
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <Text style={[styles.commentTimeText, { color: theme.subText }]}>
                        {formatDateTime(item.createdAt)}
                      </Text>
                      
                      <TouchableOpacity onPress={() => handleHideCommentAction(item.id)}>
                        <Text style={{ color: theme.subText, fontSize: 11 }}>
                          {isThisCommentHidden ? "숨김 취소" : "숨기기"}
                        </Text>
                      </TouchableOpacity>
                      
                      {!isReported && <TouchableOpacity onPress={() => handleCommentReport(item)}><Text style={{ color: theme.subText, fontSize: 11 }}>신고</Text></TouchableOpacity>}
                      
                      {!isMyComment && (
                        <TouchableOpacity onPress={() => handleBlockUserAction(item.authorUid, item.isAnonymous ? "익명" : item.authorName, item.content)}>
                          <Text style={{ color: theme.red, fontSize: 11, fontWeight: '700' }}>차단</Text>
                        </TouchableOpacity>
                      )}

                      {(isAdmin || isMyComment) && (
                        <TouchableOpacity onPress={() => handleDeleteComment(item.id, item.authorUid)}>
                          <Text style={{ color: theme.red, fontSize: 11 }}>삭제</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.commentContent, { color: isReported ? theme.subText : theme.text, fontStyle: isReported ? 'italic' : 'normal' }]}>
                    {isReported ? "⚠️ 여러 사용자의 신고에 의해 가려진 댓글입니다." : item.content}
                  </Text>
                  
                  {!isReported && (
                    <TouchableOpacity 
                      style={styles.replyButton} 
                      onPress={() => {
                        if (activeReplyCommentId === item.id) {
                          setActiveReplyCommentId(null);
                        } else {
                          setActiveReplyCommentId(item.id);
                        }
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={12} color={theme.accent} />
                      <Text style={[styles.replyButtonText, { color: theme.accent }]}>답글 쓰기</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {visibleReplies.map((reply) => {
                  const isReplyPostAuthor = post && post.authorUid && reply.authorUid && String(reply.authorUid) === String(post.authorUid);
                  const isMyReply = myCurrentUid && reply.authorUid && String(reply.authorUid) === String(myCurrentUid);
                  const isReplyReported = (reply.reportCount || 0) >= 5;
                  const isThisReplyHidden = hiddenComments.includes(String(reply.id));

                  return (
                    <View key={reply.id} style={[styles.replyItem, { backgroundColor: isDark ? '#1C1C1E' : '#F1F3F5' }]}>
                      <View style={styles.commentHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="return-down-forward" size={14} color={theme.subText} style={{ marginRight: 2 }} />
                          <Text style={[styles.commentAuthor, { color: isReplyReported ? theme.subText : theme.text }]}>
                            {reply.isAnonymous ? (isMaster ? `익명(${reply.authorName})` : "익명") : reply.authorName}
                          </Text>
                          
                          {isMyReply ? (
                            <View style={[styles.authorBadge, { borderColor: theme.subText, backgroundColor: 'transparent' }]}>
                              <Text style={[styles.authorBadgeText, { color: theme.subText }]}>나</Text>
                            </View>
                          ) : (
                            isReplyPostAuthor && (
                              <View style={styles.authorBadge}>
                                <Text style={styles.authorBadgeText}>글쓴이</Text>
                              </View>
                            )
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                          <Text style={[styles.commentTimeText, { color: theme.subText }]}>
                            {formatDateTime(reply.createdAt)}
                          </Text>
                          
                          <TouchableOpacity onPress={() => handleHideCommentAction(reply.id)}>
                            <Text style={{ color: theme.subText, fontSize: 11 }}>
                              {isThisReplyHidden ? "숨김 취소" : "숨기기"}
                            </Text>
                          </TouchableOpacity>
                          
                          {!isReplyReported && <TouchableOpacity onPress={() => handleReplyReport(item.id, reply)}><Text style={{ color: theme.subText, fontSize: 11 }}>신고</Text></TouchableOpacity>}
                          
                          {!isMyReply && (
                            <TouchableOpacity onPress={() => handleBlockUserAction(reply.authorUid, reply.isAnonymous ? "익명" : reply.authorName, reply.content)}>
                              <Text style={{ color: theme.red, fontSize: 11, fontWeight: '700' }}>차단</Text>
                            </TouchableOpacity>
                          )}

                          {(isAdmin || isMyReply) && (
                            <TouchableOpacity onPress={() => handleDeleteReply(item.id, reply.id, reply.authorUid)}>
                              <Text style={{ color: theme.red, fontSize: 11 }}>삭제</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.commentContent, { marginLeft: 18, color: isReplyReported ? theme.subText : theme.text, fontStyle: isReplyReported ? 'italic' : 'normal' }]}>
                        {isReplyReported ? "⚠️ 여러 사용자의 신고에 의해 가려진 답글입니다." : reply.content}
                      </Text>
                    </View>
                  );
                })}

                {activeReplyCommentId === item.id && (
                  <View style={[styles.replyInputWrapper, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                    <View style={styles.inputContainer}>
                      <View style={styles.inputOptions}>
                        <Text style={{ color: theme.subText, fontSize: 10 }}>익명</Text>
                        <Switch value={isAnonReply} onValueChange={setIsAnonReply} trackColor={{ false: "#767577", true: theme.accent }} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
                      </View>
                      <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="답글을 입력하세요..." placeholderTextColor={theme.subText} value={replyInput} onChangeText={setReplyInput} multiline />
                      <TouchableOpacity style={styles.sendBtn} onPress={() => handleAddReply(item.id, item.authorUid)}><Text style={styles.sendBtnText}>등록</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.inputContainer}>
            <View style={styles.inputOptions}>
              <Text style={{ color: theme.subText, fontSize: 10 }}>익명</Text>
              <Switch value={isAnonComment} onValueChange={setIsAnonComment} trackColor={{ false: "#767577", true: theme.accent }} style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} />
            </View>
            <TextInput style={[styles.input, { color: theme.text, backgroundColor: theme.background }]} placeholder="댓글을 입력하세요..." placeholderTextColor={theme.subText} value={commentInput} onChangeText={setCommentInput} multiline />
            <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment}><Text style={styles.sendBtnText}>등록</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 0 },
  postSection: { paddingHorizontal: 20, paddingBottom: 20 },
  category: { fontSize: 13, fontWeight: '700', marginBottom: 5, marginTop: 10 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 2 },
  author: { fontSize: 13, fontWeight: '600' },
  inlineWriterBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 4 },
  inlineWriterBadgeText: { fontSize: 9, fontWeight: 'bold' },
  dot: { marginHorizontal: 6, color: '#CCC' },
  date: { fontSize: 12 },
  content: { fontSize: 16, lineHeight: 24, marginBottom: 20 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#eee', gap: 6, marginBottom: 10 },
  likeText: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 20 },
  commentCount: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  commentContainer: { borderBottomWidth: 0.5 },
  commentItem: { paddingHorizontal: 20, paddingVertical: 15 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  authorBadge: { backgroundColor: '#82A97715', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: '#82A977' },
  authorBadgeText: { color: '#82A977', fontSize: 10, fontWeight: '800' },
  commentTimeText: { fontSize: 10, marginRight: 4 },
  commentContent: { fontSize: 14, lineHeight: 20 },
  replyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  replyButtonText: { fontSize: 11, fontWeight: '700' },
  replyItem: { paddingLeft: 20, paddingRight: 20, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: 'transparent' },
  replyInputWrapper: { paddingHorizontal: 15, paddingVertical: 10, borderTopWidth: 0.5 },
  inputWrapper: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 25 : 10, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'center' },
  inputOptions: { alignItems: 'center', marginRight: 5 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, maxHeight: 80, fontSize: 14 },
  sendBtn: { marginLeft: 10, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#82A977', borderRadius: 20 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
