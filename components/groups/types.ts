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
/**
 * 카드가 공통으로 그리는 것. 실제 모임이든 개인 여행이든 같은 카드다.
 */
type GroupTravelCardBase = {
  name: string;
  /**
   * 생성 시각. (2026-09-13 정책)
   *   GROUP     groups.created_at — '모임 생성순' 정렬 **그리고 카드의 CREATED 표시**에 쓴다.
   *   PERSONAL  가장 최근 trips.created_at — **정렬에만** 쓴다. 모임이 없으니 여행 것을
   *             빌린 값이라 카드에 "만든 날" 로 그리지 않는다. 여행을 만들 때마다 바뀐다.
   * ⚠️ 가짜 값을 만들지 않는다.
   */
  createdAt: string;
  /**
   * 진행 중인 여행 전체(PLANNING · TRAVELING).
   * 카드는 앞의 2건만 그리고 나머지는 '외 N건' 으로 접는다. 자르는 판단은 카드가 한다.
   */
  ongoingTrips: GroupTripItem[];
  /** 지난 여행 수(ENDED · SETTLED). */
  pastTripCount: number;
};

/**
 * GROUP-01 카드 한 장.
 *
 * ⚠️ 두 종류다. (docs/11_모임정책_v1.md §2 · 2026-09-12)
 *   GROUP     DB 에 groups 행이 있는 실제 모임
 *   PERSONAL  내 개인 여행(owner_type = PERSONAL) **전부를 묶은 카드 하나.**
 *             groups 행이 없으니 groupId · memberCount 가 없다. 여행이 몇 개든
 *             이 카드는 항상 최대 1장이다 — 여행마다 카드를 만들지 않는다.
 *             목록 UX 에서 함께 보이는 것뿐, DB 상 모임이 아니다.
 *
 * ⚠️ PERSONAL 에 가짜 groupId 를 만들어 GROUP-02 로 보내지 않는다.
 *    누르면 개인 여행 상세(/groups/personal)로 간다.
 *    편집 모드(숨기기)도 GROUP 만 대상이다 — 숨김 설정이 group_id 기준이라서다.
 */
export type GroupTravelCardData =
  | (GroupTravelCardBase & {
      kind: 'GROUP';
      groupId: string;
      /** group_members 중 ACTIVE 인원 수. 사용자가 직접 고치는 값이 아니다. */
      memberCount: number;
    })
  | (GroupTravelCardBase & {
      kind: 'PERSONAL';
      /**
       * 카드 CREATED 에 쓰는 값 — 개인 여행 카드에 묶인 여행들 중 **가장 먼저 만든**
       * trips.created_at (ISO). "처음 개인 여행을 만든 날" 이라는 뜻이다. (2026-09-15)
       * ⚠️ createdAt(정렬용 · 가장 최근 것)과 다르다. 정렬 규칙은 건드리지 않으려고 따로 둔다.
       * ⚠️ groups.created_at 이 아니다. 개인 여행에는 모임이 없다. 저장하지 않고 화면에서 센다.
       */
      firstCreatedAt: string;
    });

/** 카드 key · 선택 판별에 쓰는 안정된 id. 개인 여행 카드는 하나뿐이라 고정 key 다. */
export function groupTravelCardKey(card: GroupTravelCardData): string {
  return card.kind === 'GROUP' ? `group:${card.groupId}` : 'personal';
}

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
  /**
   * 취소된 여행(trips.status = CANCELED). **표시만** 한다. (2026-09-12)
   * ⚠️ 72시간 복구·만료는 다른 담당의 기능이다. 여기서는 세지도 계산하지도 않는다.
   */
  canceledTrips: MyTripItem[];
  /*
   * ⚠️ '나간 여행' 목록은 따로 두지 않는다. (2026-09-13 · PR #88 판단 존중)
   *    나간 여행은 여행의 상태가 아니라 **나와 여행 사이의 membership** 이다.
   *    같은 여행이 준비 중 탭과 나간 여행 탭에 두 번 나오는 문제가 있었다.
   *    위 네 목록의 카드에 MyTripItem.left 로만 표시한다. (docs/11 §6)
   */
};

/** 편집 모드 '숨긴 모임' 바텀시트 한 줄. 이름과 다시 표시만 있으면 된다. */
export type HiddenGroupItem = {
  groupId: string;
  name: string;
};
