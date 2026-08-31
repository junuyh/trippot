import { Pressable, Text, View } from 'react-native';

type Props = {
  top: React.ReactNode;
  bottom: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  /** 지나간 여행. 톤을 낮춘다. */
  muted?: boolean;
};

/** 절취선의 구멍 개수. 카드 폭이 바뀌어도 균등하게 퍼진다. */
const PERFORATION_DOTS = 18;

/**
 * 티켓 카드 껍데기.
 *
 * 위·아래 두 칸을 절취선으로 나누고 양옆을 파낸다.
 * 절취선은 점선 테두리가 아니라 **바탕색 구멍을 실제로 뚫어** 표현한다.
 * 점선은 화면에 따라 굵기가 들쭉날쭉하고 종이 느낌이 안 난다.
 *
 * 옆 홈과 구멍은 페이지 바탕(pot-stone)과 같은 색이다.
 * 그래서 카드가 이 바탕 위에 있어야 파인 것처럼 보인다.
 */
export function TicketCard({ top, bottom, accessibilityLabel, onPress, muted = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`overflow-hidden rounded-[20px] ${muted ? 'bg-pot-paper/70' : 'bg-pot-paper'} active:opacity-70`}
    >
      <View className="px-5 pb-4 pt-5">{top}</View>

      {/* 절취선 — 양옆 반원 홈 + 가운데 구멍 줄 */}
      <View className="h-4 flex-row items-center">
        <View className="-ml-2 h-4 w-4 rounded-full bg-pot-stone" />
        <View className="flex-1 flex-row items-center justify-between px-2">
          {Array.from({ length: PERFORATION_DOTS }).map((_, i) => (
            <View key={i} className="h-[3px] w-[3px] rounded-full bg-pot-stone" />
          ))}
        </View>
        <View className="-mr-2 h-4 w-4 rounded-full bg-pot-stone" />
      </View>

      <View className="px-5 pb-5 pt-4">{bottom}</View>
    </Pressable>
  );
}

/** 티켓의 작은 라벨. 참고 이미지의 FROM / TYPE 자리다. */
export function TicketLabel({ children }: { children: string }) {
  return (
    <Text className="text-[10px] font-semibold tracking-[1.4px] text-pot-mute">{children}</Text>
  );
}

/** 라벨 + 값 한 쌍. */
export function TicketField({
  label,
  children,
  align = 'left',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <View className={align === 'right' ? 'items-end' : 'items-start'}>
      <TicketLabel>{label}</TicketLabel>
      <View className="mt-1.5">{children}</View>
    </View>
  );
}
