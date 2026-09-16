// ============================================================================
// TripPot 브랜드 컬러 — 확정값 (2026-09-16 Final Color System)
//
// 서비스 대표색은 이 세 값뿐이다. 다른 보라를 새로 만들거나 밝기·채도를 조정하지 않는다.
// tailwind.config.js 의 `brand` 토큰(bg-brand · bg-brand-pressed · bg-brand-soft)과 같은 값이다.
// className 으로 못 쓰는 자리(style · Ionicons color · 상수 팔레트)만 여기서 가져간다.
//
// ⚠️ 국가 테마(lib/constants/countryTheme.ts · theme.primary)와는 별개다.
//    여행준비홈(app/trips/[tripId]/**)과 그 하위 화면의 국가별 포인트 컬러는 이 값을 쓰지 않는다.
// ============================================================================
export const BRAND = {
  /** 일반 CTA · 선택/활성 강조 · 브랜드 아이콘 · 초대 화면 배경 */
  primary: '#64139E',
  /** 실제 눌린(pressed) 상태에서만 */
  primaryPressed: '#521080',
  /** 선택된 탭·칩 배경 · 옅은 강조 컨테이너. 화면 전체 배경으로는 쓰지 않는다 */
  primarySoft: '#F6F0FA',
} as const;
