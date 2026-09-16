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
  //
  // ⚠️ 닫는 일은 서버가 한다. 만료 판정을 앱에서도 하는 건 네트워크를 아끼기
  //    위해서다 — 만료가 아니면 아예 부르지 않는다. 실제 판정과 쓰기는 서버가
  //    다시 한다. (expire_trip_cancel_request)
  await expireCancelRequest(tripId);
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
  reason: string | null;
}): Promise<RequestCancelResult> {
  const { data, error } = await supabase.rpc('request_trip_cancel', {
    p_trip_id: input.tripId,
    p_reason: input.reason ?? undefined,
  });
  if (error) throw error;

  const result = data as { outcome: 'PENDING' | 'CANCELED'; request_id: string };

  // TODO: notify CANCEL_REQUESTED → 동의 대상 전원 (사유는 푸시 본문에 넣지 않는다)
  return result.outcome === 'CANCELED'
    ? { outcome: 'CANCELED' }
    : { outcome: 'PENDING', requestId: result.request_id };
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
  requestId: string;
  vote: VoteValue;
}): Promise<VoteResult> {
  const { data, error } = await supabase.rpc('cast_trip_cancel_vote', {
    p_request_id: input.requestId,
    p_vote: input.vote,
  });
  if (error) throw error;

  // TODO: notify — APPROVED 면 CANCEL_CONFIRMED → 전원
  //                REJECTED 면 CANCEL_REJECTED → 전원
  //                PENDING  이면 CANCEL_VOTE_AGREED → 요청자
  return { outcome: (data ?? 'PENDING') as VoteResult['outcome'] };
}

// ── 폐기 ────────────────────────────────────────────────────────────────────

/**
 * 만료로 폐기. getActiveCancelRequest 가 조회 시점에 부른다.
 *
 * ⚠️ 만료가 아니면 서버가 아무 일도 하지 않는다 (멱등). 여러 화면이 동시에
 *    불러도 안전하다.
 */
export async function expireCancelRequest(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('expire_trip_cancel_request', {
    p_trip_id: tripId,
  });
  if (error) throw error;

  // TODO: notify CANCEL_EXPIRED → 전원
}

/**
 * 요청자가 철회 (POL-CXL-065)
 *
 * ⚠️ 서버가 요청자 본인인지 검사한다. 남의 요청은 철회할 수 없다.
 * ⚠️ 이미 닫힌 요청이면 아무 일도 하지 않는다 (멱등).
 */
export async function withdrawCancelRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_trip_cancel_request', {
    p_request_id: requestId,
  });
  if (error) throw error;

  // TODO: notify CANCEL_WITHDRAWN → 전원
}

// ── 되돌리기 ────────────────────────────────────────────────────────────────

/**
 * 되돌리기. (POL-CXL-032 · 033 · 037 · 038)
 *
 * 서버(restore_canceled_trip)가 검사한다 — ACTIVE 멤버인지, CANCELED 인지,
 * 취소 후 72시간 이내인지.
 *
 * ⚠️ 상태를 저장값에서 꺼내지 않는다. PLANNING 으로 두고 날짜로 다시 계산하게
 *    한다. 여행 홈의 closeTripIfEnded() 가 그 일을 한다.
 *
 * ⚠️ canceled_* 를 전부 비운다. canceled_at 이 남으면 72시간 계산이 어긋난다.
 *
 * ⚠️ 취소 중 계좌 변동은 전량 반영된다. 거래를 지우거나 고르지 않는다.
 *
 * ⚠️ 동의를 받지 않는다. 원래 상태로 돌아가는 것이라 새 결정이 아니다.
 */
export async function restoreCanceledTrip(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_canceled_trip', {
    p_trip_id: tripId,
  });
  if (error) throw error;

  // TODO: notify CANCEL_RESTORED → 전원
}

/**
 * 나간 뒤 취소 요청이 어떻게 됐는지.
 *
 * ⚠️ 재판정은 **서버가 나가기와 같은 트랜잭션에서** 한다.
 *    (leave_trip · delegate_and_leave 의 반환값)
 *    예전에는 화면이 recheckAfterMemberLeft() 를 이어서 불렀는데, 빠뜨리면
 *    이미 전원이 동의했는데도 요청이 대기로 남았다. 부르는 것을 잊을 수 있는
 *    구조 자체를 없앴다. (2026-09-16 · 보안 점검 필수 6)
 *
 * 규칙은 그대로다.
 *   · 요청자 본인이 나가면 요청을 철회한다 (POL-MEM-016)
 *   · 남은 인원이 전원 동의 상태가 되면 그 순간 확정된다 (POL-CXL-068)
 */
export type AfterLeaveOutcome = 'NONE' | 'PENDING' | 'CANCELED' | 'REJECTED' | 'WITHDRAWN';
