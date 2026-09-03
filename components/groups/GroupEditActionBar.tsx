import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui';

type Props = {
  selectedCount: number;
  hiddenCount: number;
  saving: boolean;
  onPressRemove: () => void;
  onPressHidden: () => void;
};

/**
 * 편집 모드 하단 액션 바.
 *
 * '목록에서 숨김' 은 선택된 카드가 있을 때만 활성화된다.
 * '숨긴 모임 N개 보기' 는 숨긴 모임이 있을 때만 나온다. 일반 모드에는 노출하지 않는다.
 *
 * ⚠️ 순서 관련 항목은 두지 않는다. 편집 모드는 숨기기/다시 표시만 담당한다.
 *    (2026-09-03 정책 — 사용자 지정 순 제거)
 */
export function GroupEditActionBar({
  selectedCount,
  hiddenCount,
  saving,
  onPressRemove,
  onPressHidden,
}: Props) {
  return (
    // ⚠️ pb-28 은 하단 탭바 자리다. FloatingTabBar 가 화면 위에 떠 있어(absolute)
    //    이 바의 아래쪽을 덮는다. pb-8 이었을 때는 '목록에서 숨김' 과
    //    '숨긴 모임 N개 보기' 가 탭바 밑에 깔려 아예 눌리지 않았다.
    //    바 높이 50 + 안전영역을 덮는 값으로, 다른 탭 화면이 쓰는 값과 같다.
    //    (app/(tabs)/_layout.tsx 주석)
    <View className="border-t border-pot-line bg-white px-4 pb-28 pt-3">
      {hiddenCount > 0 ? (
        <View className="mb-3 flex-row items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`숨긴 모임 ${hiddenCount}개 보기`}
            disabled={saving}
            hitSlop={8}
            onPress={onPressHidden}
            className="rounded-lg px-1 py-1 active:opacity-60"
          >
            <Text className="text-pot-ink" style={{ fontSize: 12.5 }}>{`숨긴 모임 ${hiddenCount}개 보기`}</Text>
          </Pressable>
        </View>
      ) : null}

      <Button
        label={
          selectedCount > 0 ? `목록에서 숨김 (${selectedCount})` : '목록에서 숨김'
        }
        variant="secondary"
        disabled={selectedCount === 0}
        loading={saving}
        onPress={onPressRemove}
      />
    </View>
  );
}
