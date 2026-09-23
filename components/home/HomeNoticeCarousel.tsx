// ============================================================================
// 홈 맨 위 알림 배너 — 한 장씩 옆으로 넘긴다 (2026-09-21)
//
// 전에는 초대 배너와 답해야 할 일 배너가 각각 세로로 전부 쌓였다. 답할 일이
// 서너 개만 돼도 화면 위쪽을 다 먹어서, 정작 내 여행 선반이 한참 아래로
// 밀렸다. 한 장만 보여주고 나머지는 옆으로 넘기게 한다.
//
// ⚠️ **두 묶음을 하나의 캐러셀로 합친다.** (2026-09-21 다빈)
//    전에는 초대 배너 아래에 행동 배너가 붙어 '한 줄기' 로 읽히게 두었다.
//    한쪽만 캐러셀로 바꾸면 그 줄기가 끊기고 1/2 · 1/3 이 위아래로 두 개
//    생긴다. 둘 다 '지금 답해야 할 것' 이라 사용자에게는 한 무더기다.
//    순서는 초대가 먼저다 — 답하지 않으면 여행이 시작되지 않는다.
//
// ⚠️ **한 장만 온전히 보이고, 저절로 넘어간다.** (2026-09-23 팀 의견 · 다빈)
//    앞선 두 결정을 함께 뒤집은 것이라 경위를 남긴다.
//
//    (1) 09-21 에는 "자동으로 넘기지 않는다" 로 정했었다. 이건 버튼을 눌러
//        답하는 물건이라 누르려는 순간 넘어가면 엉뚱한 걸 누른다는 이유였다.
//        그 위험은 지금도 그대로다. 대신 useAutoCarousel 이 손이 닿는 순간
//        멈추고(handleTouch · 8초), 여기서는 드래그뿐 아니라 **탭에도**
//        멈추게 onTouchStart 를 같이 건다. 손가락이 내려앉으면 화면은 선다.
//
//    (2) 09-22 에는 다음 장을 20px 드러내(CARD_PEEK) 넘길 수 있다는 것을
//        알렸다. 그 일을 이제 **움직임 자체가** 한다 — 저절로 넘어가는 것이
//        옆에 더 있다는 가장 분명한 신호다. 잘린 조각이 없어져 한 장이
//        온전히 보이고, 카드 폭도 화면 폭 그대로 돌아온다.
//
//    남는 것: 숫자 알약. 몇 개가 더 있는지는 움직임이 말해주지 않는다.
//
// ⚠️ 2026-09-17 에는 "개수를 줄이거나 접지 않는다" 로 정했었다. 답하면 사라지는
//    것들이라 바로 답하게 하려던 것이다. 하나만 보이면 나머지는 덜 답하게
//    된다는 대가를 알고 뒤집었다. 대신 몇 개가 더 있는지를 숫자로 또렷이
//    알린다. (2026-09-21 다빈)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { ScrollView, useWindowDimensions, View } from 'react-native';

import type { TripAction } from '@/lib/trip/tripActions';

import { HomeActionBanner } from './HomeActionBanner';
import { InviteBanner } from './InviteBanner';
import type { HomeInvite } from './types';
import { useAutoCarousel } from './useAutoCarousel';

/** 홈 좌우 여백(px-4) 합. 배너 폭을 화면 폭에서 이만큼 뺀다. */
const SCREEN_PADDING = 32;
/** 장 사이 간격. */
const CARD_GAP = 12;

export type HomeNoticeCarouselProps = {
  /** 답하지 않은 초대. 없으면 빈 배열. */
  invites: HomeInvite[];
  /** 참여 요청을 보내는 중인 초대의 token. 없으면 null. */
  requestingToken: string | null;
  onRequestJoin: (token: string) => void;
  onDecline: (token: string) => void;

  /** 답해야 할 일. 없으면 빈 배열. */
  actions: TripAction[];
  onPressAction: (action: TripAction) => void;
};

export function HomeNoticeCarousel({
  invites,
  requestingToken,
  onRequestJoin,
  onDecline,
  actions,
  onPressAction,
}: HomeNoticeCarouselProps) {
  const { width } = useWindowDimensions();

  const total = invites.length + actions.length;

  /** 한 장이 화면을 꽉 채운다. 잘린 조각을 남기지 않는다. (2026-09-23) */
  const cardWidth = Math.max(0, width - SCREEN_PADDING);
  const step = cardWidth + CARD_GAP;

  /**
   * 저절로 넘긴다. 여행 카드 캐러셀과 **같은 훅**을 쓴다.
   *
   * 주기 · 손댔을 때 멈추는 시간 · '동작 줄이기' 대응이 한 곳에 있어야
   * 홈의 두 캐러셀이 따로 놀지 않는다. (useAutoCarousel 머리말)
   *
   * ⚠️ 한 장씩 꽉 차므로 마지막 장이 그대로 끝이다. lastIndex 를 주지 않는다.
   */
  const { ref, handleScroll, handleTouch } = useAutoCarousel({ count: total, step });

  /**
   * 각 장이 자기 번호를 그린다. 한 장뿐이면 없다 — '1/1' 은 알려주는 게 없다.
   *
   * ⚠️ 지금 몇 번째인지를 따로 재지 않는다. 보이는 장이 곧 자기 번호를 들고
   *    있어서 스크롤을 추적할 이유가 없다. 넘기는 도중에도 숫자가 어긋나지 않는다.
   */
  const counterAt = (index: number) => (total > 1 ? `${index + 1}/${total}` : undefined);

  /*
    ⚠️ 2026-09-22 초대 모달(InviteModal)을 뺐다. 초대는 이 캐러셀의 배너로만 알린다.
       (app/(tabs)/index.tsx 의 invites 주석)
  */
  return (
    <>
      {total > 0 ? (
        <View className="mb-6">
          <ScrollView
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onScrollBeginDrag={handleTouch}
            onScrollEndDrag={handleTouch}
            /*
              ⚠️ 여행 카드 캐러셀에는 없는 줄이다. 거기는 카드를 눌러 들어가기만
                 하지만 여기는 **버튼이 있다.** 드래그만 감지하면 버튼을 누르려고
                 손가락을 올린 순간에도 화면이 계속 움직인다. 손이 닿으면 선다.
            */
            onTouchStart={handleTouch}
            scrollEventThrottle={16}
            // 한 장씩 딱 멈추게 한다. 배너가 화면보다 좁아서 pagingEnabled 로는 안 맞는다.
            snapToInterval={step}
            decelerationRate="fast"
            // 장마다 높이가 다르다. stretch 로 두면 짧은 배너가 늘어나 버린다.
            contentContainerStyle={{ gap: CARD_GAP, alignItems: 'flex-start' }}
          >
            {/* 초대가 먼저다. 답하지 않으면 그 여행이 시작되지 않는다. */}
            {invites.map((invite, index) => (
              <View key={`invite:${invite.token}`} style={{ width: cardWidth }}>
                <InviteBanner
                  invite={invite}
                  // 한 번에 하나만 보낸다. 다른 초대 버튼도 같이 막아 요청이 겹치지 않게 한다.
                  requesting={requestingToken !== null}
                  onRequestJoin={() => onRequestJoin(invite.token)}
                  onDecline={() => onDecline(invite.token)}
                  counter={counterAt(index)}
                />
              </View>
            ))}

            {actions.map((action, index) => (
              <View key={`action:${action.id}`} style={{ width: cardWidth }}>
                <HomeActionBanner
                  action={action}
                  onPress={() => onPressAction(action)}
                  // 초대가 앞에 오므로 그만큼 밀린다.
                  counter={counterAt(invites.length + index)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}
