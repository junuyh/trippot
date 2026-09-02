import { Pressable, Text, View } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  /** 마지막 항목이면 아래 구분선을 그리지 않는다. */
  isLast?: boolean;
};

/**
 * 메뉴 한 줄. 커뮤니티·설정 섹션이 함께 쓴다.
 *
 * ⚠️ chevron 을 넣지 않는다. 확정된 디자인에서는 chevron 을 반복 배치하지 않고
 *    list row + divider 로 이동 가능함을 표현한다.
 *
 * ⚠️ 로그아웃은 이 컴포넌트를 쓰지 않는다. navigation 이 아니라 action 이라
 *    같은 줄 모양에 끼워 넣지 않는다.
 */
export function MenuRow({ label, onPress, isLast = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:bg-pot-visual"
    >
      <View className={`py-3.5 ${isLast ? '' : 'border-b border-pot-line'}`}>
        <Text className="text-base leading-6 text-pot-ink">{label}</Text>
      </View>
    </Pressable>
  );
}
