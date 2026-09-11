// ============================================================================
// 대표 홈 전용 색.
//
// ⚠️ tailwind.config.js 를 고치지 않았다. 그 파일을 바꾸면 25개 화면 색이 같이
//    바뀐다. 여기 값은 HOME-01 안에서만 쓴다. 앱 전체 적용이 확정되면
//    이 파일을 지우고 tailwind 토큰으로 올리는 쪽이 맞다.
//
// 국가 색(countryTheme)은 그대로 쓴다. 여행을 구분하는 자리 —
// 가로 카드의 왼쪽 띠, 여행자금 도넛과 범례 — 에만 쓰고,
// 진행률·강조 숫자·CTA 같은 '서비스의 색'은 아래 보라 하나로 통일한다.
// ============================================================================

/** 진행률·강조 숫자·CTA. 서비스 대표 색. */
export const HOME_ACCENT = '#6C5CE7';

/**
 * 새 여행 만들기 버튼(CreateTripFab) 색. 짙은 보라. (2026-09-10)
 *
 * ⚠️ HOME_ACCENT 를 이 값으로 바꾸지 않고 따로 뒀다. 그 상수는
 *    마이페이지(components/my/MyTripListView)도 쓰고 있어서, 값을 바꾸면
 *    담당이 다른 화면의 색까지 같이 바뀐다. (CLAUDE.md 13장)
 *    두 색을 하나로 합칠지는 팀에서 정할 일이다. [검토 필요]
 */
export const HOME_FAB = '#4941B8';
/** 보라를 흰 바탕에 얹은 옅은 톤. 카드 배경·배지에 쓴다. */
export const HOME_ACCENT_SOFT = '#EFEDFF';

/** 부족·초과처럼 사용자가 챙겨야 하는 숫자. */
export const HOME_DANGER = '#F0424E';
export const HOME_DANGER_SOFT = '#FFECEE';

/** 지난 여행 인사이트 카드 바탕. */
export const HOME_CREAM = '#FFF7E4';

/** 액션 아이콘 뒤 동그라미 색. 종류마다 다르게 해서 한눈에 구분된다. */
export const HOME_ACTION_TINT = {
  BUDGET_NOT_SET: '#E8F0FE',
  BUDGET_SHORTAGE: '#FFECEE',
  FUND_SHORTAGE: '#EFEDFF',
  UNPAID_CONTRIBUTION: '#FFF3D6',
} as const;

/** 진행률 막대 바탕. */
export const HOME_TRACK = '#EEF0F4';

// ============================================================================
// 여행 준비 홈(TRIP-HOME-01)과 맞춘 값 (2026-09-03)
//
// 홈을 스티커·젤리 버튼으로 꾸몄더니 유치하다는 평을 받아 되돌렸다.
// 같은 서비스 안에서 화면마다 디자인 언어가 다르면 홈만 장난감처럼 보인다.
// 기준은 components/trip-home/ 이다. 그쪽 시안에서 값을 그대로 가져왔다.
//
//   카드 모서리   13(금고) · 14(여정) · 15(가이드) · 18(보딩패스)
//   카드 테두리   1px #edf0f2 / #e8ebef 위에 흰 바탕
//   제목          16px · weight 800 · letterSpacing -0.5 · #111827
//   본문 캡션     10px · lineHeight 15 · #596272
//   링크          10px · weight 900 · 국가 포인트 컬러 + '→'
//   일러스트      흰 동그라미 안에 큰 이모지, 카드 오른쪽 아래
//   강조 배경     국가 포인트 컬러의 옅은 톤(countryTheme.primarySoft)
//
// ⚠️ 카드마다 다른 파스텔을 돌려쓰지 않는다. 그 방식은 색이 아무 뜻도 없어서
//    화면이 알록달록해지기만 한다. 색이 필요한 자리에는 **그 여행의 국가 색**
//    (countryTheme)을 쓴다. 이미 있는 체계이고 뜻이 있다.
// ============================================================================

/** 카드 테두리. trip-home 여정 카드와 같은 값이다. */
export const HOME_CARD_LINE = '#edf0f2';
/** 캡션·보조 문장. trip-home 가이드 카드 본문과 같은 값이다. */
export const HOME_CAPTION = '#596272';
/** 더 약한 보조 글자. */
export const HOME_SUBTLE = '#858e9c';
/** 가이드 카드 계열의 옅은 하늘색 바탕. */
export const HOME_TINT_SKY = '#eef7ff';

/** trip-home 카드 모서리. 자리마다 쓰는 값이 다르다. */
export const HOME_RADIUS = {
  /** 작은 칸(금고 박스) */
  box: 13,
  /** 일반 카드(여정) */
  card: 14,
  /** 가이드·프로모 카드 */
  guide: 15,
  /** 보딩패스 */
  ticket: 18,
} as const;
