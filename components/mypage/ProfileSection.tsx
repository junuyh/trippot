import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { PASSPORT, WorldMapWatermark } from './passport';
import type { MyProfile } from './types';

// 여권 사진 칸. 세로 직사각형이다. 원형이 아니다.
// ⚠️ 모서리는 4 — 실제 여권 사진처럼 거의 각지게. (2026-09-13 · 12 → 4)
// ⚠️ 배지는 칸 **바깥** 우하단에 걸친다. 칸 안에 있으면 사진을 가리고 답답했다.
const PHOTO_WIDTH = 104;
const PHOTO_HEIGHT = 132;
const PHOTO_RADIUS = 4;
const EDIT_BADGE_SIZE = 28;
/** 배지가 칸 바깥으로 나가는 만큼. 바깥 View 가 이만큼 여백을 가져 잘리지 않는다. */
const EDIT_BADGE_OVERHANG = 10;

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
 *   오른쪽 필드들 (브랜드 줄은 TravelPassportPanel 이 위에 따로 그린다)
 *
 * 필드는 실제 여권의 것을 **TripPot 서비스 정보로 바꿔** 쓴다.
 *   TYPE = TRAVELER            (서비스 분류. 개인정보 아님)
 *   TRAVEL BASE = KOR          (예산 추천의 기본 출발 국가. 사용자의 국적이 아니다)
 *   NAME                       (카카오 닉네임 그대로)
 *   ENGLISH NAME               (users.english_name · 계정관리에서 입력. 없으면 '—'. 자동 변환하지 않는다)
 *   MEMBER SINCE               (users.created_at · TripPot 에 처음 들어온 날)
 *   PASSPORT TYPE = TripPot Member (고정. 권한·요금제와 무관)
 *
 * ⚠️ 국적 · 생년월일 · 성별 · 여권 번호는 받지도 그리지도 않는다.
 * ⚠️ 흰 카드로 감싸지 않는다. 바깥 TravelPassportPanel 이 내지 한 장이다.
 */
export function ProfileSection({ profile, pickedImageUri, onPressChangeImage }: Props) {
  // 이번 세션에서 고른 이미지가 최우선. 없으면 저장된 이미지, 그것도 없으면 기본 아이콘.
  const imageUri = pickedImageUri ?? profile.profileImageUrl;

  // 워터마크는 **정보 칼럼 안에서만** 보인다. 사진 칸 뒤로 깔리지 않는다.
  // 칼럼 폭을 onLayout 으로 재서 그 폭에 맞춘다. 절대 좌표를 박지 않는다.
  const [infoWidth, setInfoWidth] = useState(0);
  const onInfoLayout = (e: LayoutChangeEvent) => setInfoWidth(e.nativeEvent.layout.width);

  return (
    <View className="flex-row">
      {/* ── 왼쪽: 사진 칸 ─────────────────────────────────────────────── */}
      {/*
        ⚠️ 'PHOTO' 라벨을 두지 않는다. (2026-09-13) 사진 칸의 위 끝이 오른쪽
           TYPE 라벨의 위 끝과 같은 높이라야 한 줄로 읽힌다.
        ⚠️ 바깥 View 는 overflow 를 자르지 않는다. 배지가 칸 밖으로 나간다.
           오른쪽·아래 여백(EDIT_BADGE_OVERHANG)만큼 자리를 비워 둔다.
      */}
      {/* ⚠️ self-start — flex-row 의 기본 stretch 로 이 칼럼이 오른쪽 높이만큼 늘어나면
          배지의 bottom:0 이 행 바닥으로 내려가 사진에서 떨어진다. */}
      <View
        className="self-start"
        style={{ paddingRight: EDIT_BADGE_OVERHANG, paddingBottom: EDIT_BADGE_OVERHANG }}
      >
        {/* 사진 전체가 이미지 변경 터치 영역이다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 변경"
          onPress={onPressChangeImage}
          className="items-center justify-center overflow-hidden bg-white active:opacity-70"
          style={{
            width: PHOTO_WIDTH,
            height: PHOTO_HEIGHT,
            borderRadius: PHOTO_RADIUS,
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
            <Ionicons name="person" size={60} color={PASSPORT.placeholder} />
          )}
        </Pressable>

        {/*
          편집 배지 — 칸 바깥 우하단에 살짝 걸친다. 같은 handler 다.
          ⚠️ 사진 칸의 형제라 칸의 overflow hidden 에 잘리지 않는다.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프로필 사진 변경"
          hitSlop={6}
          onPress={onPressChangeImage}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: EDIT_BADGE_SIZE,
            height: EDIT_BADGE_SIZE,
            borderColor: PASSPORT.rule,
            shadowColor: PASSPORT.ink,
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }}
          className="items-center justify-center rounded-full border bg-white active:opacity-70"
        >
          <Ionicons name="pencil" size={13} color={PASSPORT.label} />
        </Pressable>
      </View>

      {/* ── 오른쪽: 필드 ──────────────────────────────────────────────── */}
      {/* 브랜드(MY TRAVEL PASSPORT · 로고)는 패널 맨 윗줄에 있다. (TravelPassportPanel)
          여기는 TYPE 부터 시작해 사진 칸과 위 끝이 맞는다. */}
      <View className="ml-4 flex-1" onLayout={onInfoLayout}>
        {/* 워터마크. 이 칼럼 폭에 맞춰 오른쪽 위에. 글자 뒤 · 터치 안 막음. */}
        {infoWidth > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute', right: -6, top: 6 }}>
            <WorldMapWatermark width={infoWidth + 6} height={(infoWidth + 6) * (150 / 360)} />
          </View>
        ) : null}

        <View className="gap-3">
          <View className="flex-row gap-3">
            <Field label="TYPE" value="TRAVELER" />
            <Field label="TRAVEL BASE" value="KOR" />
          </View>
          <Field label="NAME" value={profile.name} strong />
          {/*
            ⚠️ 저장된 값 그대로다. '지수' 를 JISU 로 추정해 넣지 않는다.
            ⚠️ 여권 안에서는 읽기 전용이다. 수정은 설정 → 계정 관리(/me/account)에서 한다.
               (2026-09-15) 여권에 pencil 을 두지 않는다 — 사진 변경과 섞이고 내지가 복잡해진다.
          */}
          <Field label="ENGLISH NAME" value={profile.englishName || EMPTY} />
          <View className="flex-row gap-3">
            <Field label="MEMBER SINCE" value={toMemberSince(profile.memberSince)} />
            <Field label="PASSPORT TYPE" value="TripPot Member" />
          </View>
        </View>
      </View>
    </View>
  );
}
