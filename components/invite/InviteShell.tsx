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
// 높이 원칙: 초대장은 **내용이 정하되, 상태가 바뀌어도 높이가 줄지 않는다.** (2026-09-17)
//   기준은 가장 긴 상태(INV-02 NONE · "초대 수락하기")의 실제 layout 높이 = CARD_MIN_HEIGHT.
//   짧은 상태(승인 대기 · ACTIVE)는 같은 높이의 카드 안에서 내용을 세로 가운데에 둔다.
//   내용이 그보다 길어지면(작은 기기 · 인원 초과 안내) 그만큼 자란다 — 고정 height 가 아니라 minHeight.
// 위치 원칙: 그렇게 정해진 카드를 **Header 아래 보라 viewport 의 세로 가운데**에 둔다 —
//   바깥 ScrollView contentContainer 의 flexGrow:1 + justifyContent:center 가 남는 공간만 나눈다.
//   카드가 viewport 보다 길어지면 그때만 스크롤한다. 고정 height 없음 → 잘리지 않는다.
// 모양 원칙: 네 모서리 concave quarter-circle. 배경색 원의 **중심이 카드 모서리(0,0)** 에 오게 두어
//   원의 1/4 만 카드를 파낸다(TICKET_CUTOUT_RADIUS). 카드에는 아주 옅은 그림자만 — 종이가 배경
//   위에 살짝 떠 있는 정도. 배경은 단색 보라. 카드는 옅은 아이보리 + 아주 은은한 종이 결
//   (assets/paper-grain.png 128px 타일을 repeat · 낮은 불투명도). 텍스트는 그 위의 실제 컴포넌트다.
//   우표 · 도장 · 얼룩 · 접힘 · 강한 grain · gradient 없음.
// 로고: 공용 assets/logo.png 를 그대로 tint. 워드마크 에셋이 없어 "TripPot" 은 Text.
// ============================================================================
import type { ReactNode } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

const PAPER_GRAIN = require('@/assets/paper-grain.png');

import { INVITE_THEME } from './inviteTheme';

/** 모서리를 파내는 반지름. 원 중심 = 카드 모서리. 시안 기준 iPhone 17 에서 맞춘 값. */
const TICKET_CUTOUT_RADIUS = 26;
/** 종이 모서리. 파인 arc 가 직선 edge 와 바로 만나도록 거의 0. */
const CARD_RADIUS = 2;
/** 초대장 폭. 좌우 보라 여백이 시안(≈ 88%)과 같아지게. */
const CARD_WIDTH = '88%';
/** 초대장 안쪽 좌우 여백. */
const INNER_H = 24;
/**
 * 모든 상태가 공유하는 초대장 최소 높이. (2026-09-17)
 * INV-02 NONE 상태의 실제 onLayout 값이다 — ACTIVE 상태 실측 556.67 (iPhone 17 · 카드 폭 354)
 * + 안내문 한 줄(lineHeight 20)만큼 긴 NONE 상태 = 576.67 → 올림. 픽셀 추측값이 아니다.
 * 상태 전환(초대 수락하기 ↔ 승인 대기)에서 종이 높이가 튀지 않게 한다.
 */
const CARD_MIN_HEIGHT = 577;

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
          minHeight: CARD_MIN_HEIGHT,
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
        {/* 종이 결. 카드 전체에 타일로 깔고 아주 옅게 — 글자 대비를 해치지 않는다. 터치는 통과. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: CARD_RADIUS,
            overflow: 'hidden',
          }}
        >
          <Image
            source={PAPER_GRAIN}
            resizeMode="repeat"
            accessibilityElementsHidden
            style={{ width: '100%', height: '100%', opacity: 0.6 }}
          />
        </View>

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

        {/* 상태별 내용. 카드가 minHeight 보다 짧은 상태면 남는 공간의 가운데에 온다. */}
        <View style={{ flexGrow: 1, justifyContent: 'center' }}>{children}</View>

        {/* CTA — 내용 바로 아래 일정한 간격. spacer 로 밀지 않는다. */}
        <View style={{ marginTop: 30 }}>{footer}</View>
      </View>
    </ScrollView>
  );
}
