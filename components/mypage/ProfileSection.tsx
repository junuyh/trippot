import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { Image, Pressable, Text, View } from 'react-native';

import { PASSPORT } from './passport';
import type { MyProfile } from './types';

// 여권 사진 칸. 3:4 세로 직사각형이다. 원형이 아니다.
// ⚠️ 배지는 같이 키우지 않는다. absolute bottom/right 라 칸 크기가 바뀌어도 모서리에 붙는다.
const PHOTO_WIDTH = 92;
const PHOTO_HEIGHT = 122;
const EDIT_BADGE_SIZE = 24;

/** 없는 값. 자동으로 추정해 채우지 않는다. */
const EMPTY = '—';

/** 여권의 "라벨 위 · 값 아래" 한 칸. 값이 강조되고 라벨은 작게 위에 붙는다. */
function Field({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  /** 이름처럼 가장 큰 값 */
  strong?: boolean;
}) {
  return (
    <View className="flex-1">
      <Text
        style={{
          fontSize: 9.5,
          lineHeight: 13,
          letterSpacing: 0.8,
          fontWeight: '600',
          color: PASSPORT.label,
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        className={strong ? 'font-black' : 'font-semibold'}
        style={
          strong
            ? { fontSize: 20, lineHeight: 26, letterSpacing: -0.4, color: PASSPORT.ink, marginTop: 1 }
            : { fontSize: 13, lineHeight: 18, color: PASSPORT.ink, marginTop: 1 }
        }
      >
        {value}
      </Text>
    </View>
  );
}

/** ISO → '2026.09.08'. 못 읽으면 '—'. */
function toMemberSince(value: string | null): string {
  if (!value) return EMPTY;
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'yyyy.MM.dd') : EMPTY;
}

type Props = {
  profile: MyProfile;
  /** 이 세션에서 사용자가 고른 이미지. 있으면 profileImageUrl 보다 우선한다. */
  pickedImageUri: string | null;
  /** 사진 또는 편집 배지를 눌렀을 때. 기기 이미지 선택을 연다. */
  onPressChangeImage: () => void;
};

/**
 * 5-1 프로필 — 여권 정보 페이지의 윗칸. (docs/09_IA_v1.md §5-1 · 2026-09-13)
 *
 *   왼쪽  사진 칸(3:4) + 편집 배지
 *   오른쪽 TripPot 로고 · MY TRAVEL PASSPORT · 필드들
 *
 * 필드는 실제 여권의 것을 **TripPot 서비스 정보로 바꿔** 쓴다.
 *   TYPE = TRAVELER            (서비스 분류. 개인정보 아님)
 *   TRAVEL BASE = KOR          (예산 추천의 기본 출발 국가. 사용자의 국적이 아니다)
 *   NAME                       (카카오 닉네임 그대로)
 *   ENGLISH NAME               (users 에 영문 이름 컬럼이 없다 → '—'. 자동 변환하지 않는다)
 *   MEMBER SINCE               (users.created_at · TripPot 에 처음 들어온 날)
 *   PASSPORT TYPE = TripPot Member (고정. 권한·요금제와 무관)
 *
 * ⚠️ 국적 · 생년월일 · 성별 · 여권 번호는 받지도 그리지도 않는다.
 * ⚠️ 흰 카드로 감싸지 않는다. 바깥 TravelPassportPanel 이 내지 한 장이다.
 */
export function ProfileSection({ profile, pickedImageUri, onPressChangeImage }: Props) {
  // 이번 세션에서 고른 이미지가 최우선. 없으면 저장된 이미지, 그것도 없으면 기본 아이콘.
  const imageUri = pickedImageUri ?? profile.profileImageUrl;

  return (
    <View className="flex-row">
      {/* ── 왼쪽: 사진 칸 ─────────────────────────────────────────────── */}
      <View>
        <Text
          style={{
            fontSize: 9.5,
            lineHeight: 13,
            letterSpacing: 0.8,
            fontWeight: '600',
            color: PASSPORT.label,
          }}
        >
          PHOTO
        </Text>
        {/* 사진 전체가 이미지 변경 터치 영역이다. 배지는 그 안에서 한 번 더 강조한다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 변경"
          onPress={onPressChangeImage}
          className="mt-1.5 items-center justify-center overflow-hidden bg-white active:opacity-70"
          style={{
            width: PHOTO_WIDTH,
            height: PHOTO_HEIGHT,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: PASSPORT.rule,
          }}
        >
          {imageUri ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{ uri: imageUri }}
              resizeMode="cover"
              style={{ width: PHOTO_WIDTH, height: PHOTO_HEIGHT }}
            />
          ) : (
            // 기본 아이콘. 새 이미지 에셋을 추가하지 않는다.
            <Ionicons name="person" size={56} color={PASSPORT.placeholder} />
          )}

          {/* 편집 배지 — absolute 라 레이아웃에 영향이 없다. */}
          <View
            style={{
              width: EDIT_BADGE_SIZE,
              height: EDIT_BADGE_SIZE,
              borderColor: PASSPORT.rule,
            }}
            className="absolute bottom-1.5 right-1.5 items-center justify-center rounded-full border bg-white"
          >
            <Ionicons name="pencil" size={12} color={PASSPORT.label} />
          </View>
        </Pressable>
      </View>

      {/* ── 오른쪽: 브랜드 + 필드 ─────────────────────────────────────── */}
      <View className="ml-4 flex-1">
        {/* 브랜드. 로고는 홈 헤더와 같은 파일 · 조금 작게. 새 로고를 그리지 않는다. */}
        <View className="flex-row items-center">
          <Image
            source={require('@/assets/logo.png')}
            style={{ width: 26, height: 21 }}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="TripPot"
          />
          <Text
            className="ml-1.5"
            style={{ fontSize: 15, lineHeight: 20, fontWeight: '700', letterSpacing: -0.3, color: PASSPORT.ink }}
          >
            TripPot
          </Text>
        </View>
        <Text
          className="mt-0.5"
          style={{ fontSize: 11, lineHeight: 15, letterSpacing: 1.1, fontWeight: '700', color: PASSPORT.accent }}
        >
          MY TRAVEL PASSPORT
        </Text>

        <View className="mt-3 gap-2.5">
          <View className="flex-row gap-3">
            <Field label="TYPE" value="TRAVELER" />
            <Field label="TRAVEL BASE" value="KOR" />
          </View>
          <Field label="NAME" value={profile.name} strong />
          {/* ⚠️ 영문 이름 컬럼이 없다. '지수' 를 JISU 로 추정해 넣지 않는다. */}
          <Field label="ENGLISH NAME" value={EMPTY} />
          <View className="flex-row gap-3">
            <Field label="MEMBER SINCE" value={toMemberSince(profile.memberSince)} />
            <Field label="PASSPORT TYPE" value="TripPot Member" />
          </View>
        </View>
      </View>
    </View>
  );
}
