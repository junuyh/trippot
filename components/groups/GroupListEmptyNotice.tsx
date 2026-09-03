import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type Props = {
  /** 편집 모드면 문구가 바뀌고 배경을 화면에 맡긴다. */
  editMode: boolean;
};

/**
 * 보이는 모임이 0개인데 숨긴 모임은 있는 상태의 안내.
 *
 * ⚠️ components/ui/EmptyState 를 쓰지 않는 이유
 *    그 컴포넌트는 내부에서 bg-white 를 칠한다. 편집 모드 배경(bg-gray-50)과
 *    이어지게 하려면 배경을 비워야 하는데, 부모 wrapper 로는 자식 배경을 덮을 수 없다.
 *    공유 컴포넌트라 수정하지 않고(CLAUDE.md 5장) 이 상태 전용으로만 따로 둔다.
 *    참여 중인 모임이 아예 없는 상태는 계속 EmptyState 를 쓴다.
 *
 * ⚠️ 배경을 칠하지 않는다. 화면이 칠한 색(일반 흰색 / 편집 회색)을 그대로 받는다.
 *
 * 최종 디자인 시안 적용 전이라 최소한으로만 구분한다. 여백·색·강도를 지금 확정하지 않는다.
 */
export function GroupListEmptyNotice({ editMode }: Props) {
  const title = editMode
    ? '숨긴 모임을 다시 표시할 수 있어요.'
    : '목록에서 숨긴 모임이 있어요.';
  const description = editMode
    ? '아래의 숨긴 모임 보기에서 다시 표시해보세요.'
    : '편집에서 다시 표시할 수 있어요.';

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name="eye-off-outline" size={44} color="#d1d5db" />
      <Text className="mt-4 text-center text-base font-semibold text-pot-ink">{title}</Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-pot-mute">{description}</Text>
    </View>
  );
}
