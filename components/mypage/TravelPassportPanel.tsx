import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { MRZ_FONT, PASSPORT, WorldMapWatermark } from './passport';
import { ProfileSection } from './ProfileSection';
import { TripSummaryCards } from './TripSummaryCards';
import type { MyProfile, MyTripCounts } from './types';

/**
 * MRZ 모양의 장식 글줄. **아무 뜻이 없다.** 브랜드 이름만 여권 밑줄처럼 늘어놓는다.
 * ⚠️ 여기에 이름 · 날짜 · 번호 같은 실제 값을 넣지 않는다.
 *    '<' 를 넉넉히 붙이고 clip 으로 잘라 어떤 폭에서도 끝까지 채운다.
 */
const MRZ_LINES = [
  'TRIPPOT<<TRAVELER<<MY<<TRAVEL<<PASSPORT<<<<<<<<<<<<<<<<<<<<<<<<<<',
  'MYTRIP<<TRIPPOT<<MEMBER<<TRAVEL<<PASS<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
];

type Props = {
  profile: MyProfile;
  pickedImageUri: string | null;
  onPressChangeImage: () => void;
  counts: MyTripCounts;
  onPressPlanning: () => void;
  onPressTraveling: () => void;
  onPressPast: () => void;
};

/**
 * "TripPot 여행 여권" 패널. 마이페이지 상단(프로필 + 내 여행)을 여권 내지 한 장으로 묶는다.
 * (2026-09-13)
 *
 *   ┌ 연한 라벤더 종이 · 옅은 테두리 · 세계지도 워터마크
 *   │  ProfileSection      사진 칸 + 로고 + 필드
 *   │  ── 얇은 선 ──
 *   │  TripSummaryCards    내 여행 3칸
 *   │  MRZ 장식 글줄
 *   └
 *
 * ⚠️ 그림자를 주지 않는다. 종이 한 장이지 떠 있는 카드가 아니다.
 * ⚠️ 안에 흰 카드를 다시 만들지 않는다. 사진 칸만 흰 바탕이다(사진 뒤 여백).
 * ⚠️ supabase · track() 을 부르지 않는다. 데이터와 handler 는 app/(tabs)/me.tsx 가 준다.
 */
export function TravelPassportPanel({
  profile,
  pickedImageUri,
  onPressChangeImage,
  counts,
  onPressPlanning,
  onPressTraveling,
  onPressPast,
}: Props) {
  // 워터마크는 패널 폭에 맞춘다. 절대 좌표를 박지 않고 onLayout 으로 잰다.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      className="overflow-hidden px-4 pb-3.5 pt-4"
      style={{
        backgroundColor: PASSPORT.paper,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: PASSPORT.edge,
      }}
    >
      {/* 워터마크. 오른쪽 위에 넓게. 글자 뒤에 깔리고 터치를 막지 않는다. */}
      {width > 0 ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: -width * 0.08, top: 44 }}
        >
          <WorldMapWatermark width={width * 0.78} height={width * 0.39} />
        </View>
      ) : null}

      <ProfileSection
        profile={profile}
        pickedImageUri={pickedImageUri}
        onPressChangeImage={onPressChangeImage}
      />

      {/* 윗칸과 아랫칸 사이 얇은 선. 1px · 연보라. */}
      <View className="my-4" style={{ height: 1, backgroundColor: PASSPORT.rule }} />

      <TripSummaryCards
        counts={counts}
        onPressPlanning={onPressPlanning}
        onPressTraveling={onPressTraveling}
        onPressPast={onPressPast}
      />

      {/* MRZ 장식. 가장 약하게. 정보보다 먼저 읽히면 안 된다. */}
      <View className="mt-4" pointerEvents="none">
        {MRZ_LINES.map((line) => (
          <Text
            key={line}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              fontFamily: MRZ_FONT,
              fontSize: 9.5,
              lineHeight: 13,
              letterSpacing: 1,
              color: PASSPORT.ink,
              opacity: 0.32,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
