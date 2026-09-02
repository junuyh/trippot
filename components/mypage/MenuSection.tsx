import { Text, View } from 'react-native';

type Props = {
  title: string;
  children: React.ReactNode;
};

/**
 * 섹션 제목 + 굵은 구분선 + 목록.
 *
 * Figma 는 섹션 제목 아래 선을 항목 사이 선보다 두껍게 그어 위계를 나눈다.
 * 그 위계를 유지하되 색은 프로젝트 토큰을 쓴다.
 */
export function MenuSection({ title, children }: Props) {
  return (
    <View>
      <Text className="text-lg font-semibold leading-7 text-pot-ink">{title}</Text>
      <View className="mt-2 border-b-2 border-pot-ink" />
      <View>{children}</View>
    </View>
  );
}
