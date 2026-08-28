// ============================================================================
// TRIP-02 여행 생성: 기본정보  ·  /trips/new/basic
//
// 여행지 · 일정 · 인원 · 여행 스타일을 받는다.
//
// 이 파일은 상태 관리 · 검증 · 로그 기록만 한다. UI 는 components/trip-create/.
// TRIP-01 과 마찬가지로 DB 에 쓰지 않는다. 저장은 TRIP-03 에서 한 번에 한다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

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
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ── 인원 기본값 ───────────────────────────────────────────────────────
  // 모임 여행이면 동행자 수 + 본인. 개인은 1명이다.
  // 사용자가 직접 만진 뒤에는 덮어쓰지 않는다.
  const [headcountTouched, setHeadcountTouched] = useState(false);
  useEffect(() => {
    if (headcountTouched) return;
    const suggested =
      draft.companionType === COMPANION_TYPE.PERSONAL
        ? 1
        : Math.max(1, draft.companionNames.length + 1);
    if (suggested !== draft.headcount) patchDraft({ headcount: suggested });
  }, [draft.companionNames.length, draft.companionType, draft.headcount, headcountTouched, patchDraft]);

  // ── 여행지 ────────────────────────────────────────────────────────────
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
    (value: string) => patchDraft({ destinationName: value }),
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

  const customNameError =
    submitAttempted && draft.isCustomDestination && trimmedName.length === 0
      ? '여행지를 입력해 주세요.'
      : null;

  const missingMessage = useMemo(() => {
    if (canSubmit) return null;
    if (!destinationValid) {
      return draft.isCustomDestination && trimmedName.length > 0
        ? '어느 지역인지 선택해 주세요.'
        : '여행지를 선택해 주세요.';
    }
    if (!datesValid) return '가는 날과 오는 날을 선택해 주세요.';
    if (!draft.travelStyle) return '여행 스타일을 선택해 주세요.';
    return null;
  }, [canSubmit, datesValid, destinationValid, draft.isCustomDestination, draft.travelStyle, trimmedName.length]);

  // ── 다음 단계 ─────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    setSubmitAttempted(true);
    if (!canSubmit || !draft.startDate || !draft.endDate || !draft.travelStyle) return;

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
          isCustom={draft.isCustomDestination}
          customName={draft.isCustomDestination ? (draft.destinationName ?? '') : ''}
          customRegion={draft.region}
          onSelectDestination={handleSelectDestination}
          onStartCustom={handleStartCustom}
          onChangeCustomName={handleChangeCustomName}
          onSelectRegion={handleSelectRegion}
          customNameError={customNameError}
        />
      </View>

      {/* ── 일정 ── */}
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

      {/* ── 인원 ── */}
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
              ? '동행자 수에 맞춰 자동으로 채웠어요. 바꿀 수 있어요.'
              : undefined
          }
        />
      </View>

      {/* ── 여행 스타일 ── */}
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

      {submitAttempted && missingMessage ? (
        <View className="mt-5 flex-row items-center gap-1.5">
          <Ionicons name="alert-circle" size={16} color="#ef4444" />
          <Text className="text-sm text-red-500">{missingMessage}</Text>
        </View>
      ) : null}

      {/*
        빠진 값이 있어도 버튼을 disabled 로 두지 않는다.
        disabled 면 onPress 가 불리지 않아 "무엇이 빠졌는지" 를 알려줄 기회가 없다.
        사용자는 버튼을 눌렀는데 아무 반응이 없는 상태를 보게 된다.
        대신 handleNext 에서 막고 missingMessage 로 이유를 알린다.
      */}
      <View className="mt-8">
        <Button label="다음" onPress={handleNext} />
      </View>
    </ScrollView>
  );
}
