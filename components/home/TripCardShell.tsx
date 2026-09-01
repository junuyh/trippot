// HOME-01 여행 카드 껍데기.
//
// 항공권 검색 결과 카드 형태다. 왼쪽 모서리에만 색 띠를 세운다.
// 띠 색은 목적지 국가 테마에서 온다. (lib/constants/countryTheme)
//
// ⚠️ 색은 이 띠와 준비율 배지에만 쓴다. 카드 본문은 화이트·쿨그레이다.
//    (countryTheme.ts — 배경과 기본 카드는 항상 화이트·쿨그레이)
import { Pressable, View } from 'react-native';

const ACCENT_WIDTH = 6;

type Props = {
  /** 왼쪽 띠 색. 보통 국가 테마의 primary. */
  accentColor: string;
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  /** 지나간 여행. 톤을 낮춘다. */
  muted?: boolean;
};

export function TripCardShell({
  accentColor,
  children,
  accessibilityLabel,
  onPress,
  muted = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="flex-row overflow-hidden rounded-[20px] bg-white active:opacity-80"
      style={{
        opacity: muted ? 0.88 : 1,
        shadowColor: '#111827',
        shadowOpacity: 0.07,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <View style={{ width: ACCENT_WIDTH, backgroundColor: accentColor }} />
      <View className="flex-1 px-5 py-[18px]">{children}</View>
    </Pressable>
  );
}
