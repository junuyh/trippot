import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';

type Props = {
  /** users.profile_image_url. 지정하지 않은 사용자는 null 이다. */
  imageUrl: string | null;
  size: number;
};

/** 사진을 올리지 않은 사용자의 기본 아바타 색. 인스타그램과 같은 회색 실루엣이다. */
const EMPTY_BG = '#EFEFEF';
const EMPTY_ICON = '#8E8E8E';

/**
 * 커뮤니티 프로필 사진.
 *
 * 사진이 있으면 그대로 보여주고, 없으면 회색 사람 실루엣을 보여준다.
 * 이름 첫 글자나 글 유형 아이콘을 쓰지 않는다 — 사람 자리에는 사람이 있어야
 * 목록에서 '누가 썼는지' 가 한눈에 읽힌다.
 */
export function Avatar({ imageUrl, size }: Props) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: EMPTY_BG,
      }}
    >
      {/* 아이콘을 원 지름의 70% 로 잡으면 어느 크기에서도 같은 비율로 보인다. */}
      <Ionicons name="person" size={Math.round(size * 0.7)} color={EMPTY_ICON} />
    </View>
  );
}
