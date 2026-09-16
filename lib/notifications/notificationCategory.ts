// ============================================================================
// 알림센터 사용자용 카테고리 — type → 카테고리 매핑 (docs/14_알림센터_v1.md §3)
//
// 사용자에게 raw type 18개를 필터로 보여주지 않는다. DB 에 category 컬럼도 없다.
// 이 파일이 유일한 매핑이다. 목록 필터는 여기서 나온 type 목록을 **서버 쪽** `in('type', …)` 으로
// 보낸다. 30건 받아 놓고 앱에서 거르지 않는다 (그러면 어떤 필터는 2건만 보인다).
//
// 현재 In-app 범위 밖이라 어떤 카테고리에도 넣지 않는 것:
//   FUND_GOAL_REACHED · TRIP_D7 · SETTLEMENT_READY  (Remote Push 정책 때 재검토)
//   INVITE_SENT                                      (producer 없음 · 미사용)
//   CANCEL_VOTE_AGREED                               (소음 · producer 제외 권장)
// ⚠️ 상수 자체는 지우지 않는다. '전체' 는 필터 없이 전부 보여준다.
// ============================================================================
import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';

export const NOTIFICATION_CATEGORY = {
  ALL: 'ALL',
  INVITE: 'INVITE',
  MEMBER: 'MEMBER',
  CANCEL: 'CANCEL',
} as const;

export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

/** 필터 칩 순서 그대로. */
export const NOTIFICATION_CATEGORIES: readonly {
  key: NotificationCategory;
  label: string;
}[] = [
  { key: NOTIFICATION_CATEGORY.ALL, label: '전체' },
  { key: NOTIFICATION_CATEGORY.INVITE, label: '초대·참여' },
  { key: NOTIFICATION_CATEGORY.MEMBER, label: '멤버·권한' },
  { key: NOTIFICATION_CATEGORY.CANCEL, label: '여행 취소' },
];

const CATEGORY_TYPES: Record<
  Exclude<NotificationCategory, typeof NOTIFICATION_CATEGORY.ALL>,
  readonly NotificationType[]
> = {
  [NOTIFICATION_CATEGORY.INVITE]: [
    NOTIFICATION_TYPE.INVITE_RECEIVED,
    NOTIFICATION_TYPE.JOIN_REQUESTED,
    NOTIFICATION_TYPE.JOIN_ACCEPTED,
    NOTIFICATION_TYPE.JOIN_REJECTED,
    NOTIFICATION_TYPE.MEMBER_JOINED,
  ],
  [NOTIFICATION_CATEGORY.MEMBER]: [
    NOTIFICATION_TYPE.MEMBER_LEFT,
    NOTIFICATION_TYPE.OWNER_DELEGATED,
  ],
  [NOTIFICATION_CATEGORY.CANCEL]: [
    NOTIFICATION_TYPE.CANCEL_REQUESTED,
    NOTIFICATION_TYPE.CANCEL_REJECTED,
    NOTIFICATION_TYPE.CANCEL_EXPIRED,
    NOTIFICATION_TYPE.CANCEL_WITHDRAWN,
    NOTIFICATION_TYPE.CANCEL_CONFIRMED,
    NOTIFICATION_TYPE.CANCEL_RESTORED,
  ],
};

/** 서버 필터에 넘길 type 목록. '전체' 는 null — 필터를 걸지 않는다. */
export function typesForCategory(category: NotificationCategory): readonly NotificationType[] | null {
  return category === NOTIFICATION_CATEGORY.ALL ? null : CATEGORY_TYPES[category];
}
