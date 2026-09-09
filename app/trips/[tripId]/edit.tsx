// ============================================================================
// 여행 기본 정보 수정  ·  /trips/:tripId/edit
//
// TRIP-HOME-01 여행명 아래 수정 버튼으로 들어온다. (시안 v4)
// 일정 · 인원 · 모임을 고친다. 맨 아래 '여행 멤버 초대하기' 도 여기다.
//
// 초대 규칙
//   · 고른 모임에 **지난 여행이 있으면** 새 모임 생성 화면으로 보낸다.
//     이미 다녀온 사람들이 모인 모임에 새 사람을 섞지 않는다.
//   · 지난 여행이 없으면 초대 시트: 카카오톡으로 초대 / 초대 링크 복사
//   · 개인 여행(모임 없음)이면 초대할 모임이 없으므로 새 모임 생성으로 보낸다.
//     [검토 필요] 개인 여행 → 새 모임 흐름은 팀원이 만드는 화면에서 이어 받는다.
//   · 새 모임 생성 화면(/groups/new)은 다른 팀원이 만든다. 경로만 여기서 정한다.
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
import * as Clipboard from "expo-clipboard";
import { format, isAfter, parseISO } from "date-fns";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Share, View } from "react-native";

import { InviteMembersSheet, TripEditForm } from "@/components/trip-edit";
import { EmptyState, ErrorState, Loading, HeaderBackButton } from "@/components/ui";
import { DEV_USER_ID } from "@/lib/constants/devUser";
import { findDestinationByName } from "@/lib/constants/destinations";
import { TRIP_OWNER_TYPE, TRIP_STATUS } from "@/lib/constants/status";
import { buildGroupInviteLink, buildInviteMessage } from "@/lib/invite/inviteLink";
import { getGroupTrips, getMyGroups, type Group } from "@/lib/supabase/queries/groups";
import { useTripContext } from '@/lib/hooks/useTripContext';
import {
  getTripById,
  updateTrip,
  type Trip,
} from "@/lib/supabase/queries/trips";

/** 새 모임 생성 화면. 다른 팀원이 만든다. 아직 없으면 라우터가 '없는 화면' 을 띄운다 */
const NEW_GROUP_HREF = "/groups/new";

export default function ScreenTripEdit() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
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
  const [groupId, setGroupId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 여행 멤버 초대 ────────────────────────────────────────────────────
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!tripId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const found = await getTripById(tripId);
      if (!found) {
        setNotFound(true);
        return;
      }
      setTrip(found);
      setStartDate(found.start_date);
      setEndDate(found.end_date);
      setHeadcount(found.headcount);
      setGroupId(found.group_id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // 모임 목록은 부가 정보다. 실패해도 일정·인원은 고칠 수 있어야 한다.
  useEffect(() => {
    getMyGroups(DEV_USER_ID)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

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
      await updateTrip(trip.id, {
        start_date: startDate,
        end_date: endDate,
        headcount,
        group_id: groupId,
        // 모임을 붙이거나 떼면 소유 형태도 함께 바뀐다.
        // 하나만 바꾸면 개인 여행인데 group_id 가 남는 상태가 된다.
        owner_type: groupId ? TRIP_OWNER_TYPE.GROUP : TRIP_OWNER_TYPE.PERSONAL,
        owner_user_id: groupId ? null : DEV_USER_ID,
      });
      router.back();
    } catch {
      setSaveError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }, [endDate, groupId, headcount, saving, startDate, trip]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === groupId) ?? null,
    [groupId, groups],
  );
  const inviteLink = useMemo(
    () => (selectedGroup ? buildGroupInviteLink(selectedGroup.id) : ""),
    [selectedGroup],
  );
  const periodLabel =
    startDate && endDate
      ? `${format(parseISO(startDate), "M.d")}–${format(parseISO(endDate), "M.d")}`
      : null;

  /**
   * 여행 멤버 초대하기.
   * 지난 여행이 있는 모임 → 새 모임 생성. 없으면 초대 시트.
   * 모임을 안 골랐으면(개인 여행) 초대할 곳이 없으니 새 모임 생성으로.
   */
  const handleInvite = useCallback(async () => {
    if (inviting) return;
    if (!selectedGroup) {
      router.push(NEW_GROUP_HREF as never);
      return;
    }
    setInviting(true);
    try {
      const { past } = await getGroupTrips(selectedGroup.id);
      if (past.length > 0) {
        router.push(NEW_GROUP_HREF as never);
        return;
      }
      setCopied(false);
      setInviteOpen(true);
    } catch {
      Alert.alert("확인하지 못했어요", "모임의 여행 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setInviting(false);
    }
  }, [inviting, selectedGroup]);

  /**
   * 카카오톡으로 초대. OS 공유 시트를 연다. 카카오톡이 깔려 있으면 거기서 고른다.
   * [검토 필요] 카카오톡 대화방 선택으로 바로 가려면 카카오 SDK 네이티브 모듈이
   * 필요하다. Expo Go 에서는 못 쓰므로 dev build 로 갈 때 붙인다.
   */
  /** 초대 문구 + 링크. 카카오톡 공유와 링크 복사가 같은 글을 쓴다 */
  const inviteMessage = useMemo(
    () =>
      selectedGroup && trip
        ? buildInviteMessage({
            destination: trip.destination ?? "여행",
            groupName: selectedGroup.name,
            periodLabel,
            link: inviteLink,
          })
        : "",
    [inviteLink, periodLabel, selectedGroup, trip],
  );

  const handleShareKakao = useCallback(async () => {
    if (!inviteMessage) return;
    try {
      await Share.share({ message: inviteMessage });
    } catch {
      // 공유 시트를 닫은 것도 여기로 온다. 실패로 알리지 않는다.
    }
  }, [inviteMessage]);

  const handleCopyLink = useCallback(async () => {
    if (!inviteMessage) return;
    try {
      await Clipboard.setStringAsync(inviteMessage);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
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

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: "#f5f6f8" }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 48,
      }}
      keyboardShouldPersistTaps="handled"
    >
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
        groups={groups}
        groupsLoading={groupsLoading}
        selectedGroupId={groupId}
        onSelectGroup={setGroupId}
        canSubmit={canSubmit}
        saving={saving}
        errorMessage={saveError}
        onSubmit={() => void handleSubmit()}
        onInvite={() => void handleInvite()}
        inviting={inviting}
      />

      {selectedGroup ? (
        <InviteMembersSheet
          visible={inviteOpen}
          onClose={() => setInviteOpen(false)}
          groupName={selectedGroup.name}
          onShareKakao={() => void handleShareKakao()}
          onCopyLink={() => void handleCopyLink()}
          copied={copied}
        />
      ) : null}
    </ScrollView>
  );
}
