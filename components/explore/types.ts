// ============================================================================
// 여행지 추천(/destinations)과 홈 추천 칸이 그리는 데이터 모양 (2026-09-16)
//
// DB 행이나 상수를 그대로 넘기지 않고 이 모양으로 바꿔 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { CountryTheme } from '@/lib/constants/countryTheme';

/**
 * 여행지 카드 한 장.
 *
 * ⚠️ 사진이 없다. 나라별 랜드마크 펜 드로잉(components/home/landmarkScene)과
 *    국가색으로 그린다. 홈의 보딩패스 · 러기지 태그와 같은 체계다.
 * ⚠️ 금액이 없다. (lib/destination/explore 머리말)
 */
export type ExploreCardData = {
  code: string;
  nameKo: string;
  nameEn: string;
  countryKo: string;
  flag: string;
  airportCode: string;
  /** '도시 · 쇼핑 · 미식' 을 나눈 낱말들. */
  styles: string[];
  /** 사람이 쓴 두 줄 소개. 줄바꿈이 들어 있다. */
  blurb: string;
  /** 추천 여행 기간. '3~4일'. */
  days: string;
  theme: CountryTheme;
};

/** 맨 위 배너 한 장. 지금 계절에 가기 좋은 여행지다. */
export type ExploreHeroData = ExploreCardData & {
  /** '선선한 바람 따라' */
  lead: string;
  /** '9월의 도쿄' */
  title: string;
};

export type ExploreTab = 'now' | 'style' | 'days';

/** 칩 한 개. 스타일 · 기간 탭이 같이 쓴다. */
export type ExploreChip = {
  key: string;
  label: string;
};
