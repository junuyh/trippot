-- ============================================================================
-- notifications.type CHECK 제약 추가
-- 기준 문서: docs/05_ERD_v4.md §notifications, lib/constants/status.ts
-- 작성일: 2026-09-03
--
-- 20260902000002_notifications.sql 은 알림 종류가 확정되기 전이라 CHECK 없이
-- 적용됐다. MVP 알림 3종이 확정되어(docs/05_ERD_v4.md) 제약을 건다.
--
-- ⚠️ 이 제약의 목록은 아래 셋과 **글자 하나까지 같아야 한다.**
--      docs/05_ERD_v4.md 의 확정 목록
--      lib/constants/status.ts 의 NOTIFICATION_TYPE
--      이 파일
--    하나라도 다르면 앱이 만든 알림이 DB 에서 거부된다.
--
-- ⚠️ 이 제약은 **이미 원격 DB 에 Supabase 대시보드에서 직접 적용됐다.**
--    이 파일은 그 변경을 마이그레이션 히스토리에 남기기 위한 것이다.
--    파일이 없으면 db reset 이나 새 환경에서 제약이 붙지 않는다.
--    그래서 이미 있으면 건너뛰도록 썼다. 두 번 실행해도 안전하다.
--    (add constraint 에는 if not exists 가 없다)
-- ============================================================================

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname  = 'notifications_type_check'
       and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_type_check
      check (type in (
        'FUND_GOAL_REACHED',   -- 전체 목표 여행비 100% 최초 달성
        'TRIP_D7',             -- 여행 시작 7일 전
        'SETTLEMENT_READY'     -- 여행 종료 후 정산 가능
      ));
  end if;
end $$;


-- ============================================================================
-- 알림 종류가 늘어날 때
--
-- 이 파일을 고치지 않는다. 새 마이그레이션에서 제약을 drop 하고 다시 만든다.
--   alter table public.notifications drop constraint notifications_type_check;
--   alter table public.notifications add constraint notifications_type_check
--     check (type in (...));
-- lib/constants/status.ts 의 NOTIFICATION_TYPE 도 같은 PR 에서 함께 고친다.
--
-- ⚠️ 목록에 없는 값이 이미 들어가 있으면 제약 추가가 실패한다.
--    select distinct type from public.notifications; 로 먼저 확인한다.
--
-- 되돌리기
--   alter table public.notifications drop constraint notifications_type_check;
-- ============================================================================
