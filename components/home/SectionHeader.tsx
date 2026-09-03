import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Props = {
  title: string;
  /** 오른쪽 링크 글자. 없으면 링크를 그리지 않는다. */
  actionLabel?: string;
  onPressAction?: () => void;
};

/**
 * 홈 섹션 제목 줄. 왼쪽 제목 + 오른쪽 '모두 보기 >'.
 *
 * 섹션마다 제목 크기가 달라지지 않게 한 곳에서 정한다.
 */
export function SectionHeader({ title, actionLabel, onPressAction }: Props) {
  return (
    <View className="mb-2.5 flex-row items-center justify-between">
      {/* 크기·굵기는 trip-home 카드 제목(16 / 800 / -0.5)과 같은 단이다. */}
      <Text
        className="text-pot-ink"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
      >
        {title}
      </Text>

      {actionLabel && onPressAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onPressAction}
          hitSlop={8}
          className="flex-row items-center active:opacity-60"
        >
          <Text className="text-pot-mute" style={{ fontSize: 12 }}>
            {actionLabel}
          </Text>
          <Ionicons name="chevron-forward" size={13} color="#747B88" />
        </Pressable>
      ) : null}
    </View>
  );
}
