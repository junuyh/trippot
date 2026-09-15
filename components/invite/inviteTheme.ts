// ============================================================================
// 초대 화면 색 — 한 곳. (2026-09-16 · 초대 플로우 공통 visual)
//
// 최종 브랜드 보라색 hex 는 아직 확정 전이다. 그때까지 MY 여권의 진한 보라(PASSPORT.accent)를
// 임시 기준으로 **재사용**한다. 확정되면 여기 primary 한 줄만 바꾼다 — 초대 화면의 배경 · 로고 ·
// 주 버튼 · 강조색이 전부 이 값을 본다. component 안에 hex 를 직접 적지 않는다.
// ============================================================================
import { PASSPORT } from '@/components/mypage/passport';

export const INVITE_THEME = {
  /** Header 아래 배경 · 로고 · 주 CTA · 강조. 단색 — gradient · 무늬 없음 */
  primary: PASSPORT.accent,
  /** primary 위의 글자 · 아이콘 */
  onPrimary: '#FFFFFF',
  /** 초대 카드. 순백. 질감 · 우표 · 도장 없음 */
  card: '#FFFFFF',
  /** 카드 안 제목 */
  ink: '#111827',
  /** 카드 안 본문 */
  body: '#4B5563',
  /** 카드 안 보조 글자 */
  muted: '#8B94A2',
  /** 카드 안 정보 칸 배경 */
  well: '#F5F3FA',
} as const;
