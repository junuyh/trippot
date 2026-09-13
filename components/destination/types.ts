// 여행지 상세(DEST-01)가 그리는 데이터 모양.
//
// DB 행이나 상수를 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
import type { CountryTheme } from '@/lib/constants/countryTheme';

export type DestinationDetailData = {
  code: string;
  /** 도시 한글명. 섹션 제목의 'OO' 자리에 들어간다. */
  nameKo: string;
  /** 티켓에서 가장 큰 글자. */
  nameEn: string;
  countryKo: string;
  /** 지역 이름. '동아시아'. */
  regionKo: string;
  airportCode: string;
  /** 국기 이모지. ⚠️ 윈도우에는 국기 글꼴이 없어 'JP' 처럼 글자로 보인다. */
  flag: string;
  /** 티켓의 '여행 기간' 칸. '3박 4일'. */
  nights: string;
  /** 티켓의 '추천 시기' 칸. '봄, 가을'. */
  season: string;
  /** 티켓의 '여행 스타일' 칸. '도시 · 미식 · 쇼핑'. */
  styles: string;
  /** 'OO는 이런 여행지예요!' 본문. */
  intro: string;
  /** '이런 분들께 추천해요' 항목. */
  recommendedFor: readonly string[];
  /**
   * 대표 사진 주소. 앱 번들에 들어간 파일이라 없을 수만 있고 로드 실패는 없다.
   * (lib/constants/destinationHeroPhoto 의 HeroPhoto.url)
   */
  photo: string | null;
  /** 국가 포인트 컬러가 여기서 온다. countryTheme 그대로다. */
  theme: CountryTheme;
};
