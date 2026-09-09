// ============================================================================
// 새 모임 만들기  ·  /groups/new
//
// 여행 정보 수정(TRIP-02) > 여행 멤버 초대하기 에서 온다.
// 고른 모임에 **여행중이거나 끝난 여행이 하나라도 있으면** 그 모임에 새 사람을
// 섞지 않는다. 이미 다녀왔거나 다녀오는 중인 사람들의 기록이라, 새로 합류한
// 사람이 지난 여행의 예산·지출까지 보게 된다.
//
//   이 여행 1건만 새 모임으로 옮긴다. 지난 여행은 이전 모임에 남는다.
//   fund_sources · 거래 · 예산은 여행에 딸려 있어 group_id 만 바꾸면 따라온다.
//
// ⚠️ 정적 라우트가 [groupId] 보다 우선한다. 이 파일이 없을 때 /groups/new 로
//    보내면 app/groups/[groupId].tsx 가 "new" 를 모임 id 로 받아 실패했다.
//    (2026-09-09 오류 보고)
//
// ⚠️ 이 화면에는 track() 이벤트가 없다. events.ts 에 모임 생성 이벤트도
//    SCREENS 상수도 없고, 공유 파일이라 임의로 추가하지 않는다. (CLAUDE.md 8장)
//
// 데이터 조회·상태 관리만 한다. UI 는 components/groups/GroupCreateForm.
// ============================================================================
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { GroupCreateForm, type MovableMember } from "@/components/groups";
import { Button, EmptyState, ErrorState, HeaderBackButton, Loading } from "@/components/ui";
import { DEV_USER_ID } from "@/lib/constants/devUser";
import { TRIP_OWNER_TYPE } from "@/lib/constants/status";
import {
  addGroupMembers,
  createGroup,
  getGroupById,
  getGroupMembers,
} from "@/lib/supabase/queries/groups";
import { getTripById, updateTrip, type Trip } from "@/lib/supabase/queries/trips";
import { supabase } from "@/lib/supabase/client";

const MAX_NAME = 20;

type Loaded = {
  trip: Trip;
  /** 이전 모임 이름. 개인 여행에서 왔으면 null */
  fromGroupName: string | null;
  /** 데려올 수 있는 사람 (나 제외) */
  members: MovableMember[];
};

export default function ScreenGroupNew() {
  // tripId 는 필수다. 어느 여행을 옮길지 모르면 이 화면이 할 일이 없다.
  // fromGroupId 는 선택 — 개인 여행에서 오면 이전 모임이 없다.
  const { tripId, fromGroupId } = useLocalSearchParams<{
    tripId?: string;
    fromGroupId?: string;
  }>();

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const trip = await getTripById(tripId);
      if (!trip) {
        setData(null);
        return;
      }

      // 이전 모임이 없으면(개인 여행) 데려올 사람도 없다. 이름만 받는다.
      if (!fromGroupId) {
        setData({ trip, fromGroupName: null, members: [] });
        setSelectedUserIds([]);
        return;
      }

      const [group, groupMembers] = await Promise.all([
        getGroupById(fromGroupId),
        getGroupMembers(fromGroupId),
      ]);

      // 나는 새 모임의 OWNER 로 따로 들어간다. 고를 대상이 아니다.
      const movable = groupMembers
        .filter((m) => m.user_id !== DEV_USER_ID)
        .map((m) => ({ userId: m.user_id, name: m.user.name }));

      setData({ trip, fromGroupName: group?.name ?? null, members: movable });
      // 기본은 전원 데려오기. 빼고 싶은 사람만 체크를 푼다.
      setSelectedUserIds(movable.map((m) => m.userId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fromGroupId, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validateName = useCallback(() => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      setNameError("모임 이름을 입력해 주세요.");
      return false;
    }
    if (trimmed.length > MAX_NAME) {
      setNameError(`${MAX_NAME}자까지 쓸 수 있어요.`);
      return false;
    }
    setNameError(null);
    return true;
  }, [groupName]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const canSave = useMemo(() => groupName.trim().length > 0 && !saving, [groupName, saving]);

  /**
   * 모임 생성 → 멤버 이동 → 여행 이동.
   *
   * ⚠️ supabase-js 에는 트랜잭션이 없다. 중간에 실패하면 사람 없는 모임이나
   *    멤버만 옮겨진 모임이 남는다. 그래서 실패하면 방금 만든 모임을 지워
   *    원래 상태로 되돌린다. createGroup() 과 같은 방식이다.
   *
   * ⚠️ 되돌리기마저 실패하면 빈 모임이 하나 남는다. 그때는 원래 에러를 그대로
   *    보여준다. 조용히 성공으로 넘기지 않는다.
   */
  const handleSave = useCallback(async () => {
    if (!data || saving) return;
    if (!validateName()) return;

    setSaving(true);
    let createdGroupId: string | null = null;

    try {
      const group = await createGroup({
        name: groupName.trim(),
        owner_user_id: DEV_USER_ID,
      });
      createdGroupId = group.id;

      await addGroupMembers(group.id, selectedUserIds, DEV_USER_ID);

      /**
       * 여행을 새 모임으로 옮긴다.
       *
       * ⚠️ owner_type 과 owner_user_id 를 함께 바꾼다. 하나만 바꾸면 개인
       *    여행인데 group_id 가 남는 상태가 된다. (edit.tsx 저장과 같은 규칙)
       *
       * ⚠️ owner_user_id 를 null 로 비우는 건 현재 trips_owner_shape CHECK 를
       *    따르는 기존 동작이다. 모임 여행에도 여행장을 세우는 마이그레이션이
       *    적용되면 edit.tsx 와 함께 이 줄도 바뀐다.
       *    (.handoff/INV-마이그레이션-제안.sql ①)
       *
       * ⚠️ fund_sources · 거래 · 예산은 건드리지 않는다. 여행에 딸려 있어
       *    group_id 만 바꾸면 함께 따라온다.
       */
      await updateTrip(data.trip.id, {
        group_id: group.id,
        owner_type: TRIP_OWNER_TYPE.GROUP,
        owner_user_id: null,
      });

      // 여행 정보 수정으로 돌아간다. 거기서 새 모임이 골라진 상태로 보인다.
      router.back();
    } catch {
      if (createdGroupId) {
        // 보상 삭제. 삭제 에러는 삼킨다. 원래 실패 원인을 덮으면 안 된다.
        await supabase.from("groups").delete().eq("id", createdGroupId).then(
          () => undefined,
          () => undefined,
        );
      }
      Alert.alert(
        "모임을 만들지 못했어요",
        "잠시 후 다시 시도해 주세요. 여행은 그대로 있어요.",
      );
      setSaving(false);
    }
  }, [data, groupName, saving, selectedUserIds, validateName]);

  const screen = (
    <Stack.Screen
      options={{
        title: "새 모임 만들기",
        headerLeft: () => <HeaderBackButton fallbackHref="/" />,
      }}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <Loading />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <ErrorState message="모임 정보를 불러오지 못했어요." onRetry={() => void load()} />
      </View>
    );
  }

  // tripId 가 없거나 잘못된 여행이면 여기서 멈춘다. Crash 하지 않는다.
  if (!data) {
    return (
      <View className="flex-1 bg-white">
        {screen}
        <EmptyState
          icon="people-outline"
          title="어느 여행의 모임인지 알 수 없어요"
          description="삭제되었거나 접근할 수 없는 여행이에요."
          actionLabel="홈으로"
          onAction={() => router.replace("/")}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {screen}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        <GroupCreateForm
          groupName={groupName}
          onChangeGroupName={(value) => {
            setGroupName(value);
            if (nameError) setNameError(null);
          }}
          groupNameError={nameError}
          onBlurGroupName={validateName}
          members={data.members}
          selectedUserIds={selectedUserIds}
          onToggleMember={toggleMember}
          fromGroupName={data.fromGroupName}
          destination={data.trip.destination ?? "이번"}
          disabled={saving}
        />
      </ScrollView>

      <View
        className="border-t border-gray-100 bg-white px-5 pb-8 pt-3"
        style={{ gap: 8 }}
      >
        <Button
          label="이 이름으로 만들기"
          loading={saving}
          disabled={!canSave}
          onPress={() => void handleSave()}
        />
      </View>
    </View>
  );
}
