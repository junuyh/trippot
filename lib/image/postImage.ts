// ============================================================================
// 게시글 사진 준비 — 업로드 전에 크기를 줄인다
//
// lib/image/profileImage.ts 와 같은 방식이다. 상한만 다르다.
//
// ⚠️ 긴 변 1600px 이다. 프로필(1024)보다 크다.
//    프로필은 85pt 원으로만 보이지만 게시글 사진은 상세에서 화면 폭을 거의
//    다 쓴다. 1024 로 줄이면 큰 화면에서 늘려 그리게 되어 흐려진다.
//    (bucket 상한 5MB — 20260904000002_community_images_storage.sql)
//
// ⚠️ EXIF 방향은 직접 다루지 않는다. expo-image-manipulator 가 비트맵을 만드는
//    시점에 방향을 적용하고 그 뒤 크기와 저장 결과가 모두 그 기준을 따른다.
//    그래서 asset.width/height 가 아니라 renderAsync() 결과로 판단한다.
// ============================================================================
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** 긴 변 상한. 상세 화면이 폭을 거의 다 쓰므로 프로필보다 크게 잡는다. */
const MAX_EDGE = 1600;

/** 이미 1600 으로 줄인 뒤라 더 낮출 이유가 없다. */
const COMPRESS = 0.8;

export type PreparedPostImage = {
  /** 업로드에 쓸 JPEG 바이트의 base64. */
  base64: string;
  /** 실제로 올릴 크기. */
  width: number;
  height: number;
};

/**
 * 고른 사진을 업로드할 수 있는 JPEG 로 바꾼다.
 *
 * 긴 변이 1600 을 넘을 때만 줄인다. **작은 사진을 늘리지 않는다.**
 * 늘리면 화질은 그대로인데 용량만 커진다.
 */
export async function preparePostImage(uri: string): Promise<PreparedPostImage> {
  // 한 번만 읽는다. 이 시점에 EXIF 방향이 적용된다.
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width: originalWidth, height: originalHeight } = original;

  const needsResize = Math.max(originalWidth, originalHeight) > MAX_EDGE;

  // 긴 변만 지정하면 나머지는 비율에 맞춰 계산된다.
  const target = needsResize
    ? await ImageManipulator.manipulate(original)
        .resize(originalWidth >= originalHeight ? { width: MAX_EDGE } : { height: MAX_EDGE })
        .renderAsync()
    : original;

  const saved = await target.saveAsync({
    format: SaveFormat.JPEG,
    compress: COMPRESS,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error('리사이즈 결과에서 base64 를 받지 못했습니다.');
  }

  return { base64: saved.base64, width: saved.width, height: saved.height };
}
