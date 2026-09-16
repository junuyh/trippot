// ============================================================================
// 여행 기본 정보 수정  ·  /trips/:tripId/edit
//
// TRIP-HOME-01 여행명 아래 수정 버튼으로 들어온다. (시안 v4)
// 일정 · 인원을 고친다. 모임은 보여주기만 한다. 맨 아래 '여행 멤버 초대하기' 도 여기다.
//
// ⚠️ **모임은 여기서 못 바꾼다.** (2026-09-15)
//    모임을 바꾸면 그 여행의 멤버·자금·결산을 볼 사람이 통째로 바뀌는데, 이 화면은
//    그걸 정리하지 않고 group_id 만 갈아 끼웠다. 모임이 정해지는 곳은 여행을 만들 때와
//    여행장이 참가 요청을 수락할 때(RPC) 두 곳뿐이다.
//
// ⚠️ **초대 버튼은 빈자리가 있을 때만 켠다.** (2026-09-15)
//    참여 중인 가입자가 인원만큼 차 있으면 링크를 보내도 수락이 HEADCOUNT_REACHED 로
//    막힌다. 인원을 늘리면 켜지고, 누르면 늘린 인원을 먼저 저장한 뒤 링크를 연다 —
//    저장 전 인원으로는 서버가 수락해 주지 않는다.
//
// 초대 규칙 (docs/10_여행초대정책_v2.md §5 · 2026-09-11)
//   · 여행 멤버 초대하기 → get_or_create_trip_invite RPC → 링크 하나 → 공유 시트
//   · 링크는 여행당 하나. 7일간 누구나 쓴다. 다시 눌러도 같은 링크가 온다.
//   · ACTIVE 여행 멤버면 누구나 초대한다. 여행장 여부로 막지 않는다. (§3)
//   · 발송 시점에 새 모임을 만들거나 여행을 옮기지 않는다. 모임 분기는
//     **여행장이 참가 요청을 수락할 때** 실제 요청자 기준으로 판정한다. (§9-4 · §9-5)
//     그래서 "지난 여행이 있으면 새 모임으로" 하던 발송 전 분기는 걷어냈다. (§9-2)
//
// ⚠️ **끝난 여행은 못 고친다.** 결산은 그 시점의 기록이라, 확정한 뒤에
//    일정이나 인원을 바꾸면 이미 남은 결산·유형 결과와 어긋난다.
//
// ⚠️ 일정을 바꿔도 예산 금액을 자동으로 다시 계산하지 않는다.
//    planned_amount 는 사용자가 확정한 값이고, 사용자 확정 행동을 통해서만
//    바뀐다. (CLAUDE.md 4장) 대신 화면이 그 사실을 알린다.
//
// ⚠️ 이 화면에는 track() 이벤트가 없다. 여행 정보 수정은 events.ts 에
//    해당 이벤트도 SCREENS 상수도 없고, 공유 파일이라 임의로 추가하지 않는다.
//    (CLAUDE.md 8장) 필요하면 사람에게 요청한 뒤 붙인다.
//
// 데이터 조회·상태 관리만 한다. UI 는 components/trip-edit/.
// ============================================================================
import { format, isAfter, parseISO } from "date-fns";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Share, View } from "react-native";

import { useAuth, useCurrentUserId } from "@/lib/auth/AuthProvider";
import {
  InviteLinkSheet,
  JoinRequestSheet,
  NewGroupNameSheet,
  type JoinRequestItem,
} from "@/components/invite";
import { TripEditForm, type TripMemberChip } from "@/components/trip-edit";
import { EmptyState, ErrorState, Loading, HeaderBackButton } from "@/components/ui";
import { findDestinationByName } from "@/lib/constants/destinations";
import { TRIP_OWNER_TYPE_LABEL, TRIP_STATUS } from "@/lib/constants/status";
import {
  buildTripInviteLink,
  buildTripInviteMessage,
  pickTripInviteOpener,
} from "@/lib/invite/tripInviteLink";
import { getMyGroups, type Group } from "@/lib/supabase/queries/groups";
import { getOrCreateTripInvite } from "@/lib/supabase/queries/tripInvites";
import { listActiveTripMembers } from "@/lib/supabase/queries/tripMembers";
import {
  TRIP_JOIN_ERROR,
  acceptTripJoinRequest,
  getTripJoinRequests,
  rejectTripJoinRequest,
  tripJoinErrorCode,
} from "@/lib/supabase/queries/tripJoinRequests";
import { isTripLeader } from "@/lib/trip/tripLeader";
import { useTripContext } from '@/lib/hooks/useTripContext';
import {
  getTripById,
  updateTrip,
  type Trip,
} from "@/lib/supabase/queries/trips";

export default function ScreenTripEdit() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // 로그인한 사용자. 여행장인지 가려 참여 요청을 읽는다.
  const userId = useCurrentUserId();
  // 개발용 미리보기인가. 미리보기에는 Supabase 세션이 없어 초대 RPC 를 부를 수 없다.
  const { isPreview } = useAuth();
  // 이 화면의 모든 이벤트에 trip_id 를 붙인다. (docs/06 v4 §5)
  useTripContext(tripId);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // ── 편집 중인 값 ──────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState(1);
  /**
   * 참여 중인 **가입** 멤버. 이름 목록과 초대 버튼 판정에 함께 쓴다.
   *
   * ⚠️ 목록과 숫자를 따로 읽지 않는다. 따로 읽으면 "3명 참여 중" 이라고 해놓고
   *    이름은 2개만 뜨는 일이 생긴다. 하나에서 둘 다 뽑는다.
   *
   * ⚠️ 미가입 동행자(user_id null)는 뺀다. 알림·투표·위임·나가기 판정에서 이미
   *    빠져 있어서, 목록에만 넣으면 거기서만 실제 멤버처럼 보인다.
   *    (2026-09-16 다빈) 새 여행에는 애초에 생기지 않는다.
   *
   * 못 읽으면 null 이고 버튼은 켜 둔다 — 서버가 수락할 때 다시 막는다.
   */
  const [members, setMembers] = useState<TripMemberChip[] | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 여행 멤버 초대 ────────────────────────────────────────────────────
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** RPC 가 돌려준 링크. 유효한 게 있으면 같은 값이 다시 온다 (§4-1) */
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  /** 시트를 열 때 한 번 고른 첫 문장. 공유·복사가 같은 글을 쓴다 */
  const [inviteOpener, setInviteOpener] = useState<string>("");

  // ── 참여 요청 (INV-04 · 여행장만) ──────────────────────────────────────────
  // 여행장 = trips.leader_user_id. owner_user_id 는 판정에 쓰지 않는다. (docs/12 §2)
  // 미리보기(세션 없음)에서는 RPC 가 AUTH_REQUIRED 를 내므로 부르지 않는다.
  const [joinRequests, setJoinRequests] = useState<JoinRequestItem[]>([]);
  /** 시트에 띄운 요청. null 이면 닫힘 */
  const [decidingRequest, setDecidingRequest] = useState<JoinRequestItem | null>(null);
  /** 수락·거절 RPC 진행 중. 두 버튼을 잠근다 (NFR-005) */
  const [deciding, setDeciding] = useState(false);
  /** 서버가 NEW_GROUP_NAME_REQUIRED 를 돌려준 요청. 이름 시트를 연다 */
  const [namingRequest, setNamingRequest] = useState<JoinRequestItem | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupNameError, setNewGroupNameError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const [found, memberRows] = await Promise.all([
        getTripById(tripId),
        // 부가 정보다. 실패해도 일정·인원은 고칠 수 있어야 한다.
        listActiveTripMembers(tripId).catch(() => null),
      ]);
      if (!found) {
        setNotFound(true);
        return;
      }
      setTrip(found);
      setStartDate(found.start_date);
      setEndDate(found.end_date);
      setHeadcount(found.headcount);
      setMembers(
        memberRows === null
          ? null
          : // 같은 사람 행이 여러 개일 수 있다 (trip_members 에 unique 가 없다)
            Array.from(
              new Map(
                memberRows
                  .filter((row) => row.user_id !== null)
                  .map((row) => [
                    row.user_id as string,
                    {
                      userId: row.user_id as string,
                      name: row.name,
                      isLeader: found.leader_user_id === row.user_id,
                    },
                  ]),
              ).values(),
            ),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 대기 중인 참여 요청. 여행장일 때만 부른다 — 아니면 서버가 NOT_LEADER 로 막고,
   * 애초에 보여줄 자리도 없다. 실패해도 일정·인원 수정은 돼야 하므로 빈 목록으로 둔다.
   */
  const loadJoinRequests = useCallback(async () => {
    if (!trip || isPreview || !isTripLeader(trip, userId)) {
      setJoinRequests([]);
      return;
    }
    try {
      const rows = await getTripJoinRequests(trip.id);
      setJoinRequests(
        rows
          .filter((row) => row.status === "PENDING")
          .map((row) => ({
            requestId: row.request_id,
            userId: row.requester_user_id,
            name: row.requester_name,
            requestedAt: row.requested_at,
            needsNewGroup: row.needs_new_group,
          })),
      );
    } catch (error) {
      // 화면은 빈 목록으로 두되, 개발 중에는 이유를 남긴다. 조용히 삼키면 RPC 실패와
      // "요청 0건" 을 구분할 수 없다. 배포 빌드에서는 아무것도 찍지 않는다.
      if (__DEV__) console.warn('[joinRequests] get_trip_join_requests failed', error);
      setJoinRequests([]);
    }
  }, [trip, isPreview, userId]);

  useEffect(() => {
    void loadJoinRequests();
  }, [loadJoinRequests]);

  // 모임 목록은 부가 정보다. 실패해도 일정·인원은 고칠 수 있어야 한다.
  useEffect(() => {
    if (!userId) return;
    getMyGroups(userId)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [userId]);

  const handleChangeDates = useCallback(
    (next: { startDate: string | null; endDate: string | null }) => {
      setStartDate(next.startDate);
      setEndDate(next.endDate);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!trip || saving) return;
    if (!startDate || !endDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      // ⚠️ group_id · owner_type · owner_user_id 를 보내지 않는다. 모임은 이 화면에서 못 바꾼다.
      await updateTrip(trip.id, {
        start_date: startDate,
        end_date: endDate,
        headcount,
      });
      router.back();
    } catch {
      setSaveError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }, [endDate, headcount, saving, startDate, trip]);

  const periodLabel =
    startDate && endDate
      ? `${format(parseISO(startDate), "M.d")}–${format(parseISO(endDate), "M.d")}`
      : null;

  /**
   * 여행 멤버 초대하기. (v2 §5)
   *
   * RPC 가 유효한 링크를 돌려주면 그걸 쓰고, 없으면 DB 가 새로 만든다.
   * 앱은 token 을 만들지 않고 trip_invites 에 쓰지도 않는다. (§12)
   *
   * ⚠️ 발송 전 새 모임 분기를 하지 않는다. 모임을 안 골랐어도(개인 여행) 링크는
   *    나간다 — 상대가 요청하고 여행장이 수락할 때 모임이 정리된다. (§9-4)
   *
   * ⚠️ 권한은 RPC 가 본다. ACTIVE 멤버가 아니면 42501 이 온다. 여기서 여행장
   *    여부를 미리 따지지 않는다. (§3)
   */
  const handleInvite = useCallback(async () => {
    if (inviting || !trip) return;

    // 개발용 미리보기 — 실제 세션이 없어 서버가 auth.uid() 를 못 본다. RPC 를 부르지
    // 않고 바로 알린다. "참여 중인 멤버만" 안내는 여기서는 틀린 설명이다.
    // ⚠️ 미리보기를 위해 RPC·RLS 를 풀거나 가짜 링크를 만들지 않는다.
    if (isPreview) {
      Alert.alert(
        "개발용 둘러보기에서는 초대 링크를 만들 수 없어요",
        "실제 초대 기능은 카카오 로그인 후 확인할 수 있어요.",
      );
      return;
    }

    setInviting(true);
    try {
      // 늘린 인원이 아직 저장 전이면 먼저 저장한다. 서버는 저장된 인원으로 수락을 판정한다.
      // ⚠️ 인원만 저장한다. 일정은 사용자가 '저장하기' 로 확정한다.
      if (headcount !== trip.headcount) {
        try {
          await updateTrip(trip.id, { headcount });
          setTrip({ ...trip, headcount });
        } catch {
          Alert.alert("인원을 저장하지 못했어요", "잠시 후 다시 시도해 주세요.");
          return;
        }
      }
      const invite = await getOrCreateTripInvite(trip.id);
      setInviteLink(buildTripInviteLink(invite.token));
      setInviteOpener(pickTripInviteOpener());
      setCopied(false);
      setInviteOpen(true);
    } catch {
      Alert.alert(
        "초대 링크를 준비하지 못했어요",
        "이 여행에 참여 중인 멤버만 초대할 수 있어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setInviting(false);
    }
  }, [headcount, inviting, isPreview, trip]);

  /** 수락·거절이 끝난 뒤. 목록과 여행(모임 · 인원)을 다시 읽는다. */
  const afterDecision = useCallback(async () => {
    setDecidingRequest(null);
    setNamingRequest(null);
    setNewGroupName("");
    setNewGroupNameError(null);
    await Promise.all([load(), loadJoinRequests()]);
  }, [load, loadJoinRequests]);

  /**
   * 수락. accept_trip_join_request 가 한 트랜잭션에서 CASE A/B/C/D 를 정한다.
   *
   *   NEW_GROUP_NAME_REQUIRED → 아무것도 안 쓰였다. 이름 시트를 열고 같은 요청을 다시 보낸다.
   *   HEADCOUNT_REACHED       → 요청은 PENDING 그대로, 링크도 그대로. 안내만.
   *   LEADER_NOT_CONFIGURED   → 사용자가 풀 수 없는 상태. 안내만, 데이터는 안 건드린다.
   *   REQUEST_NOT_PENDING     → 그새 처리됐다. 목록만 다시 읽는다.
   */
  const handleAccept = useCallback(
    async (request: JoinRequestItem, groupName?: string) => {
      if (deciding) return;
      setDeciding(true);
      try {
        await acceptTripJoinRequest(request.requestId, groupName);
        await afterDecision();
        Alert.alert("참여를 수락했어요", `${request.name}님이 이 여행에 함께해요.`);
      } catch (error) {
        const code = tripJoinErrorCode(error);
        if (code === TRIP_JOIN_ERROR.NEW_GROUP_NAME_REQUIRED) {
          // CASE C/D — 이 순간에만 이름을 묻는다. 시트를 바꿔 끼운다.
          setDecidingRequest(null);
          setNamingRequest(request);
        } else if (code === TRIP_JOIN_ERROR.HEADCOUNT_REACHED) {
          Alert.alert(
            "지금은 수락할 수 없어요",
            "예정 인원이 모두 참여 중이에요. 여행 인원을 늘리면 수락할 수 있어요. 요청은 그대로 남아 있어요.",
          );
        } else if (code === TRIP_JOIN_ERROR.LEADER_NOT_CONFIGURED) {
          Alert.alert(
            "여행장 정보가 없어요",
            "이 여행은 여행장이 지정되지 않아 참여 요청을 처리할 수 없어요. 운영팀에 알려 주세요.",
          );
        } else if (code === TRIP_JOIN_ERROR.REQUEST_NOT_PENDING) {
          await afterDecision();
        } else {
          Alert.alert("수락하지 못했어요", "잠시 후 다시 시도해 주세요.");
        }
      } finally {
        setDeciding(false);
      }
    },
    [deciding, afterDecision],
  );

  /** 거절. (invite_id, user_id) 단위로만 재요청이 막힌다. 사유는 받지 않는다. */
  const handleReject = useCallback(
    async (request: JoinRequestItem) => {
      if (deciding) return;
      setDeciding(true);
      try {
        await rejectTripJoinRequest(request.requestId);
        await afterDecision();
      } catch (error) {
        const code = tripJoinErrorCode(error);
        if (code === TRIP_JOIN_ERROR.REQUEST_NOT_PENDING) {
          await afterDecision();
        } else if (code === TRIP_JOIN_ERROR.LEADER_NOT_CONFIGURED) {
          Alert.alert("여행장 정보가 없어요", "이 여행은 여행장이 지정되지 않아 처리할 수 없어요. 운영팀에 알려 주세요.");
        } else {
          Alert.alert("거절하지 못했어요", "잠시 후 다시 시도해 주세요.");
        }
      } finally {
        setDeciding(false);
      }
    },
    [deciding, afterDecision],
  );

  /** 새 모임 이름으로 수락. 빈 이름은 서버도 거부하므로 여기서 먼저 막는다. */
  const handleSubmitNewGroupName = useCallback(() => {
    if (!namingRequest) return;
    const name = newGroupName.trim();
    if (name.length === 0) {
      setNewGroupNameError("모임 이름을 입력해 주세요.");
      return;
    }
    setNewGroupNameError(null);
    void handleAccept(namingRequest, name);
  }, [namingRequest, newGroupName, handleAccept]);

  /** 지금 모임 이름. 개인 여행이면 null. 시트 안내에 쓴다 */
  const currentGroupName = useMemo(
    () => groups.find((g) => g.id === trip?.group_id)?.name ?? null,
    [groups, trip?.group_id],
  );

  /** 초대 글 전문. 공유와 복사가 같은 글을 쓴다 */
  const inviteMessage = useMemo(
    () =>
      trip && inviteLink
        ? buildTripInviteMessage({
            opener: inviteOpener,
            destination: trip.destination ?? "여행",
            periodLabel,
            link: inviteLink,
          })
        : "",
    [inviteLink, inviteOpener, periodLabel, trip],
  );

  /**
   * OS 공유 시트. 카카오톡이든 문자든 사용자가 고른다.
   * ⚠️ 카카오 talk_message API 를 붙이지 않는다. (v2 §13)
   */
  const handleShare = useCallback(async () => {
    if (!inviteMessage) return;
    try {
      await Share.share({ message: inviteMessage });
    } catch {
      // 사용자가 시트를 닫은 것도 여기로 온다. 알리지 않는다.
    }
  }, [inviteMessage]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteMessage) return;
    try {
      await Clipboard.setStringAsync(inviteMessage);
      setCopied(true);
    } catch {
      Alert.alert("복사하지 못했어요", "잠시 후 다시 시도해 주세요.");
    }
  }, [inviteMessage]);

  // ── 4상태 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ), title: "여행 정보 수정" }} />
        <Loading message="여행 정보를 불러오는 중…" />
      </View>
    );
  }
  if (notFound || !trip) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ), title: "여행 정보 수정" }} />
        <EmptyState
          icon="airplane-outline"
          title="여행을 찾을 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }
  if (error) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ), title: "여행 정보 수정" }} />
        <ErrorState
          message="여행 정보를 불러오지 못했어요."
          onRetry={() => void load()}
        />
      </View>
    );
  }

  // 끝난 여행은 결산·유형 결과와 어긋나므로 여기서 막는다.
  if (
    trip.status === TRIP_STATUS.ENDED ||
    trip.status === TRIP_STATUS.SETTLED
  ) {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ), title: "여행 정보 수정" }} />
        <EmptyState
          icon="lock-closed-outline"
          title="끝난 여행은 고칠 수 없어요"
          description="결산은 여행이 끝난 시점의 기록이라, 일정이나 인원을 나중에 바꾸면 결산 결과와 맞지 않게 돼요."
          actionLabel="여행 홈으로"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const destinationMeta = findDestinationByName(trip.destination);

  // 시작일이 종료일보다 뒤면 저장하지 않는다. DB CHECK 가 최종 방어선이다.
  const datesValid = Boolean(
    startDate && endDate && !isAfter(parseISO(startDate), parseISO(endDate)),
  );
  const canSubmit = datesValid && headcount >= 1;

  /** 초대할 빈자리가 있는가. 인원(편집 중인 값)이 참여 중인 가입자보다 많아야 한다 */
  const joinedCount = members === null ? null : members.length;
  const canInvite = joinedCount === null || headcount > joinedCount;
  /** 모임 이름. 내 모임 목록에 없으면(불러오는 중·못 읽음) 소유 형태 이름으로 둔다 */
  const groupLabel = trip.group_id
    ? (currentGroupName ?? (groupsLoading ? "불러오는 중…" : TRIP_OWNER_TYPE_LABEL.GROUP))
    : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  return (
    /* ⚠️ 스크롤은 TripEditForm 안에 있다. '저장하기' 를 하단에 고정하려면
          스크롤 영역 바깥에 버튼이 있어야 해서 함께 그리도록 옮겼다. (2026-09-16) */
    <View className="flex-1" style={{ backgroundColor: "#f5f6f8" }}>
      <Stack.Screen options={{
          headerLeft: () => (
            <HeaderBackButton parentHref={`/trips/${tripId}`} />
          ), title: "여행 정보 수정" }} />
      <TripEditForm
        destination={trip.destination ?? "여행"}
        destinationEn={destinationMeta?.nameEn ?? null}
        flag={destinationMeta?.flag ?? null}
        startDate={startDate}
        endDate={endDate}
        onChangeDates={handleChangeDates}
        headcount={headcount}
        onChangeHeadcount={setHeadcount}
        groupLabel={groupLabel}
        isGroupTrip={trip.group_id !== null}
        joinedCount={joinedCount}
        members={members}
        canInvite={canInvite}
        canSubmit={canSubmit}
        saving={saving}
        errorMessage={saveError}
        onSubmit={() => void handleSubmit()}
        onInvite={() => void handleInvite()}
        inviting={inviting}
        joinRequests={joinRequests}
        onPressJoinRequest={setDecidingRequest}
      />

      {/* 참여 요청 수락·거절 (INV-04). 여행장에게만 목록이 오므로 여기까지 오면 여행장이다. */}
      {decidingRequest ? (
        <JoinRequestSheet
          visible
          onClose={() => (deciding ? undefined : setDecidingRequest(null))}
          request={decidingRequest}
          requestedAtLabel={format(parseISO(decidingRequest.requestedAt), "M월 d일 HH:mm")}
          destination={trip.destination ?? "여행"}
          // 이 화면은 계좌를 읽지 않는다. 일반 안내(예산·계획·사람·모은 돈)만 한다.
          accountLabel={null}
          needsNewGroup={decidingRequest.needsNewGroup}
          fromGroupName={currentGroupName}
          onAccept={() => void handleAccept(decidingRequest)}
          onReject={() => void handleReject(decidingRequest)}
          deciding={deciding}
        />
      ) : null}

      {/* 새 모임 이름 (INV-05). 서버가 NEW_GROUP_NAME_REQUIRED 를 돌려줬을 때만. */}
      {namingRequest ? (
        <NewGroupNameSheet
          visible
          onClose={() => {
            if (deciding) return;
            setNamingRequest(null);
            setNewGroupName("");
            setNewGroupNameError(null);
          }}
          fromGroupName={currentGroupName}
          destination={trip.destination ?? "여행"}
          groupName={newGroupName}
          onChangeGroupName={(value) => {
            setNewGroupName(value);
            if (newGroupNameError && value.trim().length > 0) setNewGroupNameError(null);
          }}
          groupNameError={newGroupNameError}
          onBlurGroupName={() => {
            if (newGroupName.trim().length === 0) setNewGroupNameError("모임 이름을 입력해 주세요.");
          }}
          onSubmit={handleSubmitNewGroupName}
          submitting={deciding}
        />
      ) : null}

      {/* 초대 링크 공유. candidates · branch 는 넘기지 않는다 — 링크는 여행당
          하나이고, 모임 분기는 수락 시점에 판정한다. (InviteLinkSheet 헤더) */}
      {inviteLink ? (
        <InviteLinkSheet
          visible={inviteOpen}
          onClose={() => setInviteOpen(false)}
          destination={trip.destination ?? "여행"}
          inviteUrl={inviteLink}
          onCopyLink={() => void handleCopyLink()}
          copied={copied}
          headcount={headcount}
          onShareKakao={() => void handleShare()}
          sending={false}
        />
      ) : null}
    </View>
  );
}
