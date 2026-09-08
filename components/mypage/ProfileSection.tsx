import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import type { MyProfile } from './types';

// 원형 이미지 지름.
// ⚠️ 배지는 같이 키우지 않는다. 배지가 커지면 사진을 덮는다.
//    absolute bottom-0 right-0 라 지름이 바뀌어도 원 가장자리에 그대로 붙는다.
//    (지름 d 원의 45° 지점은 0.854d, 배지 중심은 d-12 — 84 에서 거의 정확히 겹친다)
// ⚠️ 배지는 같이 키우지 않는다. 배지가 커지면 사진을 덮는다.
//    absolute bottom-0 right-0 라 지름이 바뀌어도 원 가장자리에 그대로 붙는다.
const AVATAR_SIZE = 84;
const EDIT_BADGE_SIZE = 24;

type Props = {
  profile: MyProfile;
  /** 이 세션에서 사용자가 고른 이미지. 있으면 profileImageUrl 보다 우선한다. */
  pickedImageUri: string | null;
  /** 사진 또는 편집 배지를 눌렀을 때. 기기 이미지 선택을 연다. */
  onPressChangeImage: () => void;
};

/**
 * 5-1 프로필. (docs/09_IA_v1.md §5-1)
 *
 * 왼쪽에 이름과 연결된 로그인 계정, 오른쪽에 원형 이미지를 둔다.
 * Figma 의 좌/우 배치와 정보 위계(이름이 가장 큼)를 따른다.
 *
 * ⚠️ 계정 줄은 navigation 이 아니다. Pressable 도 chevron 도 두지 않는다.
 *    계정관리(/me/account)는 아래 설정 메뉴에서 들어간다. 프로필 영역은
 *    보여주는 곳이고, 고치는 곳은 한 군데여야 한다.
 */
export function ProfileSection({ profile, pickedImageUri, onPressChangeImage }: Props) {
  // 이번 세션에서 고른 이미지가 최우선. 없으면 저장된 이미지, 그것도 없으면 기본 아이콘.
  const imageUri = pickedImageUri ?? profile.profileImageUrl;

  return (
    // ⚠️ 흰 카드로 감싸지 않는다. 상단(pot-visual) 전체가 하나의 영역으로
    //    읽혀야 하는데, 프로필만 카드로 떠 있으면 영역이 둘로 갈라진다.
    // ⚠️ px-7 은 이 줄만의 안쪽 여백이다. 화면 전체 padding 을 건드리면
    //    아래 '내 여행'·메뉴 정렬까지 따라 움직인다. 여기서만 좌·우를 28씩
    //    당겨 글자와 사진을 붙인다. justify-between 을 버리고 사진을 이름
    //    옆에 두면 좌/우 구조가 사라지므로 여백으로만 줄인다.
    //
    //    ⚠️ flex-1 을 빼도 간격은 그대로다. justify-between 이 사진을 오른쪽
    //       끝으로 미는 구조라, 이 줄의 안쪽 여백만이 실제로 거리를 줄인다.
    //
    // ⚠️ py-5 는 프로필 영역 자체의 숨 쉴 자리다. 아래 '내 여행' 에 margin 을
    //    더하는 방식은 프로필이 아니라 간격만 벌린다. 이 줄이 스스로 높이를
    //    가져야 헤더와 '내 여행' 사이에서 하나의 영역으로 읽힌다.
    <View className="flex-row items-center justify-between px-7 py-5">
      <View className="flex-1 pr-4">
        {/* 프로필의 핵심 정보다. 홈 인사말(19)보다 크게 둔다.
            weight·색·letterSpacing 은 그대로다. */}
        <Text
          numberOfLines={1}
          className="font-black text-pot-ink"
          style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.6 }}
        >
          {profile.name}
        </Text>
        {profile.accountLabel ? (
          <Text numberOfLines={1} className="mt-1 text-pot-mute" style={{ fontSize: 12.5 }}>
            {profile.accountLabel}
          </Text>
        ) : null}
      </View>

      {/* 사진 전체가 이미지 변경 터치 영역이다. 배지는 그 안에서 한 번 더 강조한다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="프로필 사진 변경"
        onPress={onPressChangeImage}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        className="active:opacity-70"
      >
        {imageUri ? (
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: imageUri }}
            resizeMode="cover"
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
          />
        ) : (
          // 기본 아이콘. 새 이미지 에셋을 추가하지 않는다.
          <Ionicons name="person-circle" size={AVATAR_SIZE} color="#CBD0D6" />
        )}

        {/* 편집 배지 — absolute 라 레이아웃에 영향이 없다. */}
        <View
          style={{ width: EDIT_BADGE_SIZE, height: EDIT_BADGE_SIZE }}
          className="absolute bottom-0 right-0 items-center justify-center rounded-full border border-pot-line bg-white"
        >
          <Ionicons name="pencil" size={13} color="#747B88" />
        </View>
      </Pressable>
    </View>
  );
}
