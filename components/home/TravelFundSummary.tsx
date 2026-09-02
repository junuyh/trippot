import { Text, View } from 'react-native';

import { SectionHeader } from './SectionHeader';
import type { HomeFundSummaryData } from './types';

type Props = {
  fund: HomeFundSummaryData;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 내 여행자금 현황.
 *
 * TripPot 이 여행 앱이 아니라 **여행 금융 서비스**라는 걸 보여주는 자리다.
 * 다만 금융 대시보드처럼 만들지 않는다. 숫자 두 개와 여행별 준비율 막대까지만 둔다.
 *
 * 주의: 여기 합계는 여행마다 하나씩 있는 현재 여행자금을 더한 값이다.
 *       한 여행 안에서 직접입력 금액과 계좌 잔액을 합치는 것과는 다르다.
 *       그건 금지돼 있다. (CLAUDE.md 3장)
 */
export function TravelFundSummary({ fund }: Props) {
  return (
    <View>
      <SectionHeader title="내 여행자금 현황" />

      <View className="rounded-2xl border border-pot-line bg-white px-5 py-5">
        <Text className="text-pot-faint" style={{ fontSize: 11.5 }}>
          진행 중인 여행에 준비된 여행자금
        </Text>
        <View className="mt-1.5 flex-row items-end">
          <Text
            className="font-black text-pot-ink"
            style={{ fontSize: 26, letterSpacing: -0.9, ...NUM }}
          >
            {fund.currentTotal.toLocaleString('ko-KR')}
          </Text>
          <Text className="mb-0.5 ml-1 font-bold text-pot-ink" style={{ fontSize: 15 }}>
            원
          </Text>
        </View>

        <View className="mt-2 flex-row items-center">
          <View className="rounded-full bg-pot-visual px-2 py-1">
            <Text className="font-bold text-pot-mute" style={{ fontSize: 11 }}>
              이번 달 적립
            </Text>
          </View>
          <Text className="ml-2 font-bold text-pot-ink" style={{ fontSize: 13, ...NUM }}>
            {fund.monthlyDeposit > 0
              ? `+${fund.monthlyDeposit.toLocaleString('ko-KR')}원`
              : '아직 없어요'}
          </Text>
        </View>

        {fund.trips.length > 0 ? (
          <>
            <View className="my-4 border-t border-dashed border-pot-dash" />

            <View className="gap-2.5">
              {fund.trips.map((trip) => (
                <View key={trip.tripId} className="flex-row items-center">
                  <Text
                    className="text-pot-mute"
                    style={{ fontSize: 12.5, width: 76 }}
                    numberOfLines={1}
                  >
                    {trip.destination ?? '여행지 미정'}
                  </Text>

                  <View className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-pot-visual">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, trip.ratePercent ?? 0))}%`,
                        backgroundColor: trip.color,
                      }}
                    />
                  </View>

                  <Text
                    className="font-bold text-pot-ink"
                    style={{ fontSize: 12, width: 42, textAlign: 'right', ...NUM }}
                  >
                    {trip.ratePercent === null ? '—' : `${trip.ratePercent}%`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
