// ============================================================================
// Analytics 상수
// 기준 문서: docs/06_이벤트로그정의서_v2.md 7장
//
// ⚠️ 이 파일은 CLAUDE.md 5장 [공유] 파일이다.
// ⚠️ 문서에 없는 이벤트를 임의로 추가하지 않는다. 필요하면 사람에게 요청한다.
//    (docs/06 §11, CLAUDE.md 8장)
//
// 단계 표기 (docs/06 §6)
//   MVP    8/31 배포 포함 — 지금 구현
//   고도화  9/07 이후 — 이름만 확정, 호출부는 만들지 않는다
// ============================================================================

/**
 * 화면 진입 로깅에 쓰는 screen_name 값. docs/06 v2 §7-0 — 17개.
 *
 * ⚠️ 아래 고도화 7화면은 아직 값이 없다. 임의로 추가하지 않는다.
 *    FUND-02 · CONTRIB-01 · TYPE-01 · COMM-03 · COMM-04 · INSURANCE-01 · MY-03
 *    해당 화면 구현(2026-09-07~) 시점에 docs/06 을 v3로 갱신한 뒤 추가한다.
 */
export const SCREENS = {
  HOME: 'home',
  TRIP_CREATE_WHO: 'trip_create_who',
  TRIP_CREATE_INFO: 'trip_create_info',
  /** TRIP-03 은 "예산·자금" 한 화면이다. v2에서 trip_create_fund 를 제거했다. */
  TRIP_CREATE_BUDGET: 'trip_create_budget',
  /** TRIP-HOME-01(진행)과 TRIP-HOME-02(종료)가 공유한다. trip_status 로 구분한다. */
  TRIP_HOME: 'trip_home',
  BUDGET_DETAIL: 'budget_detail',
  BUDGET_CATEGORY_DETAIL: 'budget_category_detail',
  TRANSACTION_LIST: 'transaction_list',
  TRANSACTION_DETAIL: 'transaction_detail',
  SETTLEMENT: 'settlement',
  TIP_LIST: 'tip_list',
  TIP_DETAIL: 'tip_detail',
  GROUP_LIST: 'group_list',
  GROUP_DETAIL: 'group_detail',
  MY_PAGE: 'my_page',
  MY_TRIPS: 'my_trips',
  MY_SETTINGS: 'my_settings',
} as const;

export const EVENTS = {
  // ── 7-0. 공통 ─────────────────────────────────────────────── MVP ──
  /** 파라미터: screen_name, trip_status (trip_home 외에는 null) */
  SCREEN_VIEWED: 'screen_viewed',
  LOGIN_COMPLETED: 'login_completed',

  // ── 7-1. 여행 생성 (Flow 01) ──────────────────────────────── MVP ──
  TRIP_CREATE_STARTED: 'trip_create_started',
  TRIP_COMPANION_SELECTED: 'trip_companion_selected',
  PAST_DATA_APPLY_SELECTED: 'past_data_apply_selected',
  TRIP_BASIC_INFO_SUBMITTED: 'trip_basic_info_submitted',
  /** 가설 1 */
  BUDGET_METHOD_SELECTED: 'budget_method_selected',
  /** Proxy NSM 분자 */
  BUDGET_TARGET_CONFIRMED: 'budget_target_confirmed',
  TRAVEL_FUND_REGISTERED: 'travel_fund_registered',
  /** Activation / 재사용률 */
  TRIP_CREATED: 'trip_created',

  // ── 7-2. 예산 상세 (Flow 02) ──────────────────────────────── MVP ──
  BUDGET_CATEGORY_EDITED: 'budget_category_edited',
  BUDGET_PLAN_ITEM_ADDED: 'budget_plan_item_added',
  BUDGET_PLAN_ITEM_EDITED: 'budget_plan_item_edited',
  BUDGET_PLAN_ITEM_DELETED: 'budget_plan_item_deleted',
  BUDGET_PLAN_SAVED: 'budget_plan_saved',

  // ── 7-3. 입출금·예산 연결 (Flow 03) ───────────────────────── MVP ──
  TRANSACTION_CATEGORIZED: 'transaction_categorized',
  /** 자동분류 정확도 */
  TRANSACTION_CATEGORY_CORRECTED: 'transaction_category_corrected',
  TRANSACTION_LINKED_TO_ITEM: 'transaction_linked_to_item',

  // ── 7-4. 수기 → 계좌 전환 (Flow 04) ───────────────────────── MVP ──
  FUND_CONVERSION_STARTED: 'fund_conversion_started',
  /** 초기화 안내 이탈률 */
  FUND_CONVERSION_CONFIRMED: 'fund_conversion_confirmed',
  FUND_CONVERSION_COMPLETED: 'fund_conversion_completed',

  // ── 7-5. 여행 종료·결산 (Flow 05) ─────────────────────────── MVP ──
  SETTLEMENT_PROMPTED: 'settlement_prompted',
  /** 결산 도달률 */
  SETTLEMENT_CONFIRMED: 'settlement_confirmed',
  SPENDING_PROFILE_GENERATED: 'spending_profile_generated',

  // ── 7-6. 다음 여행 개인화 (Flow 06) ───────────────────────── MVP ──
  PERSONALIZATION_OFFERED: 'personalization_offered',
  /** 가설 4 핵심 */
  PERSONALIZATION_APPLIED: 'personalization_applied',
  TRIP_RECREATED_SAME_MEMBERS: 'trip_recreated_same_members',

  // ── 7-7. 여행자보험 (BM 1) ────────────────────────────────── MVP ──
  /** BM 1 전환 */
  INSURANCE_CTA_CLICKED: 'insurance_cta_clicked',

  // ── 7-8. 여행 팁 커뮤니티 (BM 2) ──────────────────────────── MVP ──
  TIP_IMPRESSION: 'tip_impression',
  TIP_APPLIED_TO_BUDGET: 'tip_applied_to_budget',
  TIP_LIST_VIEWED: 'tip_list_viewed',

  // ══════════════════════════════════════════════════════════════════
  // 아래는 고도화(9/07~) 단계다.
  // 이름만 확정해 두고 호출부는 만들지 않는다. (docs/06 §1-④, §11)
  // ══════════════════════════════════════════════════════════════════

  // ── 7-5. 결산 ────────────────────────────────────────────── 고도화 ──
  SETTLEMENT_SHARED: 'settlement_shared',

  // ── 7-8. 팁 상세 / 구매 / 평가 / 찜 / 댓글 ───────────────── 고도화 ──
  TIP_DETAIL_VIEWED: 'tip_detail_viewed',
  TIP_PURCHASE_INTENT: 'tip_purchase_intent',
  TIP_PURCHASED: 'tip_purchased',
  TIP_REACTED: 'tip_reacted',
  TIP_BOOKMARKED: 'tip_bookmarked',
  TIP_COMMENTED: 'tip_commented',
  TIP_CREATED: 'tip_created',
} as const;

/**
 * 고도화 단계 이벤트 이름. MVP 기간에는 호출하지 않는다.
 * __DEV__ 에서 실수로 호출하면 track() 이 경고를 출력한다.
 */
export const ADVANCED_EVENT_NAMES: readonly string[] = [
  EVENTS.SETTLEMENT_SHARED,
  EVENTS.TIP_DETAIL_VIEWED,
  EVENTS.TIP_PURCHASE_INTENT,
  EVENTS.TIP_PURCHASED,
  EVENTS.TIP_REACTED,
  EVENTS.TIP_BOOKMARKED,
  EVENTS.TIP_COMMENTED,
  EVENTS.TIP_CREATED,
];

export type ScreenName = (typeof SCREENS)[keyof typeof SCREENS];
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
