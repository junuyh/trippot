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
// ⚠️ 2026-09-17 에는 "개수를 줄이거나 접지 않는다" 로 정했었다. 답하면 사라지는
//    것들이라 바로 답하게 하려던 것이다. 하나만 보이면 나머지는 덜 답하게
//    된다는 대가를 알고 뒤집었다. 대신 몇 개가 더 있는지를 숫자로 또렷이
//    알린다. (2026-09-21 다빈)
//
// 데이터만 props 로 받는다. supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { TripAction } from '@/lib/trip/tripActions';

import { HomeActionBanner } from './HomeActionBanner';
import { InviteBanner } from './InviteBanner';
import { InviteModal } from './InviteModal';
import type { HomeInvite } from './types';

/** 홈 좌우 여백(px-4) 합. 배너 폭을 화면 폭에서 이만큼 뺀다. */
const SCREEN_PADDING = 32;
/** 장 사이 간격. */
const CARD_GAP = 12;

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
  const cardWidth = Math.max(0, width - SCREEN_PADDING);
  const step = cardWidth + CARD_GAP;

  const [page, setPage] = useState(0);

  const total = invites.length + actions.length;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / step);
    // 같은 값을 다시 넣어 불필요한 렌더를 만들지 않는다.
    setPage((prev) => (prev === next ? prev : next));
  };

  return (
    <>
      {total > 0 ? (
        <View className="mb-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            // 한 장씩 딱 멈추게 한다. 배너가 화면보다 좁아서 pagingEnabled 로는 안 맞는다.
            snapToInterval={step}
            decelerationRate="fast"
            // 장마다 높이가 다르다. stretch 로 두면 짧은 배너가 늘어나 버린다.
            contentContainerStyle={{ gap: CARD_GAP, alignItems: 'flex-start' }}
          >
            {/* 초대가 먼저다. 답하지 않으면 그 여행이 시작되지 않는다. */}
            {invites.map((invite) => (
              <View key={`invite:${invite.token}`} style={{ width: cardWidth }}>
                <InviteBanner
                  invite={invite}
                  // 한 번에 하나만 보낸다. 다른 초대 버튼도 같이 막아 요청이 겹치지 않게 한다.
                  requesting={requestingToken !== null}
                  onRequestJoin={() => onRequestJoin(invite.token)}
                  onDecline={() => onDecline(invite.token)}
                />
              </View>
            ))}

            {actions.map((action) => (
              <View key={`action:${action.id}`} style={{ width: cardWidth }}>
                <HomeActionBanner action={action} onPress={() => onPressAction(action)} />
              </View>
            ))}
          </ScrollView>

          {total > 1 ? <PageCount page={page} total={total} /> : null}
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

/**
 * 몇 장 중 몇 번째인지.
 *
 * ⚠️ 점이 아니라 숫자다. (2026-09-21 다빈) 여행 카드는 점을 쓰지만 그건
 *    구경거리라 몇 장인지가 중요하지 않다. 여기는 답할 일이 몇 개 남았는지가
 *    정보라서, 점을 세게 하지 않고 그대로 적는다.
 *
 * ⚠️ 한 장뿐이면 부르지 않는다. '1/1' 은 알려주는 게 없다.
 */
function PageCount({ page, total }: { page: number; total: number }) {
  // 넘기는 도중 반올림이 범위를 벗어날 수 있다. 화면에 0/3 이나 4/3 을 내보내지 않는다.
  const current = Math.min(Math.max(page + 1, 1), total);

  return (
    <View className="mt-2.5 flex-row items-center justify-center">
      <Text
        accessibilityRole="text"
        accessibilityLabel={`답해야 할 일 ${total}개 중 ${current}번째`}
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: '#6b7280',
          fontVariant: ['tabular-nums'],
        }}
      >
        {current}/{total}
      </Text>
    </View>
  );
}
