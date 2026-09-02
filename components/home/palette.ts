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
