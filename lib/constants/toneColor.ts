// ============================================================================
// 배너 톤 — 성격별 색 한 벌 (2026-09-17)
//
// "답해야 할 일" 배너가 홈과 여행 홈 두 곳에 뜬다. 색을 각자 적으면 같은 취소
// 배너가 화면마다 다른 앰버가 된다. 실제로 홈 초대 배너가 확정값
// BRAND.primarySoft(#F6F0FA) 대신 #F3ECF7 을 직접 적어 여행 홈과 어긋나 있었다.
//
// ⚠️ 브랜드 보라는 여기서 새로 만들지 않는다. BRAND 를 그대로 가져다 쓴다.
//    (lib/constants/brandColor.ts · 2026-09-16 Final Color System)
//
// ⚠️ 앰버는 tailwind.config.js 에 넣지 않는다. 그 파일은 25개 화면이 함께 쓰고,
//    이 색이 필요한 곳은 취소 배너 둘뿐이다. (CLAUDE.md 5장)
//
// ⚠️ 앰버는 **취소 전용**이다. 경고 색이라 "답해야 할 일" 아무 데나 쓰지 않는다.
//    참여 요청은 brand 다 — 되돌릴 수 없는 일이 아니다.
// ============================================================================
import { BRAND } from './brandColor';

export type BannerTone = 'brand' | 'warn';

type ToneColors = {
  /** 아이콘 · 제목 · 버튼 바탕 */
  fg: string;
  /** 눌린 상태의 버튼 바탕 */
  fgPressed: string;
  /** 배너 바탕 */
  tint: string;
  /** 배너 테두리 · 보조 버튼 테두리 */
  line: string;
  /** 부제 글자 */
  body: string;
};

/** 취소 요청 배너의 앰버. CancelPendingBanner 가 쓰던 값이 기준이다. */
const WARN_FG = '#8A5A00';

export const TONE: Record<BannerTone, ToneColors> = {
  brand: {
    fg: BRAND.primary,
    fgPressed: BRAND.primaryPressed,
    tint: BRAND.primarySoft,
    line: '#E0D0EC',
    body: '#6B5B78',
  },
  warn: {
    fg: WARN_FG,
    fgPressed: '#6E4800',
    tint: '#FFF7E8',
    line: '#F0DFBC',
    body: '#8A7250',
  },
};
