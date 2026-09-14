// ============================================================================
// GROUP-02 모임 상세 · /groups/:groupId · MVP
// 기준: docs/09_IA_v1.md §3-2, docs/03_요구사항정의서_v1.md REQ-GROUP-001,
//       docs/04_화면목록_v3.md GROUP-02
//
// 담는 것: 모임 기본정보 · 멤버 · 연결 계좌 · 진행 중인 여행 · 지난 여행
//          · [이 모임으로 새 여행 만들기]
// 빼는 것: 누적 여행 유형 / 소비 특성 (IA 가 [고도화] 로 표시)
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/groups/ 에 있다. (CLAUDE.md 9장)
//
// TODO: [이 모임으로 새 여행 만들기] 는 지금 entryPoint 만 넘긴다.
//       현재 모임을 TRIP-01 에서 기본 선택하려면 groupId 도 넘겨야 하는데,
//       app/trips/new/owner.tsx 가 groupId param 을 받지 않는다.
//       그 파일은 L 담당이라 여기서 고치지 않는다. 담당자 요청 후 &groupId= 를 붙인다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import {
  AccountTripPickerSheet,
  AllAccountsSheet,
  GroupDetailView,
  GroupRenameModal,
  isActiveTripStatus,
  toGroupTripStatusLabel,
  type GroupAccountItem,
  type GroupDetailData,
} from '@/components/groups';
import type { MyTripItem } from '@/components/my';
import { ConfirmModal } from '@/components/mypage';
import { EmptyState, ErrorState, Loading } from '@/components/ui';
import { SCREENS } from '@/lib/analytics/events';
import { useCurrentUserId } from '@/lib/auth/AuthProvider';
import {
  ENTRY_POINT,
  GROUP_MEMBER_ROLE,
  TRIP_STATUS,
  type TripStatus,
} from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { countryTheme } from '@/lib/constants/countryTheme';
import { findDestinationByName } from '@/lib/constants/destinations';
import { getGroupTripAccounts } from '@/lib/supabase/queries/funds';
import {
  getLeftTrips,
  getMyParticipatingTripIds,
  getOtherActiveTripMemberCount,
  leaveTrip,
} from '@/lib/supabase/queries/trips';
import {
  getGroupById,
  getGroupCanceledTrips,
  getGroupMemberCount,
  getGroupMembers,
  getGroupTrips,
  getTripAmountSummaries,
  updateGroup,
} from '@/lib/supabase/queries/groups';
import { isTripBeforeDeparture } from '@/lib/trip/tripStatus';

type LoadState = 'loading' | 'ready' | 'notFound' | 'denied' | 'error';

export default function ScreenGROUP02() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  useScreenView(SCREENS.GROUP_DETAIL);

  const router = useRouter();
  // 참여 중인 멤버만 이 화면을 볼 수 있다. load() 안에서 확인한다.
  const userId = useCurrentUserId();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  /** 여행을 고르는 시트에 올라온 계좌. null 이면 닫혀 있다. */
  const [pickingAccount, setPickingAccount] = useState<GroupAccountItem | null>(null);
  /** '전체 계좌' 시트. 이 모임의 모든 계좌를 담는다. */
  const [allAccountsOpen, setAllAccountsOpen] = useState(false);
  /** 나가기 확인창에 올라온 여행. null 이면 닫혀 있다. */
  const [leavingTrip, setLeavingTrip] = useState<MyTripItem | null>(null);

  /** 나간 여행 카드를 눌렀을 때 띄우는 안내. 이동하지 않는다. */
  const [leftNoticeOpen, setLeftNoticeOpen] = useState(false);

  // ── 모임 이름 수정 ─────────────────────────────────────────────────────
  // 헤더 연필 → GroupRenameModal(기존) → updateGroup(기존). 새 UI 를 만들지 않는다.
  // GroupMoreMenu 는 대표 이미지·모임원 관리가 아직 없어 띄우지 않는다.
  const [renameOpen, setRenameOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  /**
   * 마지막 참가자라서 나갈 수 없다는 안내. null 이면 닫혀 있다.
   *
   * ⚠️ 나가기 확인창(leavingTrip)과 따로 둔다. 하나는 되돌릴 수 없는 동작을
   *    묻는 창이고, 이건 아무것도 하지 않는 안내다. (2026-09-10)
   */
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) {
      setLoadState('notFound');
      return;
    }

    // 참가 여부·멤버십 확인 모두 로그인한 사용자가 있어야 한다.
    // 가드가 미로그인 상태를 막고 있어 여기서는 사실상 항상 값이 있다.
    if (!userId) return;

    setLoadState('loading');
    try {
      // 모임을 먼저 확인한다. 없는 모임이면 나머지를 조회할 이유가 없다.
      // getGroupById 는 maybeSingle 이라 잘못된 groupId 에도 던지지 않고 null 을 준다.
      const found = await getGroupById(groupId);
      if (!found) {
        setLoadState('notFound');
        return;
      }

      const [memberCount, members, accounts, participating, trips, canceledTrips, myLeftTrips] =
        await Promise.all([
        // 인원 수는 GROUP-01 카드와 같은 기준을 쓴다.
        // ⚠️ getGroupMembers() 는 탈퇴 회원까지 추가로 걸러서 members.length 와
        //    숫자가 다를 수 있다. 이번 화면에서 임의로 맞추지 않는다. (후속 확인)
        getGroupMemberCount(groupId),
        getGroupMembers(groupId),
        getGroupTripAccounts(groupId),
        // 참가 여부는 한 번에 받아 온다. 여행마다 묻지 않는다. (N+1 금지)
        getMyParticipatingTripIds(userId),
        // 진행 중(PLANNING·TRAVELING) / 지난(ENDED·SETTLED) 분류는 쿼리가 한다.
        // HOME-01 과 같은 기준이다.
        getGroupTrips(groupId),
        // 취소됨 탭. **표시만.** 72시간 복구는 다른 담당이다. (docs/11 §6)
        getGroupCanceledTrips(groupId),
        // 내가 나간 여행 id. 탭이 아니라 카드 배지에만 쓴다. MY 와 같은 쿼리다.
        getLeftTrips(userId),
      ]);

      /**
       * ⚠️ 이 모임의 **참여 중(ACTIVE) 멤버만** 상세를 볼 수 있다.
       *    (2026-09-08 확정) LEFT · INVITED · 아예 멤버가 아닌 사람은 막는다.
       *    URL 로 바로 들어와도 여기서 걸린다.
       *
       *    getGroupMembers 가 이미 status = ACTIVE 로 좁혀 읽는다. 그래서
       *    이 목록에 내가 없으면 참여 중이 아니다. 질의를 하나 더 만들지 않는다.
       *
       *    나중에 다시 초대받아 ACTIVE 로 돌아오면 그때부터 다시 보인다.
       *    getGroupTrips 는 trips.group_id 로만 읽으므로 재가입 이전 여행까지
       *    준비 중·여행 중·지난 여행 모두 그대로 보인다.
       */
      if (!userId || !members.some((member) => member.user.id === userId)) {
        setLoadState('denied');
        return;
      }

      // 카드에 금액·진행률을 그리려면 세 테이블이 더 필요하다.
      // getTripsWithSummary() 와 같은 칼럼을 읽어 MY 목록과 값이 어긋나지 않는다.
      const all = [...trips.ongoing, ...trips.past];
      const summaries = await getTripAmountSummaries(all.map((trip) => trip.id));

      /**
       * 내가 나간 여행 id. **membership 메타일 뿐** 목록의 근거가 아니다.
       * (2026-09-13 · docs/11 §6) 카드는 lifecycle 탭(준비 중 등)에 한 번만 나오고,
       * left 가 참이면 '나간 여행' 배지와 무채색으로 그려진다.
       * 전에는 나간 여행을 따로 모아 탭을 하나 더 뒀는데, 같은 여행이 두 탭에
       * 두 번 나왔다. 여행 상태와 나의 참여 상태는 축이 다르다.
       */
      // ⚠️ trip_members 에 unique 가 없어 같은 여행에 ACTIVE 행과 LEFT 행이 함께
      //    있을 수 있다. 그때는 ACTIVE 가 이긴다 — trips.ts 의 "ACTIVE 행이 하나
      //    이상이면 참여 중" 규칙과 같다. 참여 중인 사람에게 나간 여행 배지를 달지 않는다.
      const leftIds = new Set(
        myLeftTrips.map((trip) => trip.id).filter((id) => !participating.has(id)),
      );

      /**
       * DB 행을 MY 여행 카드가 받는 모양으로 바꾼다.
       *
       * ⚠️ 변환 규칙을 새로 만들지 않는다. app/me/trips.tsx 가 하는 것과 같다.
       *    국기·색은 findDestinationByName → countryTheme 경로 그대로다.
       *
       * ⚠️ ownerLabel 은 이 모임 이름이다. 모임 상세라 전부 이 모임의 여행이다.
       */
      const toItem = (trip: (typeof all)[number]): MyTripItem => {
        const meta = findDestinationByName(trip.destination);
        const theme = countryTheme(meta?.countryKo);
        const amount = summaries.get(trip.id);

        return {
          tripId: trip.id,
          destination: trip.destination,
          flag: meta?.flag ?? '🌍',
          startDate: trip.start_date,
          endDate: trip.end_date,
          status: trip.status as TripStatus,
          ownerLabel: found.name,
          currentAmount: amount?.currentAmount ?? null,
          targetAmount: amount?.targetAmount ?? null,
          finalAmount: amount?.finalAmount ?? null,
          color: theme.primary,
          colorSoft: theme.primarySoft,
          // 나간 여행이면 카드가 배지를 달고 색을 뺀다. 목록 위치는 그대로다.
          left: leftIds.has(trip.id),
        };
      };

      const items = all.map(toItem);

      /**
       * 취소된 여행 카드. MY-02 의 toArchivedItems 와 같은 규칙이다 —
       * 금액을 넣지 않는다. 취소된 예산은 확정값이 아니다. 카드가 '—' 를 그린다.
       */
      const toCanceled = (trip: (typeof all)[number]): MyTripItem => ({
        ...toItem(trip),
        currentAmount: null,
        targetAmount: null,
        finalAmount: null,
        left: leftIds.has(trip.id),
      });

      setGroup({
        groupId: found.id,
        name: found.name,
        createdAt: found.created_at,
        memberCount,
        participatingTripIds: participating,
        members: members.map((member) => ({
          memberId: member.id,
          userId: member.user.id,
          name: member.user.name,
          isOwner: member.role === GROUP_MEMBER_ROLE.OWNER,
          joinedAt: member.joined_at,
        })),
        /**
         * 연결 계좌.
         *
         * ⚠️ 이 모임의 **삭제되지 않은 모든 여행**을 본다. 준비 중·여행 중은
         *    물론 지난 여행까지 포함한다. (2026-09-08 확정) 상태로 거르지
         *    않으므로 여기서 판정할 것이 없다 — getGroupTripAccounts 가 이미
         *    DELETED 를 뺀다.
         *
         * ⚠️ 여기 나오는 계좌는 각 여행의 **지금 연결된** 계좌다
         *    (fund_sources.financial_account_id). 예전에 연결했다가 바꾼
         *    계좌 이력을 따로 추적하지 않는다. 그런 기능은 만들지 않았다.
         *
         * ⚠️ **계좌 기준으로 묶는다.** 같은 계좌를 세 여행이 쓰면 한 줄이다.
         *    묶는 키는 financial_account_id 다 — 은행명으로 묶으면 같은 은행의
         *    서로 다른 계좌가 하나로 합쳐진다.
         *
         * ⚠️ 어느 여행에서 쓰이는지는 trips 배열로 남긴다. 계좌 관리 화면이
         *    여행 단위라, 눌렀을 때 어디로 보낼지 고르려면 이 목록이 필요하다.
         */
        accounts: (() => {
          const byAccount = new Map<string, GroupAccountItem>();

          for (const row of accounts) {
            const found = byAccount.get(row.accountId);
            const target =
              found ??
              (() => {
                const created: GroupAccountItem = {
                  accountId: row.accountId,
                  institutionCode: row.institutionCode,
                  maskedAccountNumber: row.maskedAccountNumber,
                  trips: [],
                  activeTripCount: 0,
                };
                byAccount.set(row.accountId, created);
                return created;
              })();

            target.trips.push({
              tripId: row.tripId,
              destination: row.destination,
              // ⚠️ 종료·결산 완료를 '지난 여행' 하나로 묶는 표시용 라벨이다.
              //    공통 TRIP_STATUS_LABEL 을 고치지 않는다.
              statusLabel: toGroupTripStatusLabel(row.status),
              isParticipant: participating.has(row.tripId),
            });

            // 준비 중·여행 중만 센다. 메인의 'N개 여행에서 사용 중' 이 이 값이다.
            if (isActiveTripStatus(row.status)) target.activeTripCount += 1;
          }

          return [...byAccount.values()];
        })(),

        // ⚠️ trips.status 로 가른다. /me/trips 목록이 쓰는 기준과 같다.
        //    (app/me/trips.tsx) 날짜로 다시 판정하면 같은 여행이 두 화면에서
        //    다른 칸에 들어갈 수 있다.
        // ⚠️ 취소 요청 중도 준비 중 탭이다. 빼면 어느 탭에도 안 들어가 사라진다
        planningTrips: items.filter((item) => isTripBeforeDeparture(item.status)),
        travelingTrips: items.filter((item) => item.status === TRIP_STATUS.TRAVELING),
        pastTrips: items.filter(
          (item) => item.status === TRIP_STATUS.ENDED || item.status === TRIP_STATUS.SETTLED,
        ),
        canceledTrips: canceledTrips.map(toCanceled),
      });
      setLoadState('ready');
    } catch {
      // 예외 객체를 화면에 그대로 노출하지 않는다. (components/ui/ErrorState)
      setLoadState('error');
    }
  }, [groupId, userId]);

  // 여행을 만들고 돌아오면 목록이 달라져 있다.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * 모임 이름 저장. (docs/11_모임정책_v1.md §3 · 2026-09-12)
   *
   * ⚠️ 권한은 RLS 가 본다. (updateGroup 주석 · ERD §6-2 — 소유자 또는 ACTIVE 멤버)
   *    앱에서 모임장 검사를 따로 두지 않는다. 실패하면 화면이 안내한다.
   * ⚠️ 성공하면 서버가 돌려준 이름으로 바로 그린다. 다시 읽지 않는다.
   */
  async function handleSubmitRename(name: string) {
    if (!group || renaming) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const updated = await updateGroup(group.groupId, { name });
      setGroup((prev) => (prev ? { ...prev, name: updated.name } : prev));
      setRenameOpen(false);
    } catch {
      setRenameError('이름을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRenaming(false);
    }
  }

  /**
   * '여행에서 나가기' 를 눌렀을 때.
   *
   * ⚠️ 확인창을 열기 전에 **나 말고 남은 참가자가 있는지 먼저 본다.**
   *    마지막 한 명은 나갈 수 없다. (2026-09-10 확정) 여행을 그만두려면
   *    '여행 취소' 를 써야 하는데 그건 다른 담당 기능이라 여기서 연결하지 않는다.
   *
   * ⚠️ 예전에는 마지막 참가자가 나가면 여행을 자동으로 지웠다. 그 정책은
   *    폐기했다. 여행에서 나가는 것과 여행을 취소하는 것은 다른 일이다.
   *
   * ⚠️ 개수를 못 읽으면 아무것도 하지 않고 안내만 한다. 확실하지 않은 채로
   *    나가기를 진행하면 마지막 참가자가 빠져나갈 수 있다.
   */
  async function handlePressLeaveTrip(trip: MyTripItem) {
    if (!userId) return;

    setLeaveError(null);

    let others: number;
    try {
      others = await getOtherActiveTripMemberCount(trip.tripId, userId);
    } catch {
      setBlockedMessage('참가자를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }

    if (others === 0) {
      setBlockedMessage('이 여행을 더 이상 진행하지 않으려면\n여행 취소를 이용해주세요.');
      return;
    }

    setLeavingTrip(trip);
  }

  /**
   * 나가기 확정.
   *
   * ⚠️ trip_members 의 내 ACTIVE 행을 LEFT 로 바꾸는 것이 전부다.
   *    trips.status 를 건드리지 않는다 — DELETED 도 CANCELED 도 만들지 않는다.
   *
   * ⚠️ group_members 도, 금융 데이터도 건드리지 않는다. 이미 낸 돈이 있어도
   *    그대로 둔다.
   */
  async function handleConfirmLeaveTrip() {
    if (!leavingTrip || !userId || leaving) return;

    setLeaving(true);
    setLeaveError(null);
    try {
      await leaveTrip(leavingTrip.tripId, userId);
      setLeavingTrip(null);
      await load();
    } catch {
      setLeaveError('여행에서 나가지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLeaving(false);
    }
  }

  // 진행 중이든 지난 여행이든 같은 곳으로 간다.  // 진행 중이든 지난 여행이든 같은 곳으로 간다.
  // 도착 화면이 trip.status 로 TRIP-HOME-01 / TRIP-HOME-02 를 가른다. (docs/04_v3 §5)
  function handlePressTrip(tripId: string) {
    router.push(`/trips/${tripId}`);
  }

  function handlePressCreateTrip() {
    // 이벤트는 여기서 찍지 않는다. TRIP-01 이 entryPoint param 을 읽어 기록한다.
    // 두 곳에서 track 하면 trip_create_started 가 두 번 쌓여 퍼널이 부풀려진다.
    // ⚠️ 지금 보고 있는 모임을 함께 넘긴다. 1단계에서 '기존 모임과 가요' 와
    //    이 모임이 미리 골라져 있어야 한다. 사용자가 방금 고른 것을 다시
    //    고르게 하지 않는다. (2026-09-09)
    router.push(
      `/trips/new/owner?entryPoint=${ENTRY_POINT.GROUP_DETAIL}&preselectedGroupId=${groupId}`,
    );
  }

  if (loadState === 'loading') {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <Loading message="모임을 불러오고 있어요" />
      </>
    );
  }

  if (loadState === 'notFound') {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <EmptyState
          icon="people-outline"
          title="모임을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 모임이에요."
          actionLabel="모임 목록으로"
          onAction={() => router.replace('/groups')}
        />
      </>
    );
  }

  /**
   * 참여 중인 멤버가 아니다.
   *
   * ⚠️ '없는 모임' 과 다른 말을 쓴다. 존재는 하지만 내가 볼 수 없는 것이다.
   *    다만 모임 이름 같은 내용은 알려주지 않는다.
   */
  if (loadState === 'denied') {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <EmptyState
          icon="lock-closed-outline"
          title="참여 중인 모임이 아니에요"
          description="모임에서 나갔거나 아직 참여하지 않았어요."
          actionLabel="모임 목록으로"
          onAction={() => router.replace('/groups')}
        />
      </>
    );
  }

  if (loadState === 'error' || !group) {
    return (
      <>
        <Stack.Screen options={{ title: '모임 상세' }} />
        <ErrorState message="모임 정보를 불러오지 못했어요." onRetry={() => void load()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: group.name,
          // 이름 수정 진입점. 실제 모임(groupId 있음)에서만 이 화면이 열리므로
          // 개인 여행에는 애초에 나타나지 않는다. (docs/11_모임정책_v1.md §3)
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="모임 이름 수정"
              hitSlop={8}
              onPress={() => {
                setRenameError(null);
                setRenameOpen(true);
              }}
              className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
            >
              <Ionicons name="pencil-outline" size={20} color="#111827" />
            </Pressable>
          ),
        }}
      />
      <GroupDetailView
        group={group}
        onPressTrip={handlePressTrip}
        onPressCreateTrip={handlePressCreateTrip}
        /**
         * 계좌를 누르면 **여행 수와 관계없이 항상** 시트를 띄운다.
         * (2026-09-08 확정)
         *
         * ⚠️ 여행이 하나뿐이어도 건너뛰지 않는다. GROUP 은 계좌 기준 화면이고
         *    계좌 관리는 여행 단위 화면이라, 어느 여행의 계좌 화면으로 넘어가는지
         *    사용자가 항상 보고 나서 이동해야 한다.
         */
        onPressAccount={(account) => setPickingAccount(account)}
        onPressAllAccounts={() => setAllAccountsOpen(true)}
        onPressLeaveTrip={(trip) => void handlePressLeaveTrip(trip)}
        // 나간 여행은 열 수 없다. "눌렀는데 아무 일도 없음" 대신 이유를 알린다.
        onPressLeftTrip={() => setLeftNoticeOpen(true)}
      />

      {/*
        ⚠️ LEFT read-only 여행 홈 연결 전 **임시 보호 UX**다. (2026-09-13 · docs/11 §6-2)
           최종 정책은 "볼 수 있지만 수정할 수 없다" 인데, 지금은 membership 기준
           수정 차단이 없어 여행 홈으로 보내면 수정까지 된다. 그래서 이동을 막고
           수정 불가만 알린다. "볼 수 없다" 고 말하지 않는다.
      */}
      <ConfirmModal
        visible={leftNoticeOpen}
        title="나간 여행이에요"
        description="이 여행은 더 이상 수정할 수 없어요."
        confirmLabel="확인"
        hideCancel
        busy={false}
        onCancel={() => setLeftNoticeOpen(false)}
        onConfirm={() => setLeftNoticeOpen(false)}
      />

      {/* 메인에서 계좌를 누르면 열린다. 여행이 하나뿐이어도 거친다. */}
      <AccountTripPickerSheet
        account={pickingAccount}
        onClose={() => setPickingAccount(null)}
        onSelectTrip={(tripId) => {
          setPickingAccount(null);
          // ⚠️ 모임에서 들어왔다는 것만 넘긴다. 뒤로가기가 이 모임으로 돌아온다.
          router.push(`/trips/${tripId}/funds/connect?fromGroupId=${groupId}`);
        }}
      />

      {/* 모임 이름 수정. 20자 · 공백 금지 검증은 모달이 한다. */}
      <GroupRenameModal
        initialName={renameOpen ? group.name : null}
        saving={renaming}
        submitError={renameError}
        onClose={() => setRenameOpen(false)}
        onSubmit={(name) => void handleSubmitRename(name)}
      />

      {/* 여행에서 나가기 확인창. 남은 참가자가 있을 때만 열린다. */}
      <ConfirmModal
        visible={leavingTrip !== null}
        title="이 여행에서 나가시겠어요?"
        description={'이 여행의 참가자에서 제외돼요.\n모임에서는 여행을 계속 확인할 수 있어요.'}
        confirmLabel="여행에서 나가기"
        destructive
        busy={leaving}
        error={leaveError}
        onCancel={() => setLeavingTrip(null)}
        onConfirm={() => void handleConfirmLeaveTrip()}
      />

      {/*
        마지막 참가자 안내. 아무것도 바꾸지 않고 알리기만 한다.
        여행 취소 화면으로 자동으로 보내지 않는다 — 다른 담당 기능이다.
      */}
      <ConfirmModal
        visible={blockedMessage !== null}
        title="마지막 참가자는 나갈 수 없어요"
        description={blockedMessage}
        confirmLabel="확인"
        hideCancel
        busy={false}
        onCancel={() => setBlockedMessage(null)}
        onConfirm={() => setBlockedMessage(null)}
      />

      {/* 지난 여행에만 남은 계좌까지 전부 본다. */}
      <AllAccountsSheet
        visible={allAccountsOpen}
        accounts={group.accounts}
        onClose={() => setAllAccountsOpen(false)}
        onSelectTrip={(tripId) => {
          setAllAccountsOpen(false);
          // ⚠️ 모임에서 들어왔다는 것만 넘긴다. 뒤로가기가 이 모임으로 돌아온다.
          router.push(`/trips/${tripId}/funds/connect?fromGroupId=${groupId}`);
        }}
      />
    </>
  );
}
