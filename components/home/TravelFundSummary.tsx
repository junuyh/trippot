import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { HOME_ACCENT, HOME_ACCENT_SOFT } from './palette';
import type { HomeFundSummaryData, HomeFundTripBar } from './types';

type Props = {
  fund: HomeFundSummaryData;
};

const NUM = { fontVariant: ['tabular-nums' as const] };
const DONUT = 116;
const RING = 15;
const RADIUS = (DONUT - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** 준비된 금액이 하나도 없을 때 도넛 바탕. */
const EMPTY_RING = '#E4E6F5';

/**
 * 내 여행자금 현황.
 *
 * TripPot 이 여행 앱이 아니라 **여행 금융 서비스**라는 걸 보여주는 자리다.
 * 다만 금융 대시보드처럼 만들지 않는다. 큰 숫자 하나와 도넛 하나까지만 둔다.
 *
 * ⚠️ 여기 합계는 여행마다 하나씩 있는 현재 여행자금을 더한 값이다.
 *    한 여행 안에서 직접입력 금액과 계좌 잔액을 합치는 것과는 다르다.
 *    그건 금지돼 있다. (CLAUDE.md 3장)
 *
 * 도넛 조각 크기는 **준비된 금액의 비중**이고, 가운데 숫자는 전체 준비율이다.
 * 둘은 다른 값이다. 조각이 크다고 준비를 많이 한 게 아니라 금액이 큰 것이다.
 */
export function TravelFundSummary({ fund }: Props) {
  const total = fund.trips.reduce((sum, trip) => sum + trip.currentAmount, 0);

  return (
    <View className="rounded-3xl px-5 py-5" style={{ backgroundColor: HOME_ACCENT_SOFT }}>
      <Text
        className="font-black text-pot-ink"
        style={{ fontSize: 16, letterSpacing: -0.5 }}
      >
        내 여행자금 현황
      </Text>

      <View className="mt-3 flex-row items-center">
        <View className="flex-1 pr-2">
          <Text className="text-pot-mute" style={{ fontSize: 11.5 }}>
            지금까지 준비한 여행자금
          </Text>
          <Text
            className="mt-1 font-black text-pot-ink"
            style={{ fontSize: 22, letterSpacing: -0.8, ...NUM }}
          >
            {fund.currentTotal.toLocaleString('ko-KR')}원
          </Text>

          <View className="mt-2.5 flex-row items-center">
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: HOME_ACCENT }}>
              <Text className="font-bold text-white" style={{ fontSize: 10 }}>
                이번 달
              </Text>
            </View>
            <Text className="ml-1.5 font-bold text-pot-ink" style={{ fontSize: 12.5, ...NUM }}>
              {fund.monthlyDeposit > 0
                ? `+${fund.monthlyDeposit.toLocaleString('ko-KR')}원 적립`
                : '적립 내역 없음'}
            </Text>
          </View>
        </View>

        <Donut trips={fund.trips} total={total} centerLabel={fund.overallRatePercent} />
      </View>

      {fund.trips.length > 0 ? (
        <View className="mt-4 gap-2">
          {fund.trips.map((trip) => (
            <View key={trip.tripId} className="flex-row items-center">
              <View
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: trip.color }}
              />
              <Text
                className="ml-2 flex-1 text-pot-ink"
                style={{ fontSize: 12.5 }}
                numberOfLines={1}
              >
                {trip.destination ?? '여행지 미정'}
              </Text>
              <Text className="text-pot-mute" style={{ fontSize: 11.5, ...NUM }}>
                {trip.currentAmount.toLocaleString('ko-KR')}원
              </Text>
              <Text
                className="ml-2.5 font-black text-pot-ink"
                style={{ fontSize: 12.5, width: 40, textAlign: 'right', ...NUM }}
              >
                {trip.ratePercent === null ? '—' : `${trip.ratePercent}%`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * 여행별 준비 금액 비중 도넛.
 *
 * strokeDasharray 로 조각을 그린다. 조각마다 원을 하나씩 겹쳐 놓고
 * 앞 조각들의 길이만큼 dashoffset 을 밀어 시작점을 옮기는 방식이다.
 * 금액이 0원인 여행은 그릴 조각이 없어 건너뛴다.
 */
function Donut({
  trips,
  total,
  centerLabel,
}: {
  trips: HomeFundTripBar[];
  total: number;
  centerLabel: number | null;
}) {
  let offset = 0;

  return (
    <View style={{ width: DONUT, height: DONUT }}>
      <Svg width={DONUT} height={DONUT}>
        {/* 12시 방향에서 시작하도록 돌린다. */}
        <G rotation={-90} origin={`${DONUT / 2}, ${DONUT / 2}`}>
          <Circle
            cx={DONUT / 2}
            cy={DONUT / 2}
            r={RADIUS}
            stroke={EMPTY_RING}
            strokeWidth={RING}
            fill="none"
          />
          {total > 0
            ? trips.map((trip) => {
                if (trip.currentAmount <= 0) return null;
                const length = (trip.currentAmount / total) * CIRCUMFERENCE;
                const dash = `${length} ${CIRCUMFERENCE - length}`;
                const start = -offset;
                offset += length;
                return (
                  <Circle
                    key={trip.tripId}
                    cx={DONUT / 2}
                    cy={DONUT / 2}
                    r={RADIUS}
                    stroke={trip.color}
                    strokeWidth={RING}
                    fill="none"
                    strokeDasharray={dash}
                    strokeDashoffset={start}
                  />
                );
              })
            : null}
        </G>
      </Svg>

      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-pot-mute" style={{ fontSize: 10 }}>
          전체 준비율
        </Text>
        <Text
          className="font-black"
          style={{ fontSize: 20, color: HOME_ACCENT, letterSpacing: -0.5, ...NUM }}
        >
          {centerLabel === null ? '—' : `${centerLabel}%`}
        </Text>
      </View>
    </View>
  );
}
