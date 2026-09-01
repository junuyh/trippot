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
// ⚠️ **댓글은 넣지 않는다.** 2026-08-31 결정. comments 테이블은 그대로 두고 쓰지 않는다.
//
// ⚠️ TYPE_SHARE(여행 결과 공유)는 **읽기만** 한다. 작성은 여행 유형 결과(TYPE-01)에서
//    나와야 하는데 그 화면이 고도화이고 유형 목록도 미확정이다. (docs/README §5 6번)
//
// 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
// ============================================================================
import { POST_STATUS, POST_TYPE, REACTION_TYPE, type PostType } from '@/lib/constants/status';
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
  /** 이 글이 나온 여행의 목적지. 연결된 여행이 없으면 null. */
  destination: string | null;
  publishedAt: string | null;
  likeCount: number;
  /** 내가 좋아요를 눌렀는가. */
  likedByMe: boolean;
};

/** 상세. (COMM-02) */
export type PostDetail = PostListItem & {
  content: string | null;
};

// users 는 작성자 FK 와 reactions 경유 두 갈래가 있어 모호하다. FK 를 명시한다.
const AUTHOR = 'users!community_posts_author_user_id_fkey(name)';

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
    .select(`id, title, post_type, published_at, ${AUTHOR}, trips(destination)`)
    .eq('status', POST_STATUS.PUBLISHED)
    .in('post_type', types)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows = data ?? [];
  const reactions = await getReactionMap(rows.map((row) => row.id), userId);

  return rows.map((row) => ({
    postId: row.id,
    title: row.title,
    postType: row.post_type as PostType,
    authorName: row.users?.name ?? null,
    destination: row.trips?.destination ?? null,
    publishedAt: row.published_at,
    likeCount: reactions.get(row.id)?.likeCount ?? 0,
    likedByMe: reactions.get(row.id)?.likedByMe ?? false,
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

  const reactions = await getReactionMap([data.id], userId);

  return {
    postId: data.id,
    title: data.title,
    postType: data.post_type as PostType,
    authorName: data.users?.name ?? null,
    destination: data.trips?.destination ?? null,
    publishedAt: data.published_at,
    content: data.content,
    likeCount: reactions.get(data.id)?.likeCount ?? 0,
    likedByMe: reactions.get(data.id)?.likedByMe ?? false,
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
// ⚠️ 찜(북마크)은 아직 만들 수 없다. 저장할 테이블이 없고
//    reactions.reaction_type 은 check (…in ('LIKE')) 로 LIKE 만 허용한다.
//    DB 담당자에게 마이그레이션을 요청해 둔 상태다. (CLAUDE.md 1장)

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
