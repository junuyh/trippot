// ============================================================================
// 여행 초대 받는 흐름 — /invite/:token 과 /invite/by/:inviteId 가 같이 쓰는 화면 몸통
//
// 2026-09-16 · app/invite/[token].tsx 의 본문을 그대로 옮겼다. 다른 점은 하나다:
// 초대를 확인(resolve)하고 요청(request)하는 함수를 **밖에서 받는다.**
//   token 판   resolveTripInvite(token)      · requestTripJoin(token)
//   inviteId 판 resolveTripInviteById(id)    · requestTripJoinByInvite(id)   (docs/14 §5 · 알림 재진입)
// 화면 상태 · 분기 · 오류 처리는 두 판이 완전히 같다. UI 를 두 번 만들지 않는다.
//
// ⚠️ 이 파일은 supabase 를 직접 부르지 않는다. 주입된 함수만 부른다. (CLAUDE.md §9)
//    track() 도 부르지 않는다. (SCREENS 상수 없음)
// ⚠️ 개발용 미리보기(previewToken · __DEV__ · isPreview)는 token 판만 넘긴다.
// ============================================================================
import { format, parseISO } from 'date-fns';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { previewInviteState } from '@/lib/invite/previewInvite';
import {
  TRIP_JOIN_ERROR,
  tripJoinErrorCode,
  type RequestTripJoinRow,
  type ResolveTripInviteRow,
} from '@/lib/supabase/queries/tripJoinRequests';
import { notifyNotificationsChanged } from '@/lib/notifications/unreadNotifications';
import { markInviteNotificationsAsRead } from '@/lib/supabase/queries/notifications';

import { InviteLandingView } from './InviteLandingView';
import { InviteUnavailableView } from './InviteUnavailableView';
import { JoinWaitingView } from './JoinWaitingView';
import type { InviteMyState, InviteRouteState } from './types';

type Props = {
  /** 초대 확인. 서버 resolve_trip_invite(_by_id) 한 행. */
  resolve: () => Promise<ResolveTripInviteRow>;
  /** 참여 요청. 서버 request_trip_join(_by_invite) 한 행. */
  request: () => Promise<RequestTripJoinRow>;
  /** 개발용 미리보기 토큰(preview-*). token 판만 넘긴다. inviteId 판은 undefined. */
  previewToken?: string;
  /** 식별자가 아예 없을 때(잘못된 링크). NOT_FOUND 로 그린다. */
  missing?: boolean;
  /** inviteId 판(/invite/by/:inviteId)만 넘긴다. INVITE_RECEIVED 읽음 처리를 정확한 행으로 좁히는 데 쓴다. */
  inviteId?: string;
  /**
   * 확인 결과 · 요청 뒤 상태가 정해질 때마다 알린다. (2026-09-16 · PR #111 pending invite)
   * token 판이 기기 보관(lib/invite/pendingInvites)을 맞추는 데 쓴다. 화면 흐름과 무관하다.
   */
  onStateChange?: (next: InviteRouteState) => void;
};

/** 서버 my_state 문자열 → 화면 타입. 모르는 값은 NONE 으로 — 요청 CTA 가 가장 안전한 기본이다. */
function toMyState(value: string): InviteMyState {
  return value === 'ACTIVE' || value === 'LEFT' || value === 'PENDING' || value === 'REJECTED'
    ? value
    : 'NONE';
}

/**
 * resolve_trip_invite 한 행 → 라우트 상태. 서버 값을 그대로 담는다.
 * ⚠️ headcount 도달은 invite_state 가 아니다. VALID 그대로 두고 화면이 인원으로 안내한다.
 */
function toRouteState(row: ResolveTripInviteRow): InviteRouteState {
  switch (row.invite_state) {
    case 'VALID':
      return {
        kind: 'VALID',
        preview: {
          destination: row.destination,
          startDate: row.start_date,
          endDate: row.end_date,
          headcount: row.headcount,
          activeMemberCount: row.active_member_count,
          ownerDisplayName: row.inviter_name,
        },
        myState: toMyState(row.my_state),
        myRequestId: row.my_request_id ?? null,
      };
    case 'EXPIRED':
      return { kind: 'EXPIRED' };
    case 'REVOKED':
      return { kind: 'REVOKED' };
    // 취소 · 삭제된 여행. 서버가 여행 정보를 비워서 보낸다. (2026-09-22 · migration 20260922000011)
    case 'CANCELED':
      return { kind: 'CANCELED' };
    default:
      return { kind: 'NOT_FOUND' };
  }
}

/** 'YYYY-MM-DD' 두 개 → '10.02 – 10.05'. 여행 정보 수정 화면과 같은 표기다. */
function toPeriodLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${format(parseISO(start), 'M.d')}–${format(parseISO(end), 'M.d')}`;
}

export function InviteFlowScreen({
  resolve,
  request,
  previewToken,
  missing = false,
  inviteId,
  onStateChange,
}: Props) {
  const { isPreview, status } = useAuth();
  const userId = useCurrentUserId();

  const [state, setState] = useState<InviteRouteState>({ kind: 'LOADING' });
  const [requesting, setRequesting] = useState(false);
  /** resolve 가 준 여행 id. '여행으로 가기' 에만 쓴다. 미리보기에는 없다. */
  const [tripId, setTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (missing) {
      setState({ kind: 'NOT_FOUND' });
      return;
    }

    // 개발용 미리보기 — 실제 로그인 없이 화면만 본다. production 에는 이 분기가 없다.
    // 미리보기에는 세션이 없어 RPC 가 AUTH_REQUIRED 를 내므로 preview-* 토큰만 그린다.
    if (__DEV__ && isPreview) {
      const preview = previewToken ? previewInviteState(previewToken) : null;
      const next = preview ?? { kind: 'NOT_CONNECTED' as const };
      setState(next);
      onStateChange?.(next);
      return;
    }

    setState({ kind: 'LOADING' });
    try {
      const row = await resolve();
      const next = toRouteState(row);
      setTripId(row.trip_id ?? null);
      setState(next);
      onStateChange?.(next);
      // 초대 내용을 실제로 봤다 — 같은 초대의 INVITE_RECEIVED 알림을 읽음으로. (읽음 정책 2026-09-17)
      // 화면 흐름과 분리한다: 실패해도 초대 화면은 그대로다. 미리보기(isPreview)는 위에서 이미 갈라졌다.
      if (userId && row.invite_state === 'VALID') {
        markInviteNotificationsAsRead(userId, { inviteId, tripId: row.trip_id })
          .then(() => notifyNotificationsChanged())
          .catch(() => undefined);
      }
    } catch {
      // 네트워크 · 세션 없음 등. 예외 객체를 화면에 그대로 내보내지 않는다.
      setState({ kind: 'ERROR' });
    }
  }, [missing, isPreview, previewToken, resolve, onStateChange, userId, inviteId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 참여 요청. request → PENDING → INV-03. 이미 PENDING 이면 같은 행(멱등).
   *
   * 서버가 거절한 이유가 화면 상태로 바뀌는 것들은 상태만 바꾼다:
   *   ALREADY_MEMBER      → ACTIVE 로 (그새 수락됐다)
   *   REJECTED_FOR_INVITE → REJECTED 로 (같은 링크로는 재요청 불가)
   *   INVITE_NOT_VALID    → 다시 확인 (만료·폐기)
   * 그 밖은 실패 안내만 하고 CTA 는 그대로 둔다. 화면 전체를 다시 그리지 않는다.
   */
  const handleRequestJoin = useCallback(async () => {
    if (state.kind !== 'VALID' || requesting || missing) return;

    // 미리보기 — 서버에 아무것도 쓰지 않고 화면 전환만 흉내 낸다.
    if (__DEV__ && isPreview) {
      const next = { ...state, myState: 'PENDING' as const, myRequestId: 'preview' };
      setState(next);
      onStateChange?.(next);
      return;
    }

    setRequesting(true);
    try {
      const row = await request();
      const next = { ...state, myState: 'PENDING' as const, myRequestId: row.request_id };
      setState(next);
      onStateChange?.(next);
    } catch (error) {
      const code = tripJoinErrorCode(error);
      if (code === TRIP_JOIN_ERROR.ALREADY_MEMBER) {
        const next = { ...state, myState: 'ACTIVE' as const, myRequestId: null };
        setState(next);
        onStateChange?.(next);
      } else if (code === TRIP_JOIN_ERROR.REJECTED_FOR_INVITE) {
        const next = { ...state, myState: 'REJECTED' as const, myRequestId: null };
        setState(next);
        onStateChange?.(next);
      } else if (code === TRIP_JOIN_ERROR.INVITE_NOT_VALID || code === TRIP_JOIN_ERROR.NOT_FOUND) {
        void load();
      } else if (code === TRIP_JOIN_ERROR.TRIP_NOT_OPEN) {
        // 취소 · 삭제된 여행이다. 초대 링크 자체는 살아 있어 resolve 는 VALID 로 오지만
        // (docs/12 §3 · invite_state 는 초대의 상태다) 서버는 요청을 받지 않는다.
        // 다시 눌러도 영원히 같다 — "잠시 후 다시" 대신 링크를 쓸 수 없다고 알린다.
        // ⚠️ 여행이 취소됐다고 말하지 않는다. 실패 이유에 여행 정보를 붙이지 않는다. (POL-INV-021)
        const next = { kind: 'REVOKED' as const };
        setState(next);
        onStateChange?.(next);
      } else {
        Alert.alert('참여 의사를 보내지 못했어요', '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setRequesting(false);
    }
  }, [state, requesting, missing, isPreview, request, load, onStateChange]);

  const periodLabel = useMemo(
    () =>
      state.kind === 'VALID'
        ? toPeriodLabel(state.preview.startDate, state.preview.endDate)
        : null,
    [state],
  );

  const screen = <Stack.Screen options={{ title: '여행 초대' }} />;
  const goHome = () => router.replace('/');

  if (state.kind === 'LOADING' || status === 'loading') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <Loading message="초대를 확인하는 중…" />
      </View>
    );
  }

  if (state.kind === 'ERROR') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <ErrorState message="초대를 확인하지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  // 미리보기인데 preview-* 토큰이 아닐 때만 온다. 가짜 초대를 그리지 않는다.
  if (state.kind === 'NOT_CONNECTED') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <EmptyState
          icon="mail-open-outline"
          title="개발용 둘러보기에서는 초대를 확인할 수 없어요"
          description="실제 초대 링크는 카카오 로그인 후 확인할 수 있어요. 화면 확인은 개발용 미리보기 토큰을 써 주세요."
          actionLabel="홈으로"
          onAction={goHome}
        />
      </View>
    );
  }

  if (
    state.kind === 'EXPIRED' ||
    state.kind === 'REVOKED' ||
    state.kind === 'NOT_FOUND' ||
    state.kind === 'CANCELED'
  ) {
    return (
      <>
        {screen}
        <InviteUnavailableView reason={state.kind} onGoHome={goHome} />
      </>
    );
  }

  // ── VALID ─────────────────────────────────────────────────────────────
  // my_state 로 세 갈래다. 링크는 유효하다 — 인원이 찼어도 여기 온다.
  if (state.myState === 'REJECTED') {
    return (
      <>
        {screen}
        <InviteUnavailableView reason="ALREADY_REJECTED" onGoHome={goHome} />
      </>
    );
  }

  if (state.myState === 'PENDING') {
    return (
      <>
        {screen}
        <JoinWaitingView
          ownerDisplayName={state.preview.ownerDisplayName}
          destination={state.preview.destination}
          periodLabel={periodLabel}
          // 요청 취소 버튼은 확정 디자인상 두지 않는다. (래퍼 cancelTripJoinRequest 는 있다)
        />
      </>
    );
  }

  return (
    <>
      {screen}
      <InviteLandingView
        preview={state.preview}
        periodLabel={periodLabel}
        // 가드가 미로그인을 /login 으로 보내므로 여기서는 사실상 항상 true 다.
        signedIn={userId !== null}
        myState={state.myState}
        onRequestJoin={handleRequestJoin}
        onDecline={goHome}
        // 이미 참여 중이면 여행 홈으로. 미리보기에서는 실제 trip id 가 없어 홈으로 보낸다.
        onGoToTrip={tripId ? () => router.replace(`/trips/${tripId}`) : goHome}
        requesting={requesting}
      />
    </>
  );
}
