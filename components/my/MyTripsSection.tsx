import { View } from 'react-native';

import { ConfirmModal } from '@/components/mypage';
import { ErrorState, Loading } from '@/components/ui';
import type { MyTripsSectionModel } from '@/lib/hooks/useMyTrips';

import { MyTripListView } from './MyTripListView';

type Props = MyTripsSectionModel & {
  /** 목록 스크롤의 아래 여백(pt). 떠 있는 하단 탭바가 있는 화면(/groups)에서만 넘긴다. 없으면 MY-02 기본값. */
  contentBottomPadding?: number;
};

/**
 * 내 여행 섹션 — 목록 + 되돌리기 팝업 + 나간 여행 안내. (2026-09-21)
 *
 * MY-02(/me/trips)와 모임 탭 [여행](/groups?tab=trips)이 같은 섹션을 그린다. 데이터·상태는 useMyTrips 가 준다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 * ⚠️ 헤더를 그리지 않는다. MY-02 는 Stack 헤더, 모임 탭은 화면 파일의 Header + 상단 탭이 담당한다.
 */
export function MyTripsSection({
  loadState,
  retry,
  filter,
  changeFilter,
  visible,
  preparingRestoreTripId,
  restoreTarget,
  restoreDescription,
  restoring,
  cancelRestore,
  confirmRestore,
  leftNoticeOpen,
  closeLeftNotice,
  pressTrip,
  pressCreateTrip,
  contentBottomPadding,
}: Props) {
  // 로딩·오류도 목록과 같은 바탕(bg-gray-50). 상태가 바뀔 때 배경색이 튀지 않는다.
  if (loadState === 'loading') {
    return (
      <View className="flex-1 bg-gray-50">
        <Loading message="여행을 불러오고 있어요" />
      </View>
    );
  }
  if (loadState === 'error') {
    return (
      <View className="flex-1 bg-gray-50">
        <ErrorState message="여행을 불러오지 못했어요." onRetry={retry} />
      </View>
    );
  }

  return (
    <>
      <MyTripListView
        trips={visible}
        filter={filter}
        onChangeFilter={changeFilter}
        onPressTrip={pressTrip}
        onPressCreateTrip={pressCreateTrip}
        preparingRestoreTripId={preparingRestoreTripId}
        contentBottomPadding={contentBottomPadding}
      />

      {/*
        되돌리기 확인 팝업. (2026-09-16) 바텀시트가 아니라 가운데 팝업 — 카드를 누르면 바로 묻는 자리라 짧게 끝낸다.
        '항상 거친다' 는 지킨다(POL-CXL-036). 계좌 내역은 건수와 반영 후 남은 돈만 적는다(POL-CXL-011).
      */}
      <ConfirmModal
        visible={restoreTarget !== null}
        title={`${restoreTarget?.trip.destination ?? '여행'} 여행을 되돌릴까요?`}
        description={restoreDescription}
        confirmLabel="되돌리기"
        centerDescription
        busy={restoring}
        onCancel={cancelRestore}
        onConfirm={confirmRestore}
      />

      <ConfirmModal
        visible={leftNoticeOpen}
        title="나간 여행이에요"
        description="이 여행은 더 이상 볼 수 없어요."
        confirmLabel="확인"
        hideCancel
        busy={false}
        onCancel={closeLeftNotice}
        onConfirm={closeLeftNotice}
      />
    </>
  );
}
