import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import type { MyProfile } from './types';

// 원형 이미지 지름. Figma 는 80 이지만 실제 화면에서 작아 보여 85 로 키웠다.
// ⚠️ 배지는 같이 키우지 않는다. 배지가 커지면 사진을 덮는다.
//    absolute bottom-0 right-0 라 지름이 바뀌어도 원 가장자리에 그대로 붙는다.
const AVATAR_SIZE = 85;
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
 *    계정관리 화면이 확정되지 않아 이동할 곳이 없다.
 */
export function ProfileSection({ profile, pickedImageUri, onPressChangeImage }: Props) {
  // 이번 세션에서 고른 이미지가 최우선. 없으면 저장된 이미지, 그것도 없으면 기본 아이콘.
  const imageUri = pickedImageUri ?? profile.profileImageUrl;

  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 pr-4">
        <Text numberOfLines={1} className="text-[25px] font-bold leading-9 text-pot-ink">
          {profile.name}
        </Text>
        {profile.accountLabel ? (
          <Text numberOfLines={1} className="mt-1 text-sm leading-5 text-pot-mute">
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
