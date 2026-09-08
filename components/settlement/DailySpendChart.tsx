// ============================================================================
// SETTLE-01 일자별 지출 흐름 (2026-09-08 v3 · 데이터 확장)
//
// "언제 제일 많이 썼나" 는 카테고리 합계로는 안 보인다. 여행 날짜마다 막대
// 하나. 가장 큰 날을 국기색으로, 나머지는 옅게. 출발 전 결제(항공·숙소)는
// '여행 전' 한 칸으로 몬다. 없으면 그 칸은 안 그린다.
//
// ⚠️ 막대 위 금액은 만원 단위다. 날마다 여섯 자리를 적으면 막대보다 글자가 크다.
// ⚠️ 여기서 합산하지 않는다. 화면이 날짜별로 묶어 넘긴다.
// ============================================================================
import { Text, View } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';
import { manwon } from '@/lib/settlement/format';
import type { DailySpend } from '@/lib/settlement/report';

export type { DailySpend } from '@/lib/settlement/report';

type Props = {
  theme: CountryTheme;
  buckets: DailySpend[];
  /** 카드 안에 넣을 때. 테두리·여백 없이, 막대도 낮게 */
  embedded?: boolean;
};

export function DailySpendChart({ theme, buckets, embedded = false }: Props) {
  if (buckets.length === 0 || buckets.every((b) => b.amount === 0)) return null;
  const BAR_AREA = embedded ? 56 : 96;
  /*
    ⚠️ 눈금은 **여행 중** 날짜로만 잡는다. 항공·숙소를 미리 결제한 '여행 전' 이
       보통 하루치의 몇 배라, 같이 재면 여행 중 막대가 전부 납작해진다.
       여행 전·후 칸은 눈금을 넘기면 꼭대기에서 잘라 그린다.
  */
  const inTrip = buckets.filter((b) => b.inTrip);
  const scaleBase = inTrip.some((b) => b.amount > 0) ? inTrip : buckets;
  const max = Math.max(1, ...scaleBase.map((b) => b.amount));
  const peak = scaleBase.reduce((best, b) => (b.amount > best.amount ? b : best), scaleBase[0]);
  const outside = buckets.filter((b) => !b.inTrip && b.amount > 0);
  // 칸이 많으면 글자를 줄인다. 열흘 넘는 여행도 한 줄에 들어가야 한다
  const dense = buckets.length > 7;

  return (
    <View
      style={
        embedded
          ? undefined
          : {
              borderWidth: 1,
              borderColor: '#e8eaee',
              borderRadius: 16,
              backgroundColor: '#fff',
              padding: 16,
            }
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: dense ? 3 : 6, height: BAR_AREA + 34 }}>
        {buckets.map((bucket) => {
          const isPeak = bucket.key === peak.key && bucket.amount > 0;
          const height = Math.min(
            BAR_AREA,
            Math.max(bucket.amount > 0 ? 4 : 2, Math.round((bucket.amount / max) * BAR_AREA)),
          );
          return (
            <View key={bucket.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {bucket.amount > 0 && (isPeak || !dense) ? (
                <Text
                  style={{
                    fontSize: dense ? 7 : 9,
                    fontWeight: isPeak ? '900' : '700',
                    color: isPeak ? theme.primary : '#7c8695',
                    marginBottom: 3,
                  }}
                  numberOfLines={1}
                >
                  {manwon(bucket.amount).replace('원', '')}
                </Text>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height,
                  borderRadius: 4,
                  backgroundColor: isPeak
                    ? theme.primary
                    : bucket.inTrip
                      ? theme.primarySoft
                      : '#e8eaee',
                  borderWidth: isPeak || !bucket.inTrip ? 0 : 1,
                  borderColor: theme.primary,
                }}
              />
              <Text
                style={{ marginTop: 6, fontSize: dense ? 8 : 10, fontWeight: isPeak ? '900' : '700', color: isPeak ? theme.primary : '#5d6674' }}
                numberOfLines={1}
              >
                {bucket.label}
              </Text>
              {bucket.sub && !dense ? (
                <Text style={{ fontSize: 8, color: '#a8afb9' }} numberOfLines={1}>
                  {bucket.sub}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {peak.amount > 0 ? (
        <Text style={{ marginTop: 10, fontSize: 11, color: '#5d6674' }}>
          {'최대 지출일 '}
          <Text style={{ fontWeight: '900', color: theme.primary }}>{peak.label}</Text>
          {` · ${manwon(peak.amount)}`}
          {outside.length > 0
            ? ` · ${outside.map((b) => `${b.label} 결제 ${manwon(b.amount)}`).join(' · ')}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}
