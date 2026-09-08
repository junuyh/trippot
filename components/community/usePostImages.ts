// ============================================================================
// COMM-04 사진 선택 (여러 장)
//
// 사진은 **글을 저장할 때** 올라간다. 고르는 시점이 아니다.
// 고르고 나서 글을 안 쓰고 나가는 사람이 있고, 그때 올린 파일은 아무도
// 참조하지 않는 쓰레기로 남는다. 화면(app/community/write.tsx)이 저장 직전에
// local 항목만 업로드하고 그 URL 을 createPost / updatePost 로 넘긴다.
//
// ⚠️ 새 글과 수정이 한 훅을 쓴다. 그래서 사진이 두 종류다.
//    · remote — 이미 저장돼 있는 사진. URL 을 그대로 다시 넘기면 된다.
//    · local  — 방금 기기에서 고른 사진. 저장할 때 올려야 URL 이 생긴다.
//    미리보기(uris)에서는 둘이 똑같이 보인다. <Image> 는 어느 쪽이든 그린다.
//
// ⚠️ **지운 remote 사진의 URL 을 따로 모아 둔다.** (removedRemoteUrls)
//    글 저장이 성공한 뒤에 그 파일들을 Storage 에서 지워야 한다.
//    지우는 즉시 삭제하면, 저장하지 않고 나갔을 때 멀쩡한 글의 사진이 사라진다.
//
// ⚠️ 업로드 권한이 미정이다. 앱에 로그인이 없어 DEV_USER_ID 로 도는데
//    Storage 쓰기 정책이 지금 전체 개방이다. (마이그레이션 하단 주석 — 배포 전
//    본인 폴더만 쓰도록 바꿔야 하는 [Release Blocker])
// ============================================================================
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

/** 한 글에 넣을 수 있는 사진 수. 더 늘리려면 목록 카드 표시도 같이 봐야 한다. */
export const MAX_IMAGES = 5;

/** 이미 저장된 사진. public URL 이다. */
export type RemotePostImage = { kind: 'remote'; url: string };

/** 방금 고른 사진. 기기 안의 임시 경로다. */
export type LocalPostImage = { kind: 'local'; uri: string; width: number; height: number };

export type PostImage = RemotePostImage | LocalPostImage;

/** 미리보기·업로드에 쓸 주소. remote 는 URL, local 은 기기 경로다. */
export function imageSource(image: PostImage): string {
  return image.kind === 'remote' ? image.url : image.uri;
}

export function usePostImages() {
  const [images, setImages] = useState<PostImage[]>([]);
  const [removedRemoteUrls, setRemovedRemoteUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  /**
   * 수정 모드에서 이미 저장돼 있던 사진으로 채운다.
   *
   * ⚠️ 지운 목록도 함께 비운다. 다른 글을 열었는데 앞 글에서 지운 URL 이
   *    남아 있으면, 저장할 때 남의 글 사진을 지우게 된다.
   */
  const reset = useCallback((urls: string[]) => {
    setImages(urls.slice(0, MAX_IMAGES).map((url) => ({ kind: 'remote', url })));
    setRemovedRemoteUrls([]);
    setError(null);
  }, []);

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

      const picked: PostImage[] = result.assets.map((asset) => ({
        kind: 'local',
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

  const removeAt = useCallback(
    (index: number) => {
      const target = images[index];
      if (!target) return;

      // 저장돼 있던 사진이면 파일도 지워야 한다. 단 저장이 성공한 뒤에.
      //
      // ⚠️ setImages 의 updater 안에서 이 판단을 하지 않는다. updater 는
      //    React 가 두 번 부를 수 있어(개발 모드 StrictMode) 같은 URL 이
      //    삭제 목록에 두 번 들어간다. 목록을 밖에서 읽고 여기서 정한다.
      if (target.kind === 'remote') {
        setRemovedRemoteUrls((urls) => (urls.includes(target.url) ? urls : [...urls, target.url]));
      }

      setImages((prev) => prev.filter((_, i) => i !== index));
      setError(null);
    },
    [images],
  );

  const clear = useCallback(() => {
    setImages([]);
    setRemovedRemoteUrls([]);
    setError(null);
  }, []);

  return {
    images,
    /** 미리보기용 주소 목록. 화면은 이것만 있으면 된다. */
    uris: images.map(imageSource),
    removedRemoteUrls,
    error,
    picking,
    pick,
    removeAt,
    reset,
    clear,
  };
}
