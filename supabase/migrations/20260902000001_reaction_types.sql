-- ============================================================================
-- 커뮤니티 반응에 찜(BOOKMARK)과 싫어요(DISLIKE)를 추가한다.
--
-- 새 테이블을 만들지 않는다. reactions 는 이미 복합 PK
-- (post_id, user_id, reaction_type) 라 한 사람이 같은 글에 좋아요와 찜을
-- 따로 누를 수 있고, 같은 종류를 두 번 누르는 것은 DB 가 막는다.
-- 막고 있던 것은 reaction_type 의 CHECK 하나뿐이다.
--
-- ⚠️ 제약을 **넓히기만** 한다. 기존 LIKE 행은 영향을 받지 않는다.
--
-- 되돌리기
--   delete from public.reactions where reaction_type <> 'LIKE';
--   alter table public.reactions drop constraint reactions_reaction_type_check;
--   alter table public.reactions add constraint reactions_reaction_type_check
--     check (reaction_type in ('LIKE'));
--
-- ⚠️ types/database.ts 는 재생성하지 않아도 된다. reaction_type 이 text 라
--    생성 타입이 그대로 string 이고, 바뀌는 것은 제약뿐이다.
-- ============================================================================

alter table public.reactions
  drop constraint reactions_reaction_type_check;

alter table public.reactions
  add constraint reactions_reaction_type_check
  check (reaction_type in ('LIKE', 'DISLIKE', 'BOOKMARK'));
