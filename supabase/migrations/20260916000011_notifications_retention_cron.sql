-- ============================================================================
-- notifications 보관기간 정리 — pg_cron 하루 1회 · 730일 (docs/14_알림센터_v1.md §9) · 2026-09-16
--
-- 정책
--   알림센터 UI 조회 window = 최근 365일 (앱 상수 NOTIFICATION_CENTER_WINDOW_DAYS)
--   DB 최대 보관 = 730일. 사용자가 그 전에 직접 지우는 것과는 별개다.
--   자동 정리 = 매일 1회, created_at < now() - interval '730 days' 인 행 hard delete.
--   개수 상한 · "DB 가 찰 때" 방식은 쓰지 않는다 (예측 가능 · 사용자별 일관).
--
-- 실행 시각: 매일 UTC 18:00 = KST 03:00 (pg_cron 은 UTC 기준. crontab '0 18 * * *').
-- 멱등: 같은 이름의 job 이 있으면 먼저 unschedule 하고 다시 등록한다. 두 번 적용해도 job 1개.
-- 권한: cron.schedule 은 postgres 로 실행되며 job 도 postgres 권한으로 돈다. notifications 의
--   RLS(dev_open_all 제거 · own-only)는 owner 인 postgres 에 적용되지 않으므로 삭제가 막히지 않는다.
--   앱(anon/authenticated) 권한 · 정책 · 함수는 건드리지 않는다.
-- 이 파일이 하지 않는 것: 지금 당장 DELETE 하지 않는다 (현재 730일 넘은 행 0건). 스케줄만 등록.
--
-- rollback (보고용 · 새 migration 으로만):
--   select cron.unschedule('notifications_cleanup_730d');
--   (extension 은 남겨도 무해. 정말 되돌리려면 drop extension if exists pg_cron;)
-- ============================================================================

create extension if not exists pg_cron;

-- 같은 이름이 있으면 지우고 다시 건다 (멱등)
do $$
declare
  v_id bigint;
begin
  for v_id in select jobid from cron.job where jobname = 'notifications_cleanup_730d' loop
    perform cron.unschedule(v_id);
  end loop;
end;
$$;

select cron.schedule(
  'notifications_cleanup_730d',
  '0 18 * * *',   -- 매일 UTC 18:00 = KST 03:00
  $$ delete from public.notifications where created_at < now() - interval '730 days' $$
);
