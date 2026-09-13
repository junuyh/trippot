// ============================================================================
// 여행 기본 정보 수정  ·  /trips/:tripId/edit
//
// TRIP-HOME-01 여행명 아래 수정 버튼으로 들어온다. (시안 v4)
// 일정 · 인원 · 모임을 고친다. 맨 아래 '여행 멤버 초대하기' 도 여기다.
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
import { Alert, ScrollView, Share, View } from "react-native";

import { useAuth, useCurrentUserId } from "@/lib/auth/AuthProvider";
import { InviteLinkSheet } from "@/components/invite";
import { TripEditForm } from "@/components/trip-edit";
import { EmptyState, ErrorState, Loading, HeaderBackButton } from "@/components/ui";
import { findDestinationByName } from "@/lib/constants/destinations";
import { TRIP_OWNER_TYPE, TRIP_STATUS } from "@/lib/constants/status";
import {
  buildTripInviteLink,
  buildTripInviteMessage,
  pickTripInviteOpener,
} from "@/lib/invite/tripInviteLink";
import { getMyGroups, type Group } from "@/lib/supabase/queries/groups";
import { getOrCreateTripInvite } from "@/lib/supabase/queries/tripInvites";
import { useTripContext } from '@/lib/hooks/useTripContext';
import {
  getTripById,
  updateTrip,
  type Trip,
} from "@/lib/supabase/queries/trips";

export default function ScreenTripEdit() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  // 로그인한 사용자. 개인 여행으로 바꿀 때 소유자가 된다.
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
  const [groupId, setGroupId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── 여행 멤버 초대 ────────────────────────────────────────────────────
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  /** RPC 가 돌려준 링크. 유효한 게 있으면 같은 값이 다시 온다 (§4-1) */
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  /** 시트를 열 때 한 번 고른 첫 문장. 공유·복사가 같은 글을 쓴다 */
  const [inviteOpener, setInviteOpener] = useState<string>("");
  const [copied, setCopied] = useState(false);

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
    if (!groupId && !userId) {
      setSaveError("로그인 정보가 없어요. 다시 로그인한 뒤 시도해 주세요.");
      return;
    }
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
        owner_user_id: groupId ? null : userId,
      });
      router.back();
    } catch {
      setSaveError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }, [endDate, groupId, headcount, saving, startDate, trip, userId]);

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
  }, [inviting, isPreview, trip]);

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
    </ScrollView>
  );
}
