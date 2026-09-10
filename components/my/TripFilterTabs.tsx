import { Pressable, Text, View } from 'react-native';

import { TRIP_STATUS_LABEL } from '@/lib/constants/status';

import type { MyTripFilter } from './types';

/**
 * 탭 이름.
 *
 * ⚠️ 준비 중·여행 중은 상태 라벨을 그대로 쓴다. 화면에 상태값 문자열을 직접
 *    적지 않는다. (lib/constants/status.ts TRIP_STATUS_LABEL)
 *    지난 여행은 ENDED·SETTLED 둘을 묶은 이름이라 상태 라벨이 없다.
 *
 * ⚠️ 탭에 개수를 적지 않는다. 숫자는 어느 탭을 볼지 고르는 데 도움이 되지 않고,
 *    빈 탭에 '0' 이 붙으면 없다는 사실만 두 번 말한다. 목록이 곧 개수다.
 */
export const TRIP_FILTER_TABS: { value: MyTripFilter; label: string }[] = [
  // ⚠️ 2026-09-04 팀 확정 — 출발 전 상태를 '진행 중' 이라 부르면 여행 중과
  //    헷갈린다. 라벨만 바꾸면 여행 중인 여행이 여전히 준비 중 탭에 섞여
  //    있어서, 탭 자체를 둘로 갈랐다.
  { value: 'planning', label: TRIP_STATUS_LABEL.PLANNING },
  { value: 'traveling', label: TRIP_STATUS_LABEL.TRAVELING },
  { value: 'past', label: '지난 여행' },
];

type Props = {
  filter: MyTripFilter;
  onChangeFilter: (filter: MyTripFilter) => void;
  /** 탭 줄의 바탕. MY-02 는 흰색, GROUP-02 는 바탕과 같게 둔다. */
  className?: string;
};

/**
 * 준비 중 / 여행 중 / 지난 여행 탭.
 *
 * MY-02(나의 여행)와 GROUP-02(모임 상세)가 같은 탭을 쓴다. 같은 여행이 두
 * 화면에서 다른 칸에 들어가지 않도록 값·라벨·모양을 한곳에서 정한다.
 *
 * ⚠️ 여기서 여행을 거르지 않는다. 어떤 여행이 어느 탭인지는 trips.status 로
 *    화면이 정한다. 날짜로 다시 판정하지 않는다.
 *
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function TripFilterTabs({ filter, onChangeFilter, className = 'bg-white' }: Props) {
  return (
    <View className={`flex-row gap-2 px-4 pb-3 pt-2 ${className}`}>
      {TRIP_FILTER_TABS.map((tab) => {
        const active = tab.value === filter;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChangeFilter(tab.value)}
            className="rounded-full px-3.5 py-2"
            style={{
              // ⚠️ 선택되지 않은 탭도 **버튼 모양이 보여야** 한다.
              //    전에는 #F1F3F6 이라 GROUP 상세의 바탕(pot-visual #F5F7FA)과
              //    거의 같아서 탭이 있는지도 알기 어려웠다.
              //    흰 배경 + 얇은 테두리면 MY-02(흰 바탕)에서도, GROUP-02
              //    (pot-visual 바탕)에서도 형태가 보인다. (2026-09-09)
              // ⚠️ 선택된 탭에도 같은 굵기의 테두리를 둔다. 없으면 탭을 바꿀
              //    때마다 높이가 1px 씩 흔들린다.
              backgroundColor: active ? '#111827' : '#FFFFFF',
              borderWidth: 1,
              borderColor: active ? '#111827' : '#E5E8EC',
            }}
          >
            <Text
              className="font-bold"
              style={{ fontSize: 12.5, color: active ? '#FFFFFF' : '#747B88' }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
