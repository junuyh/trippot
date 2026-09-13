import { Image, Text, View } from 'react-native';

import { MRZ_FONT, PASSPORT } from './passport';
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
 * "TripPot 여행 여권" 영역. 마이페이지 상단(프로필 + 내 여행)을 여권 내지처럼 그린다.
 * (2026-09-13)
 *
 *   연한 라벤더 바탕이 **화면 폭 전체**에 깔린다. 둥근 카드가 아니다.
 *   ┌ MY TRAVEL PASSPORT ·············· [TripPot 로고]
 *   │  ProfileSection      사진 칸 | 필드
 *   │  ── 얇은 선 ──
 *   │  TripSummaryCards    내 여행 3칸
 *   │  MRZ 장식 글줄
 *   └ 세계지도 워터마크는 ProfileSection 의 정보 칼럼 안에만 (사진 칸을 피한다)
 *
 * ⚠️ 테두리 · 그림자 · 둥근 모서리를 주지 않는다. 전에는 카드 한 장으로 감쌌는데
 *    안쪽이 좁아 보였다. 흰 헤더 아래 바로 종이가 깔리고, 안쪽 여백은 화면의
 *    px-4 와 같아 아래 메뉴 글자와 같은 왼쪽 선에 선다.
 * ⚠️ 안에 흰 카드를 만들지 않는다. 사진 칸만 흰 바탕이다(사진 뒤 여백).
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
  return (
    <View className="overflow-hidden px-4 pb-4 pt-4" style={{ backgroundColor: PASSPORT.paper }}>
      {/* 맨 윗줄. 왼쪽 끝 제목 · 오른쪽 끝 로고. 여권 페이지의 머리다.
          ⚠️ 제목은 이 영역의 메인 타이틀이다. 라벨 크기가 아니라 제목 크기(16 / 800). */}
      <View className="flex-row items-center justify-between">
        <Text
          style={{
            fontSize: 16,
            lineHeight: 20,
            letterSpacing: 1.6,
            fontWeight: '800',
            color: PASSPORT.accent,
          }}
        >
          MY TRAVEL PASSPORT
        </Text>
        {/* 홈 헤더와 같은 파일. 새 로고를 그리지 않는다. */}
        <Image
          source={require('@/assets/logo.png')}
          style={{ width: 30, height: 24 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="TripPot"
        />
      </View>

      {/* 머리줄과 본문 사이 24. (2026-09-13 · 16 → 24) 머리줄이 헤더로 읽히려면
          바로 아래 사진 · 필드와 숨 쉴 자리가 있어야 한다. 그 이상 벌리면 두 화면처럼 갈린다. */}
      <View className="mt-6">
        <ProfileSection
          profile={profile}
          pickedImageUri={pickedImageUri}
          onPressChangeImage={onPressChangeImage}
        />
      </View>

      {/* 윗칸과 아랫칸 사이 얇은 선. 1px · 연보라. */}
      <View className="my-5" style={{ height: 1, backgroundColor: PASSPORT.rule }} />

      <TripSummaryCards
        counts={counts}
        onPressPlanning={onPressPlanning}
        onPressTraveling={onPressTraveling}
        onPressPast={onPressPast}
      />

      {/* MRZ 장식. 가장 약하게. 정보보다 먼저 읽히면 안 된다. */}
      <View className="mt-5" pointerEvents="none">
        {MRZ_LINES.map((line) => (
          <Text
            key={line}
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              fontFamily: MRZ_FONT,
              fontSize: 9.5,
              lineHeight: 14,
              letterSpacing: 1,
              color: PASSPORT.ink,
              opacity: 0.3,
            }}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}
