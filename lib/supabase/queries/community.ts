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
  commentCount: number;
};

/** 상세. (COMM-02) — 목록과 같은 모양이다. 본문 전체가 들어 있다. */
export type PostDetail = PostListItem;

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
  limit = 30,
): Promise<PostListItem[]> {
  const types = postType ? [postType] : [...VISIBLE_POST_TYPES];

  const { data, error } = await supabase
    .from('community_posts')
    .select(`id, title, content, post_type, published_at, ${AUTHOR}, trips(destination)`)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', types)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
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
    destination: row.trips?.destination ?? null,
    publishedAt: row.published_at,
    content: row.content,
    likeCount: reactions.get(row.id)?.likeCount ?? 0,
    likedByMe: reactions.get(row.id)?.likedByMe ?? false,
    commentCount: commentCounts.get(row.id) ?? 0,
  }));
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
    .select(`id, title, content, post_type, published_at, ${AUTHOR}, trips(destination)`)
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
    authorName: data.users?.name ?? null,
    authorImageUrl: data.users?.profile_image_url ?? null,
    destination: data.trips?.destination ?? null,
    publishedAt: data.published_at,
    content: data.content,
    likeCount: reactions.get(data.id)?.likeCount ?? 0,
    likedByMe: reactions.get(data.id)?.likedByMe ?? false,
    commentCount: commentCounts.get(data.id) ?? 0,
  };
}

export type CreatePostInput = {
  authorUserId: string;
  postType: WritablePostType;
  title: string;
  content: string;
  /** 어느 여행에서 나온 글인지. 고르지 않았으면 null. */
  tripId: string | null;
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
      status: POST_STATUS.PUBLISHED,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── 좋아요 ─────────────────────────────────────────────────────────────────
//
// reactions 는 복합 PK (post_id, user_id, reaction_type) 라
// 한 사람이 한 글에 두 번 누르는 것을 DB 가 막아준다.
//
// ⚠️ 찜(북마크)·싫어요도 여기 들어와야 하지만 아직 못 만든다.
//    reaction_type 이 check (…in ('LIKE')) 라 다른 값은 DB 가 거부한다.
//    CHECK 를 넓히는 마이그레이션이 필요하고, 그건 DB 담당자만 한다. (CLAUDE.md 1장)

/** 글 목록·상세에 붙는 좋아요 정보. */
type ReactionInfo = { likeCount: number; likedByMe: boolean };

/**
 * 여러 글의 좋아요를 한 번에 모아 온다.
 *
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
    .select('post_id, user_id')
    .eq('reaction_type', REACTION_TYPE.LIKE)
    .in('post_id', postIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const prev = map.get(row.post_id) ?? { likeCount: 0, likedByMe: false };
    map.set(row.post_id, {
      likeCount: prev.likeCount + 1,
      likedByMe: prev.likedByMe || row.user_id === userId,
    });
  }
  return map;
}

/** 좋아요를 누른다. 이미 눌렀으면 아무 일도 하지 않는다. */
export async function addLike(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .upsert(
      { post_id: postId, user_id: userId, reaction_type: REACTION_TYPE.LIKE },
      { onConflict: 'post_id,user_id,reaction_type', ignoreDuplicates: true },
    );

  if (error) throw error;
}

/** 좋아요를 취소한다. 누른 적 없으면 아무 일도 하지 않는다. */
export async function removeLike(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId)
    .eq('reaction_type', REACTION_TYPE.LIKE);

  if (error) throw error;
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
