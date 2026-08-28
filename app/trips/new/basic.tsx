// ============================================================================
// TRIP-02 여행 생성: 기본정보  ·  /trips/new/basic
//
// 여행지 · 일정 · 인원 · 여행 스타일을 받는다.
//
// 이 파일은 상태 관리 · 검증 · 로그 기록만 한다. UI 는 components/trip-create/.
// TRIP-01 과 마찬가지로 DB 에 쓰지 않는다. 저장은 TRIP-03 에서 한 번에 한다.
// ============================================================================
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutAnimation, ScrollView, Text, View } from 'react-native';

import {
  DateRangeCalendar,
  DestinationPicker,
  HeadcountStepper,
  StepProgress,
  TravelStyleSelector,
} from '@/components/trip-create';
import { Button } from '@/components/ui';
import { EVENTS, SCREENS } from '@/lib/analytics/events';
import { track } from '@/lib/analytics/track';
import type { Destination, RegionCode } from '@/lib/constants/destinations';
import { COMPANION_TYPE, type TravelStyle } from '@/lib/constants/status';
import { useScreenView } from '@/lib/hooks/useScreenView';
import { useTripDraft } from '@/lib/hooks/useTripDraft';

/** 시작일·종료일을 포함한 여행 일수. 3박 4일이면 4다. */
function getDurationDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export default function ScreenTRIP02() {
  useScreenView(SCREENS.TRIP_CREATE_INFO);

  const { draft, patchDraft } = useTripDraft();

  // ── 인원 기본값 ───────────────────────────────────────────────────────
  // 모임 여행이면 동행자 수 + 본인. 개인은 1명이다.
  // 사용자가 직접 만진 뒤에는 덮어쓰지 않는다.
  const [headcountTouched, setHeadcountTouched] = useState(false);
  const suggestedHeadcount =
    draft.companionType === COMPANION_TYPE.PERSONAL
      ? 1
      : draft.companionType === COMPANION_TYPE.EXISTING_GROUP
        ? // 기존 모임은 참여 멤버 수. 아직 못 불러왔으면(0) 1 로 둔다.
          Math.max(1, draft.groupMemberCount)
        : // 신규 모임은 입력한 동행자 + 본인
          Math.max(1, draft.companionNames.length + 1);

  useEffect(() => {
    if (headcountTouched) return;
    if (suggestedHeadcount !== draft.headcount) patchDraft({ headcount: suggestedHeadcount });
  }, [draft.headcount, headcountTouched, patchDraft, suggestedHeadcount]);

  // ── 여행지 ────────────────────────────────────────────────────────────
  // 펼쳐 놓을 지역. 뒤로 갔다 돌아오면 이미 고른 목적지의 지역을 열어 둔다.
  const [openRegion, setOpenRegion] = useState<RegionCode | null>(
    () => (draft.isCustomDestination ? null : draft.region),
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

  const handleStartCustom = useCallback(() => {
    patchDraft({
      destinationCode: null,
      // 목록에서 고른 이름을 그대로 두면 직접 입력 칸에 남아 헷갈린다.
      destinationName: draft.isCustomDestination ? draft.destinationName : null,
      region: draft.isCustomDestination ? draft.region : null,
      isCustomDestination: true,
    });
  }, [draft.destinationName, draft.isCustomDestination, draft.region, patchDraft]);

  const handleChangeCustomName = useCallback(
    (value: string) => {
      patchDraft({ destinationName: value });
      setCustomNameError(null);
    },
    [patchDraft],
  );

  const handleSelectRegion = useCallback(
    (region: RegionCode) => patchDraft({ region }),
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
  const trimmedName = (draft.destinationName ?? '').trim();
  const destinationValid = draft.isCustomDestination
    ? trimmedName.length > 0 && draft.region !== null
    : draft.destinationCode !== null;
  const datesValid = Boolean(draft.startDate && draft.endDate);

  const canSubmit = destinationValid && datesValid && draft.headcount >= 1 && draft.travelStyle !== null;

  // '다음' 이 disabled 라 눌러서는 검증을 띄울 수 없다.
  // 입력칸을 건드렸다가 비운 채 벗어나는 시점에 알린다.
  const [customNameError, setCustomNameError] = useState<string | null>(null);
  const handleBlurCustomName = useCallback(() => {
    setCustomNameError(
      (draft.destinationName ?? '').trim().length === 0 ? '여행지를 입력해 주세요.' : null,
    );
  }, [draft.destinationName]);

  // ── 단계별 노출 ───────────────────────────────────────────────────────
  //
  // 네 항목을 한 번에 펼쳐 두면 첫 화면이 스크롤 세 배 길이가 된다.
  // 여행지를 정해야 일정이, 일정을 정해야 스타일이 의미를 갖기도 한다.
  //
  //   여행지 → (정하면) 일정·인원 → (정하면) 여행 스타일
  //
  // ⚠️ 한 번 펼친 단계는 다시 접지 않는다.
  //    여행지를 직접 입력으로 바꾸는 순간 아래 두 단계가 통째로 사라지면
  //    이미 고른 날짜가 없어진 것처럼 보인다. 값은 draft 에 그대로 있다.
  //    빠진 값은 접는 대신 '다음' 을 눌렀을 때 missingMessage 로 알린다.
  const [scheduleRevealed, setScheduleRevealed] = useState(false);
  const [styleRevealed, setStyleRevealed] = useState(false);

  useEffect(() => {
    if (destinationValid && !scheduleRevealed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setScheduleRevealed(true);
    }
  }, [destinationValid, scheduleRevealed]);

  useEffect(() => {
    if (datesValid && !styleRevealed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStyleRevealed(true);
    }
  }, [datesValid, styleRevealed]);

  // ── 다음 단계 ─────────────────────────────────────────────────────────
  // 연타로 같은 화면이 스택에 두 번 쌓이는 것을 막는다. (NFR-005)
  const navigatingRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      navigatingRef.current = false;
    }, []),
  );

  const handleNext = useCallback(() => {
    if (!canSubmit || !draft.startDate || !draft.endDate || !draft.travelStyle) return;
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    const destination = trimmedName;
    if (draft.isCustomDestination) patchDraft({ destinationName: destination });

    track(EVENTS.TRIP_BASIC_INFO_SUBMITTED, {
      destination,
      duration_days: getDurationDays(draft.startDate, draft.endDate),
      member_count: draft.headcount,
      travel_style: draft.travelStyle,
    });

    router.push('/trips/new/budget-fund');
  }, [canSubmit, draft.endDate, draft.headcount, draft.isCustomDestination, draft.startDate, draft.travelStyle, patchDraft, trimmedName]);

  const durationLabel =
    draft.startDate && draft.endDate
      ? `${format(parseISO(draft.startDate), 'M월 d일')} → ${format(parseISO(draft.endDate), 'M월 d일')} · ${
          getDurationDays(draft.startDate, draft.endDate) - 1
        }박 ${getDurationDays(draft.startDate, draft.endDate)}일`
      : null;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-6"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: '여행 만들기' }} />

      <StepProgress current={2} />

      <Text className="mt-6 text-2xl font-bold text-gray-900">어디로, 언제 가나요?</Text>
      <Text className="mt-1.5 text-sm text-gray-500">
        입력한 조건으로 예산을 추천해 드려요.
      </Text>

      {/* ── 여행지 ── */}
      <View className="mt-7">
        <Text className="mb-2.5 text-base font-semibold text-gray-900">
          여행지 <Text className="text-red-500">*</Text>
        </Text>
        <DestinationPicker
          selectedCode={draft.destinationCode}
          openRegion={openRegion}
          onOpenRegion={setOpenRegion}
          isCustom={draft.isCustomDestination}
          customName={draft.isCustomDestination ? (draft.destinationName ?? '') : ''}
          customRegion={draft.region}
          onSelectDestination={handleSelectDestination}
          onStartCustom={handleStartCustom}
          onChangeCustomName={handleChangeCustomName}
          onBlurCustomName={handleBlurCustomName}
          onSelectRegion={handleSelectRegion}
          customNameError={customNameError}
        />
      </View>

      {/* ── 일정 ── */}
      {scheduleRevealed ? (
      <>
      <View className="mt-7">
        <Text className="mb-2.5 text-base font-semibold text-gray-900">
          일정 <Text className="text-red-500">*</Text>
        </Text>
        <DateRangeCalendar
          startDate={draft.startDate}
          endDate={draft.endDate}
          onChange={handleChangeDates}
        />
        {durationLabel ? (
          <Text className="mt-2 text-sm font-medium text-blue-700">{durationLabel}</Text>
        ) : null}
      </View>

      {/* ── 인원 ── 일정과 함께 나타난다 */}
      <View className="mt-7">
        <Text className="mb-2.5 text-base font-semibold text-gray-900">인원</Text>
        <HeadcountStepper
          value={draft.headcount}
          onChange={(value) => {
            setHeadcountTouched(true);
            patchDraft({ headcount: value });
          }}
          hint={
            draft.companionType !== COMPANION_TYPE.PERSONAL && !headcountTouched
              ? draft.companionType === COMPANION_TYPE.EXISTING_GROUP
                ? '모임 인원에 맞춰 자동으로 채웠어요. 바꿀 수 있어요.'
                : '동행자 수에 맞춰 자동으로 채웠어요. 바꿀 수 있어요.'
              : undefined
          }
        />
      </View>
      </>
      ) : null}

      {/* ── 여행 스타일 ── */}
      {styleRevealed ? (
      <View className="mt-7">
        <Text className="mb-1 text-base font-semibold text-gray-900">
          여행 스타일 <Text className="text-red-500">*</Text>
        </Text>
        <Text className="mb-2.5 text-xs text-gray-400">
          숙소와 식사 수준에 따라 추천 금액이 달라져요.
        </Text>
        <TravelStyleSelector
          value={draft.travelStyle}
          onChange={(value: TravelStyle) => patchDraft({ travelStyle: value })}
        />
      </View>
      ) : null}

      {/*
        마지막 단계가 펼쳐지기 전에는 '다음' 을 노출하지 않는다.
        아직 물어볼 게 남았는데 완료 버튼이 먼저 보이면 단계 노출의 의미가 없다.
        필수값이 비면 disabled 로 막고, 무엇이 빠졌는지는 해당 입력칸에서 알린다.
      */}
      {styleRevealed ? (
        <View className="mt-8">
          <Button label="다음" onPress={handleNext} disabled={!canSubmit} />
        </View>
      ) : null}
    </ScrollView>
  );
}
