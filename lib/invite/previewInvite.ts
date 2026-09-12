// ============================================================================
// 개발용 미리보기 — /invite/[token] 화면 확인용 고정 데이터
//
// ⚠️⚠️ **개발용 미리보기 모드(AuthProvider.isPreview · __DEV__)에서만 쓴다.** ⚠️⚠️
//       production 번들에서는 __DEV__ 가 false 로 굳어 이 값이 화면에 갈 수 없다.
//       서버 fallback 이 아니다. 실제 사용자에게 가짜 초대가 보이면 사고다.
//
// 왜 있나 — 수신자 확인 함수(resolve_trip_invite · PR #93)가 아직 원격에 없다.
// 그래도 INV-02 · INV-03 화면은 Dev Build 에서 봐야 한다. token 문자열로 상태를
// 고르게 해 두면 딥링크 하나로 각 상태를 확인할 수 있다.
//
//   trippot://invite/preview-valid      NONE   — 참여 요청 가능
//   trippot://invite/preview-left       LEFT   — 다시 요청 가능
//   trippot://invite/preview-active     ACTIVE — 이미 참여 중
//   trippot://invite/preview-pending    PENDING → INV-03
//   trippot://invite/preview-rejected   REJECTED → 재요청 불가 안내
//   trippot://invite/preview-full       NONE + 인원 도달 (요청은 가능)
//   trippot://invite/preview-expired    EXPIRED
//   trippot://invite/preview-revoked    REVOKED
//   trippot://invite/preview-notfound   NOT_FOUND
//
// 매핑은 docs/12 §3 의 resolve_trip_invite 반환과 같은 모양(InviteRouteState)이다.
// RPC 가 붙으면 이 파일은 그대로 두고 화면 파일의 분기만 서버 결과로 바꾼다.
// ============================================================================
import type { InvitePreview, InviteRouteState } from '@/components/invite';

const PREVIEW_TRIP: InvitePreview = {
  destination: '도쿄',
  startDate: '2026-10-02',
  endDate: '2026-10-05',
  headcount: 3,
  activeMemberCount: 2,
  ownerDisplayName: '민지',
};

/** token 이 개발용 미리보기 토큰이면 그 상태를, 아니면 null 을 돌려준다. */
export function previewInviteState(token: string): InviteRouteState | null {
  if (!__DEV__) return null;

  switch (token) {
    case 'preview-valid':
      return { kind: 'VALID', preview: PREVIEW_TRIP, myState: 'NONE', myRequestId: null };
    case 'preview-left':
      return { kind: 'VALID', preview: PREVIEW_TRIP, myState: 'LEFT', myRequestId: null };
    case 'preview-active':
      return { kind: 'VALID', preview: PREVIEW_TRIP, myState: 'ACTIVE', myRequestId: null };
    case 'preview-pending':
      return {
        kind: 'VALID',
        preview: PREVIEW_TRIP,
        myState: 'PENDING',
        myRequestId: '00000000-0000-4000-8000-00000000preview',
      };
    case 'preview-rejected':
      return { kind: 'VALID', preview: PREVIEW_TRIP, myState: 'REJECTED', myRequestId: null };
    case 'preview-full':
      return {
        kind: 'VALID',
        preview: { ...PREVIEW_TRIP, activeMemberCount: 3 },
        myState: 'NONE',
        myRequestId: null,
      };
    case 'preview-expired':
      return { kind: 'EXPIRED' };
    case 'preview-revoked':
      return { kind: 'REVOKED' };
    case 'preview-notfound':
      return { kind: 'NOT_FOUND' };
    default:
      return null;
  }
}
