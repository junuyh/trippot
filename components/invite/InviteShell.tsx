// ============================================================================
// 초대 화면 공통 껍데기 — Header 아래부터 단색 보라 배경 + 세로로 긴 흰 초대장 (2026-09-16 · 시안 기준)
//
//   [기존 흰색 Header — 건드리지 않는다. root Stack 의 native header 그대로]
//   ─────────────────────────────────────────
//   [INVITE_THEME.primary 단색 배경 · 위아래 작은 여백]
//     [흰 초대장 — 화면 대부분 높이 · 네 모서리 작은 inward cutout]
//        TP 로고(primary tint) + "TripPot"
//        짧은 divider
//        children  (상태별 내용 — 각 View 가 그린다)
//        flexible space
//        footer    (CTA — 항상 초대장 하단)
//
// 크기 원칙 (docs 시안 · iPhone 17 기준 parity, 그 밖은 responsive)
//   - 초대장은 viewport 높이를 채운다: ScrollView contentContainer flexGrow:1 + 카드 flex:1.
//     내용이 더 길면 카드가 늘어나고 ScrollView 가 스크롤한다. 고정 height 없음 → 잘리지 않는다.
//   - 카드 안은 [위 내용][spacer][CTA] 라 상태별 문구가 짧아도 CTA 가 위로 올라오지 않는다.
//   - cutout 은 View + 절대 위치 원 4개. SVG 배경 에셋 없음. 우표 · 도장 · 질감 없음.
//   - 로고는 공용 assets/logo.png 를 그대로 tint 한다. 워드마크 에셋이 없어 "TripPot" 은 Text 다.
// ============================================================================
import type { ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import { INVITE_THEME } from './inviteTheme';

/** 모서리 cutout 원 지름 — 시안처럼 작고 부드럽게. */
const NOTCH = 22;
const CARD_RADIUS = 18;
/** 초대장 좌우 · 위아래 보라 여백. */
const OUTER_H = 18;
const OUTER_V = 14;
/** 초대장 안쪽 여백. */
const INNER_H = 26;

function Notch({ top, left }: { top?: boolean; left?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: NOTCH,
        height: NOTCH,
        borderRadius: NOTCH / 2,
        backgroundColor: INVITE_THEME.primary,
        [top ? 'top' : 'bottom']: -NOTCH / 2,
        [left ? 'left' : 'right']: -NOTCH / 2,
      }}
    />
  );
}

type Props = {
  /** 로고 · divider 아래의 상태별 내용. */
  children: ReactNode;
  /** 초대장 하단 CTA 묶음. 내용이 짧아도 아래에 붙는다. */
  footer: ReactNode;
};

export function InviteShell({ children, footer }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INVITE_THEME.primary }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: OUTER_H, paddingVertical: OUTER_V }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: INVITE_THEME.card,
          borderRadius: CARD_RADIUS,
          paddingHorizontal: INNER_H,
          paddingTop: 36,
          paddingBottom: 26,
          // 아주 옅은 그림자만. 질감 · 우표 · 도장 없음.
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <Notch top left />
        <Notch top />
        <Notch left />
        <Notch />

        {/* 로고 블록: TP 심볼 + TripPot 워드 + 짧은 divider */}
        <View style={{ alignItems: 'center' }}>
          {/*
            ⚠️ 확정된 로고 파일(assets/logo.png)을 그대로 쓴다. RGBA 투명 배경 + 단색 마크라
               tintColor 로 primary 를 입힌다. 파일을 바꾸거나 형태를 새로 그리지 않는다.
          */}
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 76, height: 62, tintColor: INVITE_THEME.primary }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
          <Text
            style={{
              marginTop: 8,
              fontSize: 15,
              fontWeight: '800',
              letterSpacing: 0.2,
              color: INVITE_THEME.primary,
            }}
          >
            TripPot
          </Text>
          <View
            style={{
              marginTop: 22,
              width: 44,
              height: 1.5,
              borderRadius: 1,
              backgroundColor: INVITE_THEME.primary,
              opacity: 0.35,
            }}
          />
        </View>

        {children}

        {/* 내용이 짧은 상태(ACTIVE 등)에서도 CTA 를 아래에 둔다. */}
        <View style={{ flexGrow: 1, minHeight: 28 }} />

        {footer}
      </View>
    </ScrollView>
  );
}
