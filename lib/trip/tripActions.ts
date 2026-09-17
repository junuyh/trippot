// ============================================================================
// "지금 답해야 할 일" 판단 한 벌 (2026-09-17)
//
// 같은 일이 두 화면에 뜬다.
//   홈(HOME-01)          내 여행 전부를 훑어 여행 이름과 함께 알린다
//   여행 홈(TRIP-HOME-01) 그 여행 하나만, 이미 그 여행 안이라 이름 없이
//
// ⚠️ **언제 뜨는가 · 무슨 문장인가 · 무엇을 하려는가는 여기에만 있다.**
//    화면은 받아서 그리기만 한다. 이 프로젝트에서 leaveTrip · CANCEL_PENDING ·
//    buildFundSnapshot 이 두 벌이 되어 한쪽만 고쳐지는 일을 세 번 겪었다.
//    (CLAUDE.md 7장 — 판정은 순수 함수 한 곳에 두고 양쪽이 그것만 부른다)
//
// ⚠️ 문장을 **두 벌 다** 내놓는다. 두 화면이 제목과 부제를 반대로 넣기 때문이다.
//      headline  누가 무엇을 했나   "정한나님 외 1명이 참여를 기다리고 있어요"
//      meta      지금 상태          "승인 대기 2건"
//    홈     제목 = headline · 부제 = "{여행 이름} · {meta}"
//    여행 홈 제목 = meta     · 부제 = headline           ← 기존 화면 그대로다
//    조각을 넘겨 화면이 문장을 만들게 하면 문구가 다시 두 벌이 된다.
//
// ⚠️ href 가 아니라 **intent** 를 돌려준다. 여행 홈은 아무 데도 가지 않고 그
//    자리에서 시트를 연다. href 로 적으면 여행 홈이 자기 자신으로 navigate 하는
//    모양이 된다. 무엇을 하려는가까지가 판단이고, 그것을 무엇으로 바꿀지는
//    화면이 정한다. (CLAUDE.md 9장 — app/ 이 라우팅)
//
// ⚠️ supabase 를 부르지 않는다. 이미 가져온 데이터를 받아 판단만 한다.
//    조회는 화면 파일이 한다 — 홈은 여행 N개, 여행 홈은 1개라 모양이 다르다.
// ============================================================================
import { TRIP_OWNER_TYPE, TRIP_STATUS } from '@/lib/constants/status';
import type { BannerTone } from '@/lib/constants/toneColor';

export type TripActionIntent =
  /** 참여 요청 목록으로. 수락 · 거절이 거기 있다 (INV-04 진입) */
  | 'OPEN_JOIN_REQUESTS'
  /** 취소 동의 시트로 (CXL-06). 아직 고르지 않은 사람만 */
  | 'OPEN_CANCEL_VOTE'
  /** 취소 동의 현황으로 (CXL-07). 요청자거나 이미 고른 사람 */
  | 'OPEN_CANCEL_PROGRESS'
  /**
   * 초대 링크 공유 시트로. 화면이 이미 들고 있는 useTripInvite 를 그대로 연다.
   * ⚠️ 새 라우트를 만들지 않는다 — 여행 홈은 제자리에서 시트를 연다.
   */
  | 'OPEN_INVITE_SHEET';

export type TripAction = {
  /** 목록 key. 여행 하나에 종류별로 하나씩이다 */
  id: string;
  kind: 'JOIN_REQUEST' | 'CANCEL_PENDING' | 'INVITE_EMPTY';
  tripId: string;
  /** "오사카 여행". **홈만 쓴다** — 여행 홈은 이미 그 여행 안이다 */
  tripLabel: string;
  tone: BannerTone;
  /** Ionicons 이름 */
  icon: string;

  /** 누가 무엇을 했나. 홈의 제목 · 여행 홈의 부제 */
  headline: string;
  /** 지금 상태. 여행 홈의 제목 · 홈의 부제 뒷부분 */
  meta: string;
  /*
    ⚠️ 배너 **밖** 보조 문장(note)이 여기 있었다. 2026-09-17 세 배너에서 모두
       걷어냈다. 세 문장 중 둘은 한 탭 뒤 시트에 같은 말이 있었고(취소 안내는
       CancelConfirmSheet · CancelVoteSheet, 초대 흐름 설명은 InviteLinkSheet),
       하나는 여행장만 보는 배너에서 "여행장만 할 수 있어요" 라고 말하고 있었다.
       배너마다 있고 없고가 갈리는 것보다 없는 쪽으로 통일했다. (다빈 확인)

    ⚠️ "지금 결정하지 않아도 괜찮아요" 한 조각만은 앱 어디에도 없는 문장이라
       남기자고 제안했으나, 통일성을 택했다. 승인 대기가 밀린 숙제처럼 읽힌다는
       신고가 들어오면 이 자리가 원래 그것을 막던 자리다.
  */

  ctaLabel: string;
  intent: TripActionIntent;
};

/**
 * 이 여행이 **아직 새 멤버를 들일 수 있는가.**
 *
 * ⚠️ 승인 대기 배너는 이 여행에만 뜬다. 전에는 상태를 안 봐서 **끝난 여행에도**
 *    "승인 대기 1건" 이 떴다 — 이미 다녀온 여행에 승인을 권하는 셈이었다.
 *    (2026-09-17 홈에 '세부 여행(ENDED) · 승인 대기 1건' 이 뜬 것으로 확인)
 *
 * ⚠️ CANCEL_PENDING 은 **들어간다.** 취소 요청 중에도 여행 준비는 그대로 돌고
 *    승인도 할 수 있다. (POL-CXL-006) 여기서 빼면 취소 요청이 들어온 순간
 *    승인 대기가 사라져 여행장이 요청을 놓친다.
 *
 * ⚠️ 서버는 CANCELED · DELETED 만 막는다(accept_trip_join_request ·
 *    TRIP_NOT_OPEN). ENDED · SETTLED 는 서버가 허용하지만 **보여 주지 않는다** —
 *    끝난 여행에 사람을 들이는 건 사용자가 원할 일이 아니다. 정말 필요하면
 *    여행 정보 수정에 들어가면 목록은 그대로 있다.
 *
 * ⚠️ 홈은 조회 전에 이 함수로 여행을 먼저 거른다. 판정과 조회 범위가 **같은
 *    기준**이어야 한다 — 전에 홈에만 따로 조건을 걸었다가 여행 홈과 갈렸다.
 */
export function tripAcceptsNewMembers(status: string): boolean {
  return (
    status === TRIP_STATUS.PLANNING ||
    status === TRIP_STATUS.TRAVELING ||
    status === TRIP_STATUS.CANCEL_PENDING
  );
}

/** "오사카 여행". 여행지가 없으면 그냥 "여행" */
export function tripActionLabel(destination: string | null | undefined): string {
  const name = destination?.trim();
  return name ? `${name} 여행` : '여행';
}

/**
 * 참여 요청 대기.
 *
 * ⚠️ **여행장에게만** 뜬다. 수락 · 거절이 여행장 전용이라 다른 멤버에게는 보여
 *    줄 이유가 없다. 부르는 쪽이 여행장일 때만 요청 목록을 채운다.
 *    (POL-INV-004 · canDecideJoinRequest)
 *
 * @returns 대기 중인 요청이 없거나 **새 멤버를 들일 수 없는 여행**이면 null
 *          — 화면은 null 을 안 그린다
 */
export function buildJoinRequestAction(input: {
  tripId: string;
  destination: string | null;
  /** 여행 상태. 끝났거나 취소된 여행에는 배너를 띄우지 않는다 */
  status: string;
  /** 대기 중인 요청자 이름, 오래 기다린 순. 빈 배열이면 null 을 돌려준다 */
  waitingNames: string[];
}): TripAction | null {
  // ⚠️ 상태를 **여기서** 본다. 화면마다 따로 걸면 홈과 여행 홈이 갈린다
  if (!tripAcceptsNewMembers(input.status)) return null;

  const count = input.waitingNames.length;
  if (count === 0) return null;

  /*
    ⚠️ 이름을 부른다. "요청 3건" 만으로는 누가 기다리는지 모른다. 여러 명이면
       첫 사람만 부르고 나머지는 수로 말한다 — 이름을 다 늘어놓으면 배너가
       두 줄을 넘는다.
  */
  const first = input.waitingNames[0];
  /*
    ⚠️⚠️ **용어는 두 단어뿐이다.** (2026-09-17 팀 확정)
         받는 사람이 링크에 응하는 것 = **초대 수락**
         여행장이 들이는 것           = **승인** (안 들이면 거절)
       한때 받는 쪽을 "참여 요청" 으로 바꿨다가 "초대 수락" 으로 되돌렸다.
       ⚠️ 여행장의 행동에 '수락' 을 쓰지 않는다. 양쪽이 모두 '수락' 이면 누가
          결정권자인지 사라진다.

    ⚠️ "함께 가고 싶어 해요" 는 쓰지 않는다. 홈에서 이 배너가 초대 배너
       ("○○님이 도쿄 여행에 초대했어요") 바로 아래 뜨는데, 문장만으로는 방향이
       안 드러난다. 방향은 **부제**가 말한다 — "{여행} · 승인 대기 N건" 이
       붙는 쪽이 내가 승인할 차례다. (2026-09-17 다빈)
  */
  const headline =
    count === 1
      ? `${first}님이 초대를 수락했어요`
      : `${first}님 외 ${count - 1}명이 초대를 수락했어요`;

  return {
    id: `${input.tripId}:JOIN_REQUEST`,
    kind: 'JOIN_REQUEST',
    tripId: input.tripId,
    tripLabel: tripActionLabel(input.destination),
    tone: 'brand',
    /*
      ⚠️ '아직 나 혼자'(buildInviteEmptyAction)와 **다른 아이콘이어야 한다.**
         둘은 여행 홈 같은 자리에서 서로 교대하는 배너다 — 누가 초대를 수락하면
         이쪽으로 바뀌고, 거절되면 저쪽으로 돌아간다. 아이콘이 같으면 바뀐 것을
         알아채지 못한다. 전에는 둘 다 person-add-outline 이었다. (2026-09-17)

      ⚠️ **체크를 쓰지 않는다.** 한때 checkmark-circle-outline 이었는데 "이미
         승인됨" 으로 읽혔다 — 아직 안 한 일에 완료 표시를 단 셈이다.
         사람 + 시계 = **기다리는 사람**이고, 제목("승인 대기 N건")과 글자
         그대로 맞는다. (2026-09-18 다빈)

      ⚠️ 이 문장은 곧 "초대를 수락했어요" → "참여 의사를 전달했어요" 로 바뀐다
         (담당자가 일괄 반영). 아이콘을 **양쪽 문구에서 모두 맞는 것**으로 골랐다 —
         둘 다 "누군가 들어오고 싶어 하고 내 결정을 기다린다" 는 같은 상태다.
         문구가 바뀌어도 이 값은 그대로 둔다.

      ⚠️ Ionicons 에는 사람과 시계를 함께 그린 글리프가 없다. 접두어 'mci:' 가
         붙는 이유다. 그리는 것은 components/ui/ActionIcon 이 한다.
    */
    icon: 'mci:account-clock-outline',
    headline,
    meta: `승인 대기 ${count}건`,
    ctaLabel: '확인하기',
    intent: 'OPEN_JOIN_REQUESTS',
  };
}

/**
 * 취소 요청 중.
 *
 * ⚠️ 동의 대상은 **요청자를 뺀 ACTIVE 멤버**다. 분모도 분자도 그렇다.
 *    (POL-CXL-068 · POL-MEM-014) 세는 일은 서버가 하고 여기서는 받은 수를
 *    문장으로만 옮긴다.
 *
 * ⚠️ 요청자와 이미 고른 사람은 **동의 시트로 보내지 않는다.** 요청자가 자기
 *    요청에 동의하면 분모에서는 빠진 표가 분자에 더해져, 남은 사람이 동의하지
 *    않았는데 만장일치로 판정된다.
 */
export function buildCancelPendingAction(input: {
  tripId: string;
  destination: string | null;
  agreedCount: number;
  voteTargetCount: number;
  isRequester: boolean;
  hasVoted: boolean;
  /** 취소를 요청한 사람 이름 */
  requesterName: string;
}): TripAction {
  const needsVote = !input.isRequester && !input.hasVoted;

  return {
    id: `${input.tripId}:CANCEL_PENDING`,
    kind: 'CANCEL_PENDING',
    tripId: input.tripId,
    tripLabel: tripActionLabel(input.destination),
    tone: 'warn',
    icon: 'alert-circle-outline',
    headline: input.isRequester
      ? '멤버 모두가 동의하면 취소돼요'
      : `${input.requesterName}님이 여행 취소를 요청했어요`,
    meta: `취소 요청 중 · ${input.agreedCount}/${input.voteTargetCount}명 동의`,
    ctaLabel: needsVote ? '확인하기' : '현황 보기',
    intent: needsVote ? 'OPEN_CANCEL_VOTE' : 'OPEN_CANCEL_PROGRESS',
  };
}

/**
 * 아직 나 혼자인 여행. "초대는 보냈는데 아무도 안 들어왔다" 를 알린다.
 *
 * ⚠️ 왜 필요한가 — 초대 권유 모달은 **여행당 한 번만** 뜬다(기기에 기록 ·
 *    lib/invite/inviteNudge). 그 한 번을 닫고 나면 여행 홈에는 아직 혼자라는
 *    걸 알려 주는 것이 아무것도 없었다. 초대 진입점도 여행 정보 수정 맨 아래
 *    하나뿐이라, 링크를 보낸 사람은 상대가 안 들어온 줄도 모른다.
 *    (2026-09-17 다빈 · 밀라노 여행으로 확인)
 *
 * ⚠️ 위의 두 배너와 달리 **답할 일이 아니라 권유**다. 그래서 홈(HOME-01)에서는
 *    부르지 않는다 — 홈의 배너 자리는 "지금 답해야 할 일" 이고, 여행이 세 개면
 *    권유 배너만 세 개가 쌓인다. 판정은 여기 두되 켜는 것은 여행 홈뿐이다.
 *    나중에 홈에도 띄우기로 하면 홈에서 이 함수를 부르기만 하면 된다.
 *
 * 뜨는 조건 — 하나라도 어긋나면 null 이다.
 *   · PLANNING          준비 중일 때만. 이미 떠난 여행에 초대를 권하는 건 늦었다.
 *                       (tripAcceptsNewMembers 를 쓰지 않는 이유가 이것이다 —
 *                        그 함수는 TRAVELING · CANCEL_PENDING 까지 참이다)
 *   · 모임 여행          혼자 가기로 한 사람에게 "아직 혼자예요" 는 잔소리다.
 *                       개인 여행에도 초대는 열려 있지만(승인하면 모임이 된다)
 *                       권하지는 않는다. 초대 권유 모달과 같은 규칙이다.
 *   · 가입 멤버 1명      나뿐이다.
 *   · 빈자리 있음        인원이 차 있으면 초대해도 서버가 수락을 막는다
 *                       (accept_trip_join_request · HEADCOUNT_REACHED).
 *                       인원을 늘리라는 안내는 여행 정보 수정 카드가 한다.
 *   · 승인 대기 0건      ★ 아래
 *
 * ⚠️★ **승인 대기가 한 건이라도 있으면 띄우지 않는다.** 누가 초대를 수락했지만
 *     아직 승인 전이면 가입 멤버는 **여전히 나 혼자**다. 이 조건이 없으면
 *     "아직 나 혼자예요" 와 "○○님이 초대를 수락했어요" 가 나란히 떠서 서로
 *     모순되게 읽힌다. 그때 할 일은 승인이므로 자리를 그쪽에 넘긴다.
 *
 * @returns 조건에 맞지 않으면 null — 화면은 null 을 안 그린다
 */
export function buildInviteEmptyAction(input: {
  tripId: string;
  destination: string | null;
  status: string;
  ownerType: string;
  /** 가입(user_id 있는) ACTIVE 멤버 수. 나 포함 */
  registeredMemberCount: number;
  /** trips.headcount. 빈자리 판정의 기준이다 */
  headcount: number;
  /** 대기 중인 초대 수락 건수. 한 건이라도 있으면 승인 대기 배너에 자리를 넘긴다 */
  waitingCount: number;
}): TripAction | null {
  if (input.status !== TRIP_STATUS.PLANNING) return null;
  if (input.ownerType === TRIP_OWNER_TYPE.PERSONAL) return null;
  if (input.registeredMemberCount !== 1) return null;
  if (input.headcount <= input.registeredMemberCount) return null;
  if (input.waitingCount > 0) return null;

  return {
    id: `${input.tripId}:INVITE_EMPTY`,
    kind: 'INVITE_EMPTY',
    tripId: input.tripId,
    tripLabel: tripActionLabel(input.destination),
    // ⚠️ 경고가 아니라 권유다. 취소 배너의 앰버를 쓰지 않는다
    tone: 'brand',
    icon: 'person-add-outline',
    headline: '함께 갈 사람에게 초대 링크를 보내 보세요',
    meta: '아직 나 혼자예요',
    ctaLabel: '초대하기',
    intent: 'OPEN_INVITE_SHEET',
  };
}
