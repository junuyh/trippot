// ============================================================================
// 신규 사용자 홈 온보딩 카드 한 장 (2026-09-17)
//
//   ┌─────────────────────────────┐
//   │ 01 · PLAN                   │ ← 작게
//   │ 필요한 여행비부터 계획해요    │ ← 제목
//   │ 여행지와 일정에 맞춰 …        │ ← 설명 두 줄
//   │ ┌─────────────────────┐     │
//   │ │ 실제 페이지를 줄인 화면 │     │ ← 자르지 않고 끝까지. 금액만 예시
//   │ └─────────────────────┘     │
//   └─────────────────────────────┘
//
// 시각 우선순위: 미리보기 → 제목 → 핵심 숫자(미리보기 안) → 설명 → 단계 라벨
//
// ⚠️ 카드 안에 CTA 를 두지 않는다. 버튼은 온보딩 페이지 아래 하나뿐이다.
// ⚠️ 2026-09-17 미리보기 높이를 고정하지 않는다. 영수증이 반쯤 잘려 보였다.
//    카드 키가 장마다 다르고, 긴 장은 온보딩 페이지가 세로로 스크롤한다.
// ============================================================================
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { BRAND } from '@/lib/constants/brandColor';

import { HOME_CAPTION, HOME_CARD_LINE } from '../palette';
import { PREVIEW_STAGE } from './onboardingPreviews';

/** 카드 안쪽 여백. 미리보기 폭 계산에 같이 쓴다. */
export const CARD_PADDING = 14;
/** 미리보기 무대 안쪽 여백(좌 · 우 · 위). */
export const STAGE_PADDING = 12;

export type OnboardingCardProps = {
  /** '01' */
  step: string;
  /** 'PLAN' */
  label: string;
  title: string;
  description: string;
  /** 실제 화면을 줄인 미리보기 */
  previewWidget: ReactNode;
  width: number;
};

export function OnboardingCard({
  step,
  label,
  title,
  description,
  previewWidget,
  width,
}: OnboardingCardProps) {
  return (
    <View
      style={{
        width,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: HOME_CARD_LINE,
        backgroundColor: '#FFFFFF',
        padding: CARD_PADDING,
      }}
    >
      <View style={{ paddingHorizontal: 2 }}>
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: BRAND.primary }}>
            {step} · {label}
          </Text>
          {/* 신규 사용자의 돈으로 오해하지 않게. 숫자는 소개용 예시다 */}
          <Text style={{ fontSize: 9.5, fontWeight: '600', color: '#A8AFB9' }}>예시 화면</Text>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ marginTop: 5, fontSize: 16.5, fontWeight: '800', letterSpacing: -0.5, color: '#111827' }}
        >
          {title}
        </Text>
        {/* 두 줄 고정 — 카드끼리 미리보기 시작점이 맞는다 */}
        <Text
          numberOfLines={2}
          style={{ marginTop: 4, minHeight: 36, fontSize: 12, lineHeight: 18, color: HOME_CAPTION }}
        >
          {description}
        </Text>
      </View>

      <View
        style={{
          marginTop: 12,
          borderRadius: 14,
          backgroundColor: PREVIEW_STAGE,
          // ⚠️ 높이를 정하지 않는다. 미리보기를 자르지 않고 내용만큼 그린다. (onboardingPreviews MiniPage)
          padding: STAGE_PADDING,
        }}
      >
        {previewWidget}
      </View>
    </View>
  );
}
