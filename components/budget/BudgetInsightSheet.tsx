// ============================================================================
// BUDGET-01 지난 여행 지출 분석 — 진입 버튼 + 바텀시트
//
// ⚠️ 분석을 본문에 펼치지 않는다. 본문은 카테고리별 예산이 주인공이고,
//    분석은 필요할 때 열어 보는 것이다. (스펙)
//
// ⚠️ '선택 항목 반영하기' / '이번엔 괜찮아요' 버튼을 두지 않는다.
//    토글을 바꾸는 순간이 곧 사용자의 확정 행동이다.
//    (추천이 사용자 대신 확정하지 않는다 — CLAUDE.md 4장)
//
// ⚠️ 토글 초기 상태는 DB 의 applied_source 에서 온다. 열자마자 전부 켜 두면
//    사용자가 손대지도 않았는데 예산이 바뀐 것처럼 보이고,
//    BUDGET-02 에서 직접 고친 금액을 덮어쓸 수 있다.
//
// 색 규칙: 추가 추천만 레드, 절약 추천만 그린. 조정 없음은 회색.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { CATEGORY_EMOJI } from '@/lib/constants/categoryEmoji';
import type { CountryTheme } from '@/lib/constants/countryTheme';
import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

const GREEN = '#16805d';
const MUTED = '#7c8695';
const LINE = '#e8eaee';

export type InsightItem = {
  categoryId: string;
  categoryCode: CategoryCode;
  /** 불변 원본. 토글을 끄면 이 값으로 돌아간다 */
  recommendedAmount: number;
  /** 지난 여행을 반영한 금액 */
  personalizedAmount: number;
  /** 지난 여행 계획 대비 실제. basis point 정수. 2000 = +20% */
  deviationBp: number;
  /** 지금 이 추천이 예산에 반영돼 있는지 */
  applied: boolean;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

/** basis point 를 사람이 읽는 퍼센트로. 2000 → '20' */
function percentText(bp: number): string {
  return Math.abs(bp / 100)
    .toFixed(1)
    .replace(/\.0$/, '');
}

// ── 진입 버튼 ───────────────────────────────────────────────────────────
export function BudgetInsightButton({
  items,
  onPress,
}: {
  items: InsightItem[];
  onPress: () => void;
}) {
  if (items.length === 0) return null;

  const appliedCount = items.filter((item) => item.applied).length;
  const appliedSum = items
    .filter((item) => item.applied)
    .reduce((sum, item) => sum + (item.personalizedAmount - item.recommendedAmount), 0);

  // 아직 아무것도 반영하지 않았으면 '조정할 수 있어요' 로 안내한다.
  // 반영한 게 없는데 '조정했어요' 라고 하면 사실과 다르다.
  const headline =
    appliedCount === 0
      ? `예산을 ${won(Math.abs(totalOffer(items)))} 조정할 수 있어요`
      : `예산을 ${won(Math.abs(appliedSum))} ${appliedSum >= 0 ? '늘렸어요' : '줄였어요'}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="지난 여행 지출 분석 보기"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: LINE,
        borderRadius: 15,
        backgroundColor: '#fff',
      }}
      className="active:bg-gray-50"
    >
      {/* 아이콘 뒤에 컬러 배경을 두지 않는다 (스펙) */}
      <Text style={{ fontSize: 21 }}>💡</Text>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, color: MUTED }}>지난 여행 지출 분석</Text>
        <Text style={{ marginTop: 3, fontSize: 13, fontWeight: '700', color: '#141b28' }}>
          {headline}
        </Text>
        <View className="flex-row" style={{ gap: 6, marginTop: 6 }}>
          <Text
            style={{
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 10,
              backgroundColor: '#f5f6f8',
              fontSize: 9,
              color: '#66717f',
            }}
          >
            {appliedCount}개 항목 적용 중
          </Text>
          <Text
            style={{
              paddingHorizontal: 6,
              paddingVertical: 3,
              borderRadius: 10,
              backgroundColor: '#f5f6f8',
              fontSize: 9,
              color: '#66717f',
            }}
          >
            항목별 변경 가능
          </Text>
        </View>
      </View>

      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#f5f6f8',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-forward" size={14} color="#66717f" />
      </View>
    </Pressable>
  );
}

/** 전부 반영했을 때의 조정 합계. 안내 문구에만 쓴다 */
function totalOffer(items: InsightItem[]): number {
  return items.reduce((sum, item) => sum + (item.personalizedAmount - item.recommendedAmount), 0);
}

// ── 바텀시트 ────────────────────────────────────────────────────────────
export function BudgetInsightSheet({
  visible,
  items,
  theme,
  busyCategoryId,
  onToggle,
  onClose,
}: {
  visible: boolean;
  items: InsightItem[];
  theme: CountryTheme;
  /** 저장 중인 항목. 그 행의 토글만 잠근다 */
  busyCategoryId: string | null;
  onToggle: (item: InsightItem, next: boolean) => void;
  onClose: () => void;
}) {
  const appliedCount = items.filter((item) => item.applied).length;
  const appliedSum = items
    .filter((item) => item.applied)
    .reduce((sum, item) => sum + (item.personalizedAmount - item.recommendedAmount), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(15,20,30,0.36)' }}
      />

      <View
        style={{
          maxHeight: '82%',
          backgroundColor: '#fff',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingBottom: 24,
        }}
      >
        <View
          style={{
            width: 38,
            height: 4,
            borderRadius: 4,
            backgroundColor: '#d9dde2',
            alignSelf: 'center',
            marginTop: 9,
            marginBottom: 4,
          }}
        />

        <View
          className="flex-row items-center"
          style={{ paddingHorizontal: 17, paddingTop: 10, paddingBottom: 13, borderBottomWidth: 1, borderColor: LINE }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#141b28' }}>
              지난 여행 지출 분석
            </Text>
            <Text style={{ marginTop: 4, fontSize: 10, color: MUTED }}>
              토글을 바꾸면 목표 여행비에 바로 반영돼요.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: '#f5f6f8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={17} color="#66717f" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 8 }}>
          {items.map((item, index) => {
            const diff = item.personalizedAmount - item.recommendedAmount;
            const tone = diff > 0 ? theme.primary : diff < 0 ? GREEN : '#727c89';
            const busy = busyCategoryId === item.categoryId;

            return (
              <View
                key={item.categoryId}
                className="flex-row items-center"
                style={{
                  gap: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 2,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderColor: LINE,
                }}
              >
                <Text style={{ width: 66, fontSize: 11, fontWeight: '800', color: '#141b28' }}>
                  {CATEGORY_EMOJI[item.categoryCode]} {CATEGORY_CODE_LABEL[item.categoryCode]}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#4d5765' }}>
                    {diff === 0
                      ? '지난 여행 예산과 비슷했어요'
                      : `지난 여행 ${percentText(item.deviationBp)}% ${item.deviationBp > 0 ? '초과' : '절약'}`}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 11, fontWeight: '800', color: tone }}>
                    {diff === 0
                      ? '이번 예산 조정 없음'
                      : `${diff > 0 ? '+' : '-'}${won(Math.abs(diff))} ${diff > 0 ? '추가' : '차감'} 추천`}
                  </Text>
                </View>

                <Switch
                  value={item.applied}
                  disabled={diff === 0 || busy}
                  color={theme.primary}
                  label={`${CATEGORY_CODE_LABEL[item.categoryCode]} 추천 적용`}
                  onChange={(next) => onToggle(item, next)}
                />
              </View>
            );
          })}
        </ScrollView>

        {/* 지금 반영 중인 합계. 목록을 스크롤해도 계속 보인다 */}
        <View
          className="flex-row justify-between"
          style={{
            marginHorizontal: 15,
            marginTop: 8,
            padding: 12,
            borderWidth: 1,
            borderColor: LINE,
            borderRadius: 12,
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontSize: 11, color: '#4d5765' }}>{appliedCount}개 항목 적용 중</Text>
          <Text style={{ fontSize: 12, fontWeight: '800', color: appliedSum >= 0 ? theme.primary : GREEN }}>
            {appliedSum >= 0 ? '+' : '-'}
            {won(Math.abs(appliedSum))}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── 토글 ────────────────────────────────────────────────────────────────
/** 시안의 .switch. RN 기본 Switch 는 iOS 초록이 고정이라 직접 그린다 */
function Switch({
  value,
  disabled,
  color,
  label,
  onChange,
}: {
  value: boolean;
  disabled?: boolean;
  color: string;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 20,
        backgroundColor: value ? color : '#d9dde3',
        opacity: disabled ? 0.4 : 1,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#fff',
          marginLeft: value ? 16 : 2,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </Pressable>
  );
}
