// ============================================================================
// SETTLE-01 어디에 썼나 — 한 줄 누적 막대 (2026-09-08 v3)
//
// 도넛 대신 가로 한 줄이다. 도넛은 조각 각도를 눈으로 비교해야 하지만 가로
// 막대는 길이라 바로 읽힌다. 아래 범례에 이름·비중·금액(만원)을 적는다.
//
// ⚠️ 조각은 금액 순이라 색이 곧 크기다. 국기색 한 색조의 단계를 쓴다.
// ⚠️ 색만으로 구분하게 두지 않는다. 범례에 이름과 금액을 반드시 적는다.
// ============================================================================
import { Text, View } from 'react-native';

import { manwon } from '@/lib/settlement/format';
import type { DonutSlice } from '@/lib/settlement/reportChart';

type Props = {
  slices: DonutSlice[];
  /** 카드 안에 넣을 때. 테두리·여백 없이 그린다 */
  embedded?: boolean;
};

export function SpendCompositionBar({ slices, embedded = false }: Props) {
  if (slices.length === 0) return null;

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
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
        {slices.map((slice) => (
          <View key={slice.label} style={{ flex: slice.ratio, backgroundColor: slice.color }} />
        ))}
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        {slices.map((slice) => (
          <View key={slice.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: slice.color }} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#141b28' }} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={{ fontSize: 11, color: '#98a1ad', width: 36, textAlign: 'right' }}>
              {Math.round(slice.ratio * 100)}%
            </Text>
            <Text
              style={{ fontSize: 12, fontWeight: '800', color: '#141b28', width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] }}
            >
              {manwon(slice.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
