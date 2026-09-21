// ============================================================================
// 알림 상세의 "현재 상태 · CTA" 계산 (docs/14_알림센터_v1.md §6)
//
// 알림 행(title · body)은 과거에 일어난 사실의 스냅샷이다. 그걸 누른 **지금** 무엇을 할 수
// 있는지는 현재 domain 상태를 다시 물어서 정한다. 승인이 이미 끝난 요청에 [승인하기] 를
// 다시 보여주지 않기 위해서다.
//
// 플랫폼 · 화면과 무관하다. 여기서 화면을 그리지도, router 를 부르지도 않는다.
// href 만 돌려주고 화면 파일이 이동한다.
//
// 1차 지원: INVITE_RECEIVED · JOIN_REQUESTED · JOIN_ACCEPTED · JOIN_REJECTED
// 그 밖의 type 은 상태 라벨 없이, 여행이 남아 있으면 [여행 보기] 만.
//
// ⚠️ raw invite token 을 쓰지 않는다. INVITE_RECEIVED 는 data.inviteId 로 서버에 다시 묻는다.
// ⚠️ 실패(네트워크 · 권한)는 삼키고 "지금은 확인할 수 없어요" 로 둔다. 상세 화면은 뜬다.
// ============================================================================
import { NOTIFICATION_TYPE } from '@/lib/constants/status';
import type { Notification } from '@/lib/supabase/queries/notifications';
import {
  getTripJoinRequests,
  resolveTripInviteById,
} from '@/lib/supabase/queries/tripJoinRequests';
import { hasLeftTrip } from '@/lib/supabase/queries/tripMembers';

export type NotificationAction = {
  /** 지금 상태. 예: '승인 대기' · '승인 완료'. 없으면 안 그린다. */
  statusLabel: string | null;
  /** 눌러서 갈 곳. 없으면 버튼을 그리지 않는다. */
  cta: { label: string; href: string } | null;
};

const NONE: NotificationAction = { statusLabel: null, cta: null };
const UNAVAILABLE: NotificationAction = { statusLabel: '지금은 확인할 수 없어요', cta: null };

/** data 에서 문자열 키 하나. jsonb 라 형태를 믿지 않는다. */
function readString(data: Notification['data'], key: string): string | null {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function tripHome(tripId: string): NotificationAction['cta'] {
  return { label: '여행 보기', href: `/trips/${tripId}` };
}

/**
 * INVITE_RECEIVED — 서버에 inviteId 로 다시 물어 invite_state · my_state 대로.
 *   VALID + NONE/LEFT → [여행 초대 확인하기] (/invite/by/:inviteId)
 *   PENDING           → '승인 대기 중' + 같은 화면(대기 화면이 뜬다)
 *   ACTIVE            → '참여 중' + [여행 보기]
 *   REJECTED          → '요청이 거절됐어요'
 *   EXPIRED/REVOKED   → '만료된 초대예요' / '더 이상 쓸 수 없는 초대예요'
 *   NOT_FOUND         → 초대가 사라졌거나 권한이 없다
 */
async function resolveInviteReceived(notification: Notification): Promise<NotificationAction> {
  const inviteId = readString(notification.data, 'inviteId');
  if (!inviteId) return UNAVAILABLE;

  const row = await resolveTripInviteById(inviteId);
  const inviteHref = `/invite/by/${inviteId}`;

  switch (row.invite_state) {
    case 'VALID':
      if (row.my_state === 'ACTIVE') {
        return { statusLabel: '참여 중', cta: row.trip_id ? tripHome(row.trip_id) : null };
      }
      if (row.my_state === 'PENDING') {
        return { statusLabel: '수락 대기 중', cta: { label: '참여 의사 상태 보기', href: inviteHref } };
      }
      if (row.my_state === 'REJECTED') {
        return { statusLabel: '참여 의사가 거절됐어요', cta: null };
      }
      return { statusLabel: null, cta: { label: '여행 초대 확인하기', href: inviteHref } };
    case 'EXPIRED':
      return { statusLabel: '만료된 초대예요', cta: null };
    case 'REVOKED':
      return { statusLabel: '더 이상 쓸 수 없는 초대예요', cta: null };
    default:
      return { statusLabel: '찾을 수 없는 초대예요', cta: null };
  }
}

/**
 * JOIN_REQUESTED — 여행장에게 온 알림. 그 요청이 아직 PENDING 인지 서버 목록으로 확인한다.
 *   PENDING (목록에 있음) → '수락 대기' + [참여 의사 확인하기] (/trips/:tripId/edit)
 *   ⚠️ 이 CTA 는 이동만 한다. 수락·거절은 여행 정보 수정의 시트에서 하므로 '수락' 을 붙이지 않는다. (2026-09-20)
 *   목록에 없음           → 이미 처리됨. 승인/거절 구분은 앱이 직접 읽지 않는다 → '처리 완료'
 *   NOT_LEADER 등 예외    → 더는 여행장이 아니다 → '처리 완료' + [여행 보기]
 * ⚠️ trip_join_requests 를 앱이 직접 읽지 않는다. (docs/12) 목록 RPC 하나로 판단한다.
 */
async function resolveJoinRequested(notification: Notification): Promise<NotificationAction> {
  const tripId = notification.trip_id;
  const requestId = readString(notification.data, 'requestId');
  if (!tripId) return { statusLabel: '사라진 여행이에요', cta: null };

  try {
    const pending = await getTripJoinRequests(tripId);
    const stillPending = requestId !== null && pending.some((row) => row.request_id === requestId);
    if (stillPending) {
      return {
        statusLabel: '수락 대기',
        // ⚠️ focus=requests — 배너와 같은 자리로 보낸다. 그냥 보내면 캘린더만 보인다
        cta: { label: '참여 의사 확인하기', href: `/trips/${tripId}/edit?focus=requests` },
      };
    }
    return { statusLabel: '처리 완료', cta: tripHome(tripId) };
  } catch {
    // NOT_LEADER · LEADER_NOT_CONFIGURED · NOT_FOUND — 판단할 권한이 없거나 여행이 바뀌었다.
    return { statusLabel: '처리 완료', cta: tripHome(tripId) };
  }
}

/**
 * JOIN_ACCEPTED — 요청자에게. 지금도 참여 중이면 여행으로, 그새 나갔으면 LEFT 정책(docs/11 §6-2).
 */
async function resolveJoinAccepted(
  notification: Notification,
  currentUserId: string,
): Promise<NotificationAction> {
  const tripId = notification.trip_id;
  if (!tripId) return { statusLabel: '사라진 여행이에요', cta: null };

  if (await hasLeftTrip(tripId, currentUserId)) {
    return { statusLabel: '나간 여행이에요', cta: null };
  }
  return { statusLabel: '참여 중', cta: { label: '여행 준비 보러가기', href: `/trips/${tripId}` } };
}

/**
 * 알림 하나의 현재 상태와 CTA.
 * @param currentUserId 로그인 사용자. 알림 소유자와 같다 (상세 화면이 userId 로 조회했다).
 */
export async function resolveNotificationAction(
  notification: Notification,
  currentUserId: string,
): Promise<NotificationAction> {
  try {
    switch (notification.type) {
      case NOTIFICATION_TYPE.INVITE_RECEIVED:
        return await resolveInviteReceived(notification);
      case NOTIFICATION_TYPE.JOIN_REQUESTED:
        return await resolveJoinRequested(notification);
      case NOTIFICATION_TYPE.JOIN_ACCEPTED:
        return await resolveJoinAccepted(notification, currentUserId);
      case NOTIFICATION_TYPE.TRIP_AUTO_JOINED:
        // 자동 합류도 결과는 '참여 중' 이다. 그새 나갔으면 LEFT 정책 그대로. (2026-09-21)
        return await resolveJoinAccepted(notification, currentUserId);
      case NOTIFICATION_TYPE.JOIN_REJECTED:
        // 거절 사유는 노출하지 않는다. (POL-INV-051) 갈 곳도 없다.
        return { statusLabel: '거절됨', cta: null };
      default:
        // 2차 type(MEMBER/OWNER/CANCEL) · 옛 3종. 상태 계산은 producer 가 생길 때 붙인다.
        return notification.trip_id ? { statusLabel: null, cta: tripHome(notification.trip_id) } : NONE;
    }
  } catch {
    return UNAVAILABLE;
  }
}
