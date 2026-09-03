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
  /** 작성자 프로필 사진. 없으면 기본 아바타(회색 실루엣)를 그린다. */
  authorImageUrl: string | null;
  /** 이 글이 나온 여행의 목적지. 없으면 표시하지 않는다. */
  destination: string | null;
  /** 'N일 전' 처럼 이미 사람이 읽을 문자열로 바꿔서 넘긴다. */
  publishedLabel: string | null;
  /** 본문 앞부분. 목록에서 두 줄까지 보여준다. */
  contentPreview: string | null;
  likeCount: number;
  /** 내가 좋아요를 눌렀는가. */
  likedByMe: boolean;
  dislikeCount: number;
  dislikedByMe: boolean;
  /** 내가 찜했는가. 찜은 개수를 보여주지 않는다 — 남의 찜 수는 의미가 없다. */
  bookmarkedByMe: boolean;
  commentCount: number;
  accent: PostAccent;
  /** 사진 주소 목록. 첫 장이 카드 커버다. [임시] 지금은 더미다. (cover.ts) */
  imageUrls: string[];
};

/** COMM-02 상세가 그리는 데이터. */
export type PostDetailData = PostCardData & {
  content: string | null;
};

/**
 * COMM-04 작성 화면의 '어느 여행 이야기인가' 선택지 한 칸. (2026-09-03)
 *
 * ⚠️ community_posts 에는 destination 컬럼이 없다. trip_id 뿐이다.
 *    그래서 글의 여행지는 **연결한 여행에서 나온다.** 여행을 고르지 않으면
 *    그 글은 어느 여행지 카테고리에도 들어가지 않고 '전체' 에만 보인다.
 */
export type TripOption = {
  tripId: string;
  /** 여행지 이름. 목적지를 아직 안 정한 여행이면 대체 문구가 온다. */
  label: string;
  /** '2026.09' 처럼 언제 여행인지. 같은 여행지를 여러 번 갔을 때 구분된다. */
  sublabel: string | null;
  /** 국기 이모지. 목록에 없는 목적지면 null. */
  flag: string | null;
};

/**
 * COMM-01 의 카테고리 한 칸. (2026-09-03)
 *
 * 카테고리 줄은 **하나**다. 글 유형(자유·여행 팁)과 여행지가 같은 줄에 있고
 * 한 번에 하나만 고른다.
 *
 * ⚠️ 처음에는 유형 줄과 여행지 줄을 따로 뒀는데, 줄이 둘이면 지금 무엇으로
 *    걸러진 목록인지 한눈에 안 읽힌다. 한 줄로 합치고 단일 선택으로 바꿨다.
 *
 * ⚠️ 여행지 칸은 **글이 실제로 있는 여행지만** 온다.
 *    lib/constants/destinations.ts 의 12개를 그대로 늘어놓지 않는다.
 *    눌렀을 때 빈 목록이 뜨는 칸을 만들지 않기 위해서다.
 *
 * key 가 무엇을 뜻하는지는 화면 파일이 정한다. 컴포넌트는 키를 그대로 돌려줄 뿐
 * 'type:' 이니 'dest:' 니 하는 규칙을 알지 못한다. (CLAUDE.md 9장)
 */
export type CommunityCategory = {
  /** 고유 키. 무엇으로 거를지는 화면 파일이 이 값으로 판단한다. */
  key: string;
  label: string;
  /** 국기 이모지. 여행지 칸에만 있고 유형 칸은 null 이다. */
  flag: string | null;
  /** 글 수. 셀 수 없는 칸은 null 이고 숫자를 그리지 않는다. */
  count: number | null;
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
  /** 작성자 프로필 사진. 없으면 기본 아바타(회색 실루엣)를 그린다. */
  authorImageUrl: string | null;
  content: string;
  /** '3일 전' 처럼 이미 사람이 읽을 문자열. */
  createdLabel: string;
  /** 내가 쓴 댓글인가. 지우기 버튼을 여기에만 보여준다. */
  mine: boolean;
};
