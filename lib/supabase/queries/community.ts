// ============================================================================
// 커뮤니티 조회·작성
// 기준 문서: docs/09_IA_v1.md §4
//
//   4-1 커뮤니티 홈 / 4-2 팁 목록   getPosts
//   4-3 게시글·팁 상세 / 4-6 유형 공유  getPostById
//   4-5 작성                        createPost
//
// ⚠️ **유료 팁은 다루지 않는다.** 2026-08-31 팀 결정으로 유료 기능을 뺐다.
//    PAID_TIP 은 조회에서 제외하고 작성 유형으로도 주지 않는다.
//    (docs/01_서비스정의서_v1.md §8 은 유료 팁을 BM 2 로 적고 있어 문서와 어긋난다.
//     [검토 필요] — 문서 갱신 필요)
//
// ⚠️ 댓글은 2026-08-31 에 뺐다가 2026-09-02 에 다시 넣었다. comments 테이블을 쓴다.
//
// ⚠️ **찜(북마크)과 싫어요는 아직 만들 수 없다.** reactions.reaction_type 이
//    check (…in ('LIKE')) 라 LIKE 말고는 INSERT 자체가 거부된다.
//    스키마 변경은 DB 담당자만 한다. (CLAUDE.md 1장) 요청해 둔 상태다.
//
// ⚠️ TYPE_SHARE(여행 결과 공유)는 **읽기만** 한다. 작성은 여행 유형 결과(TYPE-01)에서
//    나와야 하는데 그 화면이 고도화이고 유형 목록도 미확정이다. (docs/README §5 6번)
//
// 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
// ============================================================================
import {
  COMMENT_STATUS,
  POST_STATUS,
  POST_TYPE,
  REACTION_TYPE,
  type PostType,
  type ReactionType,
} from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

export type CommunityPost = Tables<'community_posts'>;

/** 목록·상세에서 다루는 글 유형. 유료 팁은 제외한다. */
export const VISIBLE_POST_TYPES = [
  POST_TYPE.POST,
  POST_TYPE.FREE_TIP,
  POST_TYPE.TYPE_SHARE,
] as const;

/** 사용자가 직접 쓸 수 있는 글 유형. TYPE_SHARE 는 여행 유형 결과에서만 나온다. */
export const WRITABLE_POST_TYPES = [POST_TYPE.POST, POST_TYPE.FREE_TIP] as const;
export type WritablePostType = (typeof WRITABLE_POST_TYPES)[number];

/** 목록 한 줄. */
export type PostListItem = {
  postId: string;
  title: string;
  postType: PostType;
  /** 작성자 이름. 탈퇴한 사용자면 null. */
  authorName: string | null;
  /** 작성자 프로필 사진. 지정하지 않았으면 null — 화면이 기본 아바타를 그린다. */
  authorImageUrl: string | null;
  /** 이 글이 나온 여행의 목적지. 연결된 여행이 없으면 null. */
  destination: string | null;
  publishedAt: string | null;
  /** 목록에서 본문 앞부분을 보여준다. */
  content: string | null;
  likeCount: number;
  /** 내가 좋아요를 눌렀는가. */
  likedByMe: boolean;
  dislikeCount: number;
  dislikedByMe: boolean;
  /** 내가 찜했는가. 찜은 개수를 공개하지 않는다. */
  bookmarkedByMe: boolean;
  commentCount: number;
  /**
   * 글에 붙은 사진의 public URL. 없으면 빈 배열.
   *
   * ⚠️ 목록 카드도 사진을 그리므로 상세뿐 아니라 목록에도 필요하다.
   *    URL 전체를 담는다. 화면이 Image source 에 그대로 넣기 때문이다.
   *    (users.profile_image_url 과 같은 판단)
   */
  imageUrls: string[];
};

/**
 * 상세. (COMM-02) — 목록에 두 가지가 더 붙는다.
 *
 * 목록(PostListItem)에는 없는 값이다. 목록은 남의 글을 훑는 자리라 누가 썼는지
 * '이름' 만 있으면 되지만, 상세에서는 **내 글인지 판정**해야 수정·삭제를 띄운다.
 * tripId 는 수정 화면이 '어느 여행 이야기인가' 를 원래 값으로 되돌리는 데 쓴다.
 */
export type PostDetail = PostListItem & {
  /**
   * 작성자 user_id. 이 값과 지금 사용자를 비교해 내 글인지 판정한다.
   *
   * ⚠️ nullable 이다. users 를 지우면 FK 가 null 로 풀리도록 되어 있다.
   *    null 은 '주인 없는 글' 이라 아무의 것도 아니다 — 비교가 자연히 거짓이 된다.
   */
  authorUserId: string | null;
  /** 연결된 여행. 고르지 않은 글이면 null. */
  tripId: string | null;
};

// users 는 작성자 FK 와 reactions 경유 두 갈래가 있어 모호하다. FK 를 명시한다.
const AUTHOR = 'users!community_posts_author_user_id_fkey(name, profile_image_url)';

/**
 * 글 목록. 게시된 글을 최신순으로 준다.
 *
 * @param postType 없으면 전체(유료 제외). 있으면 그 유형만. (IA 4-2 탭·필터)
 */
export async function getPosts(
  userId: string,
  postType?: PostType,
  destination?: string | null,
  limit = 30,
): Promise<PostListItem[]> {
  const types = postType ? [postType] : [...VISIBLE_POST_TYPES];

  // ⚠️ 목적지는 글의 destination 칼럼에서 읽는다. trips 를 조인하지 않는다.
  //    trips 는 참여자만 읽을 수 있어서(20260916000008) 남의 여행 글은 조인하면
  //    목적지가 null 로 온다. 글을 쓸 때 DB 트리거가 여행의 목적지를 복사해 둔다.
  //    (20260917000005)
  //
  //    여행에 연결되지 않은 글이 목적지 칸에서 빠지는 것은 의도한 동작이다.
  //    목적지를 모르는 글은 어느 여행지에도 속할 수 없다.
  const rows = destination
    ? await selectPostsByDestination(types, destination, limit)
    : await selectPosts(types, limit);

  const postIds = rows.map((row) => row.id);
  const [reactions, commentCounts] = await Promise.all([
    getReactionMap(postIds, userId),
    getCommentCountMap(postIds),
  ]);

  return rows.map((row) => ({
    postId: row.id,
    title: row.title,
    postType: row.post_type as PostType,
    authorName: row.users?.name ?? null,
    authorImageUrl: row.users?.profile_image_url ?? null,
    destination: row.destination ?? null,
    publishedAt: row.published_at,
    content: row.content,
    likeCount: reactions.get(row.id)?.likeCount ?? 0,
    likedByMe: reactions.get(row.id)?.likedByMe ?? false,
    dislikeCount: reactions.get(row.id)?.dislikeCount ?? 0,
    dislikedByMe: reactions.get(row.id)?.dislikedByMe ?? false,
    bookmarkedByMe: reactions.get(row.id)?.bookmarkedByMe ?? false,
    commentCount: commentCounts.get(row.id) ?? 0,
    imageUrls: row.image_urls ?? [],
  }));
}

/**
 * 목적지 조건 없이 전부.
 *
 * ⚠️ select 문자열을 변수로 만들어 한 함수에서 분기하지 않았다.
 *    supabase-js 는 select 리터럴로 반환 타입을 추론한다. 문자열을 조립하면
 *    행 타입 추론이 무너져서 row.trips 같은 접근이 전부 any 가 된다.
 *    갈래마다 리터럴을 두는 편이 타입이 산다.
 */
async function selectPosts(types: PostType[], limit: number) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(`id, title, content, post_type, published_at, image_urls, ${AUTHOR}, destination`)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', types)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** 특정 여행지의 글만. 여행에 연결된(목적지가 있는) 글만 남는다. */
async function selectPostsByDestination(types: PostType[], destination: string, limit: number) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(`id, title, content, post_type, published_at, image_urls, ${AUTHOR}, destination`)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', types)
    .eq('destination', destination)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** 여행지 칸 하나. 글이 한 건이라도 있는 여행지만 나온다. */
export type PostDestinationCount = {
  destination: string;
  count: number;
};

/**
 * 커뮤니티에 글이 있는 여행지 목록. (2026-09-03)
 *
 * 커뮤니티 카테고리를 여행지별로 만들면서 추가했다.
 *
 * ⚠️ lib/constants/destinations.ts 의 12개를 그대로 칸으로 만들지 않는다.
 *    글이 하나도 없는 여행지를 눌러 빈 목록을 보게 하지 않기 위해서다.
 *    **실제로 글이 있는 여행지만** 돌려준다.
 *
 * ⚠️ 글이 많은 여행지가 앞이다. 수가 같으면 이름순으로 고정해서
 *    새로고침할 때마다 칸 순서가 바뀌지 않게 한다.
 *
 * ⚠️ 2026-09-17 **여행 팁(FREE_TIP)만** 센다. 여행지 칸을 누르면 여행 팁만 보여주기 때문이다.
 *    (app/(tabs)/community.tsx toQuery) 자유 글까지 세면 자유 글만 있는 여행지 칸이 생겨
 *    눌렀을 때 빈 목록이 나오고, 칸의 숫자와 목록 수도 어긋난다.
 *    홈 '여행자들은 이렇게 다녀왔어요' 의 여행기 수도 이 값이라 같은 기준이 된다.
 *
 * 집계 함수 대신 목적지만 받아 메모리에서 센다. MVP 글 수에서는 이 편이 단순하고,
 * group by 를 쓰려면 DB 에 뷰나 RPC 를 만들어야 한다. (CLAUDE.md 1장)
 */
export async function getPostDestinations(limit = 500): Promise<PostDestinationCount[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('destination')
    .not('destination', 'is', null)
    .eq('status', POST_STATUS.PUBLISHED)
    .eq('post_type', POST_TYPE.FREE_TIP)
    .limit(limit);

  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const destination = row.destination;
    // 위에서 null 은 걸렀지만 빈 문자열이 있을 수 있다. 칸으로 만들지 않는다.
    if (!destination) continue;
    counts.set(destination, (counts.get(destination) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count || a.destination.localeCompare(b.destination, 'ko'));
}

/**
 * 글 상세.
 *
 * 없는 postId 거나 게시되지 않았거나 유료 팁이면 null 이다.
 * 화면은 "찾을 수 없는 글" 로 처리한다.
 */
export async function getPostById(postId: string, userId: string): Promise<PostDetail | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .select(
      `id, title, content, post_type, published_at, author_user_id, trip_id, image_urls, ${AUTHOR}, destination`,
    )
    .eq('id', postId)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', [...VISIBLE_POST_TYPES])
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [reactions, commentCounts] = await Promise.all([
    getReactionMap([data.id], userId),
    getCommentCountMap([data.id]),
  ]);

  return {
    postId: data.id,
    title: data.title,
    postType: data.post_type as PostType,
    authorUserId: data.author_user_id,
    tripId: data.trip_id,
    authorName: data.users?.name ?? null,
    authorImageUrl: data.users?.profile_image_url ?? null,
    destination: data.destination ?? null,
    publishedAt: data.published_at,
    content: data.content,
    likeCount: reactions.get(data.id)?.likeCount ?? 0,
    likedByMe: reactions.get(data.id)?.likedByMe ?? false,
    dislikeCount: reactions.get(data.id)?.dislikeCount ?? 0,
    dislikedByMe: reactions.get(data.id)?.dislikedByMe ?? false,
    bookmarkedByMe: reactions.get(data.id)?.bookmarkedByMe ?? false,
    commentCount: commentCounts.get(data.id) ?? 0,
    imageUrls: data.image_urls ?? [],
  };
}

export type CreatePostInput = {
  authorUserId: string;
  postType: WritablePostType;
  title: string;
  content: string;
  /** 어느 여행에서 나온 글인지. 고르지 않았으면 null. */
  tripId: string | null;
  /**
   * 이미 Storage 에 올린 사진의 public URL. 고르지 않았으면 빈 배열.
   *
   * ⚠️ 이 함수는 파일을 올리지 않는다. **올린 결과만 받는다.**
   *    업로드는 화면이 먼저 끝내고 URL 만 넘긴다.
   *    (lib/supabase/storage/communityImage.ts · 새 글은 아직 post_id 가 없어
   *     경로에 넣을 수 없으므로 업로드가 글 저장보다 앞선다)
   */
  imageUrls: string[];
};

/**
 * 글 작성. (COMM-04)
 *
 * 바로 게시한다 — 임시저장(DRAFT)은 화면에 없다.
 * published_at 을 여기서 채운다. 목록 정렬 기준이라 비워두면 글이 맨 뒤로 밀린다.
 */
export async function createPost(input: CreatePostInput): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_user_id: input.authorUserId,
      post_type: input.postType,
      title: input.title,
      content: input.content,
      trip_id: input.tripId,
      image_urls: input.imageUrls,
      status: POST_STATUS.PUBLISHED,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type UpdatePostInput = {
  postId: string;
  /** 지금 사용자. 이 값이 글의 author_user_id 와 같아야 수정된다. */
  authorUserId: string;
  postType: WritablePostType;
  title: string;
  content: string;
  tripId: string | null;
  /**
   * 저장할 사진의 최종 목록. 남길 기존 URL + 새로 올린 URL 을 순서대로 담는다.
   *
   * ⚠️ **빠진 사진은 여기서 지우지 않는다.** 이 함수는 컬럼만 바꾼다.
   *    Storage 파일 삭제는 이 저장이 성공한 뒤 화면이 부른다.
   *    (deletePostImages — 먼저 지우면 저장 실패 시 파일만 사라진다)
   */
  imageUrls: string[];
};

/**
 * 글 수정. (COMM-04 수정 모드)
 *
 * ⚠️ **작성자 본인만 고칠 수 있다.** `.eq('author_user_id', userId)` 가 그 조건이다.
 *    화면에서 수정 버튼을 감추는 것만으로는 부족하다. 화면은 UI 일 뿐이고,
 *    남의 글 id 로 이 함수를 부르면 조건에 걸려 아무 행도 바뀌지 않는다.
 *    (deleteComment 와 같은 방식)
 *
 * ⚠️ published_at 을 다시 쓰지 않는다. 고칠 때마다 갱신하면 목록이 최신순이라
 *    오래된 글을 오타 하나 고쳤다고 맨 위로 끌어올리게 된다.
 *
 * ⚠️ status 도 건드리지 않는다. 수정은 '내용을 바꾸는 일' 이지
 *    '다시 게시하는 일' 이 아니다.
 */
export async function updatePost(input: UpdatePostInput): Promise<void> {
  const { error } = await supabase
    .from('community_posts')
    .update({
      post_type: input.postType,
      title: input.title,
      content: input.content,
      trip_id: input.tripId,
      image_urls: input.imageUrls,
    })
    .eq('id', input.postId)
    .eq('author_user_id', input.authorUserId);

  if (error) throw error;
}

/**
 * 글 삭제. (COMM-02)
 *
 * ⚠️ 행을 지우지 않는다. status 를 DELETED 로 바꾼다.
 *    댓글·좋아요가 이 글을 FK 로 참조하고 있어서 실제로 지우면 그것들이 함께
 *    사라지거나 제약에 걸린다. 목록·상세 조회가 모두 PUBLISHED 만 보므로
 *    사용자에게는 사라진 것과 같다. (deleteComment 와 같은 방식)
 *
 * ⚠️ 여기서도 작성자 본인만 지울 수 있다.
 */
export async function deletePost(postId: string, authorUserId: string): Promise<void> {
  const { error } = await supabase
    .from('community_posts')
    .update({ status: POST_STATUS.DELETED })
    .eq('id', postId)
    .eq('author_user_id', authorUserId);

  if (error) throw error;
}

// ── 좋아요 ─────────────────────────────────────────────────────────────────
//
// reactions 는 복합 PK (post_id, user_id, reaction_type) 라
// 한 사람이 한 글에 두 번 누르는 것을 DB 가 막아준다.
//
// 좋아요 · 싫어요 · 찜이 모두 이 표를 쓴다. reaction_type 만 다르다.
// (2026-09-02 마이그레이션으로 CHECK 가 넓어졌다)

/** 글 목록·상세에 붙는 반응 정보. */
type ReactionInfo = {
  likeCount: number;
  likedByMe: boolean;
  dislikeCount: number;
  dislikedByMe: boolean;
  /** 찜은 개수를 세지 않는다. 남이 몇 명 찜했는지는 보여주지 않는다. */
  bookmarkedByMe: boolean;
};

const EMPTY_REACTION: ReactionInfo = {
  likeCount: 0,
  likedByMe: false,
  dislikeCount: 0,
  dislikedByMe: false,
  bookmarkedByMe: false,
};

/**
 * 여러 글의 반응을 한 번에 모아 온다.
 *
 * 종류별로 나눠 묻지 않는다. 한 번에 읽고 reaction_type 으로 갈라 담는다.
 * 글마다 따로 세면 글 수에 비례해 쿼리가 늘어난다(N+1).
 * postIds 는 이미 조회한 목록에서 나온 값이라 이 함수를 밖으로 열지 않는다.
 */
async function getReactionMap(
  postIds: string[],
  userId: string,
): Promise<Map<string, ReactionInfo>> {
  const map = new Map<string, ReactionInfo>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase
    .from('reactions')
    .select('post_id, user_id, reaction_type')
    .in('post_id', postIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const prev = map.get(row.post_id) ?? EMPTY_REACTION;
    const mine = row.user_id === userId;

    if (row.reaction_type === REACTION_TYPE.LIKE) {
      map.set(row.post_id, {
        ...prev,
        likeCount: prev.likeCount + 1,
        likedByMe: prev.likedByMe || mine,
      });
    } else if (row.reaction_type === REACTION_TYPE.DISLIKE) {
      map.set(row.post_id, {
        ...prev,
        dislikeCount: prev.dislikeCount + 1,
        dislikedByMe: prev.dislikedByMe || mine,
      });
    } else if (row.reaction_type === REACTION_TYPE.BOOKMARK && mine) {
      map.set(row.post_id, { ...prev, bookmarkedByMe: true });
    }
  }
  return map;
}

/** 반응을 남긴다. 이미 같은 반응을 눌렀으면 아무 일도 하지 않는다. */
export async function addReaction(
  postId: string,
  userId: string,
  reactionType: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .upsert(
      { post_id: postId, user_id: userId, reaction_type: reactionType },
      { onConflict: 'post_id,user_id,reaction_type', ignoreDuplicates: true },
    );

  if (error) throw error;
}

/** 반응을 거둔다. 누른 적 없으면 아무 일도 하지 않는다. */
export async function removeReaction(
  postId: string,
  userId: string,
  reactionType: ReactionType,
): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType);

  if (error) throw error;
}

/** 좋아요를 누른다. 이미 눌렀으면 아무 일도 하지 않는다. */
export async function addLike(postId: string, userId: string): Promise<void> {
  return addReaction(postId, userId, REACTION_TYPE.LIKE);
}

/** 좋아요를 취소한다. 누른 적 없으면 아무 일도 하지 않는다. */
export async function removeLike(postId: string, userId: string): Promise<void> {
  return removeReaction(postId, userId, REACTION_TYPE.LIKE);
}

// ── 댓글 ───────────────────────────────────────────────────────────────────
//
// comments 테이블은 처음부터 있었다. (init_schema.sql)
// status 는 PUBLISHED / HIDDEN / DELETED 셋뿐이라 지우기는 상태 변경으로 한다.
// 행을 정말 지우면 신고·통계에서 흔적이 사라진다.

/** 댓글 한 줄. */
export type PostComment = {
  commentId: string;
  /** 작성자 이름. 탈퇴한 사용자면 null. */
  authorName: string | null;
  /** 작성자 프로필 사진. 지정하지 않았으면 null. */
  authorImageUrl: string | null;
  content: string;
  createdAt: string;
  /** 내가 쓴 댓글인가. 지우기 버튼을 여기에만 보여준다. */
  mine: boolean;
};

// 댓글 작성자도 users 를 참조한다. 글 작성자와 구분되게 FK 를 명시한다.
const COMMENT_AUTHOR = 'users!comments_author_user_id_fkey(name, profile_image_url)';

/** 한 글의 댓글. 오래된 것부터 준다 — 대화 흐름대로 읽힌다. */
export async function getComments(postId: string, userId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`id, content, created_at, author_user_id, ${COMMENT_AUTHOR}`)
    .eq('post_id', postId)
    .eq('status', COMMENT_STATUS.PUBLISHED)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    commentId: row.id,
    authorName: row.users?.name ?? null,
    authorImageUrl: row.users?.profile_image_url ?? null,
    content: row.content,
    createdAt: row.created_at,
    mine: row.author_user_id === userId,
  }));
}

/**
 * 여러 글의 댓글 수를 한 번에 센다.
 *
 * 글마다 따로 세면 글 수만큼 쿼리가 늘어난다(N+1).
 * postIds 는 이미 조회한 목록에서 나온 값이라 이 함수를 밖으로 열지 않는다.
 */
async function getCommentCountMap(postIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase
    .from('comments')
    .select('post_id')
    .eq('status', COMMENT_STATUS.PUBLISHED)
    .in('post_id', postIds);

  if (error) throw error;

  for (const row of data ?? []) {
    map.set(row.post_id, (map.get(row.post_id) ?? 0) + 1);
  }
  return map;
}

export type CreateCommentInput = {
  postId: string;
  authorUserId: string;
  content: string;
};

/** 댓글을 단다. 빈 내용은 화면에서 미리 막는다. */
export async function createComment(input: CreateCommentInput): Promise<PostComment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: input.postId,
      author_user_id: input.authorUserId,
      content: input.content,
      status: COMMENT_STATUS.PUBLISHED,
    })
    .select(`id, content, created_at, author_user_id, ${COMMENT_AUTHOR}`)
    .single();

  if (error) throw error;

  return {
    commentId: data.id,
    authorName: data.users?.name ?? null,
    authorImageUrl: data.users?.profile_image_url ?? null,
    content: data.content,
    createdAt: data.created_at,
    mine: true,
  };
}

/**
 * 내 댓글을 지운다.
 *
 * 행을 삭제하지 않고 status 만 DELETED 로 바꾼다.
 * author_user_id 조건을 함께 걸어 남의 댓글은 지워지지 않는다.
 * (RLS 가 개발용 전체 개방이라 쿼리에서 막는다 — CLAUDE.md 7장)
 */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ status: COMMENT_STATUS.DELETED })
    .eq('id', commentId)
    .eq('author_user_id', userId);

  if (error) throw error;
}

// ============================================================================
// MY 커뮤니티 활동 (MY-01 → 작성한 게시글 · 좋아요)
//
// ⚠️ 위의 getPosts() 는 건드리지 않는다. 그쪽은 커뮤니티 목록의 의미이고
//    여기는 "내가 쓴 것 / 내가 누른 것" 이라 조건이 다르다.
//
// ⚠️ 목록에 좋아요 수·댓글 수를 붙이지 않는다. MY 목록은 제목·유형·날짜만
//    보여주고, 자세한 건 기존 게시글 상세로 넘긴다. reaction·comment 집계를
//    빼면 쿼리가 1번으로 끝난다.
// ============================================================================

/** MY 커뮤니티 활동 목록 한 줄. */
export type MyPostListItem = {
  postId: string;
  title: string;
  postType: PostType;
  /** 이 글이 나온 여행의 목적지. 연결된 여행이 없으면 null. */
  destination: string | null;
  /** 게시 시각. 아직 게시되지 않았으면 null. */
  publishedAt: string | null;
};

/** 목록에 쓰는 최소 칼럼. 본문은 상세에서 읽는다. */
const MY_POST_COLUMNS = 'id, title, post_type, published_at, destination';

/**
 * 내가 쓴 글. 게시된 것만 최신순으로.
 *
 * ⚠️ status = PUBLISHED 로 좁혀 DRAFT·HIDDEN·DELETED 를 모두 뺀다.
 *    삭제는 행을 지우지 않고 status 만 바꾼다. (이 파일 319행)
 *
 * ⚠️ VISIBLE_POST_TYPES 로 거른다. 유료 팁(PAID_TIP)은 빠진다.
 *    getPostById 도 같은 조건이라 유료 팁 상세는 열리지 않는다. 목록에만
 *    남겨 두면 눌렀을 때 '찾을 수 없는 글' 로 떨어지는 막다른 줄이 된다.
 *    커뮤니티가 감추는 글은 MY 에서도 감춘다.
 */
export async function getMyPosts(userId: string, limit = 50): Promise<MyPostListItem[]> {
  const { data, error } = await supabase
    .from('community_posts')
    .select(MY_POST_COLUMNS)
    .eq('author_user_id', userId)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', [...VISIBLE_POST_TYPES])
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    postId: row.id,
    title: row.title,
    postType: row.post_type as PostType,
    destination: row.destination ?? null,
    publishedAt: row.published_at,
  }));
}

/**
 * 내가 좋아요한 글.
 *
 * ⚠️ LIKE 만이다. BOOKMARK(찜) · DISLIKE 는 다른 화면의 이야기라 섞지 않는다.
 *
 * ⚠️ community_posts 를 **!inner** 로 붙인다. 바깥 조인이면 삭제된 글의
 *    reaction 이 글 없이 남아 빈 줄이 생긴다. !inner 라야 조건에 맞는 글이
 *    있는 reaction 만 남는다. (getPosts 의 목적지 필터와 같은 이유)
 *
 * ⚠️ 정렬은 reactions.created_at 이다. **누른 순서**로 보여야 한다.
 *    글이 쓰인 순서로 정렬하면 방금 누른 오래된 글이 맨 아래로 숨는다.
 */
export async function getMyLikedPosts(
  userId: string,
  limit = 50,
): Promise<MyPostListItem[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select(`created_at, community_posts!inner(${MY_POST_COLUMNS})`)
    .eq('user_id', userId)
    .eq('reaction_type', REACTION_TYPE.LIKE)
    .eq('community_posts.status', POST_STATUS.PUBLISHED)
    // 상세가 열리지 않는 유형은 목록에도 두지 않는다. (getMyPosts 와 같은 이유)
    .in('community_posts.post_type', [...VISIBLE_POST_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    postId: row.community_posts.id,
    title: row.community_posts.title,
    postType: row.community_posts.post_type as PostType,
    destination: row.community_posts.destination ?? null,
    publishedAt: row.community_posts.published_at,
  }));
}

/**
 * 내가 저장(찜)한 글. 저장한 순서대로. (MY → 내 커뮤니티 활동 → 저장된 게시물 · 2026-09-17)
 *
 * getMyLikedPosts 와 같은 조인·필터다. reaction_type 만 BOOKMARK 다. 새 표를 만들지 않는다 —
 * 상세의 찜 버튼이 이미 reactions(BOOKMARK) 에 쓰고 있다. 내 reaction 만 읽어 남의 저장은 섞이지 않는다.
 */
export async function getMyBookmarkedPosts(
  userId: string,
  limit = 50,
): Promise<MyPostListItem[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select(`created_at, community_posts!inner(${MY_POST_COLUMNS})`)
    .eq('user_id', userId)
    .eq('reaction_type', REACTION_TYPE.BOOKMARK)
    .eq('community_posts.status', POST_STATUS.PUBLISHED)
    .in('community_posts.post_type', [...VISIBLE_POST_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    postId: row.community_posts.id,
    title: row.community_posts.title,
    postType: row.community_posts.post_type as PostType,
    destination: row.community_posts.destination ?? null,
    publishedAt: row.community_posts.published_at,
  }));
}

/** MY '작성한 댓글' 목록 한 줄. */
export type MyCommentListItem = {
  commentId: string;
  content: string;
  createdAt: string;
  /** 이 댓글이 달린 글. 누르면 그 글로 간다. */
  postId: string;
  postTitle: string;
};

/**
 * 내가 쓴 댓글. 최신순으로.
 *
 * ⚠️ getComments 와 다르다. 그쪽은 글 하나의 댓글을 오래된 것부터 주고,
 *    여기는 한 사람이 여러 글에 쓴 댓글을 최신순으로 준다.
 *
 * ⚠️ community_posts 를 **!inner** 로 붙인다. 바깥 조인이면 지워진 글에 달린
 *    댓글이 글 제목 없이 남아 빈 줄이 된다. (getMyLikedPosts 와 같은 이유)
 *
 * ⚠️ 글 쪽도 PUBLISHED · VISIBLE_POST_TYPES 로 거른다. 상세가 열리지 않는
 *    글의 댓글을 목록에 두면 눌렀을 때 '찾을 수 없는 글' 로 떨어진다.
 *    (getMyPosts · getMyLikedPosts 와 같은 판단)
 */
export async function getMyComments(
  userId: string,
  limit = 50,
): Promise<MyCommentListItem[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, content, created_at, community_posts!inner(id, title, post_type, status)')
    .eq('author_user_id', userId)
    .eq('status', COMMENT_STATUS.PUBLISHED)
    .eq('community_posts.status', POST_STATUS.PUBLISHED)
    .in('community_posts.post_type', [...VISIBLE_POST_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    commentId: row.id,
    content: row.content,
    createdAt: row.created_at,
    postId: row.community_posts.id,
    postTitle: row.community_posts.title,
  }));
}
