// ============================================================================
// GROUP-01 · /groups · MVP
// 기준: docs/09_IA_v1.md §3-1, docs/04_화면목록_v3.md GROUP-01,
//       docs/03_요구사항정의서_v1.md POL-NAV-001
//
// 카드에 담는 것: 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수
// 담지 않는 것: 대표 모임 여행 유형([고도화]), 생성일 · 대표 이미지 · More(IA 에 없음)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ 에 있다. (CLAUDE.md 9장)
//
// 헤더·탭 라벨 제목은 app/(tabs)/_layout.tsx 에서 정한다.
// 여기서 <Stack.Screen options={{ title }} /> 을 쓰면 Tabs 스크린 옵션을 덮어써서
// 하단 탭 라벨까지 바뀐다.
//
// TODO: 정렬 토글(여행 생성일 순 / 사용자 지정 순)과 편집 모드는 아직 넣지 않았다.
//       사용자 지정 순서 저장 구조와 삭제 정책이 미확정이다. (docs/README.md §5)
//       createdAt 은 '여행 생성일 순' 정렬에 쓰려고 미리 담아둔다.
// ============================================================================
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { GroupTravelCardList, type GroupTravelCardData } from '@/components/groups';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { ENTRY_POINT } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import {
  getGroupMemberCount,
  getGroupTrips,
  getMyGroups,
} from '@/lib/supabase/queries/groups';

type LoadState = 'loading' | 'ready' | 'error';

export default function ScreenGROUP01() {
  useScreenView(SCREENS.GROUP_LIST);

  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [groups, setGroups] = useState<GroupTravelCardData[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      // TODO: 로그인 연동 시 교체
      const userId = DEV_USER_ID;

      const myGroups = await getMyGroups(userId);

      // 모임 수만큼 상세 조회가 나간다. 모임은 사람당 많아야 몇 개라 그대로 둔다.
      // 수십 개가 되면 한 번에 가져오는 쿼리로 바꾼다.
      const items = await Promise.all(
        myGroups.map(async (group): Promise<GroupTravelCardData> => {
          // 진행 중(PLANNING·TRAVELING) / 지난(ENDED·SETTLED) 분류는 쿼리가 한다.
          // HOME-01 과 같은 기준이다. (app/(tabs)/index.tsx)
          const [memberCount, trips] = await Promise.all([
            // 인원은 모임원 데이터에서 센 결과다. 사용자가 직접 넣는 값이 아니다.
            getGroupMemberCount(group.id),
            getGroupTrips(group.id),
          ]);

          return {
            groupId: group.id,
            name: group.name,
            createdAt: group.created_at,
            memberCount,
            ongoingTrips: trips.ongoing.map((trip) => ({
              tripId: trip.id,
              destination: trip.destination,
              startDate: trip.start_date,
              endDate: trip.end_date,
            })),
            pastTripCount: trips.past.length,
          };
        }),
      );

      setGroups(items);
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, []);

  // 여행 생성에서 모임을 새로 만들고 탭으로 돌아오면 목록이 달라져 있다.
  // useEffect 로는 최초 1회만 불려서 방금 만든 모임이 안 보인다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function handlePressGroup(groupId: string) {
    // 홈·모임·마이페이지 어디서 눌러도 같은 모임 상세로 간다. (docs/03 POL-NAV-001)
    router.push(`/groups/${groupId}`);
  }

  if (loadState === 'loading') {
    return <Loading message="모임을 불러오고 있어요" />;
  }

  if (loadState === 'error') {
    return <ErrorState message="모임 목록을 불러오지 못했어요." onRetry={() => void load()} />;
  }

  if (groups.length === 0) {
    // 모임은 여행 생성의 '누구와' 단계에서 만든다. 별도 모임 생성 화면은 없다.
    // (docs/09_IA_v1.md §2-1)
    return (
      <EmptyState
        icon="people-outline"
        title="아직 참여 중인 모임이 없어요"
        description="여행을 만들 때 모임을 함께 만들면 여기에 모여요."
        actionLabel="새 여행 만들기"
        onAction={() => router.push(`/trips/new/owner?entryPoint=${ENTRY_POINT.EMPTY_STATE}`)}
      />
    );
  }

  return <GroupTravelCardList groups={groups} onPressGroup={handlePressGroup} />;
}
