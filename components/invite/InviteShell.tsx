// ============================================================================
// 초대 화면 공통 껍데기 — Header 아래부터 단색 보라 배경 + 흰 초대 카드 (2026-09-16)
//
//   [기존 흰색 Header — 건드리지 않는다. root Stack 의 native header 그대로]
//   ─────────────────────────────────────────
//   [INVITE_THEME.primary 단색 배경]
//     [흰 카드 · 네 모서리 ticket cutout]
//        TripPot 로고(primary 로 tint)
//        (children — 상태별 내용은 각 View 가 그린다)
//
// 카드는 View + 절대 위치 원 4개로 만든다. SVG 배경 에셋을 두지 않는다. 화면이 작으면
// ScrollView 가 스크롤한다 — 내용이 잘리지 않는다. 시안의 픽셀 위치를 absolute 로 베끼지 않는다.
// ============================================================================
import type { ReactNode } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { INVITE_THEME } from './inviteTheme';

/** 모서리 cutout 원 지름. 카드 radius 보다 조금 크면 "잘린" 느낌이 난다. */
const NOTCH = 30;
const CARD_RADIUS = 22;

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
  children: ReactNode;
};

export function InviteShell({ children }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INVITE_THEME.primary }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
        paddingVertical: 28,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: INVITE_THEME.card,
          borderRadius: CARD_RADIUS,
          paddingHorizontal: 22,
          paddingTop: 30,
          paddingBottom: 22,
          // 그림자는 아주 옅게. 종이 질감·우표·도장은 두지 않는다.
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Notch top left />
        <Notch top />
        <Notch left />
        <Notch />

        {/*
          ⚠️ 확정된 로고 파일(assets/logo.png)을 그대로 쓴다. 홈 상단바 · 로그인 화면과 같은 파일이다.
             RGBA 투명 배경 + 단색 마크라 tintColor 로 primary 를 입힌다. 형태를 새로 그리지 않는다.
             (정확한 SVG 원본이 생기면 같은 자리에서 바꾼다)
        */}
        <View style={{ alignItems: 'center' }}>
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 66, height: 54, tintColor: INVITE_THEME.primary }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
        </View>

        {children}
      </View>
    </ScrollView>
  );
}
