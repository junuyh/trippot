// ============================================================================
// 여행지 상세(DEST-01) 공통 디자인 토큰 (2026-09-11)
//
// **여행 준비 홈(components/trip-home)의 값을 그대로 가져왔다.**
// 이 화면에서 색·치수를 새로 정하지 않는다. 여행지 상세와 여행 준비 홈은
// 사용자가 연달아 보는 화면이고(여행지 → 여행 만들기 → 여행 준비 홈),
// 둘의 카드가 다른 값을 쓰면 같은 서비스로 보이지 않는다.
//
//   INK      #111827   제목·큰 숫자        (trip-home 공통)
//   CAPTION  #596272   본문
//   MUTED    #8b94a2   보조 글자
//   SUBTLE   #858e9c   라벨·캡션
//   LINE     #eef0f3   카드 테두리·구분선  (TravelTicketCard 는 #e5e8ec)
//   TRACK    #eef0f4   그래프 바탕
//   제목      16 · weight 800 · letterSpacing -0.5
//   캡션      10 · lineHeight 15
//   모서리    13(작은 칸) · 14(일반 카드) · 15(가이드) · 18(티켓)
//
// ⚠️ 처음에는 딥네이비(#1B2540)와 따로 만든 치수를 썼다. 시안이 그랬기
//    때문인데, 그러면 이 화면만 앱에서 혼자 다른 톤이 된다. 여행 홈을 따르는
//    쪽으로 되돌렸다. (2026-09-11 사용자 요청)
//
// **TripPot 공통 UI 90% + 국가별 국기색 10%** 는 그대로다.
// 국가색이 칠해지는 자리 —
//   섹션 제목 앞 짧은 라인 · 티켓 좌우 컬러 라인 · 국가 스탬프 · 주요 숫자 ·
//   체크 아이콘 · 상위 2~3개 그래프 바 · 작은 배지
// 버튼 전체나 큰 카드 배경을 국기색으로 채우지 않는다.
//
// ⚠️ countryTheme 은 [공유] 파일이라 고치지 않았다. (CLAUDE.md 5장)
//    이미 일본 레드·프랑스 블루·이탈리아 그린으로 국기 대표색이 들어 있고,
//    stripe 에 국기 두 색이 있다. 이 화면이 원하던 체계가 그대로 있었다.
// ============================================================================

/** 제목·큰 숫자. trip-home 공통 잉크색이다. */
export const INK = '#111827';
/** 본문. trip-home 가이드 카드 본문과 같은 값이다. */
export const CAPTION = '#596272';
/** 보조 글자. */
export const MUTED = '#8b94a2';
/** 라벨·캡션처럼 더 약한 글자. */
export const SUBTLE = '#858e9c';
/** 카드 테두리·구분선. trip-home 카드와 같은 값이다. */
export const LINE = '#eef0f3';
/** 옅은 바탕. 칸 안의 칸에 쓴다. trip-home 보딩패스 스텁과 같은 값이다. */
export const TINT = '#f4f6f8';
/** 가이드 카드 계열의 옅은 하늘색. trip-home TripGuideCards 와 같은 값이다. */
export const TINT_SKY = '#eef7ff';
/** 그래프에서 국가색을 쓰지 않는 나머지 항목. */
export const BAR_NEUTRAL = '#9AA7BD';
/** 그래프 트랙. trip-home 진행률 막대 바탕과 같은 값이다. */
export const BAR_TRACK = '#eef0f4';

/** 모서리. trip-home 이 자리마다 쓰는 값을 그대로 쓴다. */
export const RADIUS = {
  /** 작은 칸 */
  box: 13,
  /** 일반 카드 */
  card: 14,
  /** 가이드·프로모 카드 */
  guide: 15,
  /** 티켓 */
  ticket: 18,
  /** 카드 안의 칸 */
  inner: 10,
  /** 알약 */
  pill: 999,
} as const;

/** 섹션 제목. trip-home 카드 제목과 같은 단이다. */
export const TITLE = {
  fontSize: 16,
  lineHeight: 21,
  fontWeight: '800' as const,
  letterSpacing: -0.5,
  color: INK,
};

/**
 * 그래프에서 국가 대표색으로 칠할 상위 항목 수.
 *
 * ⚠️ 전부 국가색으로 칠하면 화면의 국기색 비중이 10~15% 를 넘는다.
 *    금액이 큰 위쪽 몇 개만 국가색이고 나머지는 블루그레이다.
 */
export const ACCENT_BAR_COUNT = 3;

/**
 * 국가색 옅은 톤(primarySoft)을 **한 번 더 연하게** 만든다. (2026-09-11)
 *
 * ⚠️ countryTheme.primarySoft 는 카드 배지·작은 강조 배경에 쓰라고 만든 값이라,
 *    이 화면처럼 **넓은 칸을 통째로 채우면 색이 세게 느껴진다.** 같은 색이라도
 *    면적이 커지면 진해 보이기 때문이다.
 *    그래서 칸 배경에는 이 함수를 거친 값을 쓴다. 아이콘 뒤 작은 원처럼 좁은
 *    자리는 primarySoft 를 그대로 쓴다.
 *
 * ⚠️ 반투명(알파)이 아니라 흰색과 아예 섞는다. 알파를 쓰면 겹친 자리마다 색이
 *    달라져 같은 톤으로 맞출 수 없다.
 *    (components/home/NextTripBanner 의 pastel 과 같은 방식)
 */
export function softer(hex: string, ratio = 0.45): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) => {
    const channel = parseInt(value.slice(start, start + 2), 16);
    return Math.round(255 + (channel - 255) * ratio);
  };
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(0))}${to2(mix(2))}${to2(mix(4))}`;
}
