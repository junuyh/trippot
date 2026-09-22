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
// ⚠️ **자동으로 넘기지 않는다.** (2026-09-21 다빈)
//    useAutoCarousel 을 쓰지 않는 유일한 홈 캐러셀이다. 여행 카드는 구경거리라
//    저절로 넘어가도 되지만, 이건 버튼을 눌러 답하는 물건이다. 누르려는 순간
//    넘어가면 엉뚱한 걸 누른다.
//
// ⚠️ **다음 장이 오른쪽에 살짝 드러난다.** (2026-09-22 다빈 · CARD_PEEK)
//    처음 낸 판은 카드 폭이 화면에 딱 맞아떨어져서, 옆에 뭐가 더 있다는 신호가
//    아무 데도 없었다. 숫자는 몇 개인지만 말한다. 잘린 다음 장이 넘길 수 있다는
//    것을 말하는 유일한 장치다. 장이 하나뿐이면 드러낼 게 없으니 원래 폭을 쓴다.
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
import { InviteModal } from './InviteModal';
import type { HomeInvite } from './types';

/** 홈 좌우 여백(px-4). 캐러셀이 -mx-4 로 이 여백을 뚫고 나가 안쪽에서 다시 준다. */
const SCREEN_EDGE = 16;
/** 장 사이 간격. */
const CARD_GAP = 12;
/**
 * 다음 장이 오른쪽에 드러나는 폭(px).
 *
 * ⚠️ **넘길 수 있다는 걸 알리는 건 이것뿐이다.** (2026-09-22 다빈)
 *    전에는 카드 폭이 화면에 딱 맞아떨어져서(화면 - 좌우 여백) 옆에 뭐가 더
 *    있다는 신호가 아무 데도 없었다. 숫자 '1/3' 은 몇 개인지만 말하지 넘길 수
 *    있다는 말은 한 번도 하지 않는다.
 *
 * ⚠️ 그래서 캐러셀만 -mx-4 로 홈의 좌우 여백 밖으로 나간다. 여백 안에 갇히면
 *    다음 장이 화면 끝이 아니라 여백 앞에서 잘려, '화면 밖으로 이어진다' 가
 *    아니라 '카드가 하나 더 있다' 로만 보인다. 안쪽 paddingHorizontal 이
 *    원래 여백을 대신한다. HomeView 는 건드리지 않는다.
 */
const CARD_PEEK = 30;

export type HomeNoticeCarouselProps = {
  /** 답하지 않은 초대. 없으면 빈 배열. */
  invites: HomeInvite[];
  /** 지금 모달로 띄울 초대. 한 초대에 한 번만 온다. 없으면 null. */
  modalInvite: HomeInvite | null;
  /** 참여 요청을 보내는 중인 초대의 token. 없으면 null. */
  requestingToken: string | null;
  onRequestJoin: (token: string) => void;
  onDecline: (token: string) => void;
  onCloseModal: () => void;

  /** 답해야 할 일. 없으면 빈 배열. */
  actions: TripAction[];
  onPressAction: (action: TripAction) => void;
};

export function HomeNoticeCarousel({
  invites,
  modalInvite,
  requestingToken,
  onRequestJoin,
  onDecline,
  onCloseModal,
  actions,
  onPressAction,
}: HomeNoticeCarouselProps) {
  const { width } = useWindowDimensions();

  const total = invites.length + actions.length;

  /**
   * 한 장뿐이면 **화면 폭 그대로** 쓴다. (2026-09-22 다빈)
   * 드러낼 다음 장이 없는데 자리만 비워 두면 카드가 이유 없이 좁아 보인다.
   */
  const cardWidth = Math.max(
    0,
    width - SCREEN_EDGE * 2 - (total > 1 ? CARD_PEEK : 0),
  );
  const step = cardWidth + CARD_GAP;

  /**
   * 각 장이 자기 번호를 그린다. 한 장뿐이면 없다 — '1/1' 은 알려주는 게 없다.
   *
   * ⚠️ 지금 몇 번째인지를 따로 재지 않는다. 보이는 장이 곧 자기 번호를 들고
   *    있어서 스크롤을 추적할 이유가 없다. 넘기는 도중에도 숫자가 어긋나지 않는다.
   */
  const counterAt = (index: number) => (total > 1 ? `${index + 1}/${total}` : undefined);

  return (
    <>
      {total > 0 ? (
        <View className="-mx-4 mb-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // 한 장씩 딱 멈추게 한다. 배너가 화면보다 좁아서 pagingEnabled 로는 안 맞는다.
            snapToInterval={step}
            decelerationRate="fast"
            // 장마다 높이가 다르다. stretch 로 두면 짧은 배너가 늘어나 버린다.
            // 좌우 여백은 여기서 준다 — 바깥 -mx-4 로 뚫고 나온 것을 되돌리는 값이다.
            contentContainerStyle={{
              gap: CARD_GAP,
              alignItems: 'flex-start',
              paddingHorizontal: SCREEN_EDGE,
            }}
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

      {/*
        모달은 캐러셀 밖이다. 초대가 몇 번째 장이든 화면 전체를 덮어야 하고,
        넘기는 것과 무관하게 뜨고 닫힌다.
      */}
      <InviteModal
        invite={modalInvite}
        requesting={modalInvite !== null && requestingToken === modalInvite.token}
        onRequestJoin={() => {
          if (modalInvite) onRequestJoin(modalInvite.token);
        }}
        onDecline={() => {
          if (modalInvite) onDecline(modalInvite.token);
        }}
        onClose={onCloseModal}
      />
    </>
  );
}
