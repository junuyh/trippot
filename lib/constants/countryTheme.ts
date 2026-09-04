// ============================================================================
// 국가별 테마 컬러
//
// ⚠️ 배경과 기본 카드는 **항상 화이트·쿨그레이**다. 국기 색을 배경으로 깔지 않는다.
//    포인트 컬러는 진행률·선택 상태·CTA 처럼 **의미가 있는 곳에만** 쓴다.
//
// ⚠️ 도시가 달라도 국가가 같으면 같은 테마를 쓴다. (도쿄·오사카·후쿠오카 → 일본)
//    그래서 키가 목적지가 아니라 countryKo 다.
//
// 색 선택 기준
//   primary      버튼·진행률·선택 상태. 국기의 대표색
//   primarySoft  배지·약한 배경. primary 를 흰 바탕에 얹은 옅은 톤
//   onPrimary    primary 위에 올리는 글자색
//   neutral      본문 강조·티켓 영역. 딥네이비/차콜 고정
//   code         화면에 국기와 함께 표시하는 국가 코드
// ============================================================================

export type CountryTheme = {
  primary: string;
  primarySoft: string;
  onPrimary: string;
  neutral: string;
  code: string;
  /** [왼쪽, 오른쪽] 순서로 쓰는 국기 두 색 */
  stripe: readonly [string, string];
  /** 영문 국가명. 대문자로 쓴다 */
  nameEn: string;
};

/** 국가를 알 수 없을 때(직접 입력 목적지). 국기 색 대신 뉴트럴로 간다. */
export const DEFAULT_COUNTRY_THEME: CountryTheme = {
  primary: '#2E4A7D',
  primarySoft: '#EEF2F8',
  onPrimary: '#FFFFFF',
  neutral: '#1B2540',
  code: '--',
  stripe: ['#2E4A7D', '#1B2540'],
  // 국가를 모르면 배경에 쓸 이름도 없다. 빈 문자열이면 쓰는 쪽이 그리지 않는다
  nameEn: '',
};

const THEMES: Record<string, CountryTheme> = {
  // 일본 — 레드 + 화이트 + 딥네이비
  일본: { primary: '#E1394A', primarySoft: '#FDECEE', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'JP', stripe: ['#BC002D', '#1B2540'], nameEn: 'JAPAN' },
  // 프랑스 — 블루 + 화이트 + 딥네이비
  프랑스: { primary: '#2A5CAA', primarySoft: '#EBF1FA', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'FR', stripe: ['#0055A4', '#EF4135'], nameEn: 'FRANCE' },
  // 이탈리아 — 그린 + 화이트 + 레드. 대표색은 그린으로 잡는다
  이탈리아: { primary: '#1F9160', primarySoft: '#E8F5EE', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'IT', stripe: ['#008C45', '#CD212A'], nameEn: 'ITALY' },
  // 중국 — 레드 + 옐로
  중국: { primary: '#D8352C', primarySoft: '#FCEBEA', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'CN', stripe: ['#DE2910', '#FFDE00'], nameEn: 'CHINA' },
  // 대만 — 블루 + 레드
  대만: { primary: '#2B4E9B', primarySoft: '#EBEFF9', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'TW', stripe: ['#000095', '#FE0000'], nameEn: 'TAIWAN' },
  // 홍콩 — 레드 + 화이트
  홍콩: { primary: '#D63B3B', primarySoft: '#FDECEC', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'HK', stripe: ['#DE2910', '#1B2540'], nameEn: 'HONG KONG' },
  // 베트남 — 레드 + 옐로
  베트남: { primary: '#DA251D', primarySoft: '#FDECEB', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'VN', stripe: ['#DA251D', '#FFCD00'], nameEn: 'VIETNAM' },
  // 필리핀 — 블루 + 레드 + 옐로. 대표색은 블루
  필리핀: { primary: '#1F5FBF', primarySoft: '#EAF1FC', onPrimary: '#FFFFFF', neutral: '#1B2540', code: 'PH', stripe: ['#0038A8', '#CE1126'], nameEn: 'PHILIPPINES' },
};

/**
 * 국가명으로 테마를 찾는다. 모르는 국가면 뉴트럴 테마다.
 * (직접 입력 목적지는 국가를 받지 않으므로 여기로 온다)
 */
export function countryTheme(countryKo: string | null | undefined): CountryTheme {
  if (!countryKo) return DEFAULT_COUNTRY_THEME;
  return THEMES[countryKo] ?? DEFAULT_COUNTRY_THEME;
}
