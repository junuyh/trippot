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
// 높이 원칙: 초대장은 **내용이 정한다.** 카드에 flex:1 · minHeight · spacer 를 두지 않는다.
//   내용이 짧으면(ACTIVE) 짧고, 길면(NONE) 길다. 남는 화면은 보라 배경이다.
// 위치 원칙: 그렇게 정해진 카드를 **Header 아래 보라 viewport 의 세로 가운데**에 둔다 —
//   바깥 ScrollView contentContainer 의 flexGrow:1 + justifyContent:center 가 남는 공간만 나눈다.
//   카드가 viewport 보다 길어지면 그때만 스크롤한다. 고정 height 없음 → 잘리지 않는다.
// 모양 원칙: 네 모서리 concave quarter-circle. 배경색 원의 **중심이 카드 모서리(0,0)** 에 오게 두어
//   원의 1/4 만 카드를 파낸다(TICKET_CUTOUT_RADIUS). 카드에는 아주 옅은 그림자만 — 종이가 배경
//   위에 살짝 떠 있는 정도. 배경은 단색, 카드는 순백. 우표 · 도장 · 질감 · gradient 없음.
// 로고: 공용 assets/logo.png 를 그대로 tint. 워드마크 에셋이 없어 "TripPot" 은 Text.
// ============================================================================
import type { ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import { INVITE_THEME } from './inviteTheme';

/** 모서리를 파내는 반지름. 원 중심 = 카드 모서리. 시안 기준 iPhone 17 에서 맞춘 값. */
const TICKET_CUTOUT_RADIUS = 26;
/** 종이 모서리. 파인 arc 가 직선 edge 와 바로 만나도록 거의 0. */
const CARD_RADIUS = 2;
/** 초대장 폭. 좌우 보라 여백이 시안(≈ 88%)과 같아지게. */
const CARD_WIDTH = '88%';
/** 초대장 안쪽 좌우 여백. */
const INNER_H = 24;

/** 배경색 원. 중심을 카드 모서리에 맞춰 1/4 만 카드 위에 걸친다 → concave quarter-circle. */
function Notch({ top, left }: { top?: boolean; left?: boolean }) {
  const R = TICKET_CUTOUT_RADIUS;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: R * 2,
        height: R * 2,
        borderRadius: R,
        backgroundColor: INVITE_THEME.primary,
        [top ? 'top' : 'bottom']: -R,
        [left ? 'left' : 'right']: -R,
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
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 22,
      }}
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
          // 종이가 배경 위에 살짝 떠 있는 정도. 모달처럼 띄우지 않는다.
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 5 },
          elevation: 3,
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
