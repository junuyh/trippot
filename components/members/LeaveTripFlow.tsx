// ============================================================================
// 나가기 시트 세 개를 한 덩어리로 그린다. (MEM-01 · 02 · 04)
//
// ⚠️ **두 화면이 시트를 각각 배선하지 않게 하려고 있다.** 여행 홈과 모임 상세가
//    각자 props 를 이어 붙이면, 한쪽에만 조건이 붙거나 한쪽만 고쳐진다.
//    leaveTrip 이 둘로 갈렸던 것과 같은 일이다. (2026-09-14)
//
// ⚠️ MEM-03(나가기 완료)은 여기 없다. 그건 화면을 통째로 덮는 전체 화면이라
//    각 화면이 early return 으로 그린다. 돌아갈 곳도 진입점마다 다르다.
//
// ⚠️ supabase 도 track() 도 부르지 않는다. 값은 useLeaveTrip 이 만든다.
// ============================================================================
import type { useLeaveTrip } from '@/lib/hooks/useLeaveTrip';

import { DelegateLeaderSheet } from './DelegateLeaderSheet';
import { LeaveCancelsTripSheet } from './LeaveCancelsTripSheet';
import { LeaveTripSheet } from './LeaveTripSheet';

type Props = {
  leave: ReturnType<typeof useLeaveTrip>;
  /** 모임 이름. 나가기 시트의 '모임에서도 나가기' 문구에 쓴다 */
  groupName: string;
};

export function LeaveTripFlow({ leave, groupName }: Props) {
  return (
    <>
      <LeaveTripSheet
        visible={leave.sheet === 'leave'}
        onClose={leave.close}
        onDismiss={leave.onDismiss}
        mode={leave.mode}
        destination={leave.destination}
        groupName={groupName}
        alsoLeaveGroup={leave.alsoLeaveGroup}
        onChangeAlsoLeaveGroup={leave.setAlsoLeaveGroup}
        fundBalanceLabel={leave.fundBalanceLabel}
        onLeave={leave.handleLeave}
        onOpenDelegate={leave.openDelegate}
        onInvite={leave.onInvite}
        onCancelTrip={leave.onCancelTrip}
        leaving={leave.busy}
      />

      <DelegateLeaderSheet
        visible={leave.sheet === 'delegate'}
        onClose={leave.close}
        onDismiss={leave.onDismiss}
        candidates={leave.delegateCandidates}
        selectedMemberId={leave.delegateId}
        onSelect={leave.setDelegateId}
        fundBalanceLabel={leave.fundBalanceLabel}
        onSubmit={leave.handleDelegateAndLeave}
        submitting={leave.busy}
      />

      {/*
        MEM-04. 나가기를 막지 않는다 (POL-MEM-013) — 경고만 하고 보낸다.
        한 명이 취소 요청만 걸어두고 다른 사람을 여행에 묶어둘 수 있으면 안 된다.
      */}
      <LeaveCancelsTripSheet
        visible={leave.sheet === 'leaveCancels'}
        onClose={leave.close}
        onDismiss={leave.onDismiss}
        destination={leave.destination}
        agreedNames={leave.agreedNames}
        onLeave={leave.handleLeave}
        leaving={leave.busy}
      />
    </>
  );
}
