// ============================================================================
// GROUP-01 / GROUP-02 화면이 그리는 데이터 모양
// 기준: docs/09_IA_v1.md §3-1 (모임명 · 멤버 · 진행 중인 여행 · 지난 여행 수)
//
// DB 행을 그대로 넘기지 않고 이 모양으로 바꿔서 넘긴다.
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================

/** 카드 안에 한 줄로 들어가는 여행. */
import type { MyTripItem } from '@/components/my';

export type GroupTripItem = {
  tripId: string;
  /** trips.destination 은 nullable 이다. 없으면 카드가 대체 문구를 쓴다. */
  destination: string | null;
  /** 'YYYY-MM-DD'. trips.start_date 는 date 타입이라 시간대 변환이 없다. nullable. */
  startDate: string | null;
  endDate: string | null;
};

/**
 * 3-1. 모임 목록 카드 한 장. (docs/09_IA_v1.md §3-1)
 *
 * ⚠️ 실제로 DB 에 있는 값만 둔다.
 *    groups 테이블에는 대표 이미지 컬럼이 없고 정책도 미확정이라 이미지 필드를 두지 않는다.
 */
export type GroupTravelCardData = {
  groupId: string;
  name: string;
  /**
   * groups.created_at.
   * ⚠️ 카드에 표시하지 않는다. '여행 생성일 순' 정렬에만 쓴다.
   */
  createdAt: string;
  /** group_members 중 ACTIVE 인원 수. 사용자가 직접 고치는 값이 아니다. */
  memberCount: number;
  /**
   * 진행 중인 여행 전체(PLANNING · TRAVELING).
   * 카드는 앞의 2건만 그리고 나머지는 '외 N건' 으로 접는다. 자르는 판단은 카드가 한다.
   */
  ongoingTrips: GroupTripItem[];
  /** 지난 여행 수(ENDED · SETTLED). */
  pastTripCount: number;
};

/** 3-2. 모임 상세의 멤버 한 명. (docs/09_IA_v1.md §3-2) */
export type GroupMemberItem = {
  memberId: string;
  /** users.id. 현재 사용자인지 가리는 데 쓴다. 화면에 표시하지 않는다. */
  userId: string;
  name: string;
  /** true 면 '모임장' 배지를 붙인다. group_members.role 이 OWNER 인 사람. */
  isOwner: boolean;
  /**
   * group_members.joined_at. **nullable 이다.**
   *
   * ⚠️ 값이 없으면 날짜 줄을 그리지 않는다. created_at 이나 오늘 날짜로
   *    대신 채우지 않는다 — 참여일이 아닌 값을 참여일이라고 보여주게 된다.
   *
   * ⚠️ 나가기·내보내기는 status 만 바꾸고 이 값을 건드리지 않는다.
   *    그래서 나갔다가 다시 들어와도 **최초 참여일이 유지된다.**
   */
  joinedAt: string | null;
};

/** 연결 계좌가 쓰이고 있는 여행 한 건. */
export type GroupAccountTrip = {
  tripId: string;
  destination: string | null;
  /**
   * 여행 상태 이름. `준비 중` · `여행 중` · `지난 여행` 셋뿐이다.
   *
   * ⚠️ GROUP 계좌 UI 전용 파생 라벨이다. `종료` · `결산 완료` 로 나누지 않는다.
   *    (components/groups/format.ts toGroupTripStatusLabel)
   */
  statusLabel: string;
  /**
   * 현재 사용자가 이 여행의 참가자인가. (trip_members ACTIVE)
   *
   * ⚠️ false 면 계좌 시트에서 이동하지 않는다. 여행 이름·상태는 그대로
   *    보여준다 — 계좌와 여행의 연결 관계는 모임 멤버라면 볼 수 있다.
   *    (2026-09-09 확정)
   */
  isParticipant: boolean;
};

/**
 * 3-2. 모임 상세의 연결 계좌 한 건.
 *
 * ⚠️ **계좌 기준으로 한 줄이다.** 같은 계좌를 여러 여행이 쓰고 있어도 한 번만
 *    나온다. 여행마다 반복해서 보여주면 계좌가 여러 개인 것처럼 읽힌다.
 *    (2026-09-08 확정)
 *
 * ⚠️ 묶는 기준은 **financial_account_id** 다. 은행명으로 묶지 않는다.
 *    같은 은행이어도 계좌 id 가 다르면 서로 다른 계좌다.
 *
 * ⚠️ 준비 중·여행 중 여행의 계좌만 온다. 지난 여행은 화면 파일이 걸러 낸다.
 *    종료된 여행은 GROUP 상세의 연결 계좌 대상이 아니다.
 *
 * ⚠️ 잔액은 MVP 에서 표시하지 않는다. 표시 정책이 정해지지 않았다.
 *    masked_account_number 는 DB 에 이미 마스킹된 값이라 그대로 쓴다. (NFR-002)
 *
 * ⚠️ 은행명은 DB 에 없다. financial_accounts 에 bank_name 칼럼이 없고
 *    금융결제원 기관 코드(institution_code)만 있다. 이름은
 *    lib/constants/bank.ts 의 institutionName() 이 만든다 — FUND-02 계좌
 *    연결 화면과 같은 매핑이라 두 화면의 은행 이름이 갈라지지 않는다.
 */
export type GroupAccountItem = {
  accountId: string;
  /** 금융결제원 기관 코드. 화면에는 코드가 아니라 은행 이름을 보여준다. */
  institutionCode: string | null;
  maskedAccountNumber: string | null;
  /**
   * 이 계좌가 지금 연결된 여행 전부. **1개 이상이다.**
   *
   * 준비 중·여행 중·지난 여행이 모두 들어온다. 계좌를 눌렀을 때 뜨는 시트와
   * '전체 계좌' 시트가 이 목록을 그대로 보여준다.
   */
  trips: GroupAccountTrip[];
  /**
   * 그중 **준비 중·여행 중** 여행의 수.
   *
   * ⚠️ GROUP 메인의 두 가지를 이 값이 정한다. (2026-09-09 확정)
   *    1. 메인에 이 계좌를 보여줄지 — 0 이면 보여주지 않는다
   *    2. `N개 여행에서 사용 중` 의 N — 지난 여행은 세지 않는다
   *
   * ⚠️ 0 이어도 계좌를 목록에서 빼지 않는다. '전체 계좌' 시트에는 나온다.
   *    거기서는 `지난 여행에서 사용` 으로 보여준다.
   *
   * ⚠️ DB 에 새 status 를 만들지 않았다. trips.status 로 세기만 한다.
   */
  activeTripCount: number;
};

/** 3-2. 모임 상세 화면 전체. (docs/09_IA_v1.md §3-2) */
export type GroupDetailData = {
  groupId: string;
  name: string;
  /** groups.created_at. 기본정보에 '만든 날' 로 표시한다. */
  createdAt: string;
  /**
   * ACTIVE 멤버 수.
   * ⚠️ members.length 와 다를 수 있다. getGroupMemberCount() 를 쓴다 —
   *    GROUP-01 카드와 같은 기준을 유지하기 위해서다. (후속 확인 사항)
   */
  memberCount: number;
  /**
   * 현재 사용자가 참가 중인 여행 id. (trip_members ACTIVE)
   *
   * ⚠️ 카드 탭 가능 여부와 '여행에서 나가기' 노출을 이 값이 정한다.
   *    한 번의 질의로 받아 온다. (2026-09-09 확정)
   */
  participatingTripIds: Set<string>;
  members: GroupMemberItem[];
  accounts: GroupAccountItem[];
  /**
   * 상태별 여행. 전체 표시한다.
   *
   * ⚠️ MY 의 여행 카드(components/my/MyTripCard)를 그대로 쓰려고 MyTripItem 을
   *    담는다. 같은 여행이면 MY 목록과 여기서 금액·진행률이 같아야 한다.
   *    카드를 새로 만들면 두 화면이 갈라진다.
   *
   * ⚠️ 준비 중과 여행 중을 나눈다. MY 의 /me/trips 가 이미 세 갈래라
   *    묶어 두면 같은 여행이 두 화면에서 다른 칸에 들어간다.
   */
  planningTrips: MyTripItem[];
  travelingTrips: MyTripItem[];
  pastTrips: MyTripItem[];
};

/** 편집 모드 '숨긴 모임' 바텀시트 한 줄. 이름과 다시 표시만 있으면 된다. */
export type HiddenGroupItem = {
  groupId: string;
  name: string;
};
