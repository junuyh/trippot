// ============================================================================
// 초대 화면 공통 껍데기 — Header 아래 단색 보라 배경 위의 흰 초대장 (2026-09-16 · 시안 기준)
//
//   [기존 흰색 Header — 건드리지 않는다. root Stack 의 native header 그대로]
//   ─────────────────────────────────────────
//   [INVITE_THEME.primary 단색 배경 — 화면을 채운다]
//     [흰 초대장 — 폭 ≈ 88% · 높이 = 내용 높이 · 네 모서리 concave cutout]
//        TP 로고(primary tint) + "TripPot"
//        짧은 divider
//        children  (상태별 내용)
//        footer    (CTA — 내용 바로 아래, 정해진 간격)
//
// 높이 원칙: 초대장은 **내용이 정한다.** flex:1 · minHeight · spacer 로 화면을 채우지 않는다.
//   내용이 짧으면(ACTIVE) 짧고, 길면(NONE) 길다. 남는 화면은 보라 배경이다.
//   viewport 보다 길어질 때만 ScrollView 가 스크롤한다. 고정 height 없음 → 잘리지 않는다.
// 모양 원칙: cutout 은 카드와 같은 평면의 배경색 원 4개. 카드에 그림자를 두지 않아 "원을 얹은"
//   느낌이 나지 않고 "종이 모서리가 파인" 형태로 보인다. 카드 모서리 radius 는 거의 0.
//   우표 · 도장 · 질감 · SVG 배경 에셋 없음.
// 로고: 공용 assets/logo.png 를 그대로 tint. 워드마크 에셋이 없어 "TripPot" 은 Text.
// ============================================================================
import type { ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import { INVITE_THEME } from './inviteTheme';

/** concave cutout 원 지름 (파인 반지름 = 14). 시안처럼 작고 부드럽게. */
const NOTCH = 28;
/** 종이 모서리. 0 이면 원 안쪽에서 파인 선이 각지게 만나므로 2 로 살짝 눙친다. */
const CARD_RADIUS = 2;
/** 초대장 폭. 좌우 보라 여백이 시안(≈ 88%)과 같아지게. */
const CARD_WIDTH = '88%';
/** 초대장 안쪽 좌우 여백. */
const INNER_H = 24;

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
  /** CTA 묶음. 내용 바로 아래 정해진 간격으로 온다. 화면 하단에 붙이지 않는다. */
  footer: ReactNode;
};

export function InviteShell({ children, footer }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INVITE_THEME.primary }}
      contentContainerStyle={{ paddingVertical: 22, alignItems: 'center' }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          width: CARD_WIDTH,
          backgroundColor: INVITE_THEME.card,
          borderRadius: CARD_RADIUS,
          paddingHorizontal: INNER_H,
          paddingTop: 40,
          paddingBottom: 22,
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
            style={{ width: 74, height: 60, tintColor: INVITE_THEME.primary }}
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
              marginTop: 24,
              width: 64,
              height: 1.5,
              borderRadius: 1,
              backgroundColor: INVITE_THEME.primary,
              opacity: 0.35,
            }}
          />
        </View>

        {children}

        {/* CTA — 내용 바로 아래 일정한 간격. spacer 로 밀지 않는다. */}
        <View style={{ marginTop: 30 }}>{footer}</View>
      </View>
    </ScrollView>
  );
}
