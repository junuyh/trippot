// ============================================================================
// 개인 여행 상세 본문 (/groups/personal) — 그리기만 한다
//
// 모임 상세(GroupDetailView)와 **같은 정보 구조**를 갖는다. (docs/11 §2-3 · 2026-09-13)
//   상단 소개 · 연결 계좌 · 여행 탭(준비 중 · 여행 중 · 지난 여행 · 취소됨) · 카드
//
// 다른 점은 "없는 것" 이다. 개인 여행에는 groups 행이 없다.
//   멤버 · 만든 날 · 이름 수정 · 모임원 관리 — 전부 없다. 가짜로 채우지 않는다.
//
// ⚠️ GroupDetailView 를 복사하지 않는다. 그쪽의 Section · GroupAccountList ·
//    TripFilterTabs · MyTripCard 를 그대로 가져다 쓴다. 섹션 간격(mt-10)·탭 줄
//    (-mx-4)·빈 상태 문구도 같은 값이다. 두 화면이 나란히 있을 때 같은 앱으로 보여야 한다.
//
// ⚠️ '나간 여행' 탭도, 배지도 없다. 개인 여행은 내가 주인인 독립 여행이라
//    "그 여행에서 내가 나간다" 는 구조가 아니다.
//
// ⚠️ 취소됨은 표시만 한다. 72시간 되돌리기·만료는 다른 담당의 기능이다.
//
// ⚠️ supabase · track() 을 부르지 않는다. 데이터는 app/groups/personal.tsx 가 준다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  MyTripCard,
  MY_TRIP_FILTER_TABS,
  TripFilterTabs,
  type MyTripFilter,
  type MyTripItem,
} from '@/components/my';

import { GroupAccountList } from './GroupAccountList';
import { Section } from './GroupDetailView';
import type { GroupAccountItem } from './types';

/** 개인 여행 상세의 탭. MY-02 의 5탭에서 '나간 여행' 만 뺀다. */
const PERSONAL_TRIP_TABS = MY_TRIP_FILTER_TABS.filter((tab) => tab.value !== 'left');

/** 탭마다 비었을 때 할 말. 모임 상세·MY-02 와 같은 문장이다. */
const TAB_EMPTY_MESSAGE: Record<MyTripFilter, string> = {
  planning: '준비 중인 여행이 없어요.',
  traveling: '지금 여행 중인 여행이 없어요.',
  past: '아직 다녀온 여행 기록이 없어요.',
  canceled: '취소된 여행이 없어요.',
  // 개인 여행에는 이 탭이 없다. 타입(Record)을 채우기 위한 값이다.
  left: '나간 여행이 없어요.',
};

export type PersonalDetailData = {
  /**
   * 개인 여행들이 지금 연결해 쓰는 계좌. accountId 로 묶여 있다.
   * ⚠️ 계좌 소유는 여행 단위다. 여행마다 다른 계좌일 수 있다. (docs/11 §2-4)
   */
  accounts: GroupAccountItem[];
  planningTrips: MyTripItem[];
  travelingTrips: MyTripItem[];
  pastTrips: MyTripItem[];
  /** 취소된 개인 여행. 표시만 한다. */
  canceledTrips: MyTripItem[];
};

type Props = {
  data: PersonalDetailData;
  onPressTrip: (tripId: string) => void;
  onPressAccount: (account: GroupAccountItem) => void;
  onPressAllAccounts: () => void;
};

export function PersonalDetailView({
  data,
  onPressTrip,
  onPressAccount,
  onPressAllAccounts,
}: Props) {
  // 기본은 '준비 중'. 모임 상세·MY-02 와 같다.
  const [filter, setFilter] = useState<MyTripFilter>('planning');

  const visibleTrips =
    filter === 'past'
      ? data.pastTrips
      : filter === 'traveling'
        ? data.travelingTrips
        : filter === 'canceled'
          ? data.canceledTrips
          : data.planningTrips;

  const tripCount =
    data.planningTrips.length + data.travelingTrips.length + data.pastTrips.length;

  return (
    <View className="flex-1 bg-pot-visual">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-5">
        {/* 상단 소개. 모임 상세의 기본정보 자리다. 이름 대신 시스템 표시명, 만든 날 대신 여행 수. */}
        <View>
          <Text
            className="font-black text-pot-ink"
            style={{ fontSize: 22, lineHeight: 30, letterSpacing: -0.6 }}
          >
            개인 여행
          </Text>
          <Text className="mt-1.5 text-pot-mute" style={{ fontSize: 12.5 }}>
            {tripCount > 0
              ? `혼자 준비하는 여행 ${tripCount}개 · 모임이 아니라 멤버가 없어요.`
              : '혼자 준비하는 여행이 여기 모여요.'}
          </Text>
        </View>

        {/*
          연결 계좌. 모임 상세와 같은 섹션·같은 목록 컴포넌트다.
          ⚠️ 개인 여행 묶음이 계좌 하나를 갖는 게 아니다. 여행마다 계좌가 다를 수
             있어서 accountId 로 묶고 "N개 여행에서 사용 중" 을 센다.
          ⚠️ 직접 입력 여행은 계좌가 없으니 여기 안 나온다. 가짜 줄을 만들지 않는다.
        */}
        <Section
          title="연결 계좌"
          description="준비 중이거나 여행 중인 여행에서 사용 중인 계좌예요."
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="전체 계좌"
              hitSlop={10}
              onPress={onPressAllAccounts}
              className="flex-row items-center px-1 py-1 active:opacity-60"
            >
              <Text className="text-pot-mute" style={{ fontSize: 12.5, fontWeight: '600' }}>
                전체 계좌
              </Text>
              <Ionicons name="chevron-forward" size={13} color="#C3C9D2" />
            </Pressable>
          }
        >
          <GroupAccountList
            accounts={data.accounts.filter((account) => account.activeTripCount > 0)}
            onPressAccount={onPressAccount}
          />
        </Section>

        {/* 여행. 모임 상세와 같은 탭 컴포넌트·같은 간격이다. */}
        <View className="mt-10">
          <View className="-mx-4">
            <TripFilterTabs
              tabs={PERSONAL_TRIP_TABS}
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
              // 개인 여행은 전부 내 것이다. 카드를 누르면 여행 홈으로 간다.
              // 모임 이름 줄은 끈다 — 이 화면 안에서는 전부 '개인' 이라 반복이다.
              visibleTrips.map((trip) => (
                <MyTripCard
                  key={trip.tripId}
                  trip={trip}
                  onPress={onPressTrip}
                  showGroupName={false}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
