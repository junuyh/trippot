import { ActivityIndicator, Text, View } from 'react-native';

type Props = {
  message?: string;
  /** 화면 전체를 채운다. 기본 true. false 면 컨텐츠 크기만 차지한다. */
  fullScreen?: boolean;
};

/** 화면 4상태 중 Loading. (CLAUDE.md 9장) */
export function Loading({ message, fullScreen = true }: Props) {
  return (
    <View className={`items-center justify-center ${fullScreen ? 'flex-1 bg-white' : 'py-10'}`}>
      <ActivityIndicator size="large" color="#2563eb" />
      {message ? <Text className="mt-3 text-sm text-gray-500">{message}</Text> : null}
    </View>
  );
}
