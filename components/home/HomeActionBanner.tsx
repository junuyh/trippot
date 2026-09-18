// ============================================================================
// 홈 · 지금 답해야 할 일 배너 (2026-09-17)
//
// ⚠️ **경민님 초대 배너(InviteBanner)와 같은 문법이다.** 테두리 1 · radius 16 ·
//    px16 py14 · 아이콘 20 · 제목 15/700 · 부제 13 · 버튼 h36 r10 px14 오른쪽 아래.
//    값을 임의로 바꾸지 않는다 — 홈에서 초대 · 승인 대기 · 취소 요청이 나란히
//    뜨는데 문법이 갈리면 서로 다른 기능처럼 읽힌다. (2026-09-17 다빈)
//    색과 아이콘만 성격에 따라 바뀐다. (lib/constants/toneColor)
//
// ⚠️ 여행 홈 배너(JoinRequestBanner · CancelPendingBanner)와 **모양이 다른 건
//    의도다.** 여행 홈은 그 여행 안이라 크게 써도 되지만, 홈은 여행 카드 ·
//    초대 배너와 자리를 다툰다. 대신 **문구는 두 화면이 같은 함수에서 받는다.**
//    (lib/trip/tripActions) 갈려도 되는 건 껍데기뿐이다.
//
// ⚠️ action.note 를 그리지 않는다. 여행 홈 맥락 문장이다. (tripActions 주석 참조)
//
// ⚠️ 버튼은 하나다. 수락 · 동의를 여기서 하지 않고 그 화면으로 보낸다.
//    여기에 또 만들면 같은 흐름이 두 벌이 된다. (2026-09-17 다빈)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { ActionIcon } from '@/components/ui/ActionIcon';
import { Pressable, Text, View } from 'react-native';

import { TONE } from '@/lib/constants/toneColor';
import type { TripAction } from '@/lib/trip/tripActions';

type Props = {
  action: TripAction;
  onPress: () => void;
};

export function HomeActionBanner({ action, onPress }: Props) {
  const c = TONE[action.tone];

  return (
    <View
      accessibilityRole="summary"
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.tint,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View className="flex-row items-start">
        {/* ⚠️ icon 은 lib 에서 문자열로 온다. 순수 함수가 @expo/vector-icons 타입을
               물고 오지 않게 한 것이다. ActionRequiredSection 도 같은 방식이다 */}
        <ActionIcon name={action.icon} size={20} color={c.fg} style={{ marginTop: 1 }} />
        <View className="ml-2.5 flex-1">
          <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 20, color: c.fg }}>
            {action.headline}
          </Text>
          {/* ⚠️ 홈에서만 여행 이름을 붙인다. 여행이 여럿이라 어느 여행인지 말해야 한다 */}
          <Text style={{ marginTop: 2, fontSize: 13, color: c.body }}>
            {action.tripLabel} · {action.meta}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.headline} ${action.ctaLabel}`}
          onPress={onPress}
          className="active:opacity-90"
          style={{
            height: 36,
            minWidth: 104,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            backgroundColor: c.fg,
            paddingHorizontal: 14,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
            {action.ctaLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * 배너 목록. 기존 사용자 홈과 신규 사용자 홈이 함께 쓴다.
 *
 * ⚠️ 간격·아래 여백을 InvitePrompt 와 **같은 값**으로 둔다(gap-2.5 · mb-6).
 *    초대 배너 바로 아래에 붙어서 두 덩이가 한 줄기로 읽혀야 한다.
 *
 * ⚠️ 개수를 줄이거나 접지 않는다. 답하면 사라지는 것들이고, 바로 답하라고
 *    홈에 올린 것이다. 경민님 초대 배너가 같은 이유로 상한을 두지 않는다.
 *    (2026-09-17 다빈)
 */
export function HomeActionBanners({
  actions,
  onPressAction,
}: {
  actions: TripAction[];
  onPressAction: (action: TripAction) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <View className="mb-6 gap-2.5">
      {actions.map((action) => (
        <HomeActionBanner
          key={action.id}
          action={action}
          onPress={() => onPressAction(action)}
        />
      ))}
    </View>
  );
}
