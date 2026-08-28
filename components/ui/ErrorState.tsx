import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Button } from './Button';

type Props = {
  /** 사용자가 읽을 메시지. 예외 객체를 그대로 노출하지 않는다. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * 화면 4상태 중 Error. (CLAUDE.md 9장)
 * 잘못된 tripId / categoryId 접근에도 Crash 하지 않고 이 화면을 보여준다.
 */
export function ErrorState({
  message = '잠시 후 다시 시도해 주세요.',
  onRetry,
  retryLabel = '다시 시도',
}: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <Ionicons name="alert-circle-outline" size={44} color="#f87171" />
      <Text className="mt-4 text-center text-base font-semibold text-gray-900">
        문제가 생겼어요
      </Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-gray-500">{message}</Text>
      {onRetry ? (
        <View className="mt-6 w-full max-w-xs">
          <Button label={retryLabel} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
