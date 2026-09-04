// ============================================================================
// 준비 중인 여행 배너 (2026-09-04 개편)
//
//   ICN ┄┄┄┄ ✈ ┄┄┄┄ PVG                            CN
//                                        ╭─────╮
//   SHANGHAI                             │ D-7 │  ← 국가색 옅은 배지
//                        🏙 랜드마크 선그림  ╰─────╯
//   🗓 08.28 - 09.04 │ 7박 8일 │ 👤 4명 │ [ 여행계 ]
//   ────────────────────────────────────────────
//   여행자금                              목표의 1%
//   ₩ 84,000
//   ▬▬──────────────────────────────────────────
//   목표 ₩ 8,400,000
//
// ⚠️ 이 카드에는 **필요한 값만 둔다.**
//    지나온 시도들에서 뺀 것 —
//      · 파스텔 그라데이션 물빛 — 정보를 하나도 더 주지 않는다
//      · 준비 체크리스트 — 진행률 막대가 이미 같은 말을 한다
//      · 사진 — 검은 글자가 안 읽혀 흰색으로 덮어야 했고, 그러면 무슨 사진인지도
//        알아보기 어려워졌다
//
// ⚠️ 바탕은 흰색이다. 파스텔을 깔아봤지만 색 면이 생기는 순간 그 위 글자가
//    다 무거워 보였다. 색은 면이 아니라 **작은 조각에만** 둔다 —
//    D-Day 배지 · 준비율 숫자 · 진행률 막대 · 랜드마크 선그림.
//    같은 색을 비율만 달리해 섞으므로 카드 한 장이 한 벌로 보인다.
//
// ⚠️ 랜드마크는 **국가색 선그림**이다. 예전에는 회색 실루엣이었는데,
//    그건 카드 바탕이 파스텔이던 시절의 결정이다. 색 면 위에서는 같은 계열의
//    색 실루엣이 얼룩처럼 뭉쳐서 무채색이라야 했다. 바탕이 흰색이 된 지금은
//    국가색이 다른 요소(배지·막대)와 한 벌로 읽히고, 면이 아니라 가는 선이라
//    글자를 누르지도 않는다.
//
// ⚠️ 오른쪽 아래에 동그란 화살표를 뒀다가 뺐다. 카드 전체가 이미 누름 영역인데
//    그 안에 버튼처럼 생긴 것을 두면 거기만 눌러야 하는 줄 안다.
//    누를 수 있다는 신호는 카드가 뜬 모양(그림자)으로 충분하다.
//
// ⚠️ countryTheme 은 여러 화면이 함께 쓰는 파일이라 고치지 않았다.
//    파스텔은 이 카드 안에서 만든다. (CLAUDE.md 5장)
//
// ⚠️ 카드에 적는 값은 전부 실제로 아는 값이다. 항공편명·게이트처럼
//    모르는 값을 그럴듯하게 채워 넣지 않는다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { TRIP_OWNER_TYPE, TRIP_OWNER_TYPE_LABEL } from '@/lib/constants/status';

import { calcReadyRatePercent, formatDDay, formatNights, formatTripDates } from './format';
import { LandmarkArt } from './landmarkScene';
import type { OngoingTripCardData } from './types';

type Props = {
  trip: OngoingTripCardData;
  width: number;
  onPress: (tripId: string) => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

// ⚠️ 여백과 글자를 한 번 크게 잡았다가 되돌렸다. 홈은 훑는 화면이라
//    카드 한 장이 화면 절반을 차지하면 그 아래가 있다는 것도 모른다.
//    배치는 그대로 두고 치수만 줄였다.
const INSET = 12;
const RADIUS = 18;

/** 랜드마크 선그림이 차지하는 자리. 카드 오른쪽, 글자 단 옆이다. */
const ART_RATIO = 0.45;
const ART_HEIGHT = 80;
const ART_TOP = 2;
/**
 * 그림 옆 글자 단의 최소 높이.
 *
 * ⚠️ 이 값이 그림 아래로 정보 줄이 내려오게 붙잡는다. 도시 이름이 짧아 글자 단이
 *    낮아져도 정보 줄이 그림 위로 올라오지 않는다. ART_TOP + ART_HEIGHT 보다
 *    커야 하고, 둘 중 하나를 고치면 이 값도 같이 본다.
 */
const COLUMN_MIN_HEIGHT = 72;

const INK = '#111827';
/** 라벨·보조 글자. */
const LABEL = '#9aa3af';
/** 본문 회색. 날짜 줄에 쓴다. */
const BODY = '#6b7280';
/** 칸을 나누는 아주 옅은 선. 카드 안에서 두 덩이를 가른다. */
const HAIRLINE = '#eff1f4';
/** 진행률 막대 바탕. */
const TRACK = '#eef0f4';
/** 출발 공항. 로그인·항공권 연동 전까지 인천 고정이다. */
const ORIGIN_CODE = 'ICN';

/** D-Day 배지 바탕의 국가색 비율. 흰 바탕에서 알약으로 읽히는 최소값이다. */
const DDAY_TINT = 0.14;
/**
 * 랜드마크 그림의 가리개와 선.
 *
 * 가리개는 카드 바탕과 같은 흰색이다. 색을 칠하려는 게 아니라 앞 건물이
 * 뒤 건물의 선을 덮게 하려는 것이다. 선은 국가색을 아주 옅게 섞어
 * 배경으로 물러나게 한다. 진하게 하면 도시 이름보다 먼저 보인다.
 */
const ART_FILL = '#FFFFFF';
const ART_LINE_TINT = 0.32;

/**
 * 국가색을 흰색에 섞어 파스텔을 만든다.
 *
 * ⚠️ 반투명(알파)이 아니라 아예 섞어서 불투명한 색을 만든다.
 *    알파를 쓰면 겹친 자리마다 색이 달라져서 같은 톤으로 맞출 수 없다.
 */
function pastel(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) => {
    const channel = parseInt(value.slice(start, start + 2), 16);
    return Math.round(255 + (channel - 255) * ratio);
  };
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(0))}${to2(mix(2))}${to2(mix(4))}`;
}

/**
 * 도시 이름 크기. 카드 폭에 대한 비율이다.
 *
 * 이 카드에서 가장 큰 글자다. 어느 여행인지를 한눈에 알리는 것이 이 카드의 일이고,
 * 그 일을 도시 이름이 한다. HONG KONG 처럼 긴 이름은 한 줄에 들어오게 줄인다.
 */
function cityFontRatio(name: string): number {
  if (name.length <= 5) return 0.082;
  if (name.length <= 8) return 0.068;
  if (name.length <= 10) return 0.055;
  return 0.048;
}

export function NextTripBanner({ trip, width, onPress }: Props) {
  const destination = trip.destination ?? '여행지 미정';
  const dday = formatDDay(trip.startDate);
  const dates = formatTripDates(trip.startDate, trip.endDate);
  const nights = formatNights(trip.startDate, trip.endDate);
  const rate = calcReadyRatePercent(trip.currentAmount, trip.targetAmount);
  const isGroup = trip.ownerType === TRIP_OWNER_TYPE.GROUP;
  const ownerLabel = isGroup
    ? (trip.groupName ?? TRIP_OWNER_TYPE_LABEL.GROUP)
    : TRIP_OWNER_TYPE_LABEL.PERSONAL;

  const artWidth = width * ART_RATIO;
  // 글자 단은 그림과 겹치지 않는 만큼만 쓴다. 겹치면 도시 이름 위로 건물이 지나간다.
  const columnWidth = Math.max(0, width - INSET - 12 - artWidth - 10);
  const cityFont = width * cityFontRatio(trip.destinationEn);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${destination} 여행 준비 홈으로 이동`}
      onPress={() => onPress(trip.tripId)}
      className="overflow-hidden bg-white active:opacity-90"
      style={{
        width,
        borderRadius: RADIUS,
        // ⚠️ 테두리를 쓰지 않는다. 카드가 바탕에서 뜨는 일은 그림자 하나로 한다.
        //    선과 그림자를 같이 두면 경계가 두 겹이라 카드가 무거워 보인다.
        shadowColor: '#1b2540',
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      {/* 랜드마크 선그림. 그림 자체는 components/home/landmarkScene 에 있다 */}
      <LandmarkArt
        countryKo={trip.countryKo}
        fill={ART_FILL}
        line={pastel(trip.theme.primary, ART_LINE_TINT)}
        width={artWidth}
        height={ART_HEIGHT}
        style={{ position: 'absolute', right: 12, top: ART_TOP }}
      />

      {/*
        국가 코드.

        ⚠️ 'NEXT TRIP' 라벨과 국기 이모지를 함께 뒀다가 둘 다 뺐다.
           카드가 홈의 '준비 중인 여행' 칸에 있으니 NEXT TRIP 은 이미 아는 말이고,
           오른쪽 위에 두 개가 붙어 있으면 그 아래 D-Day 까지 세 덩이가 겹쳐 보였다.
           나라를 알리는 일은 코드 하나와 랜드마크 그림이 나눠 한다.

        ⚠️ 국가를 모르는 목적지의 코드는 '--' 다. 뜻 없는 기호를 띄우지 않는다.
      */}
      {trip.theme.code === '--' ? null : (
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: INSET,
            top: INSET,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.6,
            color: INK,
          }}
        >
          {trip.theme.code}
        </Text>
      )}

      {/* D-Day */}
      {dday ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: INSET - 2,
            top: INSET + 16,
            alignItems: 'center',
            backgroundColor: pastel(trip.theme.primary, DDAY_TINT),
            borderRadius: 9,
            paddingHorizontal: 7,
            paddingVertical: 3,
          }}
        >
          {/* ⚠️ 'D-7' 아래 '출발까지' 를 붙였다가 뺐다. D-N 이 이미 출발까지 남은
              날이라는 뜻이라 같은 말을 두 번 하고, 알약만 두 줄로 커졌다. */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: -0.3,
              color: trip.theme.primary,
              ...NUM,
            }}
          >
            {dday}
          </Text>
        </View>
      ) : null}

      <View style={{ padding: INSET }}>
        {/* 왼쪽 글자 단. 오른쪽은 그림과 D-Day 자리다 */}
        <View style={{ width: columnWidth, minHeight: COLUMN_MIN_HEIGHT }}>
          {/* 경로 */}
          <View className="flex-row items-center">
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {ORIGIN_CODE}
            </Text>
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            {/*
              ⚠️ 45도 돌렸다가 되돌렸다. 점선과 나란히 놓으려던 것인데 기수가
                 아래를 향해 **하강하는 비행기**로 보였다. 출발을 앞둔 카드에서
                 내려가는 비행기는 읽고 싶지 않은 그림이다.

                 돌리지 않은 Ionicons 비행기는 오른쪽 위를 향한다. 여행 준비 홈의
                 보딩패스(components/trip-home/TravelTicketCard)도 항로 위에
                 그대로 얹어 쓰고 있어서 두 화면의 비행기가 같은 방향이 된다.
            */}
            <Ionicons name="airplane" size={12} color={INK} />
            <View
              className="flex-1"
              style={{
                marginHorizontal: 6,
                borderTopWidth: 1,
                borderStyle: 'dashed',
                borderColor: '#d7dce3',
              }}
            />
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 1, color: BODY }}>
              {trip.airportCode}
            </Text>
          </View>

          {/* 도시 */}
          <Text
            numberOfLines={1}
            style={{
              marginTop: 3,
              fontSize: cityFont,
              lineHeight: cityFont * 1.08,
              // ⚠️ 800 이면 도시 이름만 카드에서 튀어나와 보였다. 크기로 이미
              //    가장 큰 글자라 굵기까지 최대일 이유가 없다.
              fontWeight: '700',
              letterSpacing: -0.8,
              color: INK,
            }}
          >
            {trip.destinationEn}
          </Text>
        </View>

        {/*
          일정 · 기간 · 인원 · 누구의 여행인가 — 한 줄.

          ⚠️ 두 줄로 나눴다가 한 줄로 붙였다. 넷 다 '이 여행이 어떤 여행인가' 를
             말하는 같은 종류의 값이라 줄을 나누면 위아래가 다른 이야기처럼 보인다.

          ⚠️ 이 줄만 카드 폭을 다 쓴다. 한글은 글자 하나가 넓어서 왼쪽 단(그림 옆)
             안에서는 네 조각이 절대 한 줄에 들어오지 않는다. 그래서 그림은
             이 줄 위에서 끝난다. (ART_TOP + ART_HEIGHT)
        */}
        <View className="mt-2 flex-row items-center">
          <Ionicons name="calendar-outline" size={11} color={LABEL} />
          <Text style={{ marginLeft: 5, fontSize: 10.5, color: BODY, ...NUM }} numberOfLines={1}>
            {`${dates.start} - ${dates.end}`}
          </Text>

          {nights ? (
            <>
              <MetaDivider />
              <Text style={{ fontSize: 10.5, color: BODY, ...NUM }} numberOfLines={1}>
                {nights}
              </Text>
            </>
          ) : null}

          <MetaDivider />
          <Ionicons name="person-outline" size={11} color={LABEL} />
          <Text style={{ marginLeft: 5, fontSize: 10.5, color: BODY, ...NUM }}>
            {`${trip.headcount}명`}
          </Text>

          <MetaDivider />
          <View
            className="flex-row items-center"
            style={{
              // 모임명이 길면 알약만 줄어든다. 날짜·인원은 잘리면 안 되는 값이다
              flexShrink: 1,
              minWidth: 0,
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2.5,
            }}
          >
            <Ionicons
              name={isGroup ? 'people-outline' : 'person-circle-outline'}
              size={10}
              color={BODY}
            />
            <Text
              numberOfLines={1}
              style={{ marginLeft: 3.5, fontSize: 10, fontWeight: '600', color: '#374151' }}
            >
              {ownerLabel}
            </Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: HAIRLINE, marginTop: 9, marginBottom: 8 }} />

        {/* 여행자금 */}
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 11, fontWeight: '600', color: LABEL }}>여행자금</Text>

          {/* 준비율. 숫자만 국가색이라 눈이 숫자에 먼저 간다 */}
          <View className="flex-row items-end">
            {rate === null ? (
              <Text style={{ fontSize: 11, color: BODY }}>목표 미설정</Text>
            ) : (
              <>
                <Text style={{ fontSize: 10.5, color: BODY, marginRight: 3, marginBottom: 1 }}>
                  목표의
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '800',
                    letterSpacing: -0.4,
                    color: trip.theme.primary,
                    ...NUM,
                  }}
                >
                  {rate}
                </Text>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '800',
                    color: trip.theme.primary,
                    marginBottom: 1.5,
                  }}
                >
                  %
                </Text>
              </>
            )}
          </View>
        </View>

        <Text
          numberOfLines={1}
          style={{
            marginTop: 1,
            fontSize: 20,
            fontWeight: '800',
            letterSpacing: -0.7,
            color: INK,
            ...NUM,
          }}
        >
          {trip.currentAmount === null ? '—' : `₩ ${trip.currentAmount.toLocaleString('ko-KR')}`}
        </Text>

        {/* 진행률 */}
        <View
          className="overflow-hidden"
          style={{
            marginTop: 8,
            height: 6,
            borderRadius: 999,
            backgroundColor: TRACK,
          }}
        >
          <View
            style={{
              height: '100%',
              borderRadius: 999,
              width: `${Math.min(100, Math.max(0, rate ?? 0))}%`,
              backgroundColor: trip.theme.primary,
            }}
          />
        </View>

        <Text style={{ marginTop: 5, fontSize: 10.5, color: LABEL, ...NUM }} numberOfLines={1}>
          {trip.targetAmount === null
            ? '목표 여행비를 아직 정하지 않았어요'
            : `목표 ₩ ${trip.targetAmount.toLocaleString('ko-KR')}`}
        </Text>
      </View>

    </Pressable>
  );
}

/** 정보 줄의 칸막이. 네 조각이 한 줄에 붙어 있어서 구분이 필요하다. */
function MetaDivider() {
  return <View style={{ width: 1, height: 9, marginHorizontal: 8, backgroundColor: '#e5e7eb' }} />;
}
