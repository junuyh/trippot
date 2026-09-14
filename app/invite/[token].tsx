// ============================================================================
// 여행 초대 받는 화면  ·  /invite/:token   (INV-02 초대 확인 · INV-03 승인 대기)
//
// 기준: docs/10_여행초대정책_v2.md §6 · §11 / docs/12_여행초대_승인_RPC계약_v1.md §3 · §4
//
// 흐름
//   링크 열기 → (미로그인이면 /login?next=/invite/:token → 카카오 → 여기로 복귀)
//   → 초대 확인(resolve) → INV-02 → [참여 요청] → PENDING → INV-03 승인 대기
//
// 화면 상태는 서버 resolve_trip_invite 의 invite_state · my_state 와 같은 모양
// (InviteRouteState)이다. 서버 결과를 그대로 담는다.
//
// 서버 연결 (2026-09-14 · PR #93 이 trippot-dev 에 적용됨)
//   resolve_trip_invite(token)  → InviteRouteState   (lib/supabase/queries/tripJoinRequests)
//   request_trip_join(token)    → PENDING → INV-03
//   앱은 trip_invites · trip_join_requests 를 직접 읽지 않는다. RPC 한 경로다.
//   INV-03 의 요청 취소 버튼은 확정 디자인상 숨긴 채 둔다(cancel 래퍼만 있다).
//
// ⚠️ 개발용 미리보기(isPreview · __DEV__)에서만 preview-* 토큰으로 각 상태를 그린다.
//    production 번들에는 __DEV__ 가 false 라 이 분기가 없다. (lib/invite/previewInvite)
//
// ⚠️ 여기서 보여주는 건 여행지 · 일정 · 예정/참여 인원 · 초대자 이름까지다.
//    예산 · 금액 · 계좌 · 멤버 목록은 InvitePreview 타입에 없어 그릴 수 없다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고 events.ts 는
//    공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { format, parseISO } from 'date-fns';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import {
  InviteLandingView,
  InviteUnavailableView,
  JoinWaitingView,
  type InviteMyState,
  type InviteRouteState,
} from '@/components/invite';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { previewInviteState } from '@/lib/invite/previewInvite';
import {
  TRIP_JOIN_ERROR,
  requestTripJoin,
  resolveTripInvite,
  tripJoinErrorCode,
  type ResolveTripInviteRow,
} from '@/lib/supabase/queries/tripJoinRequests';

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
    default:
      return { kind: 'NOT_FOUND' };
  }
}

/** 'YYYY-MM-DD' 두 개 → '10.02 – 10.05'. 여행 정보 수정 화면과 같은 표기다. */
function toPeriodLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${format(parseISO(start), 'M.d')}–${format(parseISO(end), 'M.d')}`;
}

export default function ScreenInvite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isPreview, status } = useAuth();
  const userId = useCurrentUserId();

  const [state, setState] = useState<InviteRouteState>({ kind: 'LOADING' });
  const [requesting, setRequesting] = useState(false);
  /** resolve 가 준 여행 id. '여행으로 가기' 에만 쓴다. 미리보기에는 없다. */
  const [tripId, setTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'NOT_FOUND' });
      return;
    }

    // 개발용 미리보기 — 실제 로그인 없이 화면만 본다. production 에는 이 분기가 없다.
    // 미리보기에는 세션이 없어 RPC 가 AUTH_REQUIRED 를 내므로 preview-* 토큰만 그린다.
    if (__DEV__ && isPreview) {
      const preview = previewInviteState(token);
      setState(preview ?? { kind: 'NOT_CONNECTED' });
      return;
    }

    setState({ kind: 'LOADING' });
    try {
      const row = await resolveTripInvite(token);
      setTripId(row.trip_id ?? null);
      setState(toRouteState(row));
    } catch {
      // 네트워크 · 세션 없음 등. 예외 객체를 화면에 그대로 내보내지 않는다.
      setState({ kind: 'ERROR' });
    }
  }, [token, isPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 참여 요청. request_trip_join → PENDING → INV-03. 이미 PENDING 이면 같은 행(멱등).
   *
   * 서버가 거절한 이유가 화면 상태로 바뀌는 것들은 상태만 바꾼다:
   *   ALREADY_MEMBER      → ACTIVE 로 (그새 수락됐다)
   *   REJECTED_FOR_INVITE → REJECTED 로 (같은 링크로는 재요청 불가)
   *   INVITE_NOT_VALID    → 다시 확인 (만료·폐기)
   * 그 밖은 실패 안내만 하고 CTA 는 그대로 둔다. 화면 전체를 다시 그리지 않는다.
   */
  const handleRequestJoin = useCallback(async () => {
    if (state.kind !== 'VALID' || requesting || !token) return;

    // 미리보기 — 서버에 아무것도 쓰지 않고 화면 전환만 흉내 낸다.
    if (__DEV__ && isPreview) {
      setState({ ...state, myState: 'PENDING', myRequestId: 'preview' });
      return;
    }

    setRequesting(true);
    try {
      const row = await requestTripJoin(token);
      setState({ ...state, myState: 'PENDING', myRequestId: row.request_id });
    } catch (error) {
      const code = tripJoinErrorCode(error);
      if (code === TRIP_JOIN_ERROR.ALREADY_MEMBER) {
        setState({ ...state, myState: 'ACTIVE', myRequestId: null });
      } else if (code === TRIP_JOIN_ERROR.REJECTED_FOR_INVITE) {
        setState({ ...state, myState: 'REJECTED', myRequestId: null });
      } else if (code === TRIP_JOIN_ERROR.INVITE_NOT_VALID || code === TRIP_JOIN_ERROR.NOT_FOUND) {
        void load();
      } else {
        Alert.alert('참여 요청을 보내지 못했어요', '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setRequesting(false);
    }
  }, [state, requesting, isPreview, token, load]);

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

  if (state.kind === 'EXPIRED' || state.kind === 'REVOKED' || state.kind === 'NOT_FOUND') {
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
