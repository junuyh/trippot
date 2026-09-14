// ============================================================================
// 여행 취소(CXL) DB Query
//
// ⚠️ CXL 스펙 §6 은 이 함수들을 lib/trip/cancelRequest.ts · cancelTrip.ts 에
//    두라고 하지만, CLAUDE.md §7 이 "모든 DB Query 는 queries/ 안에" 로 정해
//    두었고 그쪽이 우선한다. (§0) 판정·계산은 lib/trip/cancelPolicy.ts 다.
//
// ⚠️⚠️ supabase-js 에는 트랜잭션이 없다. ⚠️⚠️
//    이 파일의 함수들은 여러 표를 잇달아 바꾼다. 중간에 실패하면 어긋난 상태가
//    남는다. 각 함수 주석에 그때 무엇이 남는지와 왜 그 순서인지를 적었다.
//    실서비스에서 원자성이 필요해지면 Edge Function 의 RPC 로 옮긴다.
//
// ⚠️ 알림은 보내지 않는다. lib/notify/send.ts 가 아직 없고, 생성 주체가
//    Edge Function 으로 확정됐다. 보낼 자리마다 TODO 를 남겼다.
// ============================================================================
import { TRIP_STATUS } from '@/lib/constants/status';
import {
  cancelRequestExpiry,
  resolveVoteOutcome,
  type VoteValue,
} from '@/lib/trip/cancelPolicy';
import { supabase } from '@/lib/supabase/client';
import type { Json, Tables } from '@/types/database';

/**
 * 취소 확정 시점의 금액 스냅샷. (POL-CXL-011)
 *
 * ⚠️ 조회 때마다 다시 계산하지 않는다. 취소 후에도 계좌 거래는 계속 수신되지만
 *    이 값은 그때 그대로 남아야 한다.
 * ⚠️ remaining 은 cancelRemainingAmount() 로 **저장 시점에 확정**한 값이다.
 */
export type CanceledFundSnapshot = {
  fund_type: 'ACCOUNT' | 'MANUAL' | 'ZERO';
  masked_account: string | null;
  total_saved: number;
  actual_spent: number;
  remaining: number;
  goal_amount: number;
  headcount: number;
  captured_at: string;
};

export type CancelRequest = Tables<'trip_cancel_requests'>;
export type CancelVote = Tables<'trip_cancel_votes'>;

/** 요청 상태. DB CHECK 와 같은 값이다 */
export const CANCEL_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

/**
 * 요청 + 7일 (POL-CXL-063)
 *
 * ⚠️ 화면도 쓴다. CXL-03 은 **요청하기 전**에 "언제까지 동의가 모여야 하는지"
 *    를 미리 알려야 하는데, 그때는 아직 expires_at 이 없다. 숫자를 화면에
 *    또 적으면 둘이 어긋난다.
 */
export const EXPIRE_DAYS = 7;

// ── 조회 ────────────────────────────────────────────────────────────────────

/**
 * 지금 살아 있는 취소 요청. 없으면 null.
 *
 * ⚠️⚠️ **여기서 만료를 판정한다.** (lazy expiration) ⚠️⚠️
 *    별도 크론을 만들지 않는다. 여행 홈 진입 시 이 함수를 반드시 통과하므로
 *    실사용에서는 즉시 반영된다. 이걸 빼면 요청이 영원히 PENDING 으로 남는다.
 *
 * 만료 조건 두 가지 — 시간(7일)과 출발일 도달. (POL-CXL-063 · 064)
 */
export async function getActiveCancelRequest(
  tripId: string,
  tripStartDate: string | null,
): Promise<CancelRequest | null> {
  const { data, error } = await supabase
    .from('trip_cancel_requests')
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', CANCEL_REQUEST_STATUS.PENDING)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const expiry = cancelRequestExpiry({
    expiresAt: data.expires_at,
    startDate: tripStartDate,
    now: new Date(),
  });

  if (!expiry.expired) return data;

  // 만료됐으면 닫고 없는 것으로 본다. 여행 상태도 되돌린다.
  await expireCancelRequest(data.id, tripId, expiry.note ?? 'EXPIRED_TIME');
  return null;
}

export type VoteProgress = {
  requestId: string;
  /** 동의 대상 수 = ACTIVE 멤버 − 요청자 */
  targetCount: number;
  agreedCount: number;
  hasDisagree: boolean;
  votes: (CancelVote & { name: string })[];
};

/**
 * 동의 현황. CXL-07 이 쓴다.
 *
 * ⚠️ 동의 대상은 **요청자를 뺀 ACTIVE 멤버**다. 나간 사람(LEFT)은 분모에서
 *    빠진다. (POL-CXL-068)
 *
 * ⚠️⚠️ **분자도 ACTIVE 멤버만 센다.** ⚠️⚠️
 *    나간 사람의 표를 지우지 않으므로(기록이라 남긴다) 그냥 세면 분모에서는
 *    빠진 사람이 분자에는 남는다. 3명 여행(요청자 A · B · C)에서 B 가 동의하고
 *    나가면 분모가 1로 줄고 분자는 그대로 1이라, **C 가 동의한 적도 없는데
 *    만장일치로 판정된다.** 나간 사람에게는 동의를 묻지 않는다는 규칙
 *    (POL-MEM-014)은 분모와 분자 양쪽에 걸린다.
 */
export async function getVoteProgress(
  request: CancelRequest,
): Promise<VoteProgress> {
  const [members, votes] = await Promise.all([
    supabase
      .from('trip_members')
      .select('user_id, display_name, users(name)')
      .eq('trip_id', request.trip_id)
      .eq('status', 'ACTIVE'),
    supabase.from('trip_cancel_votes').select('*').eq('request_id', request.id),
  ]);

  if (members.error) throw members.error;
  if (votes.error) throw votes.error;

  const nameByUserId = new Map<string, string>();
  for (const row of members.data ?? []) {
    if (!row.user_id) continue;
    const user = row.users as { name: string } | null;
    nameByUserId.set(row.user_id, user?.name ?? row.display_name ?? '이름 없음');
  }

  // 요청자는 동의 대상이 아니다
  const targetCount = Math.max(0, nameByUserId.size - 1);

  // 나간 사람의 표는 세지 않는다. 행은 기록으로 남기되 판정에서만 뺀다
  const voteRows = (votes.data ?? []).filter((v) => nameByUserId.has(v.user_id));

  return {
    requestId: request.id,
    targetCount,
    agreedCount: voteRows.filter((v) => v.vote === 'AGREE').length,
    hasDisagree: voteRows.some((v) => v.vote === 'DISAGREE'),
    votes: voteRows.map((v) => ({
      ...v,
      name: nameByUserId.get(v.user_id) ?? '이름 없음',
    })),
  };
}

/**
 * 취소 후 발생한 거래 **전부**. CXL-05 가 쓴다.
 *
 * ⚠️ 화면은 5건만 보여주지만 이 함수는 전체를 돌려준다. 요약 금액이 전체
 *    합산이어야 하기 때문이다. 잘라서 돌려주면 안 된다.
 */
export async function getChangesSinceCancel(
  tripId: string,
  canceledAt: string,
): Promise<Tables<'transactions'>[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('trip_id', tripId)
    .gt('occurred_at', canceledAt)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ── 요청 ────────────────────────────────────────────────────────────────────

export type RequestCancelResult =
  | { outcome: 'PENDING'; requestId: string }
  | { outcome: 'CANCELED' };

/**
 * 취소 요청. 동의 대상이 0명이면 바로 확정한다. (POL-CXL-066 개인 여행)
 *
 * ⚠️ 순서를 지킬 것.
 *    1. 요청 행을 먼저 만든다
 *    2. 그다음 trips.status 를 CANCEL_PENDING 으로 올린다
 *    반대로 하면 status 만 바뀌고 요청이 없는 여행이 생긴다. 그 여행은 홈에
 *    "취소 요청 중" 배너를 띄우는데 현황을 열면 아무것도 없다.
 *
 * ⚠️ 멱등 — PENDING 요청이 이미 있으면 그걸 그대로 돌려준다. (REQ-CXL-017)
 *    유니크 인덱스 idx_cancel_req_one_pending 가 DB 에서도 막는다.
 */
export async function requestCancel(input: {
  tripId: string;
  requestedBy: string;
  reason: string | null;
  /** 동의 대상 수. 0이면 바로 확정한다 */
  voteTargetCount: number;
  /** 확정 시 저장할 자금 스냅샷 */
  fundSnapshot: CanceledFundSnapshot;
}): Promise<RequestCancelResult> {
  // 이미 대기 중인 요청이 있으면 그것을 쓴다
  const { data: existing, error: findError } = await supabase
    .from('trip_cancel_requests')
    .select('*')
    .eq('trip_id', input.tripId)
    .eq('status', CANCEL_REQUEST_STATUS.PENDING)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return { outcome: 'PENDING', requestId: existing.id };

  const expiresAt = new Date(Date.now() + EXPIRE_DAYS * 86_400_000).toISOString();

  const { data: created, error: insertError } = await supabase
    .from('trip_cancel_requests')
    .insert({
      trip_id: input.tripId,
      requested_by: input.requestedBy,
      reason: input.reason,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  // 동의할 사람이 없으면 절차를 건너뛴다 (개인 여행)
  if (input.voteTargetCount === 0) {
    await confirmCancel({
      tripId: input.tripId,
      requestId: created.id,
      canceledBy: input.requestedBy,
      reason: input.reason,
      fundSnapshot: input.fundSnapshot,
    });
    return { outcome: 'CANCELED' };
  }

  const { error: statusError } = await supabase
    .from('trips')
    .update({ status: TRIP_STATUS.CANCEL_PENDING })
    .eq('id', input.tripId);

  if (statusError) {
    // 보상 삭제. 요청만 남으면 화면이 배너를 못 띄운 채 요청이 떠돈다.
    await supabase.from('trip_cancel_requests').delete().eq('id', created.id);
    throw statusError;
  }

  // TODO: notify CANCEL_REQUESTED → 동의 대상 전원 (사유는 푸시 본문에 넣지 않는다)
  return { outcome: 'PENDING', requestId: created.id };
}

// ── 투표 ────────────────────────────────────────────────────────────────────

export type VoteResult = { outcome: 'PENDING' | 'APPROVED' | 'REJECTED' };

/**
 * 동의 또는 반대. **1인 1회, 번복 불가.** (POL-CXL-067)
 *
 * ⚠️ 번복 차단은 유니크 인덱스(idx_cancel_vote_once)가 한다. 앱에서만 막으면
 *    동시 요청에 뚫린다. 여기서는 그 에러를 그대로 올린다.
 *
 * ⚠️ 반대가 나오면 **즉시 폐기한다.** 나머지 동의를 계속 받지 않는다.
 *    (POL-CXL-062) 계속 물으면 반대한 사람을 압박하는 구조가 된다.
 *
 * ⚠️⚠️ **요청자는 투표하지 않는다.** ⚠️⚠️
 *    동의 대상(targetCount)은 요청자를 빼고 센다. 그런데 agreedCount 는
 *    trip_cancel_votes 를 그대로 세므로, 요청자 표가 섞이면 분자만 1 늘어난다.
 *    3명 여행이면 남은 2명 중 1명만 동의해도 2/2 로 읽혀 **취소가 확정된다.**
 *    화면에서도 막지만 여기서 한 번 더 막는다. 판정을 뚫는 경로를 남기지 않는다.
 */
export async function castCancelVote(input: {
  request: CancelRequest;
  userId: string;
  vote: VoteValue;
  /** 확정될 경우 저장할 자금 스냅샷 */
  fundSnapshot: CanceledFundSnapshot;
}): Promise<VoteResult> {
  if (input.userId === input.request.requested_by) {
    throw new Error('REQUESTER_CANNOT_VOTE');
  }

  const { error: insertError } = await supabase.from('trip_cancel_votes').insert({
    request_id: input.request.id,
    user_id: input.userId,
    vote: input.vote,
  });
  if (insertError) throw insertError;

  if (input.vote === 'DISAGREE') {
    await rejectCancelRequest(input.request.id, input.request.trip_id);
    return { outcome: 'REJECTED' };
  }

  const progress = await getVoteProgress(input.request);
  const outcome = resolveVoteOutcome({
    targetCount: progress.targetCount,
    agreedCount: progress.agreedCount,
    hasDisagree: progress.hasDisagree,
  });

  if (outcome === 'approved') {
    await confirmCancel({
      tripId: input.request.trip_id,
      requestId: input.request.id,
      canceledBy: input.request.requested_by,
      reason: input.request.reason,
      fundSnapshot: input.fundSnapshot,
    });
    return { outcome: 'APPROVED' };
  }

  // TODO: notify CANCEL_VOTE_AGREED → 요청자
  return { outcome: 'PENDING' };
}

// ── 폐기 ────────────────────────────────────────────────────────────────────

/**
 * 요청을 닫고 여행 상태를 되돌린다. 반대·만료·철회가 공통으로 쓴다.
 *
 * ⚠️ 원래 상태로 **저장값을 꺼내 쓰지 않는다.** 날짜로 다시 계산한다.
 *    (POL-CXL-032 와 같은 원칙) 그래서 여기서는 PLANNING 으로 두고,
 *    여행 홈이 closeTripIfEnded() 로 날짜에 맞게 올린다.
 */
async function closeRequest(
  requestId: string,
  tripId: string,
  status: string,
  note: string,
): Promise<void> {
  const { error } = await supabase
    .from('trip_cancel_requests')
    .update({ status, resolved_at: new Date().toISOString(), resolved_note: note })
    .eq('id', requestId);
  if (error) throw error;

  const { error: statusError } = await supabase
    .from('trips')
    .update({ status: TRIP_STATUS.PLANNING })
    .eq('id', tripId)
    .eq('status', TRIP_STATUS.CANCEL_PENDING);
  if (statusError) throw statusError;
}

/** 한 명이 반대해 폐기 (POL-CXL-062) */
export async function rejectCancelRequest(requestId: string, tripId: string): Promise<void> {
  await closeRequest(requestId, tripId, CANCEL_REQUEST_STATUS.REJECTED, 'DISAGREED');
  // TODO: notify CANCEL_REJECTED → 전원
}

/** 만료로 폐기. getActiveCancelRequest 가 조회 시점에 부른다 */
export async function expireCancelRequest(
  requestId: string,
  tripId: string,
  note: 'EXPIRED_TIME' | 'DEPARTURE_REACHED',
): Promise<void> {
  await closeRequest(requestId, tripId, CANCEL_REQUEST_STATUS.EXPIRED, note);
  // TODO: notify CANCEL_EXPIRED → 전원
}

/** 요청자가 철회 (POL-CXL-065) */
export async function withdrawCancelRequest(
  requestId: string,
  tripId: string,
): Promise<void> {
  await closeRequest(requestId, tripId, CANCEL_REQUEST_STATUS.WITHDRAWN, 'WITHDRAWN');
  // TODO: notify CANCEL_WITHDRAWN → 전원
}

// ── 확정 · 되돌리기 ─────────────────────────────────────────────────────────

/**
 * 취소 확정.
 *
 * ⚠️ 순서를 지킬 것.
 *    1. trips 를 CANCELED 로 (canceled_at · canceled_by · reason · 스냅샷 함께)
 *    2. 요청을 APPROVED 로
 *    반대로 하면 요청은 승인됐는데 여행이 그대로인 상태가 생긴다. 그러면
 *    화면이 "취소됨" 을 못 보여주고 사용자는 취소가 안 된 줄 안다.
 *
 * ⚠️ 스냅샷은 **이 시점에 확정한다.** 조회 때마다 다시 계산하지 않는다.
 *    (POL-CXL-011) 취소 후 계좌 거래가 계속 들어와도 기록은 안 바뀐다.
 *
 * ⚠️ 멱등 — 이미 CANCELED 면 아무것도 하지 않는다.
 */
export async function confirmCancel(input: {
  tripId: string;
  requestId: string;
  canceledBy: string;
  reason: string | null;
  fundSnapshot: CanceledFundSnapshot;
}): Promise<void> {
  const { data: trip, error: readError } = await supabase
    .from('trips')
    .select('status')
    .eq('id', input.tripId)
    .maybeSingle();
  if (readError) throw readError;
  if (trip?.status === TRIP_STATUS.CANCELED) return;

  const { error } = await supabase
    .from('trips')
    .update({
      status: TRIP_STATUS.CANCELED,
      canceled_at: new Date().toISOString(),
      canceled_by: input.canceledBy,
      cancel_reason: input.reason,
      canceled_fund_snapshot_json: input.fundSnapshot as unknown as Json,
    })
    .eq('id', input.tripId);
  if (error) throw error;

  const { error: requestError } = await supabase
    .from('trip_cancel_requests')
    .update({
      status: CANCEL_REQUEST_STATUS.APPROVED,
      resolved_at: new Date().toISOString(),
      resolved_note: 'ALL_AGREED',
    })
    .eq('id', input.requestId);
  if (requestError) throw requestError;

  // TODO: notify CANCEL_CONFIRMED → 전원
}

/**
 * 되돌리기. (POL-CXL-032 · 033 · 037 · 038)
 *
 * ⚠️ 상태를 **저장값에서 꺼내지 않는다.** PLANNING 으로 두고 날짜로 다시
 *    계산하게 한다. 여행 홈의 closeTripIfEnded() 가 그 일을 한다.
 *    저장해 둔 status_before_cancel 을 쓰면 그 사이 날짜가 지나간 여행이
 *    PLANNING 으로 되살아난다.
 *
 * ⚠️ canceled_* 를 전부 비운다. canceled_at 이 남으면 72시간 계산이 어긋난다.
 *
 * ⚠️ 취소 중 계좌 변동은 **전량 반영된다.** 거래를 지우거나 고르지 않는다.
 *    (POL-CXL-033) 거래는 그대로 있었으므로 여기서 할 일이 없다.
 *
 * ⚠️ 동의를 받지 않는다. 원래 상태로 돌아가는 것이라 새 결정이 아니다.
 */
export async function restoreCanceledTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({
      status: TRIP_STATUS.PLANNING,
      canceled_at: null,
      canceled_by: null,
      cancel_reason: null,
      canceled_fund_snapshot_json: null,
    })
    .eq('id', tripId)
    .eq('status', TRIP_STATUS.CANCELED);
  if (error) throw error;

  // TODO: notify CANCEL_RESTORED → 전원
}

/**
 * 멤버가 나갔을 때 동의를 다시 판정한다. (POL-CXL-068 · POL-MEM-014 · 016)
 *
 * ⚠️ **나감으로 남은 인원이 전원 동의 상태가 되면 그 순간 취소가 확정된다.**
 *    leaveTrip() 을 부른 화면이 반드시 이어서 부른다. 안 부르면 이미 전원이
 *    동의했는데도 요청이 계속 대기로 남는다.
 *
 * ⚠️ **요청자 본인이 나가면 요청을 철회한다.** (POL-MEM-016) 요청한 사람이
 *    없어졌는데 남은 사람들에게 계속 동의를 물으면, 아무도 원하지 않는 취소가
 *    진행된다. 화면상으로는 평범한 나가기와 같아서 따로 알리지 않는다.
 *
 * @param leftUserId 방금 나간 사람. 요청자 판정에 쓴다
 * @returns 나간 뒤의 요청 상태. 화면이 MEM-03 의 갈래를 정하는 데 쓴다
 */
export type AfterLeaveOutcome = 'NONE' | 'PENDING' | 'CANCELED' | 'REJECTED' | 'WITHDRAWN';

export async function recheckAfterMemberLeft(input: {
  tripId: string;
  tripStartDate: string | null;
  leftUserId: string;
  fundSnapshot: CanceledFundSnapshot;
}): Promise<AfterLeaveOutcome> {
  const request = await getActiveCancelRequest(input.tripId, input.tripStartDate);
  if (!request) return 'NONE';

  // 요청자가 나갔다. 남은 사람에게 물을 이유가 없다 (POL-MEM-016)
  if (request.requested_by === input.leftUserId) {
    await withdrawCancelRequest(request.id, input.tripId);
    return 'WITHDRAWN';
  }

  const progress = await getVoteProgress(request);
  const outcome = resolveVoteOutcome({
    targetCount: progress.targetCount,
    agreedCount: progress.agreedCount,
    hasDisagree: progress.hasDisagree,
  });

  if (outcome === 'approved') {
    await confirmCancel({
      tripId: input.tripId,
      requestId: request.id,
      canceledBy: request.requested_by,
      reason: request.reason,
      fundSnapshot: input.fundSnapshot,
    });
    return 'CANCELED';
  }

  if (outcome === 'rejected') {
    await rejectCancelRequest(request.id, input.tripId);
    return 'REJECTED';
  }

  return 'PENDING';
}
