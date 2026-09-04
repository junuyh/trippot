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
// ⚠️ 사진은 고르고 미리보기까지만 된다. 저장하지 않는다.
//    여러 장이라 컬럼 하나로는 안 되고 post_images 테이블이나 text[] 가 필요하다.
//    Storage 버킷도 아직 없다.
//    둘 다 DB 담당자에게 요청해 둔 상태다. (CLAUDE.md 1장 — 마이그레이션은 담당자만)
//    TODO: 준비되면 업로드 후 URL 을 createPost 에 넘긴다.
//
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { PostWriteForm, type TripOption } from '@/components/community';
import { MAX_IMAGES, usePostImages } from '@/components/community/usePostImages';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { findDestinationByName } from '@/lib/constants/destinations';
import { POST_TYPE } from '@/lib/constants/status';
import {
  createPost,
  WRITABLE_POST_TYPES,
  type WritablePostType,
} from '@/lib/supabase/queries/community';
import { getTrips, type Trip } from '@/lib/supabase/queries/trips';

const TITLE_MIN = 2;
const CONTENT_MIN = 10;

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

export default function ScreenCOMM04() {
  const router = useRouter();

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

  const [titleError, setTitleError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photos = usePostImages();

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
    try {
      const created = await createPost({
        // TODO: 로그인 연동 시 교체
        authorUserId: DEV_USER_ID,
        postType,
        title: title.trim(),
        content: content.trim(),
        // 고른 여행. 이 값이 글의 여행지 카테고리를 정한다.
        // 고르지 않았으면 null 이고 그 글은 '전체' 에만 보인다.
        tripId,
      });

      // 목록으로 돌아가지 않고 방금 쓴 글을 보여준다.
      // 뒤로 가면 작성 화면이 아니라 목록이 나오도록 replace 를 쓴다.
      router.replace(`/community/posts/${created.id}`);
    } catch {
      setSubmitError('글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }

  // 여행 선택지. 국기는 목적지 상수에서 온다. 컴포넌트가 상수를 뒤지지 않는다. (CLAUDE.md 9장)
  //
  // 최근 여행이 앞이다. 방금 다녀온 여행 이야기를 쓸 확률이 가장 높다.
  // 출발일이 없는 여행은 뒤로 보낸다.
  const tripOptions: TripOption[] = [...trips]
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .slice(0, TRIP_OPTION_LIMIT)
    .map((trip) => ({
      tripId: trip.id,
      label: trip.destination ?? '여행지 미정',
      // 같은 여행지를 여러 번 갔을 때 구분되게 연·월만 붙인다.
      // start_date 는 date 타입이라 시간대 변환이 없다. 앞 7자가 'YYYY-MM' 이다.
      sublabel: trip.start_date ? trip.start_date.slice(0, 7).replace('-', '.') : null,
      flag: findDestinationByName(trip.destination)?.flag ?? null,
    }));

  return (
    <>
      <Stack.Screen options={{ title: WRITE_TITLE[postType], headerTitleAlign: 'center' }} />
      <PostWriteForm
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
        imageUris={photos.images.map((image) => image.uri)}
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
