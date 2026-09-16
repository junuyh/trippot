// ============================================================================
// 여행 초대 수신 · 참가 요청 · 승인/거절 (INV) — RPC 6개의 앱 쪽 얇은 껍데기
//
// 기준: docs/12_여행초대_승인_RPC계약_v1.md
//       supabase/migrations/20260913000001_trip_join_request_rpcs.sql (PR #93 · trippot-dev 적용)
//
// ⚠️ 앱은 trip_invites · trip_join_requests 를 직접 읽거나 쓰지 않는다. 전부 RPC 한 경로다.
//    신원은 서버의 auth.uid() 하나 — user id 를 인자로 넘기지 않는다.
//    미리보기(isPreview)에는 세션이 없어 42501/AUTH_REQUIRED 가 온다. 화면이 미리 가른다.
//
// ⚠️ 타입은 types/database.ts 의 Functions 를 그대로 쓴다. RETURNS TABLE 은 배열로 오고
//    함수마다 정확히 한 행(목록 함수는 N 행)이다. any 로 풀지 않는다.
//
// ── 오류 계약 ────────────────────────────────────────────────────────────────
//   서버는 raise exception 의 **message 를 코드 그대로** 쓴다. PostgREST 가 그 message 를
//   error.message 로 넘기므로 정확히 일치 비교한다. (migration 머리 주석의 표와 같다)
//     NOT_FOUND · INVITE_NOT_VALID · ALREADY_MEMBER · REJECTED_FOR_INVITE ·
//     REQUEST_NOT_PENDING · TRIP_NOT_OPEN · HEADCOUNT_REACHED · NEW_GROUP_NAME_REQUIRED ·
//     LEADER_NOT_CONFIGURED · NOT_LEADER · FORBIDDEN · AUTH_REQUIRED
//   그 밖(네트워크 · 권한 42501 등)은 null — 화면이 일반 실패로 다룬다.
// ============================================================================
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

type Fn = Database['public']['Functions'];

export type ResolveTripInviteRow = Fn['resolve_trip_invite']['Returns'][number];
export type RequestTripJoinRow = Fn['request_trip_join']['Returns'][number];
export type CancelTripJoinRequestRow = Fn['cancel_trip_join_request']['Returns'][number];
export type TripJoinRequestRow = Fn['get_trip_join_requests']['Returns'][number];
export type AcceptTripJoinRequestRow = Fn['accept_trip_join_request']['Returns'][number];
export type RejectTripJoinRequestRow = Fn['reject_trip_join_request']['Returns'][number];
export type ResolveTripInviteByIdRow = Fn['resolve_trip_invite_by_id']['Returns'][number];
export type RequestTripJoinByInviteRow = Fn['request_trip_join_by_invite']['Returns'][number];

/** 서버가 message 로 돌려주는 도메인 오류 코드. migration 머리 주석의 표 그대로. */
export const TRIP_JOIN_ERROR = {
  NOT_FOUND: 'NOT_FOUND',
  INVITE_NOT_VALID: 'INVITE_NOT_VALID',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  REJECTED_FOR_INVITE: 'REJECTED_FOR_INVITE',
  REQUEST_NOT_PENDING: 'REQUEST_NOT_PENDING',
  TRIP_NOT_OPEN: 'TRIP_NOT_OPEN',
  HEADCOUNT_REACHED: 'HEADCOUNT_REACHED',
  NEW_GROUP_NAME_REQUIRED: 'NEW_GROUP_NAME_REQUIRED',
  LEADER_NOT_CONFIGURED: 'LEADER_NOT_CONFIGURED',
  NOT_LEADER: 'NOT_LEADER',
  FORBIDDEN: 'FORBIDDEN',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
} as const;

export type TripJoinErrorCode = (typeof TRIP_JOIN_ERROR)[keyof typeof TRIP_JOIN_ERROR];

const ERROR_CODES = new Set<string>(Object.values(TRIP_JOIN_ERROR));

/**
 * 던져진 오류에서 도메인 코드를 꺼낸다. 없으면 null.
 * PostgREST 오류는 { message, code, details } 모양이고 message 가 서버 raise 의 message 다.
 */
export function tripJoinErrorCode(error: unknown): TripJoinErrorCode | null {
  const message =
    error !== null && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message).trim()
      : '';
  return ERROR_CODES.has(message) ? (message as TripJoinErrorCode) : null;
}

/** RETURNS TABLE 은 배열이다. 한 행짜리 함수는 첫 행을, 없으면 던진다. */
function single<T>(rows: T[] | null, what: string): T {
  const row = rows?.[0];
  if (!row) throw new Error(`${what}: 서버가 빈 결과를 돌려줬습니다.`);
  return row;
}

/**
 * 수신자용 초대 확인. (docs/12 §3)
 * invite_state · 최소 미리보기 · my_state · my_request_id. 예산·계좌·멤버 목록은 오지 않는다.
 * ⚠️ NOT_FOUND 도 오류가 아니라 invite_state = 'NOT_FOUND' 행으로 온다.
 */
export async function resolveTripInvite(token: string): Promise<ResolveTripInviteRow> {
  const { data, error } = await supabase.rpc('resolve_trip_invite', { p_token: token });
  if (error) throw error;
  return single(data, 'resolve_trip_invite');
}

/**
 * 참가 요청. PENDING 한 행. 이미 PENDING 이면 그 행(멱등). (docs/12 §4)
 * 실패: NOT_FOUND · INVITE_NOT_VALID · ALREADY_MEMBER · REJECTED_FOR_INVITE
 */
export async function requestTripJoin(token: string): Promise<RequestTripJoinRow> {
  const { data, error } = await supabase.rpc('request_trip_join', { p_token: token });
  if (error) throw error;
  return single(data, 'request_trip_join');
}

/** 본인 PENDING 요청 취소. (docs/12 §5) 실패: NOT_FOUND · FORBIDDEN · REQUEST_NOT_PENDING */
export async function cancelTripJoinRequest(requestId: string): Promise<CancelTripJoinRequestRow> {
  const { data, error } = await supabase.rpc('cancel_trip_join_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return single(data, 'cancel_trip_join_request');
}

/**
 * 여행장의 PENDING 목록. (docs/12 §6)
 * 실패: NOT_FOUND · LEADER_NOT_CONFIGURED · NOT_LEADER
 * ⚠️ needs_new_group 등 hint 는 안내용이다. 승인 함수가 락 안에서 다시 계산한다.
 */
export async function getTripJoinRequests(tripId: string): Promise<TripJoinRequestRow[]> {
  const { data, error } = await supabase.rpc('get_trip_join_requests', { p_trip_id: tripId });
  if (error) throw error;
  return data ?? [];
}

/**
 * 여행장 승인. (docs/12 §7) 한 트랜잭션. CASE A/B/C/D 는 서버가 정한다.
 * 실패: NOT_FOUND · LEADER_NOT_CONFIGURED · NOT_LEADER · REQUEST_NOT_PENDING · TRIP_NOT_OPEN ·
 *       HEADCOUNT_REACHED(요청은 PENDING 유지) · NEW_GROUP_NAME_REQUIRED(아무것도 안 씀 → 이름 받아 재호출)
 * ⚠️ newGroupName 은 CASE C/D 에서만 필요하고, 그때만 화면이 묻는다. 빈 문자열은 넘기지 않는다.
 */
export async function acceptTripJoinRequest(
  requestId: string,
  newGroupName?: string,
): Promise<AcceptTripJoinRequestRow> {
  const name = newGroupName?.trim();
  const { data, error } = await supabase.rpc('accept_trip_join_request', {
    p_request_id: requestId,
    ...(name ? { p_new_group_name: name } : {}),
  });
  if (error) throw error;
  return single(data, 'accept_trip_join_request');
}

/** 여행장 거절. (docs/12 §8) (invite_id, user_id) 단위로만 재요청을 막는다. token 은 그대로. */
export async function rejectTripJoinRequest(requestId: string): Promise<RejectTripJoinRequestRow> {
  const { data, error } = await supabase.rpc('reject_trip_join_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return single(data, 'reject_trip_join_request');
}

// ── inviteId 재진입 (docs/14 §5 · migration 20260916000001 ⑨) ────────────────
// 알림 상세 "여행 초대 확인하기" 에서 온다. 앱은 raw token 을 모른다 — 서버가 inviteId 로
// token 을 찾아 위 함수를 그대로 부르고, token 은 응답에 없다. 응답 형태는 token 판과 같다.
// 서버 게이트: 그 invite 의 INVITE_RECEIVED 알림 소유자 · 그 invite 로 요청한 적 있는 사람 ·
// 그 여행 ACTIVE 멤버만. 아니면 resolve 는 NOT_FOUND 행, request 는 NOT_FOUND 예외.

/** resolve_trip_invite 와 같은 한 행. 게이트를 못 넘으면 invite_state = 'NOT_FOUND'. */
export async function resolveTripInviteById(inviteId: string): Promise<ResolveTripInviteByIdRow> {
  const { data, error } = await supabase.rpc('resolve_trip_invite_by_id', { p_invite_id: inviteId });
  if (error) throw error;
  return single(data, 'resolve_trip_invite_by_id');
}

/** request_trip_join 과 같은 한 행 · 같은 오류 코드. */
export async function requestTripJoinByInvite(inviteId: string): Promise<RequestTripJoinByInviteRow> {
  const { data, error } = await supabase.rpc('request_trip_join_by_invite', { p_invite_id: inviteId });
  if (error) throw error;
  return single(data, 'request_trip_join_by_invite');
}
