// ============================================================================
// 초대 화면 색 — 한 곳. (2026-09-16 · 초대 플로우 공통 visual)
//
// 브랜드 보라(BRAND.primary · #64139E)를 그대로 쓴다. (2026-09-16 확정) 초대 화면의 로고 ·
// 주 버튼 · 강조색이 이 값을 본다. component 안에 hex 를 직접 적지 않는다.
// ⚠️ 2026-09-20 · 화면 전체 배경은 primary 에서 **BRAND.primarySoft** 로 낮췄다. 진한 보라가 화면을
//    가득 채워 피로도가 높다는 팀 검토. primary 는 로고 · CTA · 아이콘 · divider 같은 강조에만 남긴다.
//    새 색을 만들지 않고 기존 토큰(tailwind brand-soft 와 같은 값)을 쓴다.
// ============================================================================
import { BRAND } from '@/lib/constants/brandColor';

export const INVITE_THEME = {
  /** 로고 · 주 CTA · 강조. 단색 — gradient · 무늬 없음 */
  primary: BRAND.primary,
  /** Header 아래 화면 전체 배경. 초대장 바깥. (2026-09-20 · primary → primarySoft) */
  background: BRAND.primarySoft,
  /** primary 위의 글자 · 아이콘 */
  onPrimary: '#FFFFFF',
  /**
   * 초대 카드 — 실제 편지지처럼 아주 옅은 오프화이트. (2026-09-17: #FAF7F0 → #FCFBF8, 노란 기를 줄이되 순백은 아님)
   * 위에 assets/paper-grain.png 를 옅게 깔아 종이 결만 낸다. 얼룩 · 접힘 · 누런 변색 · 강한 grain 없음.
   * 우표 · 도장 장식은 최종적으로 두지 않는다.
   */
  card: '#FCFBF8',
  /** 카드 안 제목 */
  ink: '#111827',
  /** 카드 안 본문 */
  body: '#4B5563',
  /** 카드 안 보조 글자 */
  muted: '#8B94A2',
  /** 카드 안 정보 칸 배경 */
  well: '#F5F3FA',
} as const;
