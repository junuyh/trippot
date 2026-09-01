// ============================================================================
// COMM-04 사진 선택 (여러 장)
//
// ⚠️ **아직 저장되지 않는다.** 두 가지가 없다.
//    · 사진을 담을 스키마 — 여러 장이라 컬럼 하나로는 안 된다.
//      post_images 테이블이나 text[] 컬럼이 필요하다. (마이그레이션 — DB 담당)
//    · Supabase Storage 'community' 버킷과 업로드 정책
//
//    지금은 기기에서 고르고 미리보기까지만 한다.
//
// ⚠️ 업로드 권한이 미정이다. 앱에 로그인이 없어 DEV_USER_ID 로 도는데,
//    authenticated 정책을 걸면 업로드가 막히고 anon 에 열면 아무나 올린다.
//    로그인 구현 시점과 함께 정해야 한다.
// ============================================================================
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

/** 한 글에 넣을 수 있는 사진 수. 더 늘리려면 목록 카드 표시도 같이 봐야 한다. */
export const MAX_IMAGES = 5;

/** 고른 사진. 기기 안의 임시 경로다. */
export type PickedImage = {
  uri: string;
  width: number;
  height: number;
};

export function usePostImages() {
  const [images, setImages] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const pick = useCallback(async () => {
    if (picking) return;

    setError(null);

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`사진은 ${MAX_IMAGES}장까지 넣을 수 있어요.`);
      return;
    }

    setPicking(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('사진 접근을 허용해 주세요.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      if (result.canceled) return;

      const picked = result.assets.map((asset) => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      }));

      // 남은 자리를 넘겨 고른 경우를 대비해 한 번 더 자른다.
      // selectionLimit 이 기기에 따라 지켜지지 않을 수 있다.
      setImages((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
    } catch {
      setError('사진을 불러오지 못했어요.');
    } finally {
      setPicking(false);
    }
  }, [images.length, picking]);

  const removeAt = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setImages([]);
    setError(null);
  }, []);

  return { images, error, picking, pick, removeAt, clear };
}
