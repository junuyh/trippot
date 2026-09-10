// ============================================================================
// 알림 문구 — notifications.title / body 의 단일 기준
//
// 알림을 만드는 곳이 여러 군데로 늘어나도 문구는 여기 하나만 고친다.
// (자금 목표 달성은 자금 화면에서, D-7 은 스케줄러에서 만들게 된다)
//
// ⚠️ 이 파일은 **문구만** 만든다. notifications 에 INSERT 하지 않는다.
//    생성 시점(스케줄러·트리거·Edge Function)은 이 브랜치 범위가 아니다.
//
// ⚠️ type 문자열을 여기서 다시 적지 않는다. NOTIFICATION_TYPE 을 그대로 쓴다.
//    Record<NotificationType, …> 이라 하나라도 빠지거나 없는 type 을 적으면
//    tsc 가 막는다. 상수·DB CHECK·문구가 갈라지지 않는다.
//
// ⚠️ 2026-09-10 · 알림이 3종 → 17종으로 늘어 INV 7종 · CXL 7종 문구를 채웠다.
//    (이슈 #73 확정본) 이 Record 가 컴파일로 요구해서 함께 넣은 것이고,
//    **발송하는 코드는 아직 없다.**
//
// ⚠️ 빌더가 tripName 하나만 받는다. 초대·취소 알림은 원래 "누가" 를 함께
//    말해야 자연스럽다("민지님이 참여를 요청했어요"). 지금은 이름을 받을 자리가
//    없어 여행명만으로 읽히게 썼다. 발송을 붙일 때 인자를 늘리는 편이 낫다.
// ============================================================================
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';

/** notifications 의 title · body 한 쌍. */
export type NotificationMessage = {
  title: string;
  body: string;
};

/** 여행명을 받아 문구를 만든다. */
type NotificationMessageBuilder = (tripName: string) => NotificationMessage;

/**
 * 알림 17종의 문구.
 *
 * ⚠️ title 은 여행명 없이 그 자체로 읽힌다. 목록에서 굵게 보이는 한 줄이라
 *    여행명은 body 에 둔다. (docs/05_ERD_v5.md §3 notifications)
 */
export const NOTIFICATION_MESSAGES: Record<NotificationType, NotificationMessageBuilder> = {
  [NOTIFICATION_TYPE.FUND_GOAL_REACHED]: (tripName) => ({
    title: '여행 준비금 목표를 달성했어요',
    body: `${tripName}의 목표 여행비를 모두 모았어요.`,
  }),
  [NOTIFICATION_TYPE.TRIP_D7]: (tripName) => ({
    title: '여행이 일주일 남았어요',
    body: `${tripName}이 7일 뒤 시작돼요.`,
  }),
  [NOTIFICATION_TYPE.SETTLEMENT_READY]: (tripName) => ({
    title: '여행 정산을 확인해 보세요',
    body: `${tripName}이 끝났어요. 실제 지출을 확인해 보세요.`,
  }),

  // ── 초대 · 멤버 (INV/MEM) ─────────────────────────────────────────────
  [NOTIFICATION_TYPE.INVITE_SENT]: (tripName) => ({
    title: '여행에 초대받았어요',
    body: `${tripName}에 함께 가자는 초대가 왔어요.`,
  }),
  [NOTIFICATION_TYPE.JOIN_REQUESTED]: (tripName) => ({
    title: '참여 요청이 왔어요',
    body: `${tripName}에 함께 가고 싶어 하는 사람이 있어요.`,
  }),
  [NOTIFICATION_TYPE.JOIN_ACCEPTED]: (tripName) => ({
    title: '여행에 합류했어요',
    body: `${tripName} 준비를 함께 시작해요.`,
  }),
  /** ⚠️ 거절 사유를 묻지도 전달하지도 않는다. (POL-INV-051) */
  [NOTIFICATION_TYPE.JOIN_REJECTED]: (tripName) => ({
    title: '참여 요청이 받아들여지지 않았어요',
    body: `${tripName}에는 합류하지 못했어요.`,
  }),
  [NOTIFICATION_TYPE.MEMBER_JOINED]: (tripName) => ({
    title: '새 멤버가 합류했어요',
    body: `${tripName}에 함께 갈 사람이 늘었어요.`,
  }),
  [NOTIFICATION_TYPE.MEMBER_LEFT]: (tripName) => ({
    title: '멤버가 여행에서 나갔어요',
    body: `${tripName}의 멤버 한 명이 나갔어요.`,
  }),
  [NOTIFICATION_TYPE.OWNER_DELEGATED]: (tripName) => ({
    title: '여행장이 되었어요',
    body: `${tripName}의 여행장을 맡게 됐어요.`,
  }),

  // ── 여행 취소 (CXL) ──────────────────────────────────────────────────
  /** ⚠️ 취소 사유를 본문에 넣지 않는다. 앱 안에서만 보여준다. (POL-CXL-029) */
  [NOTIFICATION_TYPE.CANCEL_REQUESTED]: (tripName) => ({
    title: '여행 취소 요청이 왔어요',
    body: `${tripName}을 취소할지 정해 주세요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_VOTE_AGREED]: (tripName) => ({
    title: '취소에 동의한 사람이 있어요',
    body: `${tripName} 취소 요청에 동의가 하나 늘었어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_REJECTED]: (tripName) => ({
    title: '여행 취소가 없던 일이 됐어요',
    body: `${tripName}은 그대로 진행돼요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_EXPIRED]: (tripName) => ({
    title: '취소 요청 기한이 지났어요',
    body: `${tripName} 취소 요청이 사라졌어요. 여행은 그대로예요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_WITHDRAWN]: (tripName) => ({
    title: '취소 요청이 철회됐어요',
    body: `${tripName} 취소 요청을 요청한 사람이 거뒀어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_CONFIRMED]: (tripName) => ({
    title: '여행이 취소됐어요',
    body: `${tripName}이 모두의 동의로 취소됐어요. 72시간 안에는 되돌릴 수 있어요.`,
  }),
  [NOTIFICATION_TYPE.CANCEL_RESTORED]: (tripName) => ({
    title: '여행이 되살아났어요',
    body: `${tripName} 취소가 되돌려졌어요.`,
  }),
};

/**
 * 알림 하나의 문구를 만든다.
 *
 * ```ts
 * const { title, body } = buildNotificationMessage(NOTIFICATION_TYPE.TRIP_D7, '오사카');
 * ```
 */
export function buildNotificationMessage(
  type: NotificationType,
  tripName: string,
): NotificationMessage {
  return NOTIFICATION_MESSAGES[type](tripName);
}
