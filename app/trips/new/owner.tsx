// ============================================================================
// TRIP-01 여행 생성: 누구와  ·  /trips/new/owner
//
// 이 파일은 데이터 조회 · 상태 관리 · 로그 기록만 한다.
// 실제로 보이는 UI 는 components/trip-create/ 에 있다. (CLAUDE.md 9장)
//
// ⚠️ 여기서는 DB 에 아무것도 쓰지 않는다. 입력값은 draft 에만 담고
//    실제 저장(groups / trips / trip_members insert)은 TRIP-03 에서 한 번에 한다.
//    (lib/hooks/useTripDraft.tsx 주석 참조)
// ============================================================================
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GroupPicker, NewGroupForm, OwnerTypeSelector, PastDataChoice, StepProgress } from '@/components/trip-create';
import { Button } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { COMPANION_TYPE, ENTRY_POINT, type CompanionType, type EntryPoint } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';
import { getGroupMemberCount, getMyGroups, type Group } from '@/lib/supabase/queries/groups';
import { getSettledTripCount } from '@/lib/supabase/queries/personalization';

/** ENTRY_POINT 에 없는 값이 param 으로 들어와도 이벤트를 오염시키지 않는다. */
function normalizeEntryPoint(raw: string | string[] | undefined): EntryPoint {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const allowed = Object.values(ENTRY_POINT) as string[];
  // param 이 없으면 'home'. 홈에서 들어오는 게 주 경로다. (docs/README.md §5 #17)
  return value && allowed.includes(value) ? (value as EntryPoint) : ENTRY_POINT.HOME;
}

export default function ScreenTRIP01() {
  useScreenView(SCREENS.TRIP_CREATE_WHO);

  const params = useLocalSearchParams<{ entryPoint?: string }>();
  const { draft, patchDraft } = useTripDraft();

  // ── 퍼널 시작 로그 ────────────────────────────────────────────────────
  // useScreenView 와 달리 이건 흐름당 1회다. 뒤로가기로 이 화면에 다시 와도
  // 다시 쏘면 퍼널 시작 수가 부풀어 전환율 분모가 틀어진다.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const entryPoint = normalizeEntryPoint(params.entryPoint);
    patchDraft({ entryPoint });
    track(EVENTS.TRIP_CREATE_STARTED, { entry_point: entryPoint });
  }, [params.entryPoint, patchDraft]);

  // ── 기존 모임 목록 ────────────────────────────────────────────────────
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError(false);
    try {
      // TODO: 로그인 연동 시 교체
      setGroups(await getMyGroups(DEV_USER_ID));
      setGroupsLoaded(true);
    } catch {
      setGroupsError(true);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  // 뒤로 갔다 돌아오면 이 화면이 다시 마운트되지만 draft 의 선택은 남아 있다.
  // 그때 handleSelectCompanionType 이 다시 불리지 않으므로 목록을 여기서 채운다.
  // 없으면 이미 '기존 모임' 을 고른 사용자에게 빈 목록이 보인다.
  useEffect(() => {
    if (draft.companionType === COMPANION_TYPE.EXISTING_GROUP && !groupsLoaded && !groupsLoading) {
      void loadGroups();
    }
  }, [draft.companionType, groupsLoaded, groupsLoading, loadGroups]);

  // ── 과거 결산 완료 여행 수 ────────────────────────────────────────────
  // 개인이든 모임이든 소유 단위만 바뀔 뿐 판정은 같다.
  const [pastCountLoading, setPastCountLoading] = useState(false);

  const loadPastTripCount = useCallback(
    async (companionType: CompanionType, groupId: string | null) => {
      // 새 모임은 과거 데이터가 있을 수 없다. 승계하지 않는다.
      if (companionType === COMPANION_TYPE.NEW_GROUP) {
        patchDraft({ pastTripCount: 0, applyPastData: null });
        return;
      }
      if (companionType === COMPANION_TYPE.EXISTING_GROUP && !groupId) return;

      setPastCountLoading(true);
      try {
        const count = await getSettledTripCount(
          companionType === COMPANION_TYPE.PERSONAL
            ? // TODO: 로그인 연동 시 교체
              { ownerType: 'PERSONAL', userId: DEV_USER_ID }
            : { ownerType: 'GROUP', groupId: groupId as string },
        );
        patchDraft({ pastTripCount: count, applyPastData: null });
      } catch {
        // 과거 데이터 조회 실패로 여행 생성 자체를 막지 않는다.
        // 0 으로 두면 질문을 건너뛰고 기본 추천으로 진행된다.
        patchDraft({ pastTripCount: 0, applyPastData: null });
      } finally {
        setPastCountLoading(false);
      }
    },
    [patchDraft],
  );

  // ── 동행 유형 선택 ────────────────────────────────────────────────────
  const handleSelectCompanionType = useCallback(
    (companionType: CompanionType) => {
      if (companionType === draft.companionType) return;

      patchDraft({
        companionType,
        groupId: null,
        newGroupName: companionType === COMPANION_TYPE.NEW_GROUP ? draft.newGroupName : null,
        applyPastData: null,
        pastTripCount: 0,
        groupMemberCount: 0,
      });
      setGroupNameError(null);

      track(EVENTS.TRIP_COMPANION_SELECTED, { companion_type: companionType });

      if (companionType === COMPANION_TYPE.EXISTING_GROUP && !groupsLoaded) {
        void loadGroups();
      }
      if (companionType !== COMPANION_TYPE.EXISTING_GROUP) {
        void loadPastTripCount(companionType, null);
      }
    },
    [draft.companionType, draft.newGroupName, groupsLoaded, loadGroups, loadPastTripCount, patchDraft],
  );

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      patchDraft({ groupId, applyPastData: null, pastTripCount: 0, groupMemberCount: 0 });
      void loadPastTripCount(COMPANION_TYPE.EXISTING_GROUP, groupId);

      // 인원 기본값. 실패해도 여행 생성을 막지 않는다.
      // 0 이면 TRIP-02 가 1명으로 두고, 사용자가 직접 올릴 수 있다.
      void getGroupMemberCount(groupId)
        .then((count) => patchDraft({ groupMemberCount: count }))
        .catch(() => patchDraft({ groupMemberCount: 0 }));
    },
    [loadPastTripCount, patchDraft],
  );

  const handleChangePastData = useCallback(
    (applied: boolean) => {
      patchDraft({ applyPastData: applied });
      track(EVENTS.PAST_DATA_APPLY_SELECTED, {
        applied,
        past_trip_count: draft.pastTripCount,
      });
    },
    [draft.pastTripCount, patchDraft],
  );

  // ── 신규 모임 입력 ────────────────────────────────────────────────────
  const [groupNameError, setGroupNameError] = useState<string | null>(null);

  const handleChangeGroupName = useCallback(
    (value: string) => {
      patchDraft({ newGroupName: value });
      if (groupNameError) setGroupNameError(null);
    },
    [groupNameError, patchDraft],
  );

  // '다음' 이 disabled 라 눌러서는 검증을 띄울 수 없다.
  // 입력칸을 건드렸다가 비운 채 벗어나는 시점에 알린다.
  const handleBlurGroupName = useCallback(() => {
    setGroupNameError(
      (draft.newGroupName ?? '').trim().length === 0 ? '모임 이름을 입력해 주세요.' : null,
    );
  }, [draft.newGroupName]);

  const handleAddCompanion = useCallback(() => {
    patchDraft({ companionNames: [...draft.companionNames, ''] });
  }, [draft.companionNames, patchDraft]);

  const handleChangeCompanion = useCallback(
    (index: number, value: string) => {
      const next = [...draft.companionNames];
      next[index] = value;
      patchDraft({ companionNames: next });
    },
    [draft.companionNames, patchDraft],
  );

  const handleRemoveCompanion = useCallback(
    (index: number) => {
      patchDraft({ companionNames: draft.companionNames.filter((_, i) => i !== index) });
    },
    [draft.companionNames, patchDraft],
  );

  // ── 다음 단계 ─────────────────────────────────────────────────────────
  const showPastDataChoice = draft.pastTripCount > 0 && !pastCountLoading;

  const trimmedGroupName = (draft.newGroupName ?? '').trim();
  const companionValid =
    draft.companionType === COMPANION_TYPE.PERSONAL ||
    (draft.companionType === COMPANION_TYPE.EXISTING_GROUP && Boolean(draft.groupId)) ||
    (draft.companionType === COMPANION_TYPE.NEW_GROUP && trimmedGroupName.length > 0);

  // 과거 데이터 질문이 떴으면 반드시 답해야 넘어간다.
  //
  // 답하지 않으면 past_data_apply_selected 가 아예 기록되지 않아, 질문을 본 사람
  // 대비 반영을 택한 비율(가설 5)을 잴 수 없다. 미선택을 '반영'으로 간주하면
  // 사용자가 고르지 않은 값을 고른 것처럼 기록하게 되어, 검증하려던 지표가
  // 오염된다. 그래서 기본값을 두지 않고 필수로 만든다.
  const pastDataValid = !showPastDataChoice || draft.applyPastData !== null;

  const canProceed = companionValid && pastDataValid;

  // 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다. (NFR-005)
  // 이 화면으로 돌아오면 useFocusEffect 가 다시 열어 준다.
  const navigatingRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  const handleNext = useCallback(() => {
    if (!canProceed) return;

    if (draft.companionType === COMPANION_TYPE.NEW_GROUP) {
      // 빈 칸으로 남은 동행자 입력은 저장하지 않는다.
      patchDraft({
        newGroupName: trimmedGroupName,
        companionNames: draft.companionNames.map((n) => n.trim()).filter(Boolean),
      });
    }

    if (navigatingRef.current) return;
    navigatingRef.current = true;
    // push 가 아니라 navigate 다.
    // 앞 단계를 고치러 뒤로 갔다가 다시 오면 push 는 같은 화면을 하나 더 쌓는다.
    // navigate 는 스택에 이미 있으면 그 화면으로 되돌아간다. 마법사 흐름에 맞다.
    router.navigate('/trips/new/basic');
  }, [canProceed, draft.companionNames, draft.companionType, patchDraft, trimmedGroupName]);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: '여행 만들기' }} />

      <StepProgress current={1} />

      <Text className="mt-6 text-2xl font-bold text-gray-900">누구와 가나요?</Text>
      <Text className="mt-1.5 text-sm text-gray-500">
        함께 가는 사람에 따라 예산을 나누는 방식이 달라져요.
      </Text>

      <View className="mt-6">
        <OwnerTypeSelector value={draft.companionType} onChange={handleSelectCompanionType} />
      </View>

      {draft.companionType === COMPANION_TYPE.EXISTING_GROUP ? (
        <View className="mt-5">
          <Text className="mb-2 text-sm font-medium text-gray-700">어떤 모임인가요?</Text>
          <GroupPicker
            groups={groups}
            loading={groupsLoading}
            error={groupsError}
            selectedGroupId={draft.groupId}
            onSelect={handleSelectGroup}
            onRetry={() => void loadGroups()}
            onCreateNew={() => handleSelectCompanionType(COMPANION_TYPE.NEW_GROUP)}
          />
        </View>
      ) : null}

      {draft.companionType === COMPANION_TYPE.NEW_GROUP ? (
        <View className="mt-5">
          <NewGroupForm
            groupName={draft.newGroupName ?? ''}
            onChangeGroupName={handleChangeGroupName}
            groupNameError={groupNameError}
            onBlurGroupName={handleBlurGroupName}
            companionNames={draft.companionNames}
            onChangeCompanionName={handleChangeCompanion}
            onAddCompanion={handleAddCompanion}
            onRemoveCompanion={handleRemoveCompanion}
          />
        </View>
      ) : null}

      {showPastDataChoice ? (
        <View className="mt-5">
          <PastDataChoice
            pastTripCount={draft.pastTripCount}
            value={draft.applyPastData}
            onChange={handleChangePastData}
          />
        </View>
      ) : null}

      {/*
        필수값이 비면 '다음' 을 disabled 로 막는다.
        무엇이 빠졌는지는 하단에 문구를 따로 띄우지 않고 해당 입력칸에서 바로 알린다
        (빨간 테두리 + 칸 아래 작은 문구). 같은 말을 두 곳에서 하지 않는다.
      */}
      <View className="mt-8">
        <Button label="다음" onPress={handleNext} disabled={!canProceed} />
      </View>
    </ScrollView>
  );
}
