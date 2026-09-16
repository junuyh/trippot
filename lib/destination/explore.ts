// ============================================================================
// 여행지 추천 — 고르는 규칙 (2026-09-16)
//
// 홈의 '지금 떠나기 좋은 해외여행지' · '여행 스타일로 떠나보기' 와
// 여행지 추천 화면(/destinations)이 함께 쓴다. 두 곳이 같은 목록을 보여야 한다.
//
// ⚠️ **새 데이터를 만들지 않는다.** 사람이 쓴 소개(lib/constants/destinationEditorial)의
//    추천 시기(season) · 여행 스타일(styles) · 묵는 밤(stayNights)만 읽어 나눈다.
//    "인기 1위" · "평점 4.8" 처럼 측정하지 않은 값을 붙이지 않는다.
//
// ⚠️ 금액을 쓰지 않는다. 홈과 추천 화면은 "어디 가지?" 에 답하는 자리다.
//    금액은 여행지 상세의 여행비 가이드와 여행 만들기에서 본다. (CLAUDE.md 2장)
//
// ⚠️ 계절은 **한국(KST) 달력** 기준이다. 목적지 현지 날씨가 아니다.
//    '봄, 가을' 은 사람이 적은 추천 시기라 그 이상을 계산하지 않는다.
// ============================================================================
import type { ExploreCardData, ExploreHeroData } from '@/components/explore/types';
import { countryTheme } from '@/lib/constants/countryTheme';
import { destinationEditorial } from '@/lib/constants/destinationEditorial';
import { DESTINATIONS, type Destination } from '@/lib/constants/destinations';

export type Season = '봄' | '여름' | '가을' | '겨울';

/** 달 → 계절. 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울. */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

/** 한국 시각 기준 지금 달(1~12). 기기 시간대가 달라도 같은 달을 본다. */
export function currentMonthKst(now: Date = new Date()): number {
  return new Date(now.getTime() + 9 * 3_600_000).getUTCMonth() + 1;
}

/**
 * 계절마다 배너 머리에 붙이는 한 줄.
 * ⚠️ 날씨를 단정하지 않는다. 한국 계절에서 떠나는 기분을 말한다.
 */
export const SEASON_LEAD: Record<Season, string> = {
  봄: '따뜻한 봄바람 따라',
  여름: '뜨거운 여름 햇살 따라',
  가을: '선선한 바람 따라',
  겨울: '추운 겨울을 피해',
};

/**
 * 여행 스타일 여섯 개. 홈 타일과 추천 화면 칩이 같은 순서로 쓴다.
 *
 * ⚠️ 소개의 styles 에 **실제로 적힌 낱말**만 고른다. 여행지가 두 곳 이상 걸리는 것만 둔다.
 *    시안의 '자연' · '액티비티' 는 걸리는 여행지가 없거나 하나라 뺐다.
 *    누르면 빈 목록이 나오는 타일을 두지 않는다.
 */
export const TRAVEL_STYLES = [
  { key: '미식', label: '미식 여행', icon: 'restaurant-outline' },
  { key: '도시', label: '도시 여행', icon: 'business-outline' },
  { key: '쇼핑', label: '쇼핑 여행', icon: 'bag-handle-outline' },
  { key: '휴양', label: '휴양 여행', icon: 'sunny-outline' },
  { key: '근교', label: '근교 여행', icon: 'train-outline' },
  { key: '야경', label: '야경 여행', icon: 'moon-outline' },
] as const;

export type TravelStyleKey = (typeof TRAVEL_STYLES)[number]['key'];

/**
 * 여행 기간 세 칸. 소개의 stayNights(묵는 밤)로 나눈다.
 * ⚠️ 사용자의 실제 일정이 아니다. 사람이 권한 기간이다.
 */
export const TRAVEL_DURATIONS = [
  { key: 'short', label: '2~3일', match: (nights: number) => nights <= 2 },
  { key: 'mid', label: '3~4일', match: (nights: number) => nights === 3 },
  { key: 'long', label: '4일 이상', match: (nights: number) => nights >= 4 },
] as const;

export type TravelDurationKey = (typeof TRAVEL_DURATIONS)[number]['key'];

/** 소개가 있는 여행지와 그 소개. 소개가 없는 목적지는 추천에 넣지 않는다. */
export type ExploreEntry = {
  destination: Destination;
  seasons: Season[];
  styles: string[];
  stayNights: number;
  blurb: string;
  days: string;
};

const SEASONS: readonly Season[] = ['봄', '여름', '가을', '겨울'];

function toEntry(destination: Destination): ExploreEntry | null {
  const editorial = destinationEditorial(destination.code);
  if (!editorial) return null;
  return {
    destination,
    seasons: SEASONS.filter((season) => editorial.season.includes(season)),
    styles: editorial.styles.split('·').map((style) => style.trim()).filter(Boolean),
    stayNights: editorial.stayNights,
    blurb: editorial.blurb,
    days: editorial.days,
  };
}

/** 추천에 쓸 수 있는 여행지 전부. 목적지 상수 순서 그대로다. */
export function exploreEntries(): ExploreEntry[] {
  return DESTINATIONS.flatMap((destination) => {
    const entry = toEntry(destination);
    return entry ? [entry] : [];
  });
}

/**
 * 나라가 번갈아 나오게 섞는다.
 *
 * ⚠️ 목적지 상수는 나라별로 묶여 있어 그대로 두면 도쿄 · 오사카 · 후쿠오카가
 *    연달아 나온다. 첫 화면에 한 나라만 보이면 "어디 가지?" 에 답이 안 된다.
 *    나라마다 한 곳씩 돌아가며 뽑는다. 같은 입력이면 늘 같은 순서다.
 */
export function interleaveByCountry(entries: ExploreEntry[]): ExploreEntry[] {
  const groups = new Map<string, ExploreEntry[]>();
  for (const entry of entries) {
    const key = entry.destination.countryKo;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const queues = [...groups.values()];
  const out: ExploreEntry[] = [];
  for (let round = 0; out.length < entries.length; round += 1) {
    for (const queue of queues) {
      if (queue[round]) out.push(queue[round]);
    }
  }
  return out;
}

/** 지금 계절이 추천 시기에 들어가는 여행지와 아닌 여행지. 둘 다 나라를 섞은 순서다. */
export function splitBySeason(entries: ExploreEntry[], season: Season) {
  return {
    now: interleaveByCountry(entries.filter((entry) => entry.seasons.includes(season))),
    later: interleaveByCountry(entries.filter((entry) => !entry.seasons.includes(season))),
  };
}

export function entriesByStyle(entries: ExploreEntry[], style: TravelStyleKey): ExploreEntry[] {
  return interleaveByCountry(entries.filter((entry) => entry.styles.includes(style)));
}

export function entriesByDuration(
  entries: ExploreEntry[],
  duration: TravelDurationKey,
): ExploreEntry[] {
  const rule = TRAVEL_DURATIONS.find((item) => item.key === duration) ?? TRAVEL_DURATIONS[0];
  return interleaveByCountry(entries.filter((entry) => rule.match(entry.stayNights)));
}

/** 추천 항목 → 카드 한 장. 홈과 추천 화면이 같은 모양을 쓴다. */
export function toExploreCard(entry: ExploreEntry): ExploreCardData {
  const { destination } = entry;
  return {
    code: destination.code,
    nameKo: destination.nameKo,
    nameEn: destination.nameEn,
    countryKo: destination.countryKo,
    flag: destination.flag,
    airportCode: destination.airportCode,
    styles: entry.styles,
    blurb: entry.blurb,
    days: entry.days,
    theme: countryTheme(destination.countryKo),
  };
}

/** 배너 한 장. '선선한 바람 따라' · '9월의 도쿄'. */
export function toExploreHero(entry: ExploreEntry, month: number): ExploreHeroData {
  return {
    ...toExploreCard(entry),
    lead: SEASON_LEAD[seasonOfMonth(month)],
    title: `${month}월의 ${entry.destination.nameKo}`,
  };
}

/** 주소 값 → 스타일. 모르는 값이면 첫 스타일. */
export function toTravelStyleKey(value: string | undefined): TravelStyleKey {
  return TRAVEL_STYLES.find((style) => style.key === value)?.key ?? TRAVEL_STYLES[0].key;
}

/** 주소 값 → 기간. 모르는 값이면 첫 기간. */
export function toTravelDurationKey(value: string | undefined): TravelDurationKey {
  return TRAVEL_DURATIONS.find((item) => item.key === value)?.key ?? TRAVEL_DURATIONS[0].key;
}
