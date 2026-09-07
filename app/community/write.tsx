// ============================================================================
// COMM-04 · /community/write · 게시글 / 팁 작성
// 기준 문서: docs/09_IA_v1.md §4-5
//
// ⚠️ **screen_viewed 를 남기지 않는다.** lib/analytics/events.ts 가 COMM-04 를
//    screen_name 미정 화면으로 명시하고 있고 "임의로 추가하지 않는다" 고 못박았다.
//    TODO: docs/06 이 v3 로 갱신되면 SCREENS 에 값을 받아 붙인다.
//
// ⚠️ 작성 완료 이벤트 TIP_CREATED 도 고도화 블록 + ADVANCED_EVENT_NAMES 라
//    호출하면 track() 이 경고한다. 부르지 않는다.
//    TODO: 고도화 착수 시 붙인다. (docs/06 §7-8)
//
// ⚠️ 유료 팁은 2026-08-31 팀 결정으로 뺐다. 유형 선택지에 없다.
//
// ⚠️ 사진은 **글을 저장할 때** 올라간다. 고르는 시점이 아니다. (2026-09-07)
//    고르고 나서 글을 안 쓰고 나가는 사람이 있고, 그때 올린 파일은 아무도
//    참조하지 않는 쓰레기로 남는다.
//    올린 URL 을 community_posts.image_urls 에 넣는다.
//    파일은 Storage, 파일의 위치는 컬럼 — 역할을 나눈다. (05_ERD_v6 §6-7)
//
// ⚠️ 저장 순서를 지킨다. 어긋나면 사진과 글이 따로 논다.
//    1. local 사진 업로드 → URL
//    2. 글 저장 (남길 기존 URL + 새 URL)
//    3. 성공한 뒤에야 빠진 사진 파일 삭제
//    2에서 실패하면 1에서 올린 파일을 도로 지운다. 아무도 안 쓰는 파일이다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { PostWriteForm, type TripOption } from '@/components/community';
import { ErrorState, Loading } from '@/components/ui';
import { MAX_IMAGES, usePostImages } from '@/components/community/usePostImages';
import { preparePostImage } from '@/lib/image/postImage';
import {
  deletePostImages,
  PostImageTooLargeError,
  uploadPostImage,
} from '@/lib/supabase/storage/communityImage';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import { POST_TYPE } from '@/lib/constants/status';
import {
  createPost,
  getPostById,
  updatePost,
  WRITABLE_POST_TYPES,
  type WritablePostType,
} from '@/lib/supabase/queries/community';
import { getTrips, type Trip } from '@/lib/supabase/queries/trips';

const TITLE_MIN = 2;
const CONTENT_MIN = 10;

/** 이 화면에서 쓰고 고칠 수 있는 유형인가. (자유·여행 팁) */
function isWritableType(value: string): value is WritablePostType {
  return (WRITABLE_POST_TYPES as readonly string[]).includes(value);
}

/**
 * 여행 선택지로 보여줄 최대 개수.
 *
 * 여행이 일곱 개면 칩이 일곱 개 깔려서, 글을 쓰러 온 사람이 먼저 여행 목록을
 * 훑게 된다. 커뮤니티 글은 대부분 **방금 다녀온 여행** 이야기라 최근 둘이면
 * 거의 맞는다. 나머지 여행에 글을 달 방법은 아직 없다.
 *
 * ⚠️ [검토 필요] 더 예전 여행 이야기를 쓰려는 사람은 여행을 고를 수 없다.
 *    선택하지 않아도 글은 올라가고 '전체' 목록에는 보인다. 여행지 카테고리에만
 *    안 잡힌다. 목록이 길어질 때 '더 보기' 를 둘지는 사람이 정한다.
 */
const TRIP_OPTION_LIMIT = 2;

const TYPE_OPTIONS = WRITABLE_POST_TYPES.map((value) => ({
  value,
  label: value === POST_TYPE.FREE_TIP ? '여행 팁' : '자유',
}));

/**
 * 상단바 제목. 고른 유형에 따라 바뀐다.
 *
 * POST_TYPE_LABEL 을 쓰지 않는다. 그건 DB 열거값 라벨('무료 팁'·'게시글')이라
 * 유료 팁이 있던 시절의 이름이 남아 있다. 목록 필터는 '여행 팁'·'자유'로 부르고 있어
 * 화면에서 부르는 이름을 여기서 맞춘다.
 */
const WRITE_TITLE: Record<(typeof WRITABLE_POST_TYPES)[number], string> = {
  [POST_TYPE.FREE_TIP]: '새로운 여행 팁',
  [POST_TYPE.POST]: '새로운 게시글',
};

/** 수정 모드 상단바 제목. 무엇을 고치는 중인지 한 번 더 알려준다. */
const EDIT_TITLE: Record<(typeof WRITABLE_POST_TYPES)[number], string> = {
  [POST_TYPE.FREE_TIP]: '여행 팁 수정',
  [POST_TYPE.POST]: '게시글 수정',
};

export default function ScreenCOMM04() {
  const router = useRouter();

  /**
   * 수정 모드. (2026-09-04)
   *
   * ⚠️ 수정 전용 화면을 새로 만들지 않았다. 쓸 때와 고칠 때 채우는 값이 같아서
   *    화면을 두 벌 두면 항목이 하나 늘 때마다 두 곳을 고쳐야 하고, 한쪽만
   *    고치면 새 글에는 있는 칸이 수정에는 없는 일이 생긴다.
   *    postId 가 오면 수정, 없으면 새 글이다.
   */
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const editing = typeof postId === 'string' && postId.length > 0;
  /** 고칠 글을 아직 불러오는 중. 빈 폼이 잠깐 보이는 것을 막는다. */
  const [loadingPost, setLoadingPost] = useState(editing);

  const [postType, setPostType] = useState<WritablePostType>(POST_TYPE.FREE_TIP);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // 어느 여행 이야기인가. (2026-09-03)
  //
  // ⚠️ 이 값이 커뮤니티의 여행지 카테고리를 정한다. community_posts 에
  //    destination 컬럼이 없어서(types/database.ts) 글의 여행지는 연결한 여행에서만
  //    나온다. 전에는 여기가 null 로 고정이라 어떤 글도 여행지 칸에 들어가지 못했다.
  //
  // ⚠️ 여행 조회가 실패해도 글은 쓸 수 있어야 한다. 선택지가 없으면
  //    작성 폼이 그 섹션을 그리지 않고, tripId 는 null 로 남는다.
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string | null>(null);
  /**
   * 이 글이 원래 연결돼 있던 여행.
   *
   * ⚠️ 선택지는 최근 2개만 보여준다(TRIP_OPTION_LIMIT). 그런데 오래된 여행에
   *    달아 둔 글을 고치면 그 여행이 목록에 없어서, 사용자가 손대지도 않았는데
   *    연결이 '선택 안 함' 으로 풀려 버린다. 원래 여행은 목록 밖이어도 항상 넣는다.
   */
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // TODO: 로그인 연동 시 교체
    getTrips(DEV_USER_ID)
      .then((rows) => {
        if (alive) setTrips(rows);
      })
      .catch(() => {
        // 여행 목록을 못 불러와도 글쓰기 자체를 막지 않는다.
        if (alive) setTrips([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 고칠 글 불러오기. 새 글이면 아무것도 하지 않는다.
   *
   * ⚠️ **남의 글이면 폼을 채우지 않는다.** 상세 화면이 수정 버튼을 내 글에만
   *    그리지만, 주소를 직접 치고 들어올 수 있다. 저장은 쿼리가 한 번 더 막지만
   *    (updatePost 의 author_user_id 조건) 남의 글 내용이 편집기에 뜨는 것부터
   *    막는다.
   *
   * ⚠️ 사진도 함께 되살린다. 되살리지 않으면 제목만 고치고 저장한 사람이
   *    사진을 다 잃는다. 화면에 안 보이던 것이 저장하는 순간 지워지기 때문이다.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  const photos = usePostImages();
  const resetPhotos = photos.reset;

  useEffect(() => {
    if (!editing || !postId) return;

    let alive = true;
    setLoadingPost(true);
    // TODO: 로그인 연동 시 교체
    getPostById(postId, DEV_USER_ID)
      .then((post) => {
        if (!alive) return;
        if (!post) {
          setLoadError('글을 찾을 수 없어요.');
          return;
        }
        if (post.authorUserId !== DEV_USER_ID) {
          setLoadError('내가 쓴 글만 수정할 수 있어요.');
          return;
        }
        // ⚠️ 여기서 as 로 밀어 넣지 않는다. 글 유형에는 이 화면에서 쓸 수 없는 값
        //    (TYPE_SHARE — 여행 유형 공유)도 있다. 그대로 캐스팅하면 유형 칩이
        //    하나도 안 눌린 채로 열리고, 저장하는 순간 남의 유형이 다른 값으로
        //    덮인다. 고칠 수 없는 유형이면 열지 않는다.
        if (!isWritableType(post.postType)) {
          setLoadError('이 글은 여기서 수정할 수 없어요.');
          return;
        }
        setPostType(post.postType);
        setTitle(post.title);
        setContent(post.content ?? '');
        setTripId(post.tripId);
        setEditingTripId(post.tripId);
        resetPhotos(post.imageUrls);
      })
      .catch(() => {
        if (alive) setLoadError('글을 불러오지 못했어요.');
      })
      .finally(() => {
        if (alive) setLoadingPost(false);
      });

    return () => {
      alive = false;
    };
  }, [editing, postId, resetPhotos]);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const t = title.trim();
    const c = content.trim();

    const nextTitleError =
      t.length === 0 ? '제목을 입력해 주세요.' : t.length < TITLE_MIN ? '제목이 너무 짧아요.' : null;
    const nextContentError =
      c.length === 0
        ? '내용을 입력해 주세요.'
        : c.length < CONTENT_MIN
          ? `내용을 ${CONTENT_MIN}자 이상 적어주세요.`
          : null;

    setTitleError(nextTitleError);
    setContentError(nextContentError);
    return nextTitleError === null && nextContentError === null;
  }

  async function handleSubmit() {
    // 저장 중 중복 제출 방지. (CLAUDE.md 9장)
    if (submitting) return;

    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);

    // 이번 저장에서 새로 올린 파일. 글 저장이 실패하면 도로 지운다.
    const uploaded: string[] = [];

    try {
      // ── 1. 사진 업로드 ────────────────────────────────────────────────────
      //
      // ⚠️ 한 장씩 차례로 올린다. Promise.all 로 한꺼번에 올리면 사진 다섯 장의
      //    base64 가 동시에 메모리에 뜬다. 사진첩 원본이 큰 기기에서 위험하다.
      //    순서도 그대로 지켜져서 사용자가 고른 차례대로 저장된다.
      const imageUrls: string[] = [];
      for (const image of photos.images) {
        // 이미 저장돼 있던 사진은 다시 올리지 않는다. URL 을 그대로 쓴다.
        if (image.kind === 'remote') {
          imageUrls.push(image.url);
          continue;
        }
        const prepared = await preparePostImage(image.uri);
        // TODO: 로그인 연동 시 교체
        const url = await uploadPostImage(DEV_USER_ID, prepared.base64);
        uploaded.push(url);
        imageUrls.push(url);
      }

      // ── 2. 글 저장 ────────────────────────────────────────────────────────
      if (editing && postId) {
        await updatePost({
          postId,
          // TODO: 로그인 연동 시 교체
          authorUserId: DEV_USER_ID,
          postType,
          title: title.trim(),
          content: content.trim(),
          tripId,
          imageUrls,
        });

        // ── 3. 빠진 사진 파일 삭제 ──────────────────────────────────────────
        //
        // ⚠️ 저장이 끝난 **뒤에** 지운다. 먼저 지우면 저장이 실패했을 때
        //    글에는 URL 이 남아 있는데 파일이 없는 상태가 된다.
        //
        // ⚠️ await 하지 않는다. 파일이 남는 것은 사용자가 겪는 문제가 아닌데,
        //    여기서 기다리다 실패하면 이미 성공한 수정이 실패로 보인다.
        if (photos.removedRemoteUrls.length > 0) {
          void deletePostImages(photos.removedRemoteUrls);
        }

        // 고친 글을 바로 보여준다. 뒤로 가면 수정 화면이 아니라 목록이 나온다.
        router.replace(`/community/posts/${postId}`);
        return;
      }

      const created = await createPost({
        // TODO: 로그인 연동 시 교체
        authorUserId: DEV_USER_ID,
        postType,
        title: title.trim(),
        content: content.trim(),
        // 고른 여행. 이 값이 글의 여행지 카테고리를 정한다.
        // 고르지 않았으면 null 이고 그 글은 '전체' 에만 보인다.
        tripId,
        imageUrls,
      });

      // 목록으로 돌아가지 않고 방금 쓴 글을 보여준다.
      // 뒤로 가면 작성 화면이 아니라 목록이 나오도록 replace 를 쓴다.
      router.replace(`/community/posts/${created.id}`);
    } catch (error) {
      // 글이 저장되지 않았으므로 방금 올린 파일은 아무도 참조하지 않는다.
      // 지우지 않으면 다시 시도할 때마다 같은 사진이 한 벌씩 쌓인다.
      if (uploaded.length > 0) void deletePostImages(uploaded);

      setSubmitError(
        error instanceof PostImageTooLargeError
          ? '사진 용량이 너무 커요. 다른 사진으로 바꿔 주세요.'
          : editing
            ? '글을 수정하지 못했어요. 잠시 후 다시 시도해 주세요.'
            : '글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      setSubmitting(false);
    }
  }

  // 여행 선택지. 국기는 목적지 상수에서 온다. 컴포넌트가 상수를 뒤지지 않는다. (CLAUDE.md 9장)
  //
  // 최근 여행이 앞이다. 방금 다녀온 여행 이야기를 쓸 확률이 가장 높다.
  // 출발일이 없는 여행은 뒤로 보낸다.
  const sortedTrips = [...trips].sort((a, b) =>
    (b.start_date ?? '').localeCompare(a.start_date ?? ''),
  );
  const shownTrips = sortedTrips.slice(0, TRIP_OPTION_LIMIT);
  // 고치는 글이 원래 걸어 둔 여행이 최근 2개 밖이면 그 여행도 함께 보여준다.
  // 그러지 않으면 손대지도 않은 연결이 저장하는 순간 풀린다.
  if (editingTripId && !shownTrips.some((trip) => trip.id === editingTripId)) {
    const linked = sortedTrips.find((trip) => trip.id === editingTripId);
    if (linked) shownTrips.push(linked);
  }

  const tripOptions: TripOption[] = shownTrips
    .map((trip) => ({
      tripId: trip.id,
      label: trip.destination ?? '여행지 미정',
      // 같은 여행지를 여러 번 갔을 때 구분되게 연·월만 붙인다.
      // start_date 는 date 타입이라 시간대 변환이 없다. 앞 7자가 'YYYY-MM' 이다.
      sublabel: trip.start_date ? trip.start_date.slice(0, 7).replace('-', '.') : null,
      flag: findDestinationByName(trip.destination)?.flag ?? null,
    }));

  const screenTitle = editing ? EDIT_TITLE[postType] : WRITE_TITLE[postType];

  // 고칠 글을 불러오는 동안 빈 폼을 보여주지 않는다. 빈 칸이 보였다가
  // 글자가 채워지면 사용자가 이미 지워진 줄 안다.
  if (editing && loadingPost) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle, headerTitleAlign: 'center' }} />
        <Loading message="글을 불러오고 있어요" />
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle, headerTitleAlign: 'center' }} />
        <ErrorState message={loadError} onRetry={() => router.back()} retryLabel="돌아가기" />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: screenTitle, headerTitleAlign: 'center' }} />
      <PostWriteForm
        submitLabel={editing ? '수정 완료' : '게시하기'}
        // 제목·내용이 최소 길이를 넘겨야 버튼이 검게 켜진다.
        // 켜진 버튼을 눌렀는데 오류가 나는 일이 없도록 저장 조건과 같은 기준을 쓴다.
        canSubmit={title.trim().length >= TITLE_MIN && content.trim().length >= CONTENT_MIN}
        typeOptions={TYPE_OPTIONS}
        postType={postType}
        onChangeType={(value) => setPostType(value as WritablePostType)}
        tripOptions={tripOptions}
        tripId={tripId}
        onChangeTrip={setTripId}
        title={title}
        onChangeTitle={(value) => {
          setTitle(value);
          if (titleError) setTitleError(null);
        }}
        content={content}
        onChangeContent={(value) => {
          setContent(value);
          if (contentError) setContentError(null);
        }}
        titleError={titleError}
        contentError={contentError}
        submitError={submitError}
        imageUris={photos.uris}
        maxImages={MAX_IMAGES}
        imageError={photos.error}
        imagePicking={photos.picking}
        onPickImages={() => void photos.pick()}
        onRemoveImage={photos.removeAt}
        submitting={submitting}
        onSubmit={() => void handleSubmit()}
      />
    </>
  );
}
