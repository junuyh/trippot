// ============================================================================
// 여행지 상세(DEST-01) — 여행비 가이드 · 항목별 평균 예산 (2026-09-11)
//
//   ▎여행비 가이드 ⓘ
//   ┌──────────────────────────────────────────┐
//   │ 일반적인 여행의 평균 예산이에요              │
//   │ 약 75만 ~ 95만원 / 1인   │ 여행 시기, 인원,  │
//   │                        │ 여행 스타일에 따라 │
//   │                        │ 달라질 수 있어요   │
//   └──────────────────────────────────────────┘
//   ▎항목별 평균 예산              3박 4일 · 1인 기준
//   ✈ 항공    ▓▓▓▓▓▓▓▓▓░░░   15만 ~ 25만원
//   🏨 숙박    ▓▓▓▓▓▓▓░░░░░   20만 ~ 30만원
//   …
//
// ⚠️⚠️ **이 금액은 여행 만들기가 쓰는 계산 그대로다.**
//    lib/destination/budgetGuide 가 buildBudgetRecommendation 을 부른다.
//    범위의 양끝은 '아끼는 편' 과 '넉넉한 편' 스타일이라, 사용자가 실제로
//    여행을 만들 때 **어떤 스타일을 골라도 결과가 이 범위 안에 들어온다.**
//
// ⚠️ **확정 금액처럼 보이면 안 된다.** 그래서
//    · 하나의 금액이 아니라 범위로 쓰고
//    · '/ 1인' 을 붙여 누구 기준인지 밝히고
//    · 오른쪽에 '여행 시기, 인원, 여행 스타일에 따라 달라질 수 있어요' 를 둔다
//    이 세 가지 중 하나라도 빠지면 개인 맞춤 결과로 읽힌다.
//
// ⚠️ 그래프를 전부 국가색으로 칠하지 않는다. 금액 상위 몇 개만 국가색이고
//    나머지는 블루그레이다. (tokens.ts ACCENT_BAR_COUNT)
//
// ⚠️ 기준 시점을 함께 적는다. 추천이 추정치임을 표시해야 한다. (NFR-004)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import {
  formatRange,
  formatRangeCompact,
  type DestinationBudgetGuide,
} from '@/lib/destination/budgetGuide';

import { SectionHeading } from './DestinationSections';
import {
  ACCENT_BAR_COUNT,
  BAR_NEUTRAL,
  BAR_TRACK,
  CAPTION,
  INK,
  LINE,
  RADIUS,
  softer,
  SUBTLE,
  TITLE,
} from './tokens';

type Props = {
  guide: DestinationBudgetGuide;
  accent: string;
  accentSoft: string;
};

/** 항목 아이콘. 참고 이미지의 아이콘 자리를 채운다. */
const ROW_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  AIRFARE: 'airplane-outline',
  LODGING: 'bed-outline',
  FOOD: 'restaurant-outline',
  TRANSPORT: 'bus-outline',
  ACTIVITY: 'ticket-outline',
  SHOPPING: 'bag-handle-outline',
  INSURANCE_CONTINGENCY: 'shield-checkmark-outline',
};

export function BudgetGuideSection({ guide, accent, accentSoft }: Props) {
  return (
    <View>
      <SectionHeading
        title="여행비 가이드"
        accent={accent}
        right={
          <Text style={{ fontSize: 11.5, color: SUBTLE }}>
            {guide.updatedAt} 기준
          </Text>
        }
      />

      {/*
        요약 칸.

        ⚠️ 바탕은 국가색 옅은 톤(primarySoft), **글자는 잉크색**이다. (2026-09-11)
           처음엔 이 바탕 위에 연한 회색 글자(#8b94a2)를 올려 읽기 어려웠다.
           바탕을 뺐더니 화면이 허옇게 비어 보였다. 고칠 것은 바탕이 아니라
           글자색이었다 — 옅은 색 위에 연한 회색 글자를 올리지 않는다.
      */}
      <View
        className="flex-row"
        style={{
          // 넓은 칸이라 한 번 더 연하게 만든다. (tokens.softer)
          backgroundColor: softer(accentSoft),
          borderRadius: RADIUS.card,
          paddingVertical: 15,
          paddingHorizontal: 14,
        }}
      >
        {/* 금액 쪽임을 알리는 짧은 세로 라인. 국가색이 들어가는 좁은 자리다. */}
        <View style={{ width: 3, borderRadius: 2, backgroundColor: accent, marginRight: 11 }} />

        <View style={{ flex: 1.25, paddingRight: 10 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: INK }}>일반적인 여행의 평균 예산이에요.</Text>
          <View className="mt-1.5 flex-row flex-wrap items-baseline">
            <Text
              style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.6, color: accent }}
            >
              {formatRange(guide.perPerson)}
            </Text>
            <Text style={{ marginLeft: 5, fontSize: 12.5, color: CAPTION }}>/ 1인</Text>
          </View>
        </View>

        {/* 세로선 하나로 '금액' 과 '주의' 를 가른다. 주의 문구가 금액에 붙어
            보이면 금액의 일부처럼 읽힌다. */}
        <View style={{ width: 1, backgroundColor: '#FFFFFF', opacity: 0.85 }} />

        <View style={{ flex: 1, paddingLeft: 11, justifyContent: 'center' }}>
          <Text style={{ fontSize: 11.5, lineHeight: 17, color: INK }}>
            여행 시기, 인원, 여행 스타일에 따라 달라질 수 있어요.
          </Text>
        </View>
      </View>

      {/* ── 항목별 ──────────────────────────────────────────────────────── */}
      <View className="mb-3 mt-7 flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center">
          <View style={{ width: 3, height: 15, borderRadius: 2, backgroundColor: accent }} />
          <Text style={{ marginLeft: 8, ...TITLE }}>항목별 평균 예산</Text>
        </View>
        <Text style={{ fontSize: 11.5, color: SUBTLE }}>
          {guide.nights}박 {guide.days}일 · 1인 기준
        </Text>
      </View>

      <View
        className="bg-white"
        style={{
          borderWidth: 1,
          borderColor: LINE,
          borderRadius: RADIUS.card,
          paddingVertical: 12,
          paddingHorizontal: 14,
          gap: 12,
        }}
      >
        {guide.rows.map((row, index) => (
          <View key={row.key} className="flex-row items-center">
            <Ionicons
              name={ROW_ICON[row.key] ?? 'ellipse-outline'}
              size={15}
              color={SUBTLE}
              style={{ width: 20 }}
            />
            {/* ⚠️ 고정 폭을 주지 않는다. '여행자보험/예비비' 가 74px 에 들어가지
                않아 잘렸다. 내용만큼 차지하고 그래프가 남는 폭을 쓴다. */}
            <Text
              numberOfLines={1}
              style={{ fontSize: 13, color: CAPTION, marginRight: 8, flexShrink: 0 }}
            >
              {row.label}
            </Text>

            {/* 그래프. 상위 몇 개만 국가색이다. */}
            <View
              style={{
                flex: 1,
                minWidth: 28,
                height: 8,
                borderRadius: 4,
                backgroundColor: BAR_TRACK,
                marginRight: 10,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(4, Math.round(row.ratio * 100))}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor: index < ACCENT_BAR_COUNT ? accent : BAR_NEUTRAL,
                  opacity: index < ACCENT_BAR_COUNT ? 1 : 0.55,
                }}
              />
            </View>

            {/* '약' 을 뺀 짧은 표기를 쓴다. 위 요약 칸이 이미 '약' 을 달고 있다. */}
            <Text
              numberOfLines={1}
              style={{ textAlign: 'right', fontSize: 12.5, color: INK, flexShrink: 0 }}
            >
              {formatRangeCompact(row.range)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
