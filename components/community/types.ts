// ============================================================================
// COMM-01 커뮤니티 홈(목록) · COMM-02 상세 · COMM-04 작성이 그리는 데이터 모양
// 기준 문서: docs/09_IA_v1.md §4
//
// ⚠️ 유료 팁·댓글은 다루지 않는다. 2026-08-31 팀 결정.
//
// UI 컴포넌트는 supabase / track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import type { PostType } from '@/lib/constants/status';

/**
 * 카드 윗면 색.
 *
 * ⚠️ 참고 디자인은 커버 사진을 쓰지만 community_posts 에 이미지 컬럼이 없다.
 *    사진 자리를 목적지 국가 색으로 채운다. 홈 카드의 왼쪽 띠와 같은 규칙이라
 *    앱 전체가 한 벌로 보인다. 이미지 컬럼이 생기면 이 자리에 사진만 끼우면 된다.
 */
export type PostAccent = {
  /** 카드 윗면 배경. countryTheme.primary */
  background: string;
  /** 그 위에 얹는 글자색. countryTheme.onPrimary */
  foreground: string;
};

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
  /** 본문 앞부분. 목록에서 두 줄까지 보여준다. */
  contentPreview: string | null;
  likeCount: number;
  /** 내가 좋아요를 눌렀는가. */
  likedByMe: boolean;
  commentCount: number;
  accent: PostAccent;
  /** 사진 주소 목록. 첫 장이 카드 커버다. [임시] 지금은 더미다. (cover.ts) */
  imageUrls: string[];
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

/**
 * 댓글 한 줄. (2026-09-02 추가)
 *
 * 컴포넌트가 날짜를 계산하지 않는다. 화면 파일이 이미 읽을 수 있는 문자열로 바꿔서 넘긴다.
 */
export type PostCommentItem = {
  commentId: string;
  /** 작성자 이름. 없으면 컴포넌트가 대체 문구를 쓴다. */
  authorName: string | null;
  content: string;
  /** '3일 전' 처럼 이미 사람이 읽을 문자열. */
  createdLabel: string;
  /** 내가 쓴 댓글인가. 지우기 버튼을 여기에만 보여준다. */
  mine: boolean;
};
