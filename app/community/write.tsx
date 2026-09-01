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
// 이 파일은 데이터 조회·상태 관리·로그 기록만 한다.
// 실제로 보이는 UI 는 components/community/ 에 있다. (CLAUDE.md 9장)
// ============================================================================
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { PostWriteForm } from '@/components/community';
import { DEV_USER_ID } from '@/lib/constants/devUser';
import { POST_TYPE, POST_TYPE_LABEL } from '@/lib/constants/status';
import {
  createPost,
  WRITABLE_POST_TYPES,
  type WritablePostType,
} from '@/lib/supabase/queries/community';

const TITLE_MIN = 2;
const CONTENT_MIN = 10;

const TYPE_OPTIONS = WRITABLE_POST_TYPES.map((value) => ({
  value,
  label: value === POST_TYPE.FREE_TIP ? '여행 팁' : '자유',
}));

export default function ScreenCOMM04() {
  const router = useRouter();

  const [postType, setPostType] = useState<WritablePostType>(POST_TYPE.FREE_TIP);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

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
    try {
      const created = await createPost({
        // TODO: 로그인 연동 시 교체
        authorUserId: DEV_USER_ID,
        postType,
        title: title.trim(),
        content: content.trim(),
        // 여행 연결은 아직 없다. 어느 여행에서 나온 글인지 고르는 UI 는
        // 화면 목록에 없어서 넣지 않았다.
        tripId: null,
      });

      // 목록으로 돌아가지 않고 방금 쓴 글을 보여준다.
      // 뒤로 가면 작성 화면이 아니라 목록이 나오도록 replace 를 쓴다.
      router.replace(`/community/posts/${created.id}`);
    } catch {
      setSubmitError('글을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: `${POST_TYPE_LABEL[postType]} 쓰기` }} />
      <PostWriteForm
        typeOptions={TYPE_OPTIONS}
        postType={postType}
        onChangeType={(value) => setPostType(value as WritablePostType)}
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
        submitting={submitting}
        onSubmit={() => void handleSubmit()}
      />
    </>
  );
}
