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
import type { BannerTone } from '@/lib/constants/toneColor';

export type TripActionIntent =
  /** 참여 요청 목록으로. 수락 · 거절이 거기 있다 (INV-04 진입) */
  | 'OPEN_JOIN_REQUESTS'
  /** 취소 동의 시트로 (CXL-06). 아직 고르지 않은 사람만 */
  | 'OPEN_CANCEL_VOTE'
  /** 취소 동의 현황으로 (CXL-07). 요청자거나 이미 고른 사람 */
  | 'OPEN_CANCEL_PROGRESS';

export type TripAction = {
  /** 목록 key. 여행 하나에 종류별로 하나씩이다 */
  id: string;
  kind: 'JOIN_REQUEST' | 'CANCEL_PENDING';
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
  /**
   * 배너 **밖** 보조 문장. **여행 홈만 그린다.**
   *
   * ⚠️ 홈에서 빼는 건 의도다. "취소 요청 중에도 예산과 계획은 그대로 수정할 수
   *    있어요" 는 예산을 고치려던 사람에게 하는 말이라 여행 홈 맥락이다.
   *    홈에서는 자리만 차지한다. 여행 홈에서는 빼지 말 것 — 두 배너 모두
   *    주석에 이유가 적혀 있다. (POL-CXL-006)
   */
  note: string;

  ctaLabel: string;
  intent: TripActionIntent;
};

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
 * @returns 대기 중인 요청이 없으면 null — 화면은 null 을 안 그린다
 */
export function buildJoinRequestAction(input: {
  tripId: string;
  destination: string | null;
  /** 대기 중인 요청자 이름, 오래 기다린 순. 빈 배열이면 null 을 돌려준다 */
  waitingNames: string[];
}): TripAction | null {
  const count = input.waitingNames.length;
  if (count === 0) return null;

  /*
    ⚠️ 이름을 부른다. "요청 3건" 만으로는 누가 기다리는지 모른다. 여러 명이면
       첫 사람만 부르고 나머지는 수로 말한다 — 이름을 다 늘어놓으면 배너가
       두 줄을 넘는다.
  */
  const first = input.waitingNames[0];
  /*
    ⚠️ "초대를 수락했어요" 라고 쓰지 않는다. **수락·승인은 여행장의 행동**이다.
       링크를 연 사람이 하는 건 참여 요청이다.
       (docs/10_여행초대정책_v2.md §7 — 참여 요청 → 여행장 승인 → 참여 확정)

    ⚠️ "함께 가고 싶어 해요" 도 쓰지 않는다. 홈에서 이 배너가 초대 배너
       ("○○님이 도쿄 여행에 초대했어요") 바로 아래 뜨는데, 둘 다 "누가 무엇을
       했다" 로 시작하면 **방향이 반대인 걸 못 알아본다.** 실제로 헷갈렸다.
       "참여를 요청했어요" 는 내가 승인할 차례라는 게 드러난다. (2026-09-17 다빈)
  */
  const headline =
    count === 1
      ? `${first}님이 참여를 요청했어요`
      : `${first}님 외 ${count - 1}명이 참여를 요청했어요`;

  return {
    id: `${input.tripId}:JOIN_REQUEST`,
    kind: 'JOIN_REQUEST',
    tripId: input.tripId,
    tripLabel: tripActionLabel(input.destination),
    tone: 'brand',
    icon: 'person-add-outline',
    headline,
    meta: `승인 대기 ${count}건`,
    note: '수락은 여행장만 할 수 있어요. 지금 결정하지 않아도 괜찮아요.',
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
    note: '취소 요청 중에도 예산과 계획은 그대로 수정할 수 있어요.',
    ctaLabel: needsVote ? '확인하기' : '현황 보기',
    intent: needsVote ? 'OPEN_CANCEL_VOTE' : 'OPEN_CANCEL_PROGRESS',
  };
}
