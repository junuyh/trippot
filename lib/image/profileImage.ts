// ============================================================================
// 프로필 이미지 준비 — 업로드 전에 크기를 줄인다
//
// ⚠️ 왜 필요한가
//    사진첩을 빨리 열려고 allowsEditing 을 끄면서 자르기 화면이 없어졌다.
//    그래서 고른 사진이 **원본 해상도 그대로** 넘어온다.
//    아이폰 12MP 사진은 JPEG 로 줄여도 Storage 상한 2MB 를 넘길 때가 있다.
//
//    quality 만 낮추면 해상도가 그대로라 결과가 사진마다 들쭉날쭉하다.
//    긴 변을 1024 로 맞추면 픽셀 수가 1/10 이하로 떨어져 어떤 원본이 와도
//    수백 KB 안쪽으로 수렴한다. 화면에는 85pt 원으로만 보여 손해가 없다.
//
// ⚠️ EXIF 방향
//    직접 회전 로직을 만들지 않는다. expo-image-manipulator 가 이미지를 읽어
//    비트맵으로 만드는 시점에 방향을 적용하고, 그 뒤 크기(width/height)와
//    저장 결과가 모두 그 기준을 따른다. 그래서 세로 사진을 가로로 판단하거나
//    결과가 뒤집히는 문제가 생기지 않는다.
//    (그래서 asset.width/height 가 아니라 renderAsync() 결과의 크기로 판단한다)
// ============================================================================
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** 긴 변 상한. 프로필은 85pt 원이라 이 이상은 화면에서 의미가 없다. */
const MAX_EDGE = 1024;

/** 이미 1024 로 줄인 뒤라 더 낮출 이유가 없다. */
const COMPRESS = 0.8;

export type PreparedProfileImage = {
  /** 업로드에 쓸 JPEG 바이트의 base64. */
  base64: string;
  /** 줄이기 전 크기. 로그·검증용. */
  originalWidth: number;
  originalHeight: number;
  /** 실제로 업로드할 크기. */
  width: number;
  height: number;
  /** 줄였는지. 원본이 이미 작으면 false 다. */
  resized: boolean;
};

/**
 * 고른 사진을 업로드할 수 있는 JPEG 로 바꾼다.
 *
 * 긴 변이 1024 를 넘을 때만 줄인다. **작은 사진을 늘리지 않는다.**
 * 늘리면 화질은 그대로인데 용량만 커진다.
 */
export async function prepareProfileImage(uri: string): Promise<PreparedProfileImage> {
  // 한 번만 읽는다. 이 시점에 EXIF 방향이 적용된다.
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { width: originalWidth, height: originalHeight } = original;

  const longestEdge = Math.max(originalWidth, originalHeight);
  const needsResize = longestEdge > MAX_EDGE;

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

  return {
    base64: saved.base64,
    originalWidth,
    originalHeight,
    width: saved.width,
    height: saved.height,
    resized: needsResize,
  };
}
