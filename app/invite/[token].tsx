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
// ⚠️ 서버 함수(resolve_trip_invite · request_trip_join)는 PR #93 이 원격에 적용되기
//    전이라 **아직 부르지 않는다.** 존재하지 않는 RPC 를 호출하지 않고, trip_invites 를
//    직접 읽지도 않는다(RLS 상 수신자는 못 읽는다 · 정책상 열지 않는다).
//    그래서 production 경로는 NOT_CONNECTED — "준비 중" 안내만 띄운다.
//
//    TODO(PR #93 적용 후):
//      1. lib/supabase/queries/tripJoinRequests.ts 에 resolve · request 래퍼
//      2. 아래 load() 에서 previewInviteState 대신 resolve 결과 → InviteRouteState
//      3. handleRequestJoin 에서 request_trip_join 호출 → PENDING → INV-03
//      4. JoinWaitingView 에 onCancelRequest 연결 (cancel_trip_join_request)
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
import { View } from 'react-native';

import {
  InviteLandingView,
  InviteUnavailableView,
  JoinWaitingView,
  type InviteRouteState,
} from '@/components/invite';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { useAuth, useCurrentUserId } from '@/lib/auth/AuthProvider';
import { previewInviteState } from '@/lib/invite/previewInvite';

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

  const load = useCallback(() => {
    if (!token) {
      setState({ kind: 'NOT_FOUND' });
      return;
    }

    // 개발용 미리보기 — 실제 로그인 없이 화면만 본다. production 에는 이 분기가 없다.
    if (__DEV__ && isPreview) {
      const preview = previewInviteState(token);
      if (preview) {
        setState(preview);
        return;
      }
    }

    // TODO(PR #93): resolveTripInvite(token) → setState(서버 결과)
    setState({ kind: 'NOT_CONNECTED' });
  }, [token, isPreview]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * 참여 요청.
   * TODO(PR #93): requestTripJoin(token) → 성공 시 PENDING 으로 전환.
   * 지금은 미리보기에서만 화면 전환을 흉내 낸다. 서버에 아무것도 쓰지 않는다.
   */
  const handleRequestJoin = useCallback(() => {
    if (state.kind !== 'VALID' || requesting) return;
    if (__DEV__ && isPreview) {
      setRequesting(true);
      setState({ ...state, myState: 'PENDING', myRequestId: 'preview' });
      setRequesting(false);
    }
  }, [state, requesting, isPreview]);

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
        <ErrorState message="초대를 확인하지 못했어요." onRetry={load} />
      </View>
    );
  }

  // 서버 함수가 아직 없다. 가짜 미리보기를 보여주지 않고 준비 중이라고만 알린다.
  if (state.kind === 'NOT_CONNECTED') {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <EmptyState
          icon="mail-open-outline"
          title="초대 확인은 준비 중이에요"
          description="초대 링크는 받았어요. 링크에서 참가를 요청하고 여행장이 수락하는 흐름을 준비하고 있어요. 곧 여기서 바로 이어져요."
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
          // TODO(PR #93): onCancelRequest → cancelTripJoinRequest(state.myRequestId)
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
        onGoToTrip={goHome}
        requesting={requesting}
      />
    </>
  );
}
