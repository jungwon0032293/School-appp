import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function ModalScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이것은 모달입니다</Text>
      
      <TouchableOpacity 
        // ✅ 'as any'를 붙이면 타입 체크를 강제로 통과합니다. 
        // 혹은 router.back() 을 쓰면 모달이 닫히며 이전 화면으로 돌아갑니다.
        onPress={() => router.replace('/' as any)} 
        activeOpacity={0.7}
        style={styles.linkContainer}
      >
        <Text style={styles.linkText}>
          홈 화면으로 돌아가기
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  linkContainer: {
    marginTop: 20,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
