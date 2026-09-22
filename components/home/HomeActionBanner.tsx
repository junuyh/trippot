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
  /**
   * '2/5'. 캐러셀이 넘겨준다. 한 장뿐이면 오지 않는다.
   *
   * ⚠️ **제목 줄 오른쪽 끝**이다. (2026-09-22 다빈)
   *    카드 밖 아래 → 배너와 떨어져 보여서 무엇의 개수인지 읽히지 않았다.
   *    버튼 줄 왼쪽 → 버튼과 같은 줄이라 둘이 서로 눈길을 다퉜다. 버튼을
   *    오른쪽에 그대로 두기로 하면서 이 자리를 비웠다.
   *
   * ⚠️ 제목과 **같은 줄에 나란히** 둔다. 겹쳐 띄우지 않는다. 제목은 두 줄까지
   *    늘어나고(‘○○님 외 2명이 참여 의사를 보냈어요’), 띄워 두면 그때 글자를
   *    덮는다. 대신 제목이 쓸 수 있는 폭이 그만큼 줄어든다.
   */
  counter?: string;
};

export function HomeActionBanner({ action, onPress, counter }: Props) {
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
        {counter ? <BannerCounter text={counter} color={c.body} /> : null}
      </View>

      {/*
        ⚠️ 버튼은 **오른쪽**이다. 가운데로 옮기자는 안이 있었는데, 배너 네 종류
           중 버튼이 둘인 건 초대 배너 하나뿐이고 나머지 셋은 하나다. 104 짜리
           버튼 하나를 340 카드 한가운데 두면 양옆이 118 씩 비어 떠 보인다.
           (2026-09-22 다빈 확인)
      */}
      <View className="mt-3 flex-row items-center justify-end">
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
 * 몇 장 중 몇 번째인지. 초대 배너와 **같은 모양**을 쓴다.
 *
 * ⚠️ 점이 아니라 숫자다. (2026-09-21 다빈 · 2026-09-22 재확인) 여행 카드는
 *    점을 쓰지만 그건 구경거리라 몇 장인지가 중요하지 않다. 여기는 답할 일이
 *    몇 개 남았는지가 정보라서 세게 하지 않고 그대로 적는다.
 *    점 세 개는 세어야 알고, 답할 일이 대여섯 개가 되면 세기를 포기한다.
 *
 * ⚠️ **알약으로 감싼다.** (2026-09-22 다빈) 맨 숫자는 부제와 같은 회색 계열
 *    작은 글씨라 본문의 일부처럼 흘러갔다. 채워진 도형이라야 별개의 표시로
 *    읽힌다.
 *
 * ⚠️ 바탕은 그 톤의 **부제 글자색**(TONE[tone].body)이다. 기준색(fg)으로
 *    채우면 CTA 버튼과 같은 색이라 눈길을 다투고, 흰 바탕 + 기준색 테두리는
 *    초대 배너의 '거절하기' 와 구성이 똑같아 누를 수 있는 것처럼 보인다.
 *    body 는 어떤 버튼도 쓰지 않는 색이라 그 혼동이 없다.
 *
 * ⚠️ 9 는 이 서비스에서 **읽으라고 쓰는 가장 작은 글자**다. 7~8.5 도 있지만
 *    전부 여권·영수증 카드의 장식용 대문자 줄이다. 흰 글자 대 진한 바탕이라
 *    이 크기에서도 읽힌다. (2026-09-22 다빈)
 */
export function BannerCounter({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        marginLeft: 10,
        // 제목이 길어도 알약이 눌리지 않게 한다. 눌리면 숫자가 줄바꿈된다.
        flexShrink: 0,
        height: 18,
        justifyContent: 'center',
        paddingHorizontal: 7,
        borderRadius: 9,
        backgroundColor: color,
      }}
    >
      <Text
        accessibilityLabel={`${text.split('/')[1]}개 중 ${text.split('/')[0]}번째`}
        style={{
          fontSize: 9,
          fontWeight: '800',
          color: '#FFFFFF',
          // 넘길 때마다 숫자 폭이 달라져 알약이 들썩이지 않게 한다
          fontVariant: ['tabular-nums'],
        }}
      >
        {text}
      </Text>
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
