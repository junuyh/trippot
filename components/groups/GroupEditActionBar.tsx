import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  selectedCount: number;
  hiddenCount: number;
  /** 사용자 지정 순일 때만 초기화 진입점을 노출한다. */
  canResetOrder: boolean;
  saving: boolean;
  onPressRemove: () => void;
  onPressHidden: () => void;
  onPressResetOrder: () => void;
};

/**
 * 편집 모드 하단 액션 바.
 *
 * '목록에서 제거' 는 선택된 카드가 있을 때만 활성화된다.
 * '숨긴 모임 N개 보기' 는 숨긴 모임이 있을 때만 나온다. 일반 모드에는 노출하지 않는다.
 * '모임 생성일 순으로 초기화' 는 현재가 사용자 지정 순일 때만 나온다.
 */
export function GroupEditActionBar({
  selectedCount,
  hiddenCount,
  canResetOrder,
  saving,
  onPressRemove,
  onPressHidden,
  onPressResetOrder,
}: Props) {
  return (
    <View className="border-t border-gray-200 bg-white px-5 pb-8 pt-3">
      {hiddenCount > 0 || canResetOrder ? (
        <View className="mb-3 flex-row items-center justify-between">
          {hiddenCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`숨긴 모임 ${hiddenCount}개 보기`}
              disabled={saving}
              hitSlop={8}
              onPress={onPressHidden}
              className="rounded-lg px-1 py-1 active:bg-gray-100"
            >
              <Text className="text-sm text-blue-600">{`숨긴 모임 ${hiddenCount}개 보기`}</Text>
            </Pressable>
          ) : (
            <View />
          )}

          {canResetOrder ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="모임 생성일 순으로 초기화"
              disabled={saving}
              hitSlop={8}
              onPress={onPressResetOrder}
              className="rounded-lg px-1 py-1 active:bg-gray-100"
            >
              <Text className="text-sm text-gray-500">모임 생성일 순으로 초기화</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Button
        label={
          selectedCount > 0 ? `목록에서 제거 (${selectedCount})` : '목록에서 제거'
        }
        variant="secondary"
        disabled={selectedCount === 0}
        loading={saving}
        onPress={onPressRemove}
      />
    </View>
  );
}
