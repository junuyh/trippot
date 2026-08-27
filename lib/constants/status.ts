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
// ============================================================================

// ── 모임 ───────────────────────────────────────────────────────────────────
export const GROUP_STATUS = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const;
export type GroupStatus = (typeof GROUP_STATUS)[keyof typeof GROUP_STATUS];

export const GROUP_MEMBER_ROLE = {
  OWNER: 'OWNER',
  MEMBER: 'MEMBER',
} as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLE)[keyof typeof GROUP_MEMBER_ROLE];

export const GROUP_MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  LEFT: 'LEFT',
} as const;
export type GroupMemberStatus = (typeof GROUP_MEMBER_STATUS)[keyof typeof GROUP_MEMBER_STATUS];

// ── 여행 ───────────────────────────────────────────────────────────────────
export const TRIP_OWNER_TYPE = {
  PERSONAL: 'PERSONAL',
  GROUP: 'GROUP',
} as const;
export type TripOwnerType = (typeof TRIP_OWNER_TYPE)[keyof typeof TRIP_OWNER_TYPE];

export const TRIP_STATUS = {
  PLANNING: 'PLANNING',
  TRAVELING: 'TRAVELING',
  ENDED: 'ENDED',
  SETTLED: 'SETTLED',
  DELETED: 'DELETED',
} as const;
export type TripStatus = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];

export const TRIP_MEMBER_STATUS = {
  ACTIVE: 'ACTIVE',
  INVITED: 'INVITED',
  LEFT: 'LEFT',
} as const;
export type TripMemberStatus = (typeof TRIP_MEMBER_STATUS)[keyof typeof TRIP_MEMBER_STATUS];

// ── 예산 ───────────────────────────────────────────────────────────────────
export const BUDGET_METHOD = {
  RECOMMENDED: 'RECOMMENDED',
  USER_DEFINED: 'USER_DEFINED',
} as const;
export type BudgetMethod = (typeof BUDGET_METHOD)[keyof typeof BUDGET_METHOD];

export const CATEGORY_CODE = {
  AIRFARE: 'AIRFARE',
  LODGING: 'LODGING',
  FOOD: 'FOOD',
  TRANSPORT: 'TRANSPORT',
  ACTIVITY: 'ACTIVITY',
  SHOPPING: 'SHOPPING',
  INSURANCE: 'INSURANCE',
  CONTINGENCY: 'CONTINGENCY',
} as const;
export type CategoryCode = (typeof CATEGORY_CODE)[keyof typeof CATEGORY_CODE];

/**
 * planned_amount 가 어느 값에서 왔는지. (CLAUDE.md 4장)
 * ⚠️ 이 열거값만 소문자다. DB CHECK 가 소문자로 정의돼 있다.
 */
export const APPLIED_SOURCE = {
  DEFAULT: 'default',
  PERSONALIZED: 'personalized',
  USER: 'user',
} as const;
export type AppliedSource = (typeof APPLIED_SOURCE)[keyof typeof APPLIED_SOURCE];

export const BUDGET_PLAN_ITEM_STATUS = {
  PLANNED: 'PLANNED',
  DONE: 'DONE',
  CANCELED: 'CANCELED',
} as const;
export type BudgetPlanItemStatus =
  (typeof BUDGET_PLAN_ITEM_STATUS)[keyof typeof BUDGET_PLAN_ITEM_STATUS];

// ── 여행자금 ───────────────────────────────────────────────────────────────
/** fund_sources.source_type. ZERO 는 '아직 등록 안 함'이다. */
export const FUND_SOURCE_TYPE = {
  ACCOUNT: 'ACCOUNT',
  MANUAL: 'MANUAL',
  ZERO: 'ZERO',
  MOCK: 'MOCK',
} as const;
export type FundSourceType = (typeof FUND_SOURCE_TYPE)[keyof typeof FUND_SOURCE_TYPE];

// ── 거래 ───────────────────────────────────────────────────────────────────
/** transactions.source_type / contributions.source_type. ZERO 가 없다. */
export const TRANSACTION_SOURCE_TYPE = {
  ACCOUNT: 'ACCOUNT',
  MANUAL: 'MANUAL',
  MOCK: 'MOCK',
} as const;
export type TransactionSourceType =
  (typeof TRANSACTION_SOURCE_TYPE)[keyof typeof TRANSACTION_SOURCE_TYPE];

export const TRANSACTION_TYPE = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
} as const;
export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

/** 거래 카테고리를 누가 정했는가. */
export const CATEGORY_METHOD = {
  AUTO: 'AUTO',
  USER: 'USER',
  NONE: 'NONE',
} as const;
export type CategoryMethod = (typeof CATEGORY_METHOD)[keyof typeof CATEGORY_METHOD];

// ── 모임원 납부 ────────────────────────────────────────────────────────────
export const CONTRIBUTION_STATUS = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;
export type ContributionStatus =
  (typeof CONTRIBUTION_STATUS)[keyof typeof CONTRIBUTION_STATUS];

// ── 커뮤니티 ───────────────────────────────────────────────────────────────
export const POST_TYPE = {
  POST: 'POST',
  FREE_TIP: 'FREE_TIP',
  PAID_TIP: 'PAID_TIP',
  TYPE_SHARE: 'TYPE_SHARE',
} as const;
export type PostType = (typeof POST_TYPE)[keyof typeof POST_TYPE];

export const POST_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;
export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];

export const COMMENT_STATUS = {
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const;
export type CommentStatus = (typeof COMMENT_STATUS)[keyof typeof COMMENT_STATUS];

/** v1 은 LIKE 하나뿐이다. */
export const REACTION_TYPE = {
  LIKE: 'LIKE',
} as const;
export type ReactionType = (typeof REACTION_TYPE)[keyof typeof REACTION_TYPE];

// ── 팁 판매 ────────────────────────────────────────────────────────────────
export const SALES_STATUS = {
  ON_SALE: 'ON_SALE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
} as const;
export type SalesStatus = (typeof SALES_STATUS)[keyof typeof SALES_STATUS];

export const PURCHASE_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
  REFUNDED: 'REFUNDED',
} as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[keyof typeof PURCHASE_STATUS];

// ── 보험 제휴 ──────────────────────────────────────────────────────────────
export const INSURANCE_REFERRAL_STATUS = {
  CLICKED: 'CLICKED',
  QUOTE_COMPLETED: 'QUOTE_COMPLETED',
  PURCHASE_COMPLETED: 'PURCHASE_COMPLETED',
} as const;
export type InsuranceReferralStatus =
  (typeof INSURANCE_REFERRAL_STATUS)[keyof typeof INSURANCE_REFERRAL_STATUS];

// ── 로그 ───────────────────────────────────────────────────────────────────
/** ⚠️ 소문자다. track() 이 자동으로 채우므로 화면에서 직접 쓸 일은 없다. */
export const EVENT_LOG_ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
} as const;
export type EventLogEnv = (typeof EVENT_LOG_ENV)[keyof typeof EVENT_LOG_ENV];


// ============================================================================
// Analytics 파라미터 값
//
// ⚠️ DB 값과 **다르다.** docs/06_이벤트로그정의서_v1.md 가 소문자 스네이크를
//    쓰기로 정했기 때문이다. track() 에 넘길 때는 아래 상수를 쓴다.
//    DB 에 넣을 때는 위쪽 DB 상수를 쓴다. 섞으면 CHECK 제약에서 터진다.
// ============================================================================

/** docs/06 §7-2 의 category 값. DB 의 CATEGORY_CODE 와 철자가 다르다. */
export const ANALYTICS_CATEGORY = {
  FLIGHT: 'flight',
  ACCOMMODATION: 'accommodation',
  FOOD: 'food',
  TRANSPORT: 'transport',
  ACTIVITY: 'activity',
  SHOPPING: 'shopping',
  INSURANCE: 'insurance',
  RESERVE: 'reserve',
} as const;
export type AnalyticsCategory = (typeof ANALYTICS_CATEGORY)[keyof typeof ANALYTICS_CATEGORY];

/** DB category_code → Analytics category. track() 에 넘기기 전에 이걸로 변환한다. */
export const CATEGORY_CODE_TO_ANALYTICS: Record<CategoryCode, AnalyticsCategory> = {
  AIRFARE: ANALYTICS_CATEGORY.FLIGHT,
  LODGING: ANALYTICS_CATEGORY.ACCOMMODATION,
  FOOD: ANALYTICS_CATEGORY.FOOD,
  TRANSPORT: ANALYTICS_CATEGORY.TRANSPORT,
  ACTIVITY: ANALYTICS_CATEGORY.ACTIVITY,
  SHOPPING: ANALYTICS_CATEGORY.SHOPPING,
  INSURANCE: ANALYTICS_CATEGORY.INSURANCE,
  CONTINGENCY: ANALYTICS_CATEGORY.RESERVE,
};

/**
 * docs/06 §7-3 `transaction_categorized` 의 mapped_by 값.
 * DB 컬럼이 아니다. DB 는 category_method (AUTO|USER|NONE) 를 쓴다.
 * NONE 인 거래는 아직 분류되지 않은 것이므로 이 이벤트를 쏘지 않는다.
 */
export const MAPPED_BY = {
  AUTO: 'auto',
  USER: 'user',
} as const;
export type MappedBy = (typeof MAPPED_BY)[keyof typeof MAPPED_BY];


// ============================================================================
// 화면 표시용 한국어 라벨
// 화면에 상태값을 그대로 노출하지 않는다. 반드시 이 라벨을 거친다.
// Record<T, string> 이라 값이 추가되면 라벨 누락이 컴파일 에러로 잡힌다.
// ============================================================================

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNING: '준비 중',
  TRAVELING: '여행 중',
  ENDED: '종료',
  SETTLED: '결산 완료',
  DELETED: '삭제됨',
};

export const TRIP_OWNER_TYPE_LABEL: Record<TripOwnerType, string> = {
  PERSONAL: '개인 여행',
  GROUP: '모임 여행',
};

export const CATEGORY_CODE_LABEL: Record<CategoryCode, string> = {
  AIRFARE: '항공',
  LODGING: '숙소',
  FOOD: '식비',
  TRANSPORT: '교통',
  ACTIVITY: '액티비티',
  SHOPPING: '쇼핑',
  INSURANCE: '여행자보험',
  CONTINGENCY: '예비비',
};

export const BUDGET_METHOD_LABEL: Record<BudgetMethod, string> = {
  RECOMMENDED: '추천 예산',
  USER_DEFINED: '직접 입력',
};

export const APPLIED_SOURCE_LABEL: Record<AppliedSource, string> = {
  default: '기본 추천',
  personalized: '개인화 추천',
  user: '직접 설정',
};

export const BUDGET_PLAN_ITEM_STATUS_LABEL: Record<BudgetPlanItemStatus, string> = {
  PLANNED: '예정',
  DONE: '완료',
  CANCELED: '취소',
};

export const FUND_SOURCE_TYPE_LABEL: Record<FundSourceType, string> = {
  ACCOUNT: '연결 계좌',
  MANUAL: '직접 입력',
  ZERO: '미등록',
  MOCK: '연결 계좌',
};

export const TRANSACTION_SOURCE_TYPE_LABEL: Record<TransactionSourceType, string> = {
  ACCOUNT: '계좌 연동',
  MANUAL: '직접 입력',
  MOCK: '계좌 연동',
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: '입금',
  WITHDRAWAL: '출금',
};

export const CATEGORY_METHOD_LABEL: Record<CategoryMethod, string> = {
  AUTO: '자동 분류',
  USER: '직접 분류',
  NONE: '미분류',
};

export const CONTRIBUTION_STATUS_LABEL: Record<ContributionStatus, string> = {
  UNPAID: '미납',
  PARTIAL: '일부 납부',
  PAID: '납부 완료',
};

export const GROUP_STATUS_LABEL: Record<GroupStatus, string> = {
  ACTIVE: '활동 중',
  ARCHIVED: '보관됨',
  DELETED: '삭제됨',
};

export const GROUP_MEMBER_ROLE_LABEL: Record<GroupMemberRole, string> = {
  OWNER: '모임장',
  MEMBER: '멤버',
};

export const GROUP_MEMBER_STATUS_LABEL: Record<GroupMemberStatus, string> = {
  ACTIVE: '참여 중',
  INVITED: '초대됨',
  LEFT: '나감',
};

export const TRIP_MEMBER_STATUS_LABEL: Record<TripMemberStatus, string> = {
  ACTIVE: '참여 중',
  INVITED: '초대됨',
  LEFT: '나감',
};

export const POST_TYPE_LABEL: Record<PostType, string> = {
  POST: '게시글',
  FREE_TIP: '무료 팁',
  PAID_TIP: '유료 팁',
  TYPE_SHARE: '여행 유형 공유',
};

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: '임시저장',
  PUBLISHED: '게시됨',
  HIDDEN: '숨김',
  DELETED: '삭제됨',
};

export const COMMENT_STATUS_LABEL: Record<CommentStatus, string> = {
  PUBLISHED: '게시됨',
  HIDDEN: '숨김',
  DELETED: '삭제됨',
};

export const SALES_STATUS_LABEL: Record<SalesStatus, string> = {
  ON_SALE: '판매 중',
  PAUSED: '판매 중지',
  ENDED: '판매 종료',
};

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: '결제 대기',
  COMPLETED: '구매 완료',
  CANCELED: '취소됨',
  REFUNDED: '환불됨',
};

export const INSURANCE_REFERRAL_STATUS_LABEL: Record<InsuranceReferralStatus, string> = {
  CLICKED: '조회함',
  QUOTE_COMPLETED: '견적 완료',
  PURCHASE_COMPLETED: '가입 완료',
};
