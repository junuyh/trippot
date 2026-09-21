// ============================================================================
// TRIP-02 여행 생성: 기본정보  ·  /trips/new/basic
//
// 여행지 · 일정 · 인원을 받는다.
//
// ⚠️ 2026-09-01 · 여행 스타일은 TRIP-03 으로 옮겼다. (HTML 디자인 반영)
//    스타일을 바꿀 때 추천 금액이 바로 움직이는 것을 같은 화면에서 보게 하려는 것이다.
//    draft.travelStyle 은 여기서 건드리지 않는다.
//
// 이 파일은 상태 관리 · 검증 · 로그 기록만 한다. UI 는 components/trip-create/.
// TRIP-01 과 마찬가지로 DB 에 쓰지 않는다. 저장은 TRIP-03 에서 한 번에 한다.
// ============================================================================
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  BottomCta,
  DateRangeCalendar,
  DestinationPicker,
  HeadcountStepper,
  StepProgress,
} from '@/components/trip-create';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import { REGION_LABEL, type Destination, type RegionCode } from '@/lib/constants/destinations';
import { COMPANION_TYPE } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';

/** 처음 들어왔을 때 펼쳐 둘 지역. REGION_LABEL 의 정의 순서가 화면 순서다. */
const DEFAULT_OPEN_REGION = (Object.keys(REGION_LABEL) as RegionCode[])[0];

/** 시작일·종료일을 포함한 여행 일수. 3박 4일이면 4다. */
function getDurationDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export default function ScreenTRIP02() {
  useScreenView(SCREENS.TRIP_CREATE_INFO);

  const { draft, patchDraft } = useTripDraft();

  // ── 인원 기본값 ───────────────────────────────────────────────────────
  // 기존 모임이면 그 모임의 멤버 수, 그 밖에는 본인 1명에서 시작한다.
  // 사용자가 직접 만진 뒤에는 덮어쓰지 않는다.
  //
  // ⚠️⚠️ 신규 모임은 **2명**에서 시작한다. (2026-09-16 다빈 확정)
  //    TRIP-01 에서 동행자 이름을 미리 받지 않게 되어(NewGroupForm 주석) 셀
  //    근거가 사라졌는데, 1 로 두면 **빈자리가 없어 초대해도 수락이 막힌다.**
  //    여행 정보 수정의 초대 버튼은 빈자리가 있을 때만 켜지고, 서버도
  //    HEADCOUNT_REACHED 로 거절한다. '새 모임을 만들어요' 를 고른 사람이
  //    혼자 갈 리는 없으므로 나 + 1 로 연다. 더 부르려면 아래 스테퍼로 올린다.
  const [headcountTouched, setHeadcountTouched] = useState(false);
  const suggestedHeadcount =
    draft.companionType === COMPANION_TYPE.EXISTING_GROUP
      ? // 기존 모임은 참여 멤버 수. 아직 못 불러왔으면(0) 1 로 둔다.
        Math.max(1, draft.groupMemberCount)
      : draft.companionType === COMPANION_TYPE.NEW_GROUP
        ? 2
        : 1;

  useEffect(() => {
    if (headcountTouched) return;
    if (suggestedHeadcount !== draft.headcount) patchDraft({ headcount: suggestedHeadcount });
  }, [draft.headcount, headcountTouched, patchDraft, suggestedHeadcount]);

  /**
   * 기존 모임 여행의 인원 하한.
   *
   * 그 모임 멤버는 여행을 만드는 순간 전원 들어온다. (2026-09-21 팀 합의)
   * 인원을 그보다 적게 잡으면 만들자마자 정원이 찬 여행이 되어, 서버가
   * 초대 수락을 HEADCOUNT_REACHED 로 막는다.
   *
   * ⚠️ 멤버 수를 아직 못 읽었으면(0) 하한을 걸지 않는다. 없는 숫자로 사용자를
   *    막지 않는다. 그 경우는 서버의 add_group_members_to_trip 이 저장 뒤에
   *    정원을 맞춘다.
   */
  const minHeadcount =
    draft.companionType === COMPANION_TYPE.EXISTING_GROUP
      ? Math.max(1, draft.groupMemberCount)
      : 1;

  // 사용자가 내려 둔 뒤에 멤버 수가 도착할 수 있다. 그때 하한까지 올린다.
  useEffect(() => {
    if (draft.headcount < minHeadcount) patchDraft({ headcount: minHeadcount });
  }, [draft.headcount, minHeadcount, patchDraft]);

  // ── 여행지 ────────────────────────────────────────────────────────────
  // 펼쳐 놓을 지역. 뒤로 갔다 돌아오면 이미 고른 목적지의 지역을 열어 둔다.
  //
  // 처음 들어오면 첫 지역을 열어 둔다. 아무것도 안 열어 두면 목록에 무엇이 있는지
  // 모른 채 검색부터 하게 되고, 있는 목적지를 못 찾아 직접 입력으로 새면
  // 기준 데이터를 쓰지 못한다.
  const [openRegion, setOpenRegion] = useState<RegionCode | null>(
    () => draft.region ?? DEFAULT_OPEN_REGION,
  );

  const handleSelectDestination = useCallback(
    (destination: Destination) => {
      patchDraft({
        destinationCode: destination.code,
        destinationName: destination.nameKo,
        region: destination.region,
        isCustomDestination: false,
      });
    },
    [patchDraft],
  );

  // ── 일정 ──────────────────────────────────────────────────────────────
  const handleChangeDates = useCallback(
    (next: { startDate: string | null; endDate: string | null }) => patchDraft(next),
    [patchDraft],
  );

  // ── 검증 ──────────────────────────────────────────────────────────────
  // 시작일 > 종료일은 달력이 구조적으로 만들지 못한다(뒤를 누르면 새 시작일이 된다).
  // DB CHECK trips_date_order 가 최종 방어선이다.
  // ⚠️ 2026-09-01 · 직접 입력을 MVP 에서 뺐다. 목록에 있는 12개만 고른다.
  //    draft.isCustomDestination 은 이제 항상 false 다. 되돌릴 때를 위해 타입은 남긴다.
  const trimmedName = (draft.destinationName ?? '').trim();
  const destinationValid = draft.destinationCode !== null;
  const datesValid = Boolean(draft.startDate && draft.endDate);

  // 스타일은 TRIP-03 으로 옮겼으므로 여기서 요구하지 않는다.
  const canSubmit = destinationValid && datesValid && draft.headcount >= 1;

  // ⚠️ 2026-09-01 · 단계별 노출을 걷어냈다. (HTML 디자인 반영)
  //    원래는 여행지 → 일정·인원 → 스타일 순으로 하나씩 펼쳤다. 한 번에 펼치면
  //    첫 화면이 길어진다는 이유였다. 세 항목을 처음부터 보여주는 쪽으로 바꿨다.
  //    빠진 값은 여전히 '다음' 을 disabled 로 막고 해당 입력칸에서 알린다.

  // ── 다음 단계 ─────────────────────────────────────────────────────────
  // 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다. (NFR-005)
  const navigatingRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  const handleNext = useCallback(() => {
    if (!canSubmit || !draft.startDate || !draft.endDate) return;
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    const destination = trimmedName;

    // ⚠️ travel_style 파라미터를 지우지 않는다. (CLAUDE.md 13장 로그 보호)
    //    다만 스타일 입력이 TRIP-03 으로 가면서, 이 시점에는 사용자가 아직 고르지
    //    않았다. 그래서 여기 실리는 값은 draft 기본값이고 "여행 조건 분포" 라는
    //    원래 목적을 채우지 못한다. 실제로 고른 값은 trips.travel_style_json 과
    //    budget_target_confirmed 에 남는다. L 확인 대기 중이다. (2026-09-01)
    track(EVENTS.TRIP_BASIC_INFO_SUBMITTED, {
      destination,
      duration_days: getDurationDays(draft.startDate, draft.endDate),
      member_count: draft.headcount,
      travel_style: draft.travelStyle,
    });

    // push 가 아니라 navigate 다.
    // 앞 단계를 고치러 뒤로 갔다가 다시 오면 push 는 같은 화면을 하나 더 쌓는다.
    // navigate 는 스택에 이미 있으면 그 화면으로 되돌아간다. 마법사 흐름에 맞다.
    router.navigate('/trips/new/budget-fund');
  }, [canSubmit, draft.endDate, draft.headcount, draft.isCustomDestination, draft.startDate, draft.travelStyle, patchDraft, trimmedName]);

  // 고른 날짜 요약. 왼쪽은 날짜, 오른쪽은 박·일이다. (HTML 의 picked 박스)
  const durationLabel =
    draft.startDate && draft.endDate
      ? `${format(parseISO(draft.startDate), 'M.d(E)', { locale: ko })} → ${format(
          parseISO(draft.endDate),
          'M.d(E)',
          { locale: ko },
        )}`
      : null;

  const nightsLabel =
    draft.startDate && draft.endDate
      ? `${getDurationDays(draft.startDate, draft.endDate) - 1}박 ${getDurationDays(draft.startDate, draft.endDate)}일`
      : null;

  /**
   * 인원 안내 문구. (HTML renderPeople 과 같은 규칙)
   *
   * 모임 인원과 비교해 지금 몇 명인지를 그때그때 말해준다.
   * "맞췄어요" 로만 고정해 두면 사용자가 인원을 바꾼 뒤에도 문구가 그대로라
   * 화면이 거짓말을 하게 된다.
   */
  const headcountHint = (() => {
    if (draft.companionType !== COMPANION_TYPE.EXISTING_GROUP) {
      return '함께 가는 인원을 정해주세요';
    }

    const base = draft.groupMemberCount;
    // 멤버 수를 못 불러왔으면 비교할 기준이 없다. 없는 숫자를 말하지 않는다.
    if (base <= 0) return '함께 가는 인원을 정해주세요';

    const name = draft.groupName ?? '모임';
    if (draft.headcount === base) return `${name} 멤버 ${base}명으로 맞췄어요`;
    if (draft.headcount < base) return `${name} 멤버 ${base}명 중 ${draft.headcount}명이 가요`;
    return `${name} 멤버 ${base}명보다 ${draft.headcount - base}명 많아요`;
  })();

  // 날짜를 아직 다 안 골랐을 때만 섹션 헤더에서 다음 할 일을 알려준다.
  const scheduleHint = !draft.startDate
    ? '가는 날을 골라주세요'
    : !draft.endDate
      ? '오는 날을 골라주세요'
      : null;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: '여행 만들기' }} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-5"
        keyboardShouldPersistTaps="handled"
      >
        <StepProgress current={2} />

        <Text className="mt-6 text-[26px] font-bold leading-8 text-gray-900">
          어디로 떠나나요?
        </Text>
        <Text className="mt-2 text-[13px] text-gray-500">
          여행지와 일정에 따라 예상 여행비가 달라져요.
        </Text>

        {/* ── 여행지 ── */}
        <View className="mt-7">
          <View className="mb-2.5 flex-row items-baseline">
            <Text className="text-[15px] font-bold text-gray-900">여행지</Text>
            <Text className="ml-1 text-[15px] font-bold text-red-500">*</Text>
          </View>
          <DestinationPicker
            selectedCode={draft.destinationCode}
            openRegion={openRegion}
            onOpenRegion={setOpenRegion}
            onSelectDestination={handleSelectDestination}
          />
        </View>

        {/* ── 일정 ── 남은 안내는 헤더 오른쪽에 둔다. 달력 안의 문구와 겹치지 않게 끈다 ── */}
        <View className="mt-7">
          <View className="mb-2.5 flex-row items-baseline">
            <Text className="text-[15px] font-bold text-gray-900">일정</Text>
            <Text className="ml-1 text-[15px] font-bold text-red-500">*</Text>
            {scheduleHint ? (
              <Text className="ml-auto text-[11px] font-medium text-gray-400">{scheduleHint}</Text>
            ) : null}
          </View>
          <DateRangeCalendar
            startDate={draft.startDate}
            endDate={draft.endDate}
            onChange={handleChangeDates}
            maxMonthsAhead={18}
            showHint={false}
          />
          {durationLabel ? (
            <View className="mt-3 flex-row items-center rounded-xl bg-gray-100 px-3.5 py-3.5">
              <Text className="text-[13px] font-bold text-gray-900">{durationLabel}</Text>
              <Text className="ml-auto text-xs font-bold text-brand">{nightsLabel}</Text>
            </View>
          ) : null}
        </View>

        {/*
          ── 인원 ──
          혼자 가는 여행은 1명으로 정해져 있다. 물어볼 것이 없어 섹션을 그리지 않는다.
        */}
        {draft.companionType !== COMPANION_TYPE.PERSONAL ? (
          <View className="mt-7">
            <View className="mb-2.5 flex-row items-baseline">
              <Text className="text-[15px] font-bold text-gray-900">인원</Text>
              <Text className="ml-1 text-[15px] font-bold text-red-500">*</Text>
              {draft.companionType === COMPANION_TYPE.EXISTING_GROUP ? (
                <Text className="ml-auto text-[11px] font-medium text-gray-400">바꿀 수 있어요</Text>
              ) : null}
            </View>
            <HeadcountStepper
              min={minHeadcount}
              value={draft.headcount}
              onChange={(value) => {
                setHeadcountTouched(true);
                patchDraft({ headcount: value });
              }}
              hint={headcountHint}
            />
          </View>
        ) : null}
      </ScrollView>

      {/*
        필수값이 비면 '다음' 을 disabled 로 막는다.
        무엇이 빠졌는지는 하단 문구가 아니라 해당 입력칸에서 알린다.
      */}
      <BottomCta label="다음" onPress={handleNext} disabled={!canSubmit} />
    </View>
  );
}
