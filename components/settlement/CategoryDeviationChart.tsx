// ============================================================================
// SETTLE-01 계획과 얼마나 달랐나 — 가운데 기준선 좌우로 뻗는 막대 (2026-09-08 v3)
//
// 카테고리 여덟 줄에 계획·실제 여섯 자리 숫자를 나란히 적으면 표가 된다.
// 결산에서 알고 싶은 건 "어디서 빗나갔나" 하나라, 기준선(계획)에서 오른쪽은
// 초과(빨강), 왼쪽은 절약(초록)으로 편차만 그린다. 계획대로 쓴 줄은 점 하나다.
// 이 편차가 다음 여행 개인화의 근거다. (CLAUDE.md 2장)
//
// ⚠️ 막대 길이는 **금액**에 비례한다. 비율로 그리면 5만원짜리의 +50% 가
//    100만원짜리의 +10% 보다 길어진다. 근거 정렬(travelType)과 같은 원칙.
// ⚠️ 지출 기록이 없으면 '절약' 이라고 말하지 않는다. "기록 없음" 으로 둔다.
// ⚠️ 카테고리를 누르면 그 카테고리의 BUDGET-02 로 간다. 스냅샷이면 안 눌린다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import { CATEGORY_CODE_LABEL } from '@/lib/constants/status';
import { manwon, manwonSigned } from '@/lib/settlement/format';

import type { CategoryComparison } from './CategoryComparisonList';

const OVER = '#d64550';
const SAVED = '#18865e';
const INK = '#141b28';

type Props = {
  categories: CategoryComparison[];
  onSelect?: (categoryId: string) => void;
  /** 카드 안에 넣을 때. 테두리·바깥 여백 없이, 위쪽 n개만 */
  embedded?: boolean;
  limit?: number;
};

export function CategoryDeviationChart({ categories, onSelect, embedded = false, limit }: Props) {
  const sorted = [...categories]
    .sort((a, b) => {
      // 기록 없는 카테고리는 뒤로. 편차가 큰 순
      const aNone = a.actualAmount === 0;
      const bNone = b.actualAmount === 0;
      if (aNone !== bNone) return aNone ? 1 : -1;
      return Math.abs(b.actualAmount - b.plannedAmount) - Math.abs(a.actualAmount - a.plannedAmount);
    })
    .slice(0, limit ?? categories.length);
  const maxDiff = Math.max(1, ...sorted.map((c) => (c.actualAmount > 0 ? Math.abs(c.actualAmount - c.plannedAmount) : 0)));

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
              paddingVertical: 6,
            }
      }
    >
      {/* 축 설명 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: embedded ? 0 : 16, paddingTop: embedded ? 0 : 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: SAVED }}>◀ 절약</Text>
        <Text style={{ fontSize: 9, fontWeight: '700', color: '#98a1ad' }}>계획</Text>
        <Text style={{ fontSize: 9, fontWeight: '800', color: OVER }}>초과 ▶</Text>
      </View>

      {sorted.map((category) => {
        const diff = category.actualAmount - category.plannedAmount;
        const noRecord = category.actualAmount === 0;
        const ratio = noRecord ? 0 : Math.abs(diff) / maxDiff;
        const color = noRecord ? '#c4cad3' : diff > 0 ? OVER : diff < 0 ? SAVED : '#98a1ad';
        const canPress = Boolean(onSelect && category.categoryId);
        const label = noRecord ? '기록 없음' : diff === 0 ? '계획대로' : manwonSigned(diff);

        return (
          <Pressable
            key={category.categoryCode}
            accessibilityRole={canPress ? 'button' : undefined}
            accessibilityLabel={`${CATEGORY_CODE_LABEL[category.categoryCode]} ${label}`}
            disabled={!canPress}
            onPress={() => category.categoryId && onSelect?.(category.categoryId)}
            className={canPress ? 'active:bg-gray-50' : undefined}
            style={{ paddingHorizontal: embedded ? 0 : 16, paddingVertical: embedded ? 6 : 9 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15, width: 20 }}>{CATEGORY_EMOJI[category.categoryCode]}</Text>
              <Text style={{ width: 58, fontSize: 12, fontWeight: '800', color: INK }} numberOfLines={1}>
                {CATEGORY_CODE_LABEL[category.categoryCode]}
              </Text>

              {/* 기준선 좌우 막대 */}
              <View style={{ flex: 1, height: 14, justifyContent: 'center' }}>
                <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#d9dde3' }} />
                {noRecord || diff === 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: '50%',
                      marginLeft: -3,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: color,
                    }}
                  />
                ) : diff > 0 ? (
                  <View
                    style={{
                      position: 'absolute',
                      left: '50%',
                      width: `${Math.max(3, ratio * 50)}%`,
                      height: 10,
                      borderTopRightRadius: 5,
                      borderBottomRightRadius: 5,
                      backgroundColor: color,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      position: 'absolute',
                      right: '50%',
                      width: `${Math.max(3, ratio * 50)}%`,
                      height: 10,
                      borderTopLeftRadius: 5,
                      borderBottomLeftRadius: 5,
                      backgroundColor: color,
                    }}
                  />
                )}
              </View>

              <Text
                style={{ width: 62, textAlign: 'right', fontSize: 12, fontWeight: '900', color, fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {label}
              </Text>
              {canPress ? <Ionicons name="chevron-forward" size={13} color="#a8afb9" /> : <View style={{ width: 13 }} />}
            </View>
            <Text style={{ marginLeft: 28, marginTop: 2, fontSize: 9, color: '#98a1ad' }}>
              계획 {manwon(category.plannedAmount)} · 실제 {manwon(category.actualAmount)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
