// ============================================================================
// 여행지 추천 · /destinations (2026-09-16)
//
// 홈의 '지금 떠나기 좋은 해외여행지 — 전체 보기' 와 '여행 스타일로 떠나보기' 타일이
// 여기로 들어온다. 카드를 누르면 여행지 상세(/destinations/:destinationCode)로 간다.
//
//   ?tab=now                     지금 가기 좋아요 (기본)
//   ?tab=style&style=미식         여행 스타일
//   ?tab=days&days=short          여행 기간
//
// ⚠️ **[검토 필요] 이 화면은 docs/04_화면목록_v3.md 에 없다.** 여행지 상세(DEST-01)와
//    같은 이유로 홈 담당이 만들었다. 화면 번호와 소속은 팀에서 정한다.
//
// ⚠️ **데이터는 코드 상수뿐이다.** DB 를 부르지 않는다. 사람이 쓴 여행지 소개의
//    추천 시기 · 스타일 · 기간으로 나눈다. (lib/destination/explore) 그래서
//    Loading / Error 상태가 없다. 목록이 비면 격자가 빈 안내를 그린다.
//
// ⚠️ screen_viewed 를 남기지 않는다. SCREENS 에 이 화면 상수가 없고
//    events.ts 는 공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
//    측정이 필요하면 SCREENS.DESTINATION_EXPLORE 를 사람에게 요청한다.
//
// 이 파일은 상태 관리만 한다. 실제로 보이는 UI 는 components/explore/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { ExploreView, type ExploreChip, type ExploreTab } from '@/components/explore';
import {
  TRAVEL_DURATIONS,
  TRAVEL_STYLES,
  currentMonthKst,
  entriesByDuration,
  entriesByStyle,
  exploreEntries,
  seasonOfMonth,
  splitBySeason,
  toExploreCard,
  toExploreHero,
  toTravelDurationKey,
  toTravelStyleKey,
  type TravelDurationKey,
  type TravelStyleKey,
} from '@/lib/destination/explore';

/** 배너에 올릴 여행지 수. 나라가 섞인 순서의 앞에서부터다. */
const HERO_LIMIT = 3;

function toTab(value: string | undefined): ExploreTab {
  return value === 'style' || value === 'days' ? value : 'now';
}

const STYLE_CHIPS: ExploreChip[] = TRAVEL_STYLES.map((style) => ({
  key: style.key,
  label: style.label,
}));

const DURATION_CHIPS: ExploreChip[] = TRAVEL_DURATIONS.map((item) => ({
  key: item.key,
  label: item.label,
}));

export default function ScreenDestinationExplore() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; style?: string; days?: string }>();

  const [tab, setTab] = useState<ExploreTab>(() => toTab(params.tab));
  const [style, setStyle] = useState<TravelStyleKey>(() => toTravelStyleKey(params.style));
  const [duration, setDuration] = useState<TravelDurationKey>(() =>
    toTravelDurationKey(params.days),
  );

  // 상수에서 만든다. 화면을 여는 동안 달이 바뀌어도 다시 계산할 이유가 없다.
  const month = useMemo(() => currentMonthKst(), []);
  const entries = useMemo(() => exploreEntries(), []);
  const { now, later } = useMemo(
    () => splitBySeason(entries, seasonOfMonth(month)),
    [entries, month],
  );

  const chipEntries =
    tab === 'days' ? entriesByDuration(entries, duration) : entriesByStyle(entries, style);

  return (
    <>
      <Stack.Screen options={{ title: '여행지 추천', headerTitleAlign: 'center' }} />
      <ExploreView
        tab={tab}
        onChangeTab={setTab}
        hero={now.slice(0, HERO_LIMIT).map((entry) => toExploreHero(entry, month))}
        nowItems={now.map(toExploreCard)}
        laterItems={later.map(toExploreCard)}
        monthLabel={`${month}월`}
        chips={tab === 'days' ? DURATION_CHIPS : STYLE_CHIPS}
        selectedChip={tab === 'days' ? duration : style}
        onChangeChip={(key) =>
          tab === 'days'
            ? setDuration(toTravelDurationKey(key))
            : setStyle(toTravelStyleKey(key))
        }
        chipItems={chipEntries.map(toExploreCard)}
        onPressDestination={(code) => router.push(`/destinations/${code}`)}
      />
    </>
  );
}
