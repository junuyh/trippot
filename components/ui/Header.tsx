import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  title: string;
  /** 뒤로가기 버튼 노출. 기본 true. */
  showBack?: boolean;
  /** 오른쪽 영역 (버튼 등). */
  right?: ReactNode;
};

/**
 * Stack 헤더를 `headerShown: false` 로 끄고 직접 그릴 때 쓴다.
 * 기본 Stack 헤더로 충분하면 이 컴포넌트를 쓰지 않아도 된다.
 */
export function Header({ title, showBack = true, right }: Props) {
  return (
    <View className="h-14 flex-row items-center border-b border-gray-100 bg-white px-2">
      {showBack && router.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </Pressable>
      ) : (
        <View className="w-10" />
      )}

      <Text numberOfLines={1} className="flex-1 text-center text-lg font-semibold text-gray-900">
        {title}
      </Text>

      <View className="min-w-10 items-end pr-2">{right}</View>
    </View>
  );
}
