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

import {
  BottomCta,
  GroupPicker,
  HeaderBackButton,
  NewGroupForm,
  OwnerTypeSelector,
  PastDataChoice,
  StepProgress,
} from '@/components/trip-create';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
// TODO: 로그인 연동 시 교체
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { COMPANION_TYPE, ENTRY_POINT, type CompanionType, type EntryPoint } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';
import {
  getGroupMemberCount,
  getGroupMembers,
  getMyGroups,
  type Group,
} from '@/lib/supabase/queries/groups';
import { getSettledTripCount } from '@/lib/supabase/queries/personalization';

/** ENTRY_POINT 에 없는 값이 param 으로 들어와도 이벤트를 오염시키지 않는다. */
function normalizeEntryPoint(raw: string | string[] | undefined): EntryPoint {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const allowed = Object.values(ENTRY_POINT) as string[];
  // param 이 없으면 'home'. 홈에서 들어오는 게 주 경로다. (docs/README.md §5 #17)
  return value && allowed.includes(value) ? (value as EntryPoint) : ENTRY_POINT.HOME;
}

/**
 * 동행이 바뀌면 TRIP-02 에서 고른 것을 비운다.
 *
 * 뒤로 와서 **실제로 무언가를 바꿨을 때만** 비운다. 뒤로 갔다가 그냥 돌아오는
 * 경우(실수로 눌렀거나 확인만 한 경우)에는 그대로 둔다. 아무것도 바꾸지 않은
 * 사람에게 여행지와 날짜를 다시 입력시킬 이유가 없다.
 *
 * ⚠️ TRIP-03 상단의 '도쿄 · 3박 4일 · 4명 ✏️' 는 TRIP-02 로 곧장 돌아가는
 *    경로라 TRIP-01 을 거치지 않는다. 그래서 이 초기화의 영향을 받지 않는다.
 *    거기서 인원만 고치고 돌아와도 여행지·일정은 그대로 남는다.
 *
 * 여행 스타일은 비우지 않는다. TRIP-03 소관이고 동행과 무관하다.
 * 인원은 여기서 건드리지 않는다. TRIP-02 가 새 동행 기준으로 다시 채운다.
 */
const CLEARED_TRIP_BASICS = {
  destinationCode: null,
  destinationName: null,
  region: null,
  isCustomDestination: false,
  startDate: null,
  endDate: null,
} as const;

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

  // ── 고른 모임의 멤버 이름 ─────────────────────────────────────────────
  // 인원 기본값은 getGroupMemberCount 가 따로 센다. 두 함수의 제외 조건이 달라서
  // (탈퇴 사용자) 여기 length 로 대신하면 인원 기본값이 조용히 달라진다.
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const loadGroupMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    setMemberNames([]);
    try {
      const members = await getGroupMembers(groupId);
      setMemberNames(members.map((member) => member.user.name));
    } catch {
      // 멤버 이름은 확인용이다. 못 불러와도 모임 선택과 여행 생성을 막지 않는다.
      setMemberNames([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // 목록과 같은 이유로, 돌아왔을 때 이미 고른 모임의 멤버를 다시 채운다.
  const restoredGroupIdRef = useRef<string | null>(null);
  useEffect(() => {
    const groupId = draft.groupId;
    if (draft.companionType !== COMPANION_TYPE.EXISTING_GROUP || !groupId) {
      // 모임 선택이 풀리면 다음에 같은 모임을 다시 골라도 새로 불러오게 한다.
      restoredGroupIdRef.current = null;
      return;
    }
    if (restoredGroupIdRef.current === groupId) return;
    restoredGroupIdRef.current = groupId;
    void loadGroupMembers(groupId);
  }, [draft.companionType, draft.groupId, loadGroupMembers]);

  // ── 과거 결산 완료 여행 수 ────────────────────────────────────────────
  // 개인이든 모임이든 소유 단위만 바뀔 뿐 판정은 같다.
  const [pastCountLoading, setPastCountLoading] = useState(false);

  const loadPastTripCount = useCallback(
    async (companionType: CompanionType, groupId: string | null) => {
      // 새 모임은 과거 데이터가 있을 수 없다. 승계하지 않는다.
      if (companionType === COMPANION_TYPE.NEW_GROUP) {
        patchDraft({ pastTripCount: 0, applyPastData: null, pastDataInteracted: false });
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
        // 토글은 켜진 채로 뜬다. 과거 데이터가 없으면(0) 블록 자체를 그리지 않으므로
        // null 로 둬서 '물어보지 않음' 과 구분한다.
        patchDraft({
          pastTripCount: count,
          applyPastData: count > 0 ? true : null,
          pastDataInteracted: false,
        });
      } catch {
        // 과거 데이터 조회 실패로 여행 생성 자체를 막지 않는다.
        // 0 으로 두면 질문을 건너뛰고 기본 추천으로 진행된다.
        patchDraft({ pastTripCount: 0, applyPastData: null, pastDataInteracted: false });
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
        ...CLEARED_TRIP_BASICS,
        companionType,
        groupId: null,
        groupName: null,
        newGroupName: companionType === COMPANION_TYPE.NEW_GROUP ? draft.newGroupName : null,
        applyPastData: null,
        pastDataInteracted: false,
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
      // 이미 고른 모임을 다시 누른 것이면 바뀐 게 없다.
      // 그냥 두지 않으면 여행지·일정만 애꿎게 비워진다.
      if (groupId === draft.groupId) return;

      patchDraft({
        ...CLEARED_TRIP_BASICS,
        groupId,
        // TRIP-02 인원 안내 문구에 쓴다. 목록에 없으면 null 로 두고 문구를 낮춘다.
        groupName: groups.find((group) => group.id === groupId)?.name ?? null,
        applyPastData: null,
        pastDataInteracted: false,
        pastTripCount: 0,
        groupMemberCount: 0,
      });
      void loadPastTripCount(COMPANION_TYPE.EXISTING_GROUP, groupId);

      // 인원 기본값. 실패해도 여행 생성을 막지 않는다.
      // 0 이면 TRIP-02 가 1명으로 두고, 사용자가 직접 올릴 수 있다.
      void getGroupMemberCount(groupId)
        .then((count) => patchDraft({ groupMemberCount: count }))
        .catch(() => patchDraft({ groupMemberCount: 0 }));
    },
    [draft.groupId, groups, loadPastTripCount, patchDraft],
  );

  // ⚠️ 여기서 track() 을 부르지 않는다.
  //    토글이 기본 ON 이라 만지지 않고 넘어가는 사용자가 생기는데, 이 자리에서만
  //    기록하면 그런 사용자가 통째로 빠져 분모가 비고 가설 5 를 못 잰다.
  //    기록은 handleNext 가 '다음' 시점에 최종값으로 한 번 한다.
  const handleChangePastData = useCallback(
    (applied: boolean) => {
      patchDraft({ applyPastData: applied, pastDataInteracted: true });
    },
    [patchDraft],
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

  // 과거 데이터 반영은 기본 ON 토글이라 답하지 않아도 넘어간다.
  // 예전에는 2택 필수 선택이었다. 안 고르면 past_data_apply_selected 가 아예
  // 남지 않아 분모가 비는 게 이유였는데, 이제 '다음' 시점에 최종값을 기록하므로
  // 그 문제가 없다. (안 2 · 2026-09-01 L 승인)
  const canProceed = companionValid;

  // 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다. (NFR-005)
  // 이 화면으로 돌아오면 useFocusEffect 가 다시 열어 준다.
  const navigatingRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  // 같은 값으로 앞뒤를 오가며 '다음' 을 여러 번 눌러도 한 번만 쏜다.
  // 누른 횟수만큼 쌓이면 분모가 사람 수가 아니라 이동 횟수가 된다.
  // 값을 바꿔서 다시 오면 그때는 바뀐 값으로 다시 쏜다. 분석은 흐름당 마지막
  // 이벤트를 본다.
  const sentPastDataRef = useRef<boolean | null>(null);

  const handleNext = useCallback(() => {
    if (!canProceed) return;

    // 과거 데이터 반영 여부는 여기서 기록한다. (가설 5)
    //
    // 토글이 기본 ON 이라 만지지 않고 지나가는 사용자가 있다. onChange 에서만
    // 기록하면 그 사람들이 빠져서, 반영을 택한 비율의 분모가 '토글을 만진 사람'
    // 으로 좁아진다. 그래서 토글을 본 사람 전원이 남도록 이 자리로 옮겼다.
    //
    // interacted 는 '기본 ON 을 그대로 둠' 과 '직접 켜거나 끔' 을 나눈다.
    // 이게 없으면 기본값 관성이 그대로 수용률로 잡혀 비율이 부풀려진다.
    if (showPastDataChoice) {
      const applied = draft.applyPastData !== false;
      if (sentPastDataRef.current !== applied) {
        sentPastDataRef.current = applied;
        track(EVENTS.PAST_DATA_APPLY_SELECTED, {
          applied,
          interacted: draft.pastDataInteracted,
          past_trip_count: draft.pastTripCount,
        });
      }
    }

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
  }, [
    canProceed,
    draft.applyPastData,
    draft.companionNames,
    draft.companionType,
    draft.pastDataInteracted,
    draft.pastTripCount,
    patchDraft,
    showPastDataChoice,
    trimmedGroupName,
  ]);

  // ── 나가기 ────────────────────────────────────────────────────────────
  // TRIP-01 은 /trips/new 중첩 Stack 의 첫 화면이라 Stack 이 back 버튼을 그려 주지
  // 않는다. 헤더 왼쪽에 직접 붙이고, 들어온 곳(홈 또는 여행 준비 홈)으로 되돌린다.
  //
  // 이 스택을 벗어나면 draft 가 사라지지만(useTripDraft) 되묻지 않는다.
  // 1단계에서 잃을 입력이 적고, 잘못 들어온 사용자를 한 번 더 붙잡지 않는다.
  //
  // 딥링크로 이 화면에 바로 들어오면 돌아갈 스택이 없어 back() 이 아무 일도 하지
  // 않는다. 그때만 홈 탭으로 보낸다.
  const handleExit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: '여행 만들기',
          headerLeft: () => <HeaderBackButton onPress={handleExit} />,
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        <StepProgress current={1} />

        <Text className="mt-6 text-[26px] font-bold leading-8 text-gray-900">누구와 가나요?</Text>
        <Text className="mt-2 text-[13px] text-gray-500">
          함께 가는 사람에 따라 예산을 나누는 방식이 달라져요.
        </Text>

        {/*
          고른 카드 안에서 이어서 입력한다. 카드 아래 별도 영역으로 내리면
          무엇에 딸린 입력인지가 흐려진다. 자리만 넘기고 데이터는 여기서 만든다.
        */}
        <View className="mt-5">
          <OwnerTypeSelector
            value={draft.companionType}
            onChange={handleSelectCompanionType}
            bodies={{
              // 혼자 가는 경우엔 물어볼 게 반영 여부뿐이다.
              // 과거 여행이 없으면 펼칠 내용이 없어 카드가 그대로 닫혀 있다.
              [COMPANION_TYPE.PERSONAL]: showPastDataChoice ? (
                <PastDataChoice
                  pastTripCount={draft.pastTripCount}
                  value={draft.applyPastData}
                  onChange={handleChangePastData}
                />
              ) : null,
              [COMPANION_TYPE.EXISTING_GROUP]: (
                <>
                  <GroupPicker
                    groups={groups}
                    loading={groupsLoading}
                    error={groupsError}
                    selectedGroupId={draft.groupId}
                    onSelect={handleSelectGroup}
                    onRetry={() => void loadGroups()}
                    onCreateNew={() => handleSelectCompanionType(COMPANION_TYPE.NEW_GROUP)}
                    memberNames={memberNames}
                    membersLoading={membersLoading}
                  />
                  {showPastDataChoice ? (
                    <View className="mt-3.5 border-t border-gray-200 pt-3.5">
                      <PastDataChoice
                        pastTripCount={draft.pastTripCount}
                        value={draft.applyPastData}
                        onChange={handleChangePastData}
                      />
                    </View>
                  ) : null}
                </>
              ),
              [COMPANION_TYPE.NEW_GROUP]: (
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
              ),
            }}
          />
        </View>

      </ScrollView>

      {/*
        필수값이 비면 '다음' 을 disabled 로 막는다.
        무엇이 빠졌는지는 하단에 문구를 따로 띄우지 않고 해당 입력칸에서 바로 알린다
        (빨간 테두리 + 칸 아래 작은 문구). 같은 말을 두 곳에서 하지 않는다.
      */}
      <BottomCta label="다음" onPress={handleNext} disabled={!canProceed} />
    </View>
  );
}
