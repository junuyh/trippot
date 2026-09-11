// ============================================================================
// 여행지 상세(DEST-01) — 함께 가면 이런 예산이에요 (2026-09-11)
//
//   ▎함께 가면 이런 예산이에요 ⓘ            [ - ] 4명 [ + ]
//   ┌──────────────────────────────────────────┐
//   │ 👥 4명이 함께 준비하는 경우 (평균 기준)      │
//   │    총 예상 여행비   약 300만 ~ 380만원      │
//   │    1인 평균        약 75만 ~ 95만원        │
//   └──────────────────────────────────────────┘
//   ┌──────────────────────────────────────────┐
//   │ 🧮 정확한 금액이 궁금하다면?                │
//   │    여행 기간, 숙소 스타일, 여행 목적에 맞춰   │
//   │    우리 모임만의 예상 예산을 계산해드려요.    │
//   └──────────────────────────────────────────┘
//
// ⚠️ 인원을 바꾸면 **화면 파일이 계산을 다시 한다.** 이 컴포넌트는 숫자를
//    계산하지 않는다. 인원이 바뀌었다고 알리기만 한다. (CLAUDE.md 9장)
//
// ⚠️ 총액은 1인 평균 × 인원이 **아니다.** 1인 평균은 총액을 인원으로 나눠
//    1,000원 단위로 반올림한 표시값이라, 곱해서 되돌리면 총액과 어긋난다.
//    둘 다 여행 만들기와 같은 함수에서 따로 받아 온다.
//    (lib/budget/recommendation 의 perPerson 주석)
//
// ⚠️ 아래 안내 칸은 **버튼이 아니다.** 여행 만들기로 보내는 버튼은 화면 맨
//    아래에 하나뿐이고, 여기 또 두면 같은 곳으로 가는 입구가 둘이 된다.
//    "정확한 금액은 여행을 만들면 나온다" 는 사실만 알린다.
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { formatRange, type DestinationBudgetGuide } from '@/lib/destination/budgetGuide';

import { SectionHeading } from './DestinationSections';
import { INK, LINE, MUTED, RADIUS, SUBTLE, TINT } from './tokens';

type Props = {
  guide: DestinationBudgetGuide;
  accent: string;
  accentSoft: string;
  onChangeHeadcount: (next: number) => void;
};

/** 인원 상한·하한. 혼자 가는 여행부터 모임 여행까지 담는다. */
const MIN_HEADCOUNT = 1;
const MAX_HEADCOUNT = 10;

function StepButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'remove' | 'add';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className="items-center justify-center active:opacity-60"
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: LINE,
        backgroundColor: '#FFFFFF',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={14} color={INK} />
    </Pressable>
  );
}

export function HeadcountBudgetSection({
  guide,
  accent,
  accentSoft,
  onChangeHeadcount,
}: Props) {
  const { headcount } = guide;

  return (
    <View>
      <SectionHeading
        title="함께 가면 이런 예산이에요"
        accent={accent}
        right={
          <View className="flex-row items-center">
            <StepButton
              icon="remove"
              label="인원 줄이기"
              disabled={headcount <= MIN_HEADCOUNT}
              onPress={() => onChangeHeadcount(Math.max(MIN_HEADCOUNT, headcount - 1))}
            />
            <Text
              style={{
                width: 42,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: '700',
                color: INK,
              }}
            >
              {headcount}명
            </Text>
            <StepButton
              icon="add"
              label="인원 늘리기"
              disabled={headcount >= MAX_HEADCOUNT}
              onPress={() => onChangeHeadcount(Math.min(MAX_HEADCOUNT, headcount + 1))}
            />
          </View>
        }
      />

      {/* ── 인원 기준 금액 ──────────────────────────────────────────────── */}
      <View
        className="bg-white"
        style={{
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: RADIUS.card,
          padding: 14,
        }}
      >
        <View className="flex-row items-center">
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="people-outline" size={14} color={accent} />
          </View>
          <Text style={{ marginLeft: 8, fontSize: 12.5, color: MUTED }}>
            {headcount}명이 함께 준비하는 경우 (평균 기준)
          </Text>
        </View>

        <View className="mt-3 flex-row items-center justify-between">
          <Text style={{ fontSize: 12.5, color: MUTED, flexShrink: 0 }}>총 예상 여행비</Text>
          {/* ⚠️ 10명이면 '약 700만 ~ 1,250만원' 까지 길어진다. 줄어들 수 있게 두고
              그래도 모자라면 글자를 줄인다. 자르지 않는다. */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              flexShrink: 1,
              marginLeft: 8,
              textAlign: 'right',
              fontSize: 16,
              fontWeight: '800',
              letterSpacing: -0.5,
              color: accent,
            }}
          >
            {formatRange(guide.total)}
          </Text>
        </View>

        <View style={{ height: 1, backgroundColor: LINE, marginVertical: 10 }} />

        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 12.5, color: MUTED, flexShrink: 0 }}>1인 평균</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ flexShrink: 1, marginLeft: 8, textAlign: 'right', fontSize: 14, fontWeight: '700', color: INK }}
          >
            {formatRange(guide.perPerson)}
          </Text>
        </View>
      </View>

      {/* ── 안내. 버튼이 아니다. ───────────────────────────────────────── */}
      <View
        className="mt-2.5 flex-row"
        style={{ backgroundColor: TINT, borderRadius: RADIUS.card, padding: 14 }}
      >
        <Ionicons name="calculator-outline" size={16} color={SUBTLE} style={{ marginTop: 1 }} />
        <View style={{ marginLeft: 9, flex: 1 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: INK }}>
            정확한 금액이 궁금하다면?
          </Text>
          <Text style={{ marginTop: 3, fontSize: 11.5, lineHeight: 17, color: MUTED }}>
            여행 기간, 숙소 스타일, 여행 목적에 맞춰 우리 모임만의 예상 예산을 계산해드려요.
          </Text>
        </View>
      </View>
    </View>
  );
}
