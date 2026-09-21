// ============================================================================
// 상태값·열거형 상수
// 기준: supabase/migrations/20260827000001_init_schema.sql 의 CHECK 제약
//
// ⚠️ 화면·쿼리 어디서도 'PLANNING' 같은 문자열 리터럴을 직접 쓰지 않는다.
//    이 파일의 상수만 쓴다. (CLAUDE.md 6장)
//
// ⚠️ 값은 DB CHECK 제약과 **글자 그대로** 일치해야 한다.
//    바꾸려면 마이그레이션을 먼저 고쳐야 한다. 여기만 고치면 런타임에 INSERT 가 깨진다.
//
// 대소문자 주의: 대부분 대문자지만 APPLIED_SOURCE 와 EVENT_LOG_ENV 는 소문자다.
//               DB CHECK 가 그렇게 정의돼 있다.
//
// ⚠️⚠️ DB 값과 Analytics 값은 다르다. ⚠️⚠️
//       track() 에 넘기기 전 반드시 변환 맵을 거친다. (파일 하단 "DB → Analytics 변환 맵")
//       DB 는 CHECK 제약이 있어 틀리면 즉시 터지지만, Analytics 는 검증이 없어
//       잘못된 값이 조용히 쌓인다. 리포트를 쓸 때 발견하면 이미 늦다.
// ============================================================================

// ── 모임 ───────────────────────────────────────────────────────────────────
export const GROUP_STATUS = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;
export type GroupStatus = (typeof GROUP_STATUS)[keyof typeof GROUP_STATUS];

export const GROUP_MEMBER_ROLE = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;
export type GroupMemberRole =
  (typeof GROUP_MEMBER_ROLE)[keyof typeof GROUP_MEMBER_ROLE];

export const GROUP_MEMBER_STATUS = {
  ACTIVE: "ACTIVE",
  INVITED: "INVITED",
  LEFT: "LEFT",
} as const;
export type GroupMemberStatus =
  (typeof GROUP_MEMBER_STATUS)[keyof typeof GROUP_MEMBER_STATUS];

// ── 여행 ───────────────────────────────────────────────────────────────────
export const TRIP_OWNER_TYPE = {
  PERSONAL: "PERSONAL",
  GROUP: "GROUP",
} as const;
export type TripOwnerType =
  (typeof TRIP_OWNER_TYPE)[keyof typeof TRIP_OWNER_TYPE];

export const TRIP_STATUS = {
  PLANNING: "PLANNING",
  TRAVELING: "TRAVELING",
  ENDED: "ENDED",
  SETTLED: "SETTLED",
  DELETED: "DELETED",
  /**
   * 전원 동의로 취소된 여행. DELETED 와 다르게 되돌릴 수 있고 데이터를 남긴다.
   * trips.canceled_at 이 취소 확정 시각이며 되돌리기 72시간의 기준이다.
   * (20260909000001_trips_canceled_status.sql · 2026-09-09)
   */
  /**
   * 취소가 요청되어 동의 절차가 도는 중. 아직 취소된 게 아니다.
   * trip_cancel_requests 에 PENDING 요청이 한 건 있고, 요청자를 뺀 전원이
   * 동의하면 CANCELED 로 넘어간다. 7일 안에 안 모이면 만료된다.
   * (20260910000002_trip_cancel.sql · 2026-09-10)
   *
   * ⚠️ 이 상태의 여행은 **홈 진행 중 목록에 보여야 한다.** 동의할 사람이
   *    들어갈 길이 그 목록뿐이다. 지금 app/(tabs)/index.tsx 는 PLANNING·
   *    TRAVELING 만 통과시켜 이 값이 빠진다. 취소 기능을 붙일 때 함께 고친다.
   */
  CANCEL_PENDING: "CANCEL_PENDING",
  CANCELED: "CANCELED",
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_MEMBER_STATUS = {
  ACTIVE: "ACTIVE",
  INVITED: "INVITED",
  LEFT: "LEFT",
} as const;
export type TripMemberStatus =
  (typeof TRIP_MEMBER_STATUS)[keyof typeof TRIP_MEMBER_STATUS];

// ── 예산 ───────────────────────────────────────────────────────────────────
export const BUDGET_METHOD = {
  RECOMMENDED: "RECOMMENDED",
  USER_DEFINED: "USER_DEFINED",
} as const;
export type BudgetMethod = (typeof BUDGET_METHOD)[keyof typeof BUDGET_METHOD];

export const CATEGORY_CODE = {
  AIRFARE: "AIRFARE",
  LODGING: "LODGING",
  FOOD: "FOOD",
  TRANSPORT: "TRANSPORT",
  ACTIVITY: "ACTIVITY",
  SHOPPING: "SHOPPING",
  INSURANCE: "INSURANCE",
  CONTINGENCY: "CONTINGENCY",
} as const;
export type CategoryCode = (typeof CATEGORY_CODE)[keyof typeof CATEGORY_CODE];

/**
 * planned_amount 가 어느 값에서 왔는지. (CLAUDE.md 4장)
 * ⚠️ 이 열거값만 소문자다. DB CHECK 가 소문자로 정의돼 있다.
 */
export const APPLIED_SOURCE = {
  DEFAULT: "default",
  PERSONALIZED: "personalized",
  USER: "user",
} as const;
export type AppliedSource =
  (typeof APPLIED_SOURCE)[keyof typeof APPLIED_SOURCE];

export const BUDGET_PLAN_ITEM_STATUS = {
  PLANNED: "PLANNED",
  DONE: "DONE",
  CANCELED: "CANCELED",
} as const;
export type BudgetPlanItemStatus =
  (typeof BUDGET_PLAN_ITEM_STATUS)[keyof typeof BUDGET_PLAN_ITEM_STATUS];

/**
 * budget_plan_items.display_mode. 목록에서 금액을 보여주는 방식이다.
 *
 * ⚠️ 표시에만 쓴다. expected_amount 는 언제나 **총액**이고 이 값에 따라
 *    바뀌지 않는다. 계획 합계·설정 예산·결산 어디에도 영향을 주지 않는다.
 *    (BUDGET-02 v2 스펙 / 20260901000001 마이그레이션)
 */
export const PLAN_DISPLAY_MODE = {
  TOTAL: "TOTAL",
  PER_PERSON: "PER_PERSON",
} as const;
export type PlanDisplayMode =
  (typeof PLAN_DISPLAY_MODE)[keyof typeof PLAN_DISPLAY_MODE];

/**
 * transactions.refund_status. 환불·취소 상태다.
 *
 * ⚠️ 환불을 입금(DEPOSIT) 거래로 넣지 않는다. 누적 모금액이 잘못 늘어난다.
 *    금액은 양수로 두고 성격만 이 값으로 구분한다.
 *
 *   PENDING   환불 예정. 아직 돈이 돌아오지 않아 **지출에 남긴다**
 *   REFUNDED  환불 완료. 실제 지출 집계에서 뺀다
 *   CANCELED  결제 취소. 처음부터 없던 거래로 본다
 */
export const REFUND_STATUS = {
  NONE: "NONE",
  PENDING: "PENDING",
  REFUNDED: "REFUNDED",
  CANCELED: "CANCELED",
} as const;
export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

// ── 여행자금 ───────────────────────────────────────────────────────────────
/** fund_sources.source_type. ZERO 는 '아직 등록 안 함'이다. */
export const FUND_SOURCE_TYPE = {
  ACCOUNT: "ACCOUNT",
  MANUAL: "MANUAL",
  ZERO: "ZERO",
  MOCK: "MOCK",
} as const;
export type FundSourceType =
  (typeof FUND_SOURCE_TYPE)[keyof typeof FUND_SOURCE_TYPE];

// ── 거래 ───────────────────────────────────────────────────────────────────
/** transactions.source_type / contributions.source_type. ZERO 가 없다. */
export const TRANSACTION_SOURCE_TYPE = {
  ACCOUNT: "ACCOUNT",
  MANUAL: "MANUAL",
  MOCK: "MOCK",
} as const;
export type TransactionSourceType =
  (typeof TRANSACTION_SOURCE_TYPE)[keyof typeof TRANSACTION_SOURCE_TYPE];

export const TRANSACTION_TYPE = {
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
} as const;
export type TransactionType =
  (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

/** 거래 카테고리를 누가 정했는가. */
export const CATEGORY_METHOD = {
  AUTO: "AUTO",
  USER: "USER",
  NONE: "NONE",
} as const;
export type CategoryMethod =
  (typeof CATEGORY_METHOD)[keyof typeof CATEGORY_METHOD];

// ── 모임원 납부 ────────────────────────────────────────────────────────────
export const CONTRIBUTION_STATUS = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;
export type ContributionStatus =
  (typeof CONTRIBUTION_STATUS)[keyof typeof CONTRIBUTION_STATUS];

// ── 커뮤니티 ───────────────────────────────────────────────────────────────
export const POST_TYPE = {
  POST: "POST",
  FREE_TIP: "FREE_TIP",
  PAID_TIP: "PAID_TIP",
  TYPE_SHARE: "TYPE_SHARE",
} as const;
export type PostType = (typeof POST_TYPE)[keyof typeof POST_TYPE];

export const POST_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  HIDDEN: "HIDDEN",
  DELETED: "DELETED",
} as const;
export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];

export const COMMENT_STATUS = {
  PUBLISHED: "PUBLISHED",
  HIDDEN: "HIDDEN",
  DELETED: "DELETED",
} as const;
export type CommentStatus =
  (typeof COMMENT_STATUS)[keyof typeof COMMENT_STATUS];

/**
 * 글에 남기는 반응.
 *
 * DB 의 check (reaction_type in ('LIKE','DISLIKE','BOOKMARK')) 와 같아야 한다.
 * (supabase/migrations/20260902000001_reaction_types.sql)
 *
 * BOOKMARK(찜)는 개수를 공개하지 않는다. 내가 눌렀는지만 화면에 쓴다.
 */
export const REACTION_TYPE = {
  LIKE: "LIKE",
  DISLIKE: "DISLIKE",
  BOOKMARK: "BOOKMARK",
} as const;
export type ReactionType = (typeof REACTION_TYPE)[keyof typeof REACTION_TYPE];

// ── 팁 판매 ────────────────────────────────────────────────────────────────
export const SALES_STATUS = {
  ON_SALE: "ON_SALE",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
} as const;
export type SalesStatus = (typeof SALES_STATUS)[keyof typeof SALES_STATUS];

export const PURCHASE_STATUS = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  REFUNDED: "REFUNDED",
} as const;
export type PurchaseStatus =
  (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

// ── 보험 제휴 ──────────────────────────────────────────────────────────────
export const INSURANCE_REFERRAL_STATUS = {
  CLICKED: "CLICKED",
  QUOTE_COMPLETED: "QUOTE_COMPLETED",
  PURCHASE_COMPLETED: "PURCHASE_COMPLETED",
} as const;
export type InsuranceReferralStatus =
  (typeof INSURANCE_REFERRAL_STATUS)[keyof typeof INSURANCE_REFERRAL_STATUS];

// ── 알림 ───────────────────────────────────────────────────────────────────
/**
 * notifications.type — 받은 알림의 종류.
 *
 * ⚠️ 이 목록은 DB 의 `notifications_type_check` 허용값과 정확히 같아야 한다.
 *    하나라도 다르면 앱이 만든 알림이 DB 에서 거부된다.
 *
 * ⚠️ 화면·기능 코드에서는 type 문자열을 직접 쓰지 않고
 *    반드시 `NOTIFICATION_TYPE` 을 사용한다.
 *
 * ⚠️ 이 목록은 아래 둘과 **글자 하나까지 같아야 한다.** 하나라도 다르면 알림이
 *    저장되지 않는다.
 *      supabase/migrations/20260910000001_trip_invites_members.sql ⑥ 의 CHECK
 *      docs/05_ERD 의 확정 목록
 *
 * ⚠️ INV 7종 · CXL 7종은 값만 열어 둔 상태다. 발송하는 코드는 아직 없다.
 *    (2026-09-10 · 이슈 #73 확정본)
 */
export const NOTIFICATION_TYPE = {
  /** 전체 목표 여행비 100% 최초 달성 */
  FUND_GOAL_REACHED: "FUND_GOAL_REACHED",
  /** 여행 시작 7일 전 */
  TRIP_D7: "TRIP_D7",
  /** 여행 종료 후 정산 가능 */
  SETTLEMENT_READY: "SETTLEMENT_READY",

  // ── 초대 · 멤버 (INV/MEM) ─────────────────────────────────────────────
  // 2026-09-10 · 이슈 #73 확정본. 발송 코드는 아직 없다. 값을 먼저 연다.
  /** 초대 링크 발송 → 초대받은 사람. ⚠️ multi-use 링크라 발송 시점에 수신자를 모른다 — 미사용 (docs/14 §3) */
  INVITE_SENT: "INVITE_SENT",
  /** 로그인한 사용자가 유효한 초대 링크를 처음 열었을 때 → 그 사람 (docs/14 §3-1 · 2026-09-16 · migration 20260916000001) */
  INVITE_RECEIVED: "INVITE_RECEIVED",
  /** 참여 요청 도착 → 여행장 */
  JOIN_REQUESTED: "JOIN_REQUESTED",
  /** 수락됨 → 요청자 */
  JOIN_ACCEPTED: "JOIN_ACCEPTED",
  /** 거절됨 → 요청자 */
  JOIN_REJECTED: "JOIN_REJECTED",
  /** 새 멤버 합류 → 기존 멤버 */
  MEMBER_JOINED: "MEMBER_JOINED",
  /** 멤버 이탈 → 남은 멤버 */
  MEMBER_LEFT: "MEMBER_LEFT",
  /** 여행장 위임 → 새 여행장 */
  OWNER_DELEGATED: "OWNER_DELEGATED",
  /** 기존 모임으로 새 여행이 만들어져 초대 없이 자동 합류 → 합류당한 본인 (2026-09-21 · migration 20260921000013) */
  TRIP_AUTO_JOINED: "TRIP_AUTO_JOINED",

  // ── 여행 취소 (CXL) ──────────────────────────────────────────────────
  /** 취소 요청 발생 → 동의 대상 전원 */
  CANCEL_REQUESTED: "CANCEL_REQUESTED",
  /** 멤버가 동의 → 요청자 */
  CANCEL_VOTE_AGREED: "CANCEL_VOTE_AGREED",
  /** 멤버가 반대 → 요청 폐기 → 전원 */
  CANCEL_REJECTED: "CANCEL_REJECTED",
  /** 만료 → 요청 폐기 → 전원 */
  CANCEL_EXPIRED: "CANCEL_EXPIRED",
  /** 요청자 철회 → 전원 */
  CANCEL_WITHDRAWN: "CANCEL_WITHDRAWN",
  /** 전원 동의 → 취소 확정 → 전원 */
  CANCEL_CONFIRMED: "CANCEL_CONFIRMED",
  /** 되돌리기 실행 → 전원 */
  CANCEL_RESTORED: "CANCEL_RESTORED",
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

// ── 로그 ───────────────────────────────────────────────────────────────────
/** ⚠️ 소문자다. track() 이 자동으로 채우므로 화면에서 직접 쓸 일은 없다. */
export const EVENT_LOG_ENV = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
} as const;
export type EventLogEnv = (typeof EVENT_LOG_ENV)[keyof typeof EVENT_LOG_ENV];

// ============================================================================
// Analytics 파라미터 열거값
// 기준: docs/06_이벤트로그정의서_v1.md 7장
//
// ⚠️⚠️ DB 값과 Analytics 값은 다르다. ⚠️⚠️
//       track() 에 넘기기 전 반드시 아래 변환 맵을 거친다.
//
//       DB 는 대문자 스네이크, Analytics 는 소문자 스네이크다. (docs/06 §4)
//       DB 값을 그대로 track() 에 넘기면 CHECK 제약이 없으므로 **아무 에러 없이**
//       잘못된 값이 쌓인다. 리포트를 쓸 때 발견하면 이미 늦다.
//
// 문서에 열거값이 정의되지 않은 파라미터는 여기에 만들지 않았다.
// 아래 "문서 미정의" 목록 참조. 임의로 값을 지어내지 않는다. (docs/06 §11)
// ============================================================================

// ── 여행 생성 (docs/06 §7-1) ───────────────────────────────────────────────

/** trip_create_started.entry_point */
export const ENTRY_POINT = {
  HOME: "home",
  EMPTY_STATE: "empty_state",
  GROUP_DETAIL: "group_detail",
  PAST_TRIP: "past_trip",
} as const;
export type EntryPoint = (typeof ENTRY_POINT)[keyof typeof ENTRY_POINT];

/** trip_companion_selected.companion_type. DB 대응 없음 (신규/기존 모임 구분은 앱 상태다). */
export const COMPANION_TYPE = {
  PERSONAL: "personal",
  EXISTING_GROUP: "existing_group",
  NEW_GROUP: "new_group",
} as const;
export type CompanionType =
  (typeof COMPANION_TYPE)[keyof typeof COMPANION_TYPE];

/**
 * budget_method_selected.method
 * ⚠️ DB BUDGET_METHOD 와 이름도 뜻도 같지만 값이 다르다. USER_DEFINED ≠ user_entered.
 */
export const ANALYTICS_BUDGET_METHOD = {
  RECOMMENDED: "recommended",
  USER_ENTERED: "user_entered",
} as const;
export type AnalyticsBudgetMethod =
  (typeof ANALYTICS_BUDGET_METHOD)[keyof typeof ANALYTICS_BUDGET_METHOD];

/**
 * travel_fund_registered.fund_type
 * ⚠️ DB FUND_SOURCE_TYPE 은 값이 4개(MOCK 포함), 이쪽은 3개다.
 */
export const FUND_TYPE = {
  ACCOUNT: "account",
  MANUAL: "manual",
  ZERO: "zero",
} as const;
export type FundType = (typeof FUND_TYPE)[keyof typeof FUND_TYPE];

/**
 * trip_created.owner_type
 * ⚠️ DB TRIP_OWNER_TYPE 은 'PERSONAL' | 'GROUP' (대문자). 여기는 소문자다.
 */
export const ANALYTICS_OWNER_TYPE = {
  PERSONAL: "personal",
  GROUP: "group",
} as const;
export type AnalyticsOwnerType =
  (typeof ANALYTICS_OWNER_TYPE)[keyof typeof ANALYTICS_OWNER_TYPE];

// ── 예산 상세 (docs/06 §7-2) ───────────────────────────────────────────────

/**
 * budget_category_edited.category / budget_plan_item_*.category /
 * transaction_*.category / personalization_offered.top_category / tip_*.category
 *
 * ⚠️ DB CATEGORY_CODE 와 **철자가 아예 다르다.** AIRFARE ≠ flight, CONTINGENCY ≠ reserve.
 *    반드시 CATEGORY_CODE_TO_ANALYTICS 를 거친다.
 */
export const ANALYTICS_CATEGORY = {
  FLIGHT: "flight",
  ACCOMMODATION: "accommodation",
  FOOD: "food",
  TRANSPORT: "transport",
  ACTIVITY: "activity",
  SHOPPING: "shopping",
  INSURANCE: "insurance",
  RESERVE: "reserve",
} as const;
export type AnalyticsCategory =
  (typeof ANALYTICS_CATEGORY)[keyof typeof ANALYTICS_CATEGORY];

// budget_category_edited.applied_source 는 DB APPLIED_SOURCE 와 값이 같다.
// (DB 쪽이 원래 소문자다) 이 파라미터만 변환 없이 그대로 넘겨도 된다.

// ── 입출금·예산 연결 (docs/06 §7-3) ────────────────────────────────────────

/**
 * transaction_categorized.mapped_by
 * ⚠️ DB CATEGORY_METHOD 는 AUTO|USER|NONE 3개. 여기는 NONE 이 없다.
 *    미분류(NONE) 거래는 이 이벤트를 쏘지 않는다.
 */
export const MAPPED_BY = {
  AUTO: "auto",
  USER: "user",
} as const;
export type MappedBy = (typeof MAPPED_BY)[keyof typeof MAPPED_BY];

/**
 * transaction_categorized.source_type
 * ⚠️ DB TRANSACTION_SOURCE_TYPE 은 ACCOUNT|MANUAL|MOCK 3개. 문서는 mock|manual 2개다.
 *    MVP 거래가 전부 Mock/수기라서 ACCOUNT 는 v1 문서에 정의되지 않았다.
 *    이 값으로 재는 것은 사용자 습관이 아니라 **자동분류 로직의 품질**이다. (docs/06 §7-3)
 */
export const ANALYTICS_TRANSACTION_SOURCE_TYPE = {
  MOCK: "mock",
  MANUAL: "manual",
} as const;
export type AnalyticsTransactionSourceType =
  (typeof ANALYTICS_TRANSACTION_SOURCE_TYPE)[keyof typeof ANALYTICS_TRANSACTION_SOURCE_TYPE];

// ── 세부 계획 추천 (BUDGET-02) ────────────────────────────────────────────

/**
 * 계획 항목이 **어디서 왔는가**. budget_plan_item_added.plan_source
 *
 * ⚠️ 이 값이 없으면 "AI 추천이 계획 항목 수를 늘렸는가" 를 잴 수 없다.
 *    프로젝트의 핵심 가설 중 하나라 추가했다. (2026-09-03)
 *
 * ⚠️ ai 와 catalog 를 나눈다. 둘 다 '추천에서 왔다' 지만 만든 주체가 다르다.
 *    합쳐 두면 Edge Function 이 죽어 카탈로그로만 돌아간 기간의 수치가
 *    AI 성과로 잡힌다. 실제로 그런 기간이 있었다.
 */
export const PLAN_ITEM_SOURCE = {
  /** 사용자가 직접 입력 */
  USER: "user",
  /** AI(Edge Function) 추천 카드 */
  AI: "ai",
  /** 규칙 기반 카탈로그 추천 카드 (AI 실패 시 대체) */
  CATALOG: "catalog",
} as const;
export type PlanItemSource =
  (typeof PLAN_ITEM_SOURCE)[keyof typeof PLAN_ITEM_SOURCE];

// ── 수기 → 계좌 전환 (docs/06 §7-4) ────────────────────────────────────────

/** fund_conversion_completed.result */
export const CONVERSION_RESULT = {
  SUCCESS: "success",
  FAIL: "fail",
} as const;
export type ConversionResult =
  (typeof CONVERSION_RESULT)[keyof typeof CONVERSION_RESULT];

// ── 결산 (docs/06 §7-5) ────────────────────────────────────────────────────

/** settlement_prompted.trigger. 여행 종료 자동 유도인지 사용자가 직접 눌렀는지. */
export const SETTLEMENT_TRIGGER = {
  AUTO: "auto",
  MANUAL: "manual",
} as const;
export type SettlementTrigger =
  (typeof SETTLEMENT_TRIGGER)[keyof typeof SETTLEMENT_TRIGGER];

// ── 여행자보험 (docs/06 §7-7) ──────────────────────────────────────────────

/**
 * insurance_cta_clicked.placement
 * 값이 SCREENS 의 일부와 같지만 의미가 다르다(CTA 가 놓인 위치).
 * SCREENS 를 재사용하지 말고 이 상수를 쓴다. 문서가 이 두 곳만 정의했다.
 */
export const INSURANCE_PLACEMENT = {
  BUDGET_DETAIL: "budget_detail",
  TRIP_HOME: "trip_home",
} as const;
export type InsurancePlacement =
  (typeof INSURANCE_PLACEMENT)[keyof typeof INSURANCE_PLACEMENT];

// ── 여행 팁 (docs/06 §7-8) ─────────────────────────────────────────────────

/** tip_reacted.reaction — 고도화(9/07~) 이벤트의 파라미터다. MVP 에서 쓰지 않는다. */
export const TIP_REACTION = {
  UP: "up",
  DOWN: "down",
} as const;
export type TipReaction = (typeof TIP_REACTION)[keyof typeof TIP_REACTION];

// ── 확정 열거값 (2026-08-27) ───────────────────────────────────────────────
// docs/06 v1 은 파라미터 이름만 적고 값을 정하지 않았던 것들이다.
// 아래 값으로 확정했다. ⚠️ docs/06 에는 아직 반영되지 않았다 (v2 대상).

/**
 * login_completed.provider
 * MVP 는 kakao 만 구현한다. 나머지는 [Future] — 값만 확정해 두고 쓰지 않는다.
 */
export const AUTH_PROVIDER = {
  KAKAO: "kakao",
  /** [Future] */
  APPLE: "apple",
  /** [Future] */
  GOOGLE: "google",
  /** [Future] */
  EMAIL: "email",
} as const;
export type AuthProvider = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

/**
 * trip_basic_info_submitted.travel_style
 *
 * 예산 추천 배수의 기준이 되는 값이다. Analytics 파라미터인 동시에
 * trips.travel_style_json 에 담기는 앱 데이터이기도 하다.
 * (해당 칼럼은 jsonb 라 DB CHECK 로 막혀 있지 않다. 이 상수가 유일한 방어선이다.)
 */
export const TRAVEL_STYLE = {
  BUDGET: "budget",
  STANDARD: "standard",
  COMFORT: "comfort",
} as const;
export type TravelStyle = (typeof TRAVEL_STYLE)[keyof typeof TRAVEL_STYLE];

/**
 * 여행자보험 보장 등급 (INSURANCE-01)
 *
 * lib/constants/budgetProducts.ts 의 보험 상품 3개(in-basic / in-standard /
 * in-plus)와 짝이 맞는다. 예산 구성에서 고른 보장이 보험 화면에 그대로
 * 이어지려면 두 곳이 같은 값을 봐야 한다.
 *
 * ⚠️ DB 칼럼이 아니다. 화면 안에서만 쓰는 값이고 저장하지 않는다.
 *    사용자가 어떤 보장을 골랐는지는 예산 카테고리의 상품 선택이 갖는다.
 */
export const INSURANCE_COVERAGE = {
  BASIC: "basic",
  STANDARD: "standard",
  PLUS: "plus",
} as const;
export type InsuranceCoverage =
  (typeof INSURANCE_COVERAGE)[keyof typeof INSURANCE_COVERAGE];

/**
 * spending_profile_generated.profile_type
 * balanced 는 뚜렷한 편차가 없을 때의 기본값이다.
 *
 * ⚠️ [미확정] 여행 유형 목록은 아직 확정되지 않았다.
 *    현재 6개 값은 임시값이며, 산출 방식(규칙 기반 / AI 활용)도 미정이다.
 *    TYPE-01 화면 구현 시점에 확정한다.
 *    IA 문서에는 '교통 효율형'이 있으나 여기에는 없고,
 *    여기 있는 balanced 는 IA에 없다.
 *
 *    값을 바꾸려면 supabase/seed.sql 의 travel_types 도 함께 고쳐야 한다.
 *    시드가 이 값들을 code 로 참조하고 있다.
 */
export const SPENDING_PROFILE_TYPE = {
  // ── 어디에 더 썼나 ────────────────────────────────────────────────
  GOURMET: "gourmet",
  LODGING_FOCUSED: "lodging_focused",
  EXPERIENCE: "experience",
  SHOPPING: "shopping",

  // ── 얼마나 썼나 ──────────────────────────────────────────────────
  FRUGAL: "frugal",
  /**
   * 계획을 크게 넘겨 쓴 여행. (2026-09-08 추가)
   *
   * ⚠️ 이게 없으면 특정 카테고리를 넘기지 않은 채 전체만 초과한 여행이
   *    '균형형' 으로 잡힌다. 20% 더 쓰고도 균형이라고 부르면 유형이
   *    아무 말도 하지 않는 것과 같다.
   */
  BIG_SPENDER: "big_spender",

  // ── 어떻게 준비했나 ──────────────────────────────────────────────
  /**
   * 계획을 거의 세우지 않고 다녀온 여행. (2026-09-08 추가)
   *
   * ⚠️ 유일하게 **지출이 아니라 준비 행동**을 보는 유형이다.
   *    세부 계획 항목 수로 판정한다. 계획을 안 짜는 사람에게도 결과가
   *    나와야 결산까지 오게 된다.
   */
  SPONTANEOUS: "spontaneous",
  /**
   * 계획과 실제가 거의 일치한 여행. (2026-09-08 추가)
   *
   * ⚠️ 균형형에서 갈라 낸 값이다. '정확히 맞췄다' 는 자랑거리인데
   *    균형형에 섞이면 그 성취가 드러나지 않는다.
   */
  PLANNER: "planner",
  /**
   * 여행자금을 출발 한 달 전에 다 모은 여행. (2026-09-08 추가)
   *
   * ⚠️ 지출이 아니라 **자금 준비** 를 보는 유일한 유형이다.
   *    핵심 루프(계획 → 준비 → 소비 → 결산)에서 '준비' 단계만 유형이 없었다.
   *    입금 거래가 목표액에 닿은 날과 출발일의 간격으로 판정한다.
   */
  EARLY_SAVER: "early_saver",

  /** 뚜렷한 편차가 없을 때의 기본값 */
  BALANCED: "balanced",
} as const;
export type SpendingProfileType =
  (typeof SPENDING_PROFILE_TYPE)[keyof typeof SPENDING_PROFILE_TYPE];

/** settlement_shared.channel — 고도화(9/07~) 이벤트의 파라미터다. MVP 에서 쓰지 않는다. */
export const SHARE_CHANNEL = {
  KAKAO: "kakao",
  LINK: "link",
  IMAGE: "image",
} as const;
export type ShareChannel = (typeof SHARE_CHANNEL)[keyof typeof SHARE_CHANNEL];

/**
 * tip_impression.placement
 *
 * ⚠️ INSURANCE_PLACEMENT 와 **별개 상수다. 이름을 재사용하지 않는다.**
 *    파라미터 이름이 둘 다 placement 라 헷갈리기 쉽지만 값 집합이 다르다.
 *      보험: budget_detail | trip_home                      (2개)
 *      팁  : budget_category | budget_detail | trip_home | tip_list  (4개)
 *    서로 바꿔 쓰면 Analytics 에 조용히 잘못된 값이 쌓인다.
 */
export const TIP_PLACEMENT = {
  BUDGET_CATEGORY: "budget_category",
  BUDGET_DETAIL: "budget_detail",
  TRIP_HOME: "trip_home",
  TIP_LIST: "tip_list",
} as const;
export type TipPlacement = (typeof TIP_PLACEMENT)[keyof typeof TIP_PLACEMENT];

/** tip_list_viewed.sort — 고도화(9/07~) 이벤트의 파라미터다. MVP 에서 쓰지 않는다. */
export const TIP_SORT = {
  LATEST: "latest",
  POPULAR: "popular",
  PRICE_LOW: "price_low",
  PRICE_HIGH: "price_high",
} as const;
export type TipSort = (typeof TIP_SORT)[keyof typeof TIP_SORT];

// ============================================================================
// DB → Analytics 변환 맵
//
// track() 에 DB 값을 넘길 때는 반드시 여기를 거친다.
// null 은 "해당 Analytics 값이 문서에 정의되지 않음" 이다. null 이면 이벤트를 쏘지 않거나
// 사람에게 문의한다. 임의 값으로 채우지 않는다.
// ============================================================================

/** budget_categories.category_code → 이벤트 category */
export const CATEGORY_CODE_TO_ANALYTICS: Record<
  CategoryCode,
  AnalyticsCategory
> = {
  AIRFARE: ANALYTICS_CATEGORY.FLIGHT,
  LODGING: ANALYTICS_CATEGORY.ACCOMMODATION,
  FOOD: ANALYTICS_CATEGORY.FOOD,
  TRANSPORT: ANALYTICS_CATEGORY.TRANSPORT,
  ACTIVITY: ANALYTICS_CATEGORY.ACTIVITY,
  SHOPPING: ANALYTICS_CATEGORY.SHOPPING,
  INSURANCE: ANALYTICS_CATEGORY.INSURANCE,
  CONTINGENCY: ANALYTICS_CATEGORY.RESERVE,
};

/** trips.owner_type → trip_created.owner_type */
export const OWNER_TYPE_TO_ANALYTICS: Record<
  TripOwnerType,
  AnalyticsOwnerType
> = {
  PERSONAL: ANALYTICS_OWNER_TYPE.PERSONAL,
  GROUP: ANALYTICS_OWNER_TYPE.GROUP,
};

/** trip_budgets.method → budget_method_selected.method */
export const BUDGET_METHOD_TO_ANALYTICS: Record<
  BudgetMethod,
  AnalyticsBudgetMethod
> = {
  RECOMMENDED: ANALYTICS_BUDGET_METHOD.RECOMMENDED,
  USER_DEFINED: ANALYTICS_BUDGET_METHOD.USER_ENTERED,
};

/**
 * fund_sources.source_type → travel_fund_registered.fund_type
 *
 * MOCK 과 ACCOUNT 를 둘 다 'account' 로 보낸다.
 * fund_type 은 "사용자가 어떤 경로를 택했나"를 재는 값이지 데이터 출처를 재는 값이
 * 아니다. MVP 에서 계좌 연결은 곧 Mock 계좌 연결이고, 사용자 경험상 둘의 구분이 없다.
 * 데이터 출처는 transaction_categorized.source_type 이 따로 재고 있다.
 */
export const FUND_SOURCE_TYPE_TO_ANALYTICS: Record<FundSourceType, FundType> = {
  ACCOUNT: FUND_TYPE.ACCOUNT,
  MOCK: FUND_TYPE.ACCOUNT,
  MANUAL: FUND_TYPE.MANUAL,
  ZERO: FUND_TYPE.ZERO,
};

/**
 * transactions.category_method → transaction_categorized.mapped_by
 * NONE 은 아직 분류되지 않은 상태라 대응 값이 없다. null 이면 이벤트를 쏘지 않는다.
 */
export const CATEGORY_METHOD_TO_ANALYTICS: Record<
  CategoryMethod,
  MappedBy | null
> = {
  AUTO: MAPPED_BY.AUTO,
  USER: MAPPED_BY.USER,
  NONE: null,
};

/**
 * transactions.source_type → transaction_categorized.source_type
 * ACCOUNT 는 v1 문서에 대응 값이 없다. 실계좌 연동이 붙는 시점에 사람에게 요청한다.
 */
export const TRANSACTION_SOURCE_TYPE_TO_ANALYTICS: Record<
  TransactionSourceType,
  AnalyticsTransactionSourceType | null
> = {
  MOCK: ANALYTICS_TRANSACTION_SOURCE_TYPE.MOCK,
  MANUAL: ANALYTICS_TRANSACTION_SOURCE_TYPE.MANUAL,
  ACCOUNT: null,
};

// ============================================================================
// docs/06 미반영 — v2 대상
//
// 아래 6개 파라미터는 docs/06_이벤트로그정의서_v1.md 7장이 이름만 적고
// 열거값을 정하지 않았던 것들이다. 2026-08-27 에 값을 확정해 위에 상수로 넣었다.
// **문서에는 아직 반영되지 않았다.** 그때까지는 이 파일이 실제 기준이다.
//
//   login_completed.provider                (§7-0)  → AUTH_PROVIDER
//   trip_basic_info_submitted.travel_style  (§7-1)  → TRAVEL_STYLE
//   spending_profile_generated.profile_type (§7-5)  → SPENDING_PROFILE_TYPE
//   settlement_shared.channel               (§7-5)  → SHARE_CHANNEL      [고도화]
//   tip_impression.placement                (§7-8)  → TIP_PLACEMENT
//   tip_list_viewed.sort                    (§7-8)  → TIP_SORT           [고도화]
//
// 이 목록에 없는 새 파라미터 값이 필요하면 임의로 추가하지 말고 사람에게 요청한다.
// (docs/06 §11, CLAUDE.md 8장)
// ============================================================================
// ============================================================================
// 화면 표시용 한국어 라벨
// 화면에 상태값을 그대로 노출하지 않는다. 반드시 이 라벨을 거친다.
// Record<T, string> 이라 값이 추가되면 라벨 누락이 컴파일 에러로 잡힌다.
// ============================================================================

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNING: "준비 중",
  TRAVELING: "여행 중",
  ENDED: "종료",
  SETTLED: "결산 완료",
  DELETED: "삭제됨",
  CANCEL_PENDING: "취소 요청됨",
  CANCELED: "취소됨",
};

export const TRIP_OWNER_TYPE_LABEL: Record<TripOwnerType, string> = {
  PERSONAL: "개인 여행",
  GROUP: "모임 여행",
};

export const CATEGORY_CODE_LABEL: Record<CategoryCode, string> = {
  AIRFARE: "항공",
  LODGING: "숙소",
  FOOD: "식비",
  TRANSPORT: "교통",
  // 2026-09-21 테스트 · "액티비티" 는 유료 체험만 가리키는 말로 읽혔다.
  // 관람·투어까지 담는 칸이라 "관광" 으로 바꾼다. category_code 는 그대로 ACTIVITY 다.
  ACTIVITY: "관광",
  SHOPPING: "쇼핑",
  INSURANCE: "여행자보험",
  CONTINGENCY: "예비비",
};

export const BUDGET_METHOD_LABEL: Record<BudgetMethod, string> = {
  RECOMMENDED: "추천 예산",
  USER_DEFINED: "직접 입력",
};

export const APPLIED_SOURCE_LABEL: Record<AppliedSource, string> = {
  default: "기본 추천",
  personalized: "개인화 추천",
  user: "직접 설정",
};

export const BUDGET_PLAN_ITEM_STATUS_LABEL: Record<
  BudgetPlanItemStatus,
  string
> = {
  PLANNED: "예정",
  DONE: "완료",
  CANCELED: "취소",
};

export const FUND_SOURCE_TYPE_LABEL: Record<FundSourceType, string> = {
  ACCOUNT: "연결 계좌",
  MANUAL: "직접 입력",
  ZERO: "미등록",
  MOCK: "연결 계좌",
};

export const TRANSACTION_SOURCE_TYPE_LABEL: Record<
  TransactionSourceType,
  string
> = {
  ACCOUNT: "계좌 연동",
  MANUAL: "직접 입력",
  MOCK: "계좌 연동",
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "입금",
  WITHDRAWAL: "출금",
};

export const CATEGORY_METHOD_LABEL: Record<CategoryMethod, string> = {
  AUTO: "자동 분류",
  USER: "직접 분류",
  NONE: "미분류",
};

export const CONTRIBUTION_STATUS_LABEL: Record<ContributionStatus, string> = {
  UNPAID: "미납",
  PARTIAL: "일부 납부",
  PAID: "납부 완료",
};

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  ACTIVE: "활동 중",
  ARCHIVED: "보관됨",
  DELETED: "삭제됨",
};

export const GROUP_MEMBER_ROLE_LABEL: Record<GroupMemberRole, string> = {
  OWNER: "모임장",
  MEMBER: "멤버",
};

export const GROUP_MEMBER_STATUS_LABEL: Record<GroupMemberStatus, string> = {
  ACTIVE: "참여 중",
  INVITED: "초대됨",
  LEFT: "나감",
};

export const TRIP_MEMBER_STATUS_LABEL: Record<TripMemberStatus, string> = {
  ACTIVE: "참여 중",
  INVITED: "초대됨",
  LEFT: "나감",
};

export const POST_TYPE_LABEL: Record<PostType, string> = {
  POST: "게시글",
  FREE_TIP: "무료 팁",
  PAID_TIP: "유료 팁",
  TYPE_SHARE: "여행 유형 공유",
};

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: "임시저장",
  PUBLISHED: "게시됨",
  HIDDEN: "숨김",
  DELETED: "삭제됨",
};

export const COMMENT_STATUS_LABEL: Record<CommentStatus, string> = {
  PUBLISHED: "게시됨",
  HIDDEN: "숨김",
  DELETED: "삭제됨",
};

export const SALES_STATUS_LABEL: Record<SalesStatus, string> = {
  ON_SALE: "판매 중",
  PAUSED: "판매 중지",
  ENDED: "판매 종료",
};

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: "결제 대기",
  COMPLETED: "구매 완료",
  CANCELED: "취소됨",
  REFUNDED: "환불됨",
};

export const INSURANCE_REFERRAL_STATUS_LABEL: Record<
  InsuranceReferralStatus,
  string
> = {
  CLICKED: "조회함",
  QUOTE_COMPLETED: "견적 완료",
  PURCHASE_COMPLETED: "가입 완료",
};

// ── Analytics 열거값 라벨 ──────────────────────────────────────────────────
// 값은 소문자 스네이크(Analytics 규격)지만, 화면에도 노출되는 값이라 라벨이 필요하다.

/**
 * 예산 추천 배수의 기준. 여행 생성 화면에서 사용자가 고른다.
 *
 * ⚠️ 라벨을 '알뜰형 / 표준형 / 편안형 / 럭셔리형' 에서 바꿨다. (2026-08-28)
 *    '~형' 은 등급처럼 읽혀서, 사용자가 자기 여행을 고르는 대신
 *    낮은 등급을 고르기 부끄러워하는 선택이 된다.
 *    소비 성향 표현이지 등급이 아니므로 서술형으로 바꿨다.
 *
 * 단계는 3개를 유지한다. 늘리지 않는다.
 *   · 사용자가 인접 단계를 구분하지 못한다
 *   · 각 단계의 배수를 정할 근거가 없다
 *   · 선택지가 늘수록 여행 생성 이탈이 늘어난다
 * 대신 TRAVEL_STYLE_DESCRIPTION 으로 각 단계가 무슨 뜻인지 명확히 한다.
 *
 * ⚠️ 2026-09-01 · 4단계(budget/standard/comfort/luxury) → 3단계로 줄였다. (L 승인)
 *    빠진 값은 luxury 다. comfort 를 빼지 않은 이유는 supabase/seed.sql 의
 *    오사카 여행이 comfort 를 쓰고 있어서다. seed.sql 은 DB 담당 소유라 고칠 수 없다.
 *    최상위 라벨은 comfort 가 이어받아 '아낌없이' 가 됐다.
 *    → 이미 luxury 로 저장된 여행이 있으면 라벨과 배수가 조회되지 않는다.
 */
export const TRAVEL_STYLE_LABEL: Record<TravelStyle, string> = {
  budget: "아끼는 편",
  standard: "보통",
  comfort: "아낌없이",
};

/**
 * 스타일 선택지의 보조 설명. 라벨 아래에 함께 노출한다.
 *
 * 라벨만으로는 '보통' 과 '아낌없이' 의 차이가 금액으로 얼마나 벌어지는지
 * 알 수 없다. 숙소·식사라는 구체적인 기준을 주어야 사용자가 고를 수 있다.
 * 실제 배수도 숙소·식비에서 가장 크게 갈린다.
 * (lib/constants/budgetMultiplier.ts)
 */
export const TRAVEL_STYLE_DESCRIPTION: Record<TravelStyle, string> = {
  budget: "가성비 위주, 게스트하우스·현지식",
  standard: "무난한 호텔, 적당한 외식",
  comfort: "좋은 호텔, 맛집 위주",
};

/** 결산 후 소비 유형 결과 화면에 표시한다. */
export const SPENDING_PROFILE_TYPE_LABEL: Record<SpendingProfileType, string> =
  {
    gourmet: "미식형",
    lodging_focused: "숙박 중시형",
    experience: "체험형",
    shopping: "쇼핑 중심형",
    frugal: "절약형",
    big_spender: "통 큰 여행자",
    spontaneous: "즉흥형",
    planner: "계획파",
    early_saver: "미리미리형",
    balanced: "균형형",
  };
