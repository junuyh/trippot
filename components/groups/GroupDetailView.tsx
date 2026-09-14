import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MyTripCard,
  MY_TRIP_FILTER_TABS,
  TripFilterTabs,
  type MyTripFilter,
  type MyTripItem,
} from '@/components/my';
import { TRIP_STATUS } from '@/lib/constants/status';
import { SwipeToAction } from '@/components/mypage';
import { Button } from '@/components/ui';

import { GroupAccountList } from './GroupAccountList';
import { GroupMemberList } from './GroupMemberList';
import { formatCreatedDate, formatMemberCount } from './format';
import type { GroupAccountItem, GroupDetailData } from './types';

/** 탭마다 비었을 때 할 말이 다르다. MY-02 와 같은 문장을 쓴다. */
const TAB_EMPTY_MESSAGE: Record<MyTripFilter, string> = {
  planning: '준비 중인 여행이 없어요.',
  traveling: '지금 여행 중인 여행이 없어요.',
  past: '아직 다녀온 여행 기록이 없어요.',
  canceled: '취소된 여행이 없어요.',
  // ⚠️ 모임 상세에는 '나간 여행' 탭이 없다. 타입(Record)을 채우기 위한 값이다.
  //    나간 여행은 여행 상태가 아니라 membership 이라 lifecycle 탭 안에서
  //    배지로만 보인다. (PR #88 · docs/11 §6 · 2026-09-13)
  left: '나간 여행이 없어요.',
};

/**
 * 모임 상세의 탭 — 여행 **lifecycle** 4개. (docs/11_모임정책_v1.md §6)
 *
 * ⚠️ MY-02 의 MY_TRIP_FILTER_TABS(5개)를 그대로 쓰지 않는다. PR #88 이 그 목록을
 *    MY 전용으로 분리한 이유가 바로 "모임 상세에 '내가 나간 여행' 칸은 뜻에 맞지
 *    않는다" 였다. 취소됨은 여행 자체의 상태라 여기 있다.
 */
const GROUP_TRIP_TABS = MY_TRIP_FILTER_TABS.filter((tab) => tab.value !== 'left');

type Props = {
  group: GroupDetailData;
  onPressTrip: (tripId: string) => void;
  onPressCreateTrip: () => void;
  /**
   * 계좌를 눌렀을 때. 여행이 하나면 바로 이동하고 둘 이상이면 고르게 한다.
   * 어느 쪽인지는 화면 파일이 정한다.
   */
  onPressAccount: (account: GroupAccountItem) => void;
  /** '전체 계좌' 를 눌렀을 때. 모든 계좌를 담은 시트를 연다. */
  onPressAllAccounts: () => void;
  /** 준비 중 여행에서 나가기. 참가자에게만 보인다. */
  onPressLeaveTrip: (trip: MyTripItem) => void;
  /**
   * 나간 여행 카드를 눌렀을 때. 화면이 이유를 알린다 — 이동하지 않는다.
   * 눌러도 아무 일이 없는 카드를 두지 않기 위해서다. (2026-09-12)
   */
  onPressLeftTrip: (trip: MyTripItem) => void;
};

/** 섹션 제목 + 본문. 상세 화면의 블록이 전부 같은 리듬을 갖게 한다. */
export function Section({
  title,
  description,
  titleSuffix,
  right,
  onPress,
  accessibilityLabel,
  children,
}: {
  title: string;
  /** 제목 아래 한 줄 설명. 없으면 그리지 않는다. */
  description?: string;
  /**
   * 제목 **바로 옆**에 붙는 것. 제목과 한 덩어리로 읽힌다.
   *
   * ⚠️ right 와 다르다. right 는 줄 오른쪽 끝으로 밀려 제목과 멀어진다.
   *    멤버 인원처럼 제목에 딸린 값은 옆에 붙어야 한다. (2026-09-09)
   */
  titleSuffix?: React.ReactNode;
  /** 제목 오른쪽 끝에 놓을 것. 없으면 제목만 그린다. */
  right?: React.ReactNode;
  /**
   * 제목 줄 전체를 눌렀을 때.
   *
   * ⚠️ chevron 만 터치 영역으로 두지 않는다. 14px 아이콘 하나는 누르기
   *    어렵고, 옆의 '멤버' 와 '3명' 도 같은 곳으로 가는 말이라 눌러도
   *    아무 일이 없으면 이상하다. 제목 줄 전체가 하나의 버튼이다.
   */
  onPress?: () => void;
  accessibilityLabel?: string;
  children: React.ReactNode;
}) {
  // 홈 섹션 제목과 같은 단이다. (16 / 800 / -0.5)
  // HOME 컴포넌트를 가져다 쓰지 않고 값만 맞춘다.
  const header = (
    <>
      {/* 제목과 그 옆 값은 한 덩어리다. gap-2.5(10) 로 붙여 둔다. */}
      <View className="flex-row items-center gap-2.5">
        <Text
          className="text-pot-ink"
          style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
        >
          {title}
        </Text>
        {titleSuffix ?? null}
      </View>
      {right ?? null}
    </>
  );

  return (
    // ⚠️ 섹션 사이 mt-10(40). 32 로는 네 덩어리가 여전히 붙어 보였다.
    //    모든 섹션이 같은 리듬을 쓴다. 섹션 **안쪽** 줄 간격·카드 padding·
    //    글자 크기는 건드리지 않는다. (2026-09-09)
    <View className="mt-10">
      {/* ⚠️ 누를 수 있을 때만 Pressable 로 감싼다. 감싸도 className 이 같아서
          레이아웃은 달라지지 않는다. 눌리지 않는 섹션에 눌리는 표시(active)를
          붙이지 않으려고 분기한다. */}
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          className="flex-row items-center justify-between active:opacity-60"
        >
          {header}
        </Pressable>
      ) : (
        <View className="flex-row items-center justify-between">{header}</View>
      )}
      {description ? (
        <Text className="mt-1.5 text-pot-faint" style={{ fontSize: 11.5, lineHeight: 17 }}>
          {description}
        </Text>
      ) : null}
      <View className="mt-3.5">{children}</View>
    </View>
  );
}

/**
 * GROUP-02 모임 상세 본문. (docs/09_IA_v1.md §3-2)
 *
 * 기본정보 · 멤버 · 연결 계좌 · 진행 중인 여행 · 지난 여행 ·
 * [이 모임으로 새 여행 만들기] — 화면 하단 고정
 *
 * '누적 여행 유형 / 소비 특성' 은 IA 가 [고도화] 로 표시해 넣지 않는다.
 *
 * ⚠️ 여행 카드는 MY 의 MyTripCard 를 **그대로** 쓴다. 비슷한 카드를 따로
 *    만들지 않는다. 같은 여행이 두 화면에서 다르게 보이면 어느 쪽이 맞는지
 *    사용자가 알 수 없다. 색·D-Day·진행률 규칙도 그 컴포넌트 것을 따른다.
 *
 * 데이터 조회·로그는 app/groups/[groupId].tsx 가 한다. 여기는 그리기만 한다.
 * (CLAUDE.md 9장)
 */
export function GroupDetailView({
  group,
  onPressTrip,
  onPressCreateTrip,
  onPressAccount,
  onPressAllAccounts,
  onPressLeaveTrip,
  onPressLeftTrip,
}: Props) {
  // 이 화면은 (tabs) 밖 Stack 화면이라 FloatingTabBar 가 없다.
  // 대신 홈 인디케이터 자리는 직접 비켜 준다.
  const insets = useSafeAreaInsets();

  /**
   * 어느 탭을 보고 있는지.
   *
   * ⚠️ 기본은 '준비 중' 이다. MY-02 와 같다. 모임 상세에서 가장 급한 것도
   *    앞으로 갈 여행이다.
   */
  const [filter, setFilter] = useState<MyTripFilter>('planning');

  // ⚠️ 여기서 상태를 다시 판정하지 않는다. 화면 파일이 trips.status 로 이미
  //    세 갈래로 갈라 넘겨준다. (app/groups/[groupId]/index.tsx)
  const visibleTrips =
    filter === 'past'
      ? group.pastTrips
      : filter === 'traveling'
        ? group.travelingTrips
        : filter === 'canceled'
          ? group.canceledTrips
          : group.planningTrips;

  return (
    <View className="flex-1 bg-pot-visual">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-5">
      {/* 모임 기본정보 */}
      <View>
        <Text
          numberOfLines={2}
          className="font-black text-pot-ink"
          style={{ fontSize: 22, lineHeight: 30, letterSpacing: -0.6 }}
        >
          {group.name}
        </Text>
        {/* ⚠️ 여기에는 생성일만 둔다. 인원 수와 이동은 아래 '멤버' 섹션
            제목 오른쪽으로 옮겼다. 멤버로 가는 입구가 두 군데면 헷갈린다. */}
        <Text className="mt-1.5 text-pot-mute" style={{ fontSize: 12.5 }}>
          {`만든 날 ${formatCreatedDate(group.createdAt)}`}
        </Text>
      </View>

      {/*
        ⚠️ 멤버는 **정보 영역**이다. 누르는 곳이 아니다. (2026-09-09 확정)
           멤버 관리 화면을 없앴고, 인원수 옆 chevron·이동도 제거했다.
      */}
      <Section
        title="멤버"
        titleSuffix={
          <Text className="text-pot-faint" style={{ fontSize: 12.5 }}>
            {formatMemberCount(group.memberCount)}
          </Text>
        }
      >
        <GroupMemberList members={group.members} />
      </Section>

      {/*
        ⚠️ 메인에는 **준비 중·여행 중에서 쓰는 계좌만** 둔다. 지난 여행에만
           남은 계좌는 '전체 계좌' 에서 본다. (2026-09-09 확정)
        ⚠️ 활성 계좌가 0개여도 '전체 계좌' 는 숨기지 않는다. 지난 여행 계좌가
           남아 있을 수 있고, 그때 확인할 곳이 여기뿐이다.
      */}
      <Section
        title="연결 계좌"
        description="준비 중이거나 여행 중인 여행에서 사용 중인 계좌예요."
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="전체 계좌"
            // 작은 텍스트라 터치 영역을 따로 넓힌다.
            hitSlop={10}
            onPress={onPressAllAccounts}
            className="flex-row items-center px-1 py-1 active:opacity-60"
          >
            {/*
              ⚠️ 보조 액션이다. 색은 pot-mute 로 둔다 — pot-ink 로 올렸더니
                 옆의 섹션 제목('연결 계좌')과 강조가 경쟁했다.
                 누를 수 있다는 신호는 chevron 이 맡는다. (2026-09-09)
            */}
            <Text
              className="text-pot-mute"
              style={{ fontSize: 12.5, fontWeight: '600' }}
            >
              전체 계좌
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#C3C9D2" />
          </Pressable>
        }
      >
        <GroupAccountList
          accounts={group.accounts.filter((account) => account.activeTripCount > 0)}
          onPressAccount={onPressAccount}
        />
      </Section>

      {/*
        여행. 세 상태를 세로로 쌓지 않고 탭으로 가른다.
        MY-02(/me/trips)와 **같은 탭 컴포넌트**를 쓴다. 값도 planning /
        traveling / past 로 같아서 두 화면의 말이 갈라지지 않는다.

        ⚠️ 탭 줄만 화면 폭을 다 쓰도록 -mx-4 로 바깥 padding 을 되돌린다.
           본문은 px-4 를 유지한다.
      */}
      {/* ⚠️ 다른 섹션과 같은 mt-10(40) 을 쓴다. */}
      <View className="mt-10">
        <View className="-mx-4">
          {/* lifecycle 4탭. 취소됨은 표시만 한다. 나간 여행은 탭이 아니라 카드 배지다. */}
          <TripFilterTabs
            tabs={GROUP_TRIP_TABS}
            filter={filter}
            onChangeFilter={setFilter}
            className="bg-transparent"
          />
        </View>

        <View className="mt-3 gap-3">
          {visibleTrips.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed border-pot-dash bg-white px-4 py-8">
              <Text className="text-pot-faint" style={{ fontSize: 13 }}>
                {TAB_EMPTY_MESSAGE[filter]}
              </Text>
            </View>
          ) : (
            visibleTrips.map((trip) => {
              const participant = group.participatingTripIds.has(trip.tripId);

              // 나가기 가능 조건은 그대로다 — 준비 중 + 내가 참가자.
              // 여행 중·지난 여행에는 없고, 남을 내보내는 기능도 없다.
              const canLeave = participant && trip.status === TRIP_STATUS.PLANNING;

              /*
                ⚠️ 참가자가 아니면 카드를 누를 수 없다. (2026-09-09 확정)
                   여행 정보는 그대로 보여주되 상세로 들어가지 않는다.
                   여행 상세에는 수정 진입점이 여럿인데 참가자 검사가 없어서,
                   비참가자를 들여보내면 남의 여행을 고칠 수 있게 된다.
                ⚠️ MyTripCard 는 MY 와 함께 쓰는 컴포넌트다. onPress 에 null 을
                   넘길 수 있게만 넓혔고 MY 동작은 그대로다.
                ⚠️ 모임 이름을 끈다. 이미 이 모임 상세 안이라 카드마다
                   같은 이름이 반복된다. MY 는 그대로다. (2026-09-09)
              */
              /*
                나간 여행(trip.left) — 최종 정책(2026-09-14 · docs/11 v2 §6-2):
                **목록 이력으로만 보인다. 여행 홈·상세에는 들어갈 수 없다.**
                그래서 이동하지 않고 안내만 한다. 이건 임시가 아니라 확정이다.
                미참여(participant 아님)는 접근 범위가 미확정이라 그대로 둔다 — 눌리지 않는다.
                취소된 여행은 MY-02 와 같이 그대로 연다 — 복구·72시간 처리는 다른 담당.
              */
              const onPress = trip.left
                ? () => onPressLeftTrip(trip)
                : participant
                  ? onPressTrip
                  : null;

              const card = (
                <MyTripCard trip={trip} onPress={onPress} showGroupName={false} />
              );

              /*
                여행에서 나가기 — 카드를 왼쪽으로 밀면 오른쪽에 나온다. (2026-09-12)
                항상 보이던 텍스트 버튼을 뺐다. 나가기는 자주 쓰는 동작이 아니라
                카드마다 늘 떠 있으면 목록이 소란스럽다.

                ⚠️ 삭제가 아니다. trash 아이콘을 쓰지 않는다. 여행 설정 시트의
                   '여행 나가기' 와 같은 exit-outline 이다. (TripSettingsSheet)
                ⚠️ SwipeToAction 은 MY 커뮤니티 활동이 쓰는 그 컴포넌트다.
                   같은 폭·같은 동작. 누르면 스와이프를 닫고 기존 확인 흐름으로 간다.
                ⚠️ 나갈 수 없는 여행은 감싸지 않는다. 밀어도 아무것도 안 나온다.
              */
              return (
                <View key={trip.tripId} className="overflow-hidden rounded-2xl">
                  {canLeave ? (
                    <SwipeToAction
                      label="여행 나가기"
                      accessibilityLabel={`${trip.destination ?? '여행'} 에서 나가기`}
                      icon="exit-outline"
                      color="#6B7280"
                      onPress={() => onPressLeaveTrip(trip)}
                    >
                      {card}
                    </SwipeToAction>
                  ) : (
                    card
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      </ScrollView>

      {/*
        CTA 는 화면 하단에 고정한다.
        전에는 ScrollView 의 마지막 자식이라 여행이 많은 모임에서는 끝까지
        내려야 보였다. 모임 상세에서 가장 하고 싶은 일이 스크롤 뒤에 숨어 있었다.

        ⚠️ absolute 로 띄우지 않고 ScrollView 의 형제로 둔다. 그러면 스크롤
           영역이 그만큼 줄어들어 마지막 콘텐츠가 버튼 뒤로 들어가지 않는다.
           별도 bottom padding 을 계산할 필요도 없다.

        모양은 GroupEditActionBar 와 같다. (border-t · px-5 · pt-3)
        아래 여백은 그 바의 pb-8(32) 을 하한으로 두고 안전영역이 더 크면 그쪽을 쓴다.
      */}
      <View
        className="border-t border-pot-line bg-white px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 32) }}
      >
        <Button label="이 모임으로 새 여행 만들기" onPress={onPressCreateTrip} />
      </View>
    </View>
  );
}
