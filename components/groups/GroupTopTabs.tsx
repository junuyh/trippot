import { Pressable, Text, View } from 'react-native';

import { BRAND } from '@/lib/constants/brandColor';

/** 하단 모임 탭 화면의 상단 구분. 주소 ?tab= 값과 같다. */
export const GROUP_TOP_TAB = {
  TRIPS: 'trips',
  GROUPS: 'groups',
} as const;
export type GroupTopTab = (typeof GROUP_TOP_TAB)[keyof typeof GROUP_TOP_TAB];

/** 주소의 ?tab= → 탭. 없거나 모르는 값이면 '여행'. */
export function toGroupTopTab(value: string | undefined): GroupTopTab {
  return value === GROUP_TOP_TAB.GROUPS ? GROUP_TOP_TAB.GROUPS : GROUP_TOP_TAB.TRIPS;
}

const TABS: { value: GroupTopTab; label: string }[] = [
  { value: GROUP_TOP_TAB.TRIPS, label: '여행' },
  { value: GROUP_TOP_TAB.GROUPS, label: '모임' },
];

/** 공통 Header(components/ui/Header · h-14)와 같은 높이. 탭이 곧 헤더라 제목 줄을 따로 두지 않는다. */
const HEADER_HEIGHT = 56;
/*
 * 글자 크기 = 공통 Header 제목(components/ui/Header · `text-lg font-semibold`)과 **같은 class** 로 맞춘다.
 * ⚠️ 숫자로 18 을 적으면 안 된다. 이 프로젝트의 NativeWind(v4 · metro inlineRem 기본 14)에서 `text-lg` 는
 *    1.125rem = 15.75pt / lineHeight 1.75rem = 24.5pt 로 렌더된다. 18/28 로 두었더니 커뮤니티·마이페이지
 *    제목보다 눈에 띄게 컸다. (2026-09-21) 굵기·색만 style 로 준다.
 */
const TITLE_CLASS = 'text-lg';
/** 선택 표시 밑줄. 두꺼우면 탭바처럼 무거워진다. */
const INDICATOR_HEIGHT = 2.5;
/** 글자와 밑줄 사이. 밑줄이 헤더 바닥이 아니라 글자에 붙어 한 세트로 보이게 한다. (6 → 4 · 2026-09-21) */
const INDICATOR_GAP = 4;
const TAB_PADDING_X = 14;

const COLOR_SELECTED = BRAND.primary;
/** 비선택 탭 글자. 검정에 가깝게 두면 선택 탭과 무게가 안 갈리고, 너무 연하면 눌러도 되는지 모른다. */
const COLOR_UNSELECTED = '#5B6472';
/** 공통 Header 의 border-b border-gray-100 과 같은 선. */
const DIVIDER = '#F3F4F6';

type Props = {
  value: GroupTopTab;
  onChange: (next: GroupTopTab) => void;
};

/**
 * 하단 [모임] 탭 화면의 헤더 — 제목 대신 [여행] [모임] 텍스트 탭이 헤더 자리에 있다. (2026-09-21 수정)
 *
 * 처음엔 공통 Header('모임') 아래 알약 두 개를 뒀는데, 제목과 탭이 뜻이 겹치고 여행 안의
 * 필터 알약(TripFilterTabs)과 같은 모양이라 두 층이 구분되지 않았다. 지금 구조는
 *   1층  헤더 텍스트 탭   여행 / 모임   (선택 = 브랜드색 + 밑줄, 비선택 = 회색, 배경·테두리 없음)
 *   2층  여행 필터 알약   준비 중 / 여행 중 / …   (TripFilterTabs 그대로)
 * 공통 Header 는 children 을 받지 않아 API 를 넓히지 않고 이 화면 전용으로 그린다.
 * 상태바 높이(safe area)는 화면 파일이 바깥에서 띄운다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function GroupTopTabs({ value, onChange }: Props) {
  return (
    <View
      className="flex-row items-stretch justify-center bg-white"
      style={{ height: HEADER_HEIGHT, borderBottomWidth: 1, borderBottomColor: DIVIDER }}
    >
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${tab.label} 탭`}
            onPress={() => onChange(tab.value)}
            // 글자 너비만큼만 차지하되, 누를 수 있는 영역은 헤더 높이(56 ≥ 44) 전체.
            className="justify-center active:opacity-60"
            style={{ paddingHorizontal: TAB_PADDING_X, minWidth: 44 }}
          >
            {/* 글자 + 밑줄이 한 묶음(24.5 + 4 + 2.5)으로 헤더 세로 가운데에 온다. 밑줄을 바닥에 붙이지 않는다. */}
            <View>
              <Text
                className={TITLE_CLASS}
                style={{
                  fontWeight: active ? '700' : '600',
                  color: active ? COLOR_SELECTED : COLOR_UNSELECTED,
                }}
              >
                {tab.label}
              </Text>
              {/* 밑줄은 글자 너비. 비선택 탭도 같은 높이의 투명 줄을 둬 글자 기준선이 흔들리지 않는다. */}
              <View
                pointerEvents="none"
                style={{
                  marginTop: INDICATOR_GAP,
                  height: INDICATOR_HEIGHT,
                  borderRadius: INDICATOR_HEIGHT,
                  backgroundColor: active ? COLOR_SELECTED : 'transparent',
                }}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
