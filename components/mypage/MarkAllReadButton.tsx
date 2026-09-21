import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = {
  /** 안 읽은 알림이 하나라도 있는가(DB + 기기 보관함). 없으면 회색 비활성으로 남긴다. */
  enabled: boolean;
  /** 처리 중. 중복 탭을 막고 스피너를 보여준다. */
  busy: boolean;
  onPress: () => void;
};

/**
 * 알림센터 헤더 오른쪽 [모두 읽음]. (2026-09-20)
 *
 * ⚠️ 작은 글자 액션이다. 필터 칩 줄과 겹치지 않도록 헤더에 둔다(Stack.Screen headerRight).
 *    다른 화면의 headerRight(여행 홈 톱니 · 정산 홈 버튼)와 같은 자리다.
 * ⚠️ **항상 그린다.** 안 읽은 것이 없으면 같은 자리에 연한 회색으로 남겨 기능이 있다는 것을 알린다.
 *    (처음엔 숨겼는데, 다 읽은 상태에서는 기능의 존재를 알 수 없었다 · 2026-09-20 팀 검토)
 *    헤더 자리가 생겼다 사라지지 않고, iOS 헤더의 빈 슬롯(둥근 유리 원)도 생기지 않는다.
 * ⚠️ 비활성일 때는 스피너를 그리지 않는다. 스피너는 처리 중(busy)에만.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function MarkAllReadButton({ enabled, busy, onPress }: Props) {
  const disabled = !enabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="모두 읽음"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      className="px-1 py-2 active:opacity-60"
    >
      {busy ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text
          className={enabled ? 'text-brand' : 'text-pot-faint'}
          // 가운데 제목 '알림'(네이티브 17 semibold)보다 한 단계 아래. 굵게 키우지 않는다. (2026-09-20)
          style={{ fontSize: 13, fontWeight: '600' }}
        >
          모두 읽음
        </Text>
      )}
    </Pressable>
  );
}
