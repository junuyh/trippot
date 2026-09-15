// ============================================================================
// 여행에서 나가기 — 두 진입점이 함께 쓰는 흐름 하나
//
//   여행 홈 > 설정 > 여행 나가기
//   모임 상세 > 여행 카드 스와이프 > 나가기
//
// ⚠️⚠️ **같은 흐름을 두 번 짜지 않는다.** ⚠️⚠️
//    이 훅이 생긴 이유가 그것이다. 나가기가 두 곳에 따로 구현돼 있었고,
//    모임 상세 쪽은 여행장 판정도 취소 동의 재판정도 하지 않았다. 그래서
//    오사카 여행의 여행장이 그냥 빠져나갔고, 그 여행은 초대를 수락할 사람도
//    위임받을 사람도 없는 상태가 됐다. (2026-09-14 · 다빈 지시)
//
// ⚠️ 화면은 상태를 만들지 않는다. 여기서 만든 값을 그대로 컴포넌트에 넘긴다.
//    화면마다 `sheet` 를 따로 들면 시트 두 개가 동시에 열린다.
//
// ⚠️ DB Query 를 직접 쓰지 않는다. queries/ 의 함수만 부른다. (CLAUDE.md §7)
//
// ⚠️ 데이터는 **나가기를 누른 시점에** 읽는다. 화면 로드 때가 아니다.
//    나가기는 빈번한 동작이 아니고, 미리 읽어 두면 여행 홈과 모임 상세가
//    서로 다른 시점의 값을 들고 판정하게 된다. (다빈 결정)
// ============================================================================
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

import type { LeaveMode, TripMemberItem } from '@/components/members';
import { FUND_SOURCE_TYPE } from '@/lib/constants/status';
import { buildCancelFundSnapshot, resolveVoteOutcome } from '@/lib/trip/cancelPolicy';
import { canLeaveTrip, leaveModeOf } from '@/lib/trip/tripLeader';
import { getBudgetByTripId, getBudgetCategories } from '@/lib/supabase/queries/budgets';
import { getTravelFund } from '@/lib/supabase/queries/funds';
import { getFundTotals } from '@/lib/supabase/queries/transactions';
import {
  getActiveCancelRequest,
  getVoteProgress,
  recheckAfterMemberLeft,
  type CanceledFundSnapshot,
} from '@/lib/supabase/queries/tripCancel';
import {
  delegateAndLeave,
  leaveTrip,
  listActiveTripMembers,
} from '@/lib/supabase/queries/tripMembers';
import { getTripById, type Trip } from '@/lib/supabase/queries/trips';

/** 한 번에 하나만 열린다 */
export type LeaveSheet = null | 'leave' | 'delegate' | 'leaveCancels';

/** MEM-03 에 넘길 값. null 이면 아직 안 나갔다 */
export type LeaveDone = {
  variant: 'left' | 'delegated' | 'canceled';
  alsoLeftGroup: boolean;
  newLeaderName?: string;
};

/**
 * 시트가 완전히 닫히기를 기다리는 시간. **Android 전용 대비책이다.**
 *
 * ⚠️ iOS 는 Modal 의 onDismiss 를 쓴다. 시간으로 어림잡으면 틀린다 —
 *    BottomSheet 의 닫기 애니메이션이 끝난 뒤에도 iOS 가 네이티브 Modal 을
 *    내리는 시간이 더 있다. 그 안에 새 Modal 을 띄우면 조용히 무시되고,
 *    보이지 않는 Modal 이 화면 전체의 터치를 삼킨다. (2026-09-13 확인)
 */
const SHEET_SWAP_MS = 240;

type Options = {
  /** 나가기를 마친 뒤. 목록 새로고침 같은 것이 필요하면 여기서 한다 */
  onLeft?: () => void;
  /**
   * 막혔을 때 '여행 취소하기' 를 눌렀을 때.
   *
   * ⚠️ 여행 홈은 자기 CXL 시트를 연다. 모임 상세는 CXL 흐름이 없으므로
   *    여행 홈으로 보낸다. **바로 취소하지 않는다** — CXL-01(사유) →
   *    CXL-03(확인)을 거친다. (POL-CXL-060)
   */
  onCancelTrip?: (tripId: string) => void;
  /** 막혔을 때 '멤버 초대하기' 를 눌렀을 때 */
  onInvite?: (tripId: string) => void;
};

export function useLeaveTrip(options: Options = {}) {
  const { onLeft, onCancelTrip, onInvite } = options;

  const [sheet, setSheetState] = useState<LeaveSheet>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LeaveDone | null>(null);

  /** 나가기 시트의 '모임에서도 나갈지'. null 이면 아직 안 골랐다 */
  const [alsoLeaveGroup, setAlsoLeaveGroup] = useState<boolean | null>(null);
  /** 위임 대상 memberId */
  const [delegateId, setDelegateId] = useState<string | null>(null);

  /** 나가기를 누른 시점에 읽은 값들 */
  const [ctx, setCtx] = useState<{
    trip: Trip;
    userId: string;
    members: TripMemberItem[];
    delegateCandidates: TripMemberItem[];
    otherActiveCount: number;
    fundBalanceLabel: string | null;
    fundSnapshot: CanceledFundSnapshot;
    /** 나가면 그 순간 취소가 확정되는가 (POL-MEM-015) */
    leaveCancelsTrip: boolean;
    /** MEM-04 가 이름을 부를, 이미 동의한 사람들 */
    agreedNames: string[];
  } | null>(null);

  const pendingRef = useRef<LeaveSheet>(null);

  /** 시트가 다 내려간 뒤 다음 시트를 연다. 각 시트의 onDismiss 가 부른다 */
  const flushPendingSheet = useCallback(() => {
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;
    setSheetState(next);
  }, []);

  /** 열린 시트를 닫고, 완전히 내려간 뒤 다음 시트를 연다 */
  const openSheetAfterClose = useCallback(
    (next: LeaveSheet) => {
      setSheetState((current) => {
        if (current === null) return next;
        pendingRef.current = next;
        /**
         * ⚠️⚠️ iOS 에서는 **타이머를 걸지 않는다.** ⚠️⚠️
         *    240ms 는 어림값이라 네이티브 Modal 이 다 내려가기 전에 터질 수
         *    있고, 그러면 새 Modal 을 띄우려다 iOS 가 조용히 무시한다.
         *    실제로 '여행장 넘기기' 를 눌러도 MEM-02 가 안 떴다.
         *    (2026-09-14 · 모임 상세에서 확인) iOS 는 Modal 의 onDismiss 가
         *    정확한 신호를 준다. 타이머는 onDismiss 가 없는 Android 몫이다.
         */
        if (Platform.OS !== 'ios') setTimeout(flushPendingSheet, SHEET_SWAP_MS);
        return null;
      });
    },
    [flushPendingSheet],
  );

  const close = useCallback(() => setSheetState(null), []);

  /**
   * 나가기를 시작한다. 필요한 것을 지금 읽고 MEM-01 을 연다.
   *
   * ⚠️ 조회가 실패하면 **시트를 열지 않는다.** 판정에 쓸 값이 없는 채로 열면
   *    "나갈 수 있다" 로 잘못 갈린다.
   */
  const open = useCallback(
    async (tripId: string, userId: string | null) => {
      if (!userId || loading) return;
      setLoading(true);
      setError(null);
      try {
        const trip = await getTripById(tripId);
        if (!trip) throw new Error('NOT_FOUND');

        const [members, budget, fund, totals] = await Promise.all([
          listActiveTripMembers(tripId),
          getBudgetByTripId(tripId),
          getTravelFund(tripId),
          getFundTotals(tripId),
        ]);
        const categories = budget ? await getBudgetCategories(budget.id) : [];

        const items: TripMemberItem[] = members.map((m) => ({
          memberId: m.id,
          userId: m.user_id,
          name: m.name,
          isTripLeader: trip.leader_user_id === m.user_id,
        }));

        /**
         * ⚠️ 미가입 동행자(user_id 가 null)는 세지 않는다. 계정이 없어
         *    여행장이 될 수 없고, 그 사람만 남은 여행은 아무도 손댈 수 없다.
         */
        const others = items.filter((m) => m.userId !== null && m.userId !== userId);

        const fundSnapshot = buildCancelFundSnapshot({
          isAccountFund: fund?.source_type === FUND_SOURCE_TYPE.ACCOUNT,
          currentAmount: fund?.current_amount ?? 0,
          depositTotal: totals.depositTotal,
          actualSpent: categories.reduce((sum, c) => sum + c.actual_amount, 0),
          goalAmount: budget?.target_amount ?? 0,
          headcount: trip.headcount,
        });

        /**
         * 취소 동의 중인가. 나가면 바로 확정되는지까지 본다. (POL-MEM-015)
         *
         * ⚠️ 실패해도 나가기는 막지 않는다. 경고를 못 띄울 뿐이다.
         *    (POL-MEM-013 · 한 명이 요청만 걸어두고 묶어둘 수 없다)
         */
        let leaveCancelsTrip = false;
        let agreedNames: string[] = [];
        try {
          const request = await getActiveCancelRequest(tripId, trip.start_date);
          if (request && request.requested_by !== userId) {
            const progress = await getVoteProgress(request);
            const myVote =
              progress.votes.find((v) => v.user_id === userId)?.vote ?? null;
            leaveCancelsTrip =
              resolveVoteOutcome({
                targetCount: Math.max(0, progress.targetCount - 1),
                agreedCount: Math.max(
                  0,
                  progress.agreedCount - (myVote === 'AGREE' ? 1 : 0),
                ),
                hasDisagree: progress.hasDisagree,
              }) === 'approved';
            agreedNames = progress.votes
              .filter((v) => v.vote === 'AGREE' && v.user_id !== userId)
              .map((v) => v.name);
          }
        } catch {
          // 취소 정보를 못 읽었다. 경고 없이 평범한 나가기로 진행한다
        }

        setCtx({
          trip,
          userId,
          members: items,
          delegateCandidates: others,
          otherActiveCount: others.length,
          fundBalanceLabel:
            fund && fund.current_amount > 0
              ? `${fund.current_amount.toLocaleString('ko-KR')}원`
              : null,
          fundSnapshot,
          leaveCancelsTrip,
          agreedNames,
        });
        setAlsoLeaveGroup(null);
        setDelegateId(null);

        /**
         * ⚠️ 여행장이면 **MEM-02 를 바로 연다.** MEM-01 의 needsDelegate 갈래를
         *    거치지 않는다. (2026-09-14 다빈 결정)
         *
         *    그 화면이 주던 정보는 "여행장이 하는 일" 한 줄뿐이었고, MEM-02 가
         *    이미 '되돌릴 수 없다' 경고를 갖고 있다. 무엇보다 시트→시트 전환이
         *    사라져서 iOS Modal 타이밍 문제를 탈 일이 없어진다 — 실제로 그
         *    전환에서 '여행장 넘기기' 를 눌러도 MEM-02 가 안 뜨는 일이 있었다.
         *
         * ⚠️ 판정을 여기서 한 번 더 하는 게 아니다. 아래 decision 과 같은
         *    함수를 쓴다. ctx 를 막 만든 참이라 그 값을 아직 못 읽어서 직접 부른다.
         */
        const openMode = leaveModeOf(
          canLeaveTrip({
            trip,
            userId,
            isActiveMember: items.some((m) => m.userId === userId),
            otherActiveCount: others.length,
            delegatableCount: others.length,
          }),
        );
        setSheetState(openMode === 'needsDelegate' ? 'delegate' : 'leave');
      } catch {
        setError('여행 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  const decision = ctx
    ? canLeaveTrip({
        trip: ctx.trip,
        userId: ctx.userId,
        isActiveMember: ctx.members.some((m) => m.userId === ctx.userId),
        otherActiveCount: ctx.otherActiveCount,
        delegatableCount: ctx.delegateCandidates.length,
      })
    : null;
  const mode: LeaveMode = decision ? leaveModeOf(decision) : 'member';

  /** 실제로 나간다. 나간 뒤 상태를 DB 에서 다시 읽어 MEM-03 갈래를 정한다 */
  const runLeave = useCallback(
    async (delegateToUserId?: string, delegateToName?: string) => {
      if (!ctx || busy) return;

      /**
       * ⚠️⚠️ 위임 경로에서도 '모임에서도 나갈지' 를 **묻는다.** ⚠️⚠️
       *    한동안 false 로 고정했었다. 그런데 이 앱에서 **모임을 나가는 통로가
       *    나가기 시트뿐이다** — 모임 상세에도 마이페이지에도 모임 나가기가
       *    없다. 고정해 두면 여행장이 위임하고 나가는 순간 모임에서 나갈
       *    방법이 영영 사라진다. (2026-09-15 다빈 지적)
       *    선택지는 MEM-02 가 그린다.
       *
       * ⚠️ 개인 여행에는 나갈 모임이 없다. 그때는 묻지 않고 false 로 둔다.
       *    안 그러면 고를 수 없는 값을 기다리며 버튼이 영영 안 눌린다.
       */
      const alsoLeave = ctx.trip.group_id === null ? false : alsoLeaveGroup;
      if (alsoLeave === null) return;
      setBusy(true);
      setError(null);
      try {
        if (delegateToUserId) {
          await delegateAndLeave({
            tripId: ctx.trip.id,
            fromUserId: ctx.userId,
            toUserId: delegateToUserId,
            alsoLeaveGroup: alsoLeave,
            groupId: ctx.trip.group_id,
          });
        } else {
          await leaveTrip({
            tripId: ctx.trip.id,
            userId: ctx.userId,
            alsoLeaveGroup: alsoLeave,
            groupId: ctx.trip.group_id,
          });
        }

        /**
         * ⚠️ 결과를 **DB 를 다시 읽어서** 정한다. 위 leaveCancelsTrip 은 시트를
         *    열 때 계산한 값이라, 그 사이 다른 사람이 동의하거나 반대했으면
         *    틀린다. 경고를 띄울지 정할 때만 쓰고 결과 표시에는 쓰지 않는다.
         * ⚠️ 실패해도 나가기는 이미 끝났다. 평범한 나가기로 보여준다.
         */
        const outcome = await recheckAfterMemberLeft({
          tripId: ctx.trip.id,
          tripStartDate: ctx.trip.start_date,
          leftUserId: ctx.userId,
          fundSnapshot: ctx.fundSnapshot,
        }).catch(() => 'NONE' as const);

        setSheetState(null);
        setDone(
          outcome === 'CANCELED'
            ? { variant: 'canceled', alsoLeftGroup: alsoLeave }
            : delegateToUserId
              ? {
                  variant: 'delegated',
                  alsoLeftGroup: alsoLeave,
                  newLeaderName: delegateToName,
                }
              : { variant: 'left', alsoLeftGroup: alsoLeave },
        );
        onLeft?.();
      } catch {
        setError('나가지 못했어요. 잠시 후 다시 시도해 주세요.');
        setBusy(false);
      }
    },
    [alsoLeaveGroup, busy, ctx, onLeft],
  );

  const handleLeave = useCallback(() => {
    // 나가면 바로 취소되는 경우에만 MEM-04 를 거친다 (POL-MEM-015)
    if (ctx?.leaveCancelsTrip && sheet === 'leave') {
      openSheetAfterClose('leaveCancels');
      return;
    }
    void runLeave();
  }, [ctx, openSheetAfterClose, runLeave, sheet]);

  const handleDelegateAndLeave = useCallback(() => {
    const target = ctx?.delegateCandidates.find((c) => c.memberId === delegateId);
    if (!target?.userId) return;
    void runLeave(target.userId, target.name);
  }, [ctx, delegateId, runLeave]);

  /** MEM-03 을 닫는다. 화면이 돌아갈 곳을 정한다 */
  const clearDone = useCallback(() => setDone(null), []);

  return {
    open,
    loading,
    error,
    setError,

    // 시트
    sheet,
    close,
    onDismiss: flushPendingSheet,
    busy,

    // MEM-01
    mode,
    destination: ctx?.trip.destination ?? '여행',
    isGroupTrip: Boolean(ctx?.trip.group_id),
    fundBalanceLabel: ctx?.fundBalanceLabel ?? null,
    alsoLeaveGroup,
    setAlsoLeaveGroup,
    handleLeave,
    openDelegate: () => openSheetAfterClose('delegate'),
    onInvite: () => ctx && onInvite?.(ctx.trip.id),
    onCancelTrip: () => {
      const tripId = ctx?.trip.id;
      setSheetState(null);
      if (tripId) onCancelTrip?.(tripId);
    },

    // MEM-02
    delegateCandidates: ctx?.delegateCandidates ?? [],
    delegateId,
    setDelegateId,
    handleDelegateAndLeave,

    // MEM-04
    agreedNames: ctx?.agreedNames ?? [],

    // MEM-03
    done,
    clearDone,
  };
}
