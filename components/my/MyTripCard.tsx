import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from '@/components/home/format';
import { HOME_ACCENT, HOME_TRACK } from '@/components/home/palette';
import { TRIP_STATUS, TRIP_STATUS_LABEL } from '@/lib/constants/status';
import { TRIP_STAGE, TRIP_STAGE_LABEL } from '@/lib/trip/stage';

import type { MyTripItem } from './types';

type Props = {
  trip: MyTripItem;
  /**
   * 누를 수 없는 카드면 `null` 을 넘긴다.
   *
   * ⚠️ GROUP-02 는 내가 참가하지 않은 여행도 보여준다. 그 카드는 정보만
   *    보여줄 뿐 상세로 들어가지 않는다. 눌리는 표시(active)도 붙이지 않는다.
   *    (2026-09-09 확정) MY 는 항상 함수를 넘기므로 동작이 달라지지 않는다.
   */
  onPress: ((tripId: string) => void) | null;
  /**
   * 모임 이름을 보여줄지. 기본은 지금까지와 같이 보여준다.
   *
   * ⚠️ GROUP-02 는 이미 그 모임 안이라 카드마다 같은 모임 이름이 반복된다.
   *    거기서만 끈다. MY 는 여러 모임의 여행이 섞여 있어 필요하다.
   *    (2026-09-09) **기본값을 바꾸지 않는다.**
   */
  showGroupName?: boolean;
  /**
   * 되돌리기 확인 시트에 필요한 내역을 불러오는 중. 카드에 스피너를 띄운다.
   *
   * ⚠️ 되돌리기는 **버튼이 아니라 카드 자체를 눌러서** 한다. (2026-09-16 · MY-02)
   *    되돌릴 수 있는 취소 여행을 누르면 화면 파일이 여행 홈 대신 CXL-05 확인
   *    시트를 연다. 카드 안에 버튼을 따로 두면 카드 누르기(여행 홈)와 버튼
   *    누르기(되돌리기)가 한 장 안에서 다른 일을 해서 헷갈렸다.
   */
  restoreLoading?: boolean;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
/** 왼쪽 색 띠. 홈의 가로 카드와 같은 규칙이라 두 화면이 한 벌로 보인다. */
const STRIPE = 4;
/**
 * 색을 죽이는 자리.
 *
 * ⚠️ 지난 여행은 **색을 죽이지 않는다.** (2026-09-11)
 *    전에는 끝난 여행이라 무채색으로 뒀는데, 목록이 통째로 회색이라 어느
 *    여행인지 색으로 알아볼 수 없었다. 홈의 지난 여행 태그(LuggageTagCard)는
 *    국가색을 그대로 쓰고 있어서 두 화면이 서로 달라 보이기도 했다.
 *    끝났다는 것은 '결산 완료' 배지와 최종 여행비가 이미 말하고 있다.
 *
 * ⚠️ 이 값은 **취소된 여행과 나간 여행**에만 쓴다. 그 둘은 '더 이상 내
 *    여행이 아니다' 라서 색을 빼는 것이 뜻과 맞는다.
 */
const MUTED = '#B6BCC6';
/** 여행 종료(DONE) 배지. 여행 홈 배지와 같은 값이다. */
const DONE_SOFT = '#eef8f2';
const DONE_INK = '#1c6f4f';
/**
 * 되돌리기 가능 배지. 취소됨(회색)과 구분되게 앱 강조색(HOME_ACCENT)을 쓴다.
 * ⚠️ 노랑·주황을 쓰지 않는다. 경고로 읽혀서 "문제가 있다" 는 인상을 준다. (2026-09-16)
 */
const RESTORABLE_SOFT = '#EFEDFD';
const RESTORABLE_INK = HOME_ACCENT;

/**
 * MY-02 목록의 여행 한 장.
 *
 * 진행 중이면 준비율까지, 지난 여행이면 최종 여행비까지 보여준다.
 * 카드 모양·색 규칙은 홈의 가로 카드를 그대로 따른다.
 */
export function MyTripCard({
  trip,
  onPress,
  showGroupName = true,
  restoreLoading = false,
}: Props) {
  const past = trip.status === TRIP_STATUS.ENDED || trip.status === TRIP_STATUS.SETTLED;
  // 취소된 여행과 나간 여행만 색을 뺀다. 지난 여행은 국가색을 그대로 쓴다.
  const dimmed = trip.status === TRIP_STATUS.CANCELED || trip.left === true;
  const accent = dimmed ? MUTED : trip.color;

  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  /**
   * 되돌릴 수 있는 취소 여행인가.
   * ⚠️ restorable 은 MY '취소됨' 탭에서만 채운다. GROUP-02 에서는 undefined 라
   *    이 카드들이 예전처럼 '취소됨' 으로만 보인다.
   */
  const restorable =
    trip.status === TRIP_STATUS.CANCELED && !trip.left && trip.restorable === true;

  return (
    <Pressable
      // 누를 수 없는 카드는 버튼이 아니다. 스크린리더도 정보로 읽는다.
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        !onPress
          ? destination
          : restorable
            ? `${destination} 여행 되돌리기`
            : `${destination} 여행 홈으로 이동`
      }
      disabled={onPress === null}
      onPress={onPress ? () => onPress(trip.tripId) : undefined}
      className={`flex-row overflow-hidden rounded-2xl bg-white ${
        onPress ? 'active:opacity-80' : ''
      }`}
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{ width: STRIPE, backgroundColor: accent }} />

      <View className="flex-1 px-4 py-3.5">
        <View className="flex-row items-center">
          <Text
            className="flex-1 font-black text-pot-ink"
            style={{ fontSize: 14.5, letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {destination} {trip.flag}
          </Text>

          {/*
            ⚠️ 취소·나간 여행을 **먼저** 가른다. (2026-09-11)
               아래로 내려가면 출발일이 남아 있는 한 D-Day 배지가 붙어서,
               이미 끝난 여행에 '출발까지 12일' 이 뜬다.
          */}
          {restorable ? (
            /*
              되돌리기 가능한 취소 여행. (2026-09-16)
              ⚠️ '취소됨' 과 색을 다르게 둔다. 같은 회색이면 되살릴 수 있는 여행인지
                 카드를 눌러 보기 전까지 알 수 없다.
            */
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: RESTORABLE_SOFT }}>
              <Text className="font-black" style={{ fontSize: 10, color: RESTORABLE_INK }}>
                되돌리기 가능
              </Text>
            </View>
          ) : dimmed ? (
            <View className="rounded-full bg-pot-visual px-2 py-0.5">
              <Text className="font-bold text-pot-mute" style={{ fontSize: 10 }}>
                {trip.left ? '나간 여행' : TRIP_STATUS_LABEL.CANCELED}
              </Text>
            </View>
          ) : past && trip.stage ? (
            /*
              ⚠️ 여행 홈(TRIP-HOME-02) 배지와 같은 말·같은 색이다. (2026-09-15)
                 '결산 전' 하나로 뭉치면 지출이 없는 여행에도 결산을 하라는 말이 된다.
                 끝난 여행(DONE)만 초록, 나머지는 국가색이다.
            */
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: trip.stage === TRIP_STAGE.DONE ? DONE_SOFT : trip.colorSoft }}
            >
              <Text
                className="font-black"
                style={{ fontSize: 10, color: trip.stage === TRIP_STAGE.DONE ? DONE_INK : trip.color }}
              >
                {TRIP_STAGE_LABEL[trip.stage]}
              </Text>
            </View>
          ) : past ? (
            <View className="rounded-full bg-pot-visual px-2 py-0.5">
              <Text className="font-bold text-pot-mute" style={{ fontSize: 10 }}>
                {trip.status === TRIP_STATUS.SETTLED ? '결산 완료' : '결산 전'}
              </Text>
            </View>
          ) : dday ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: trip.colorSoft }}>
              <Text className="font-black" style={{ fontSize: 10, color: trip.color, ...NUM }}>
                {dday}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-1 flex-row items-center">
          <Ionicons name="calendar-outline" size={11} color="#9AA3AE" />
          <Text className="ml-1 text-pot-faint" style={{ fontSize: 11, ...NUM }} numberOfLines={1}>
            {`${dates.start} – ${dates.end}${nights ? `  ·  ${nights}` : ''}`}
          </Text>
          {/* 모임 이름. GROUP-02 처럼 이미 그 모임 안이면 그리지 않는다.
              가운뎃점도 함께 없앤다. 남겨 두면 끝에 점만 떠 있다. */}
          {showGroupName ? (
            <>
              <Text className="mx-1.5 text-pot-line" style={{ fontSize: 11 }}>
                ·
              </Text>
              <Text
                className="flex-1 text-pot-faint"
                style={{ fontSize: 11 }}
                numberOfLines={1}
              >
                {trip.ownerLabel}
              </Text>
            </>
          ) : null}
        </View>

        {/*
          ⚠️ 취소·나간 여행에는 **금액 줄을 그리지 않는다.** (2026-09-11)
             취소된 여행의 예산은 확정된 값이 아니고, 나간 여행의 금액은 더 이상
             내 몫이 아니다. 그대로 두면 '— / —원' 과 빈 진행률 막대가 남아
             무언가 불러오지 못한 것처럼 보인다.
        */}
        {/*
          취소된 여행의 되돌리기 안내. (2026-09-16)
          ⚠️ 버튼도 '눌러서 되돌리기' 안내도 두지 않는다. 카드를 누르면 확인 팝업이
             뜨고, 거기서 되돌릴지 묻는다. 여기는 "언제까지" 만 말한다. (2026-09-16)
          ⚠️ 나간 여행은 제외한다. 내가 나간 여행을 내가 되살리지 않는다.
          ⚠️ restorable 이 undefined 면(GROUP-02) 아무것도 그리지 않는다.
        */}
        {trip.status === TRIP_STATUS.CANCELED && !trip.left && trip.restorable !== undefined ? (
          restorable ? (
            <View className="mt-2.5 flex-row items-center justify-between">
              <Text className="flex-1 text-pot-mute" style={{ fontSize: 11 }} numberOfLines={1}>
                {trip.restoreDeadlineLabel
                  ? `${trip.restoreDeadlineLabel}까지 되돌릴 수 있어요`
                  : '되돌릴 수 있어요'}
              </Text>
              {restoreLoading ? <ActivityIndicator size="small" color={RESTORABLE_INK} /> : null}
            </View>
          ) : (
            <Text className="mt-2.5 text-pot-faint" style={{ fontSize: 11 }}>
              되돌릴 수 있는 기간(3일)이 지났어요
            </Text>
          )
        ) : null}

        {dimmed ? null : past ? (
          <View className="mt-2.5 flex-row items-end justify-between">
            <Text className="text-pot-faint" style={{ fontSize: 10.5 }}>
              최종 여행비
            </Text>
            <Text className="font-black text-pot-ink" style={{ fontSize: 13, ...NUM }}>
              {/*
                ⚠️ '결산 전' 을 여기 또 적지 않는다. 카드 위 배지가 이미 상태를
                   말하고 있어서 같은 말이 한 카드에 두 번 나왔다.
                   (2026-09-21 테스트) 금액 자리에는 금액만 둔다.
              */}
              {trip.finalAmount === null
                ? '—'
                : `${trip.finalAmount.toLocaleString('ko-KR')}원`}
            </Text>
          </View>
        ) : (
          <>
            <Text className="mt-2.5 text-pot-ink" style={{ fontSize: 12, ...NUM }} numberOfLines={1}>
              <Text className="font-black">
                {trip.currentAmount === null ? '—' : trip.currentAmount.toLocaleString('ko-KR')}원
              </Text>
              <Text className="text-pot-faint">
                {' / '}
                {trip.targetAmount === null ? '—' : trip.targetAmount.toLocaleString('ko-KR')}원
              </Text>
            </Text>

            <View className="mt-2 flex-row items-center">
              <View
                className="h-1 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: HOME_TRACK }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(0, rate ?? 0))}%`,
                    backgroundColor: accent,
                  }}
                />
              </View>
              <Text
                className="ml-2 font-black"
                style={{ fontSize: 10.5, color: rate === null ? '#8B94A2' : accent, ...NUM }}
              >
                {rate === null ? '목표 미설정' : `${rate}%`}
              </Text>
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}
