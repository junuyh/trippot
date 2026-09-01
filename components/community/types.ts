// ============================================================================
// COMM-01 커뮤니티 홈 · COMM-02 상세 · COMM-04 작성이 그리는 데이터 모양
// 기준 문서: docs/09_IA_v1.md §4
//
// ⚠️ 유료 팁·댓글은 다루지 않는다. 2026-08-31 팀 결정.
//
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { PostType } from '@/lib/constants/status';

/** 목록 카드 한 장. */
export type PostCardData = {
  postId: string;
  title: string;
  postType: PostType;
  /** 이미 라벨로 바꿔서 넘긴다. (POST_TYPE_LABEL) */
  postTypeLabel: string;
  /** 작성자 이름. 없으면 카드가 대체 문구를 쓴다. */
  authorName: string | null;
  /** 이 글이 나온 여행의 목적지. 없으면 표시하지 않는다. */
  destination: string | null;
  /** 'N일 전' 처럼 이미 사람이 읽을 문자열로 바꿔서 넘긴다. */
  publishedLabel: string | null;
  likeCount: number;
  /** 내가 좋아요를 눌렀는가. */
  likedByMe: boolean;
};

/** COMM-02 상세가 그리는 데이터. */
export type PostDetailData = PostCardData & {
  content: string | null;
};

/** COMM-01 의 유형 필터 한 칸. (IA 4-2 — 홈 안의 탭·필터) */
export type PostFilter = {
  /** null 이면 전체 */
  value: PostType | null;
  label: string;
};
