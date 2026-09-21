-- ============================================================================
-- AI 기능 사용 기록과 하루 한도
--
-- 왜 필요한가 (2026-09-21 4차 테스트)
--   AI 함수 네 개에 계정별 제한이 하나도 없었다. 로그인만 했으면 계획 추천을
--   100번 눌러도 100번 다 OpenAI 로 나간다. 영수증 스캔은 이미지를 실어 보내
--   건당 비용이 더 크다. 악의적 호출이 아니라 **무심한 반복**이 문제다.
--   추천이 마음에 안 들면 사람은 닫았다 다시 연다.
--
--   비용이 튀어도 누가 얼마나 썼는지 알 길이 없다는 것이 더 큰 문제였다.
--   그래서 한도보다 **기록**이 먼저다. 숫자를 모르면 한도도 정할 수 없다.
--
-- ⚠️ 쓰기는 Edge Function(service_role)만 한다. 앱이 직접 넣으면 한도를
--    앱에서 우회할 수 있다. 사용자는 자기 기록을 읽기만 한다.
--
-- ⚠️ 날짜는 **KST 기준**으로 끊는다. UTC 로 두면 한국 사용자에게는 한도가
--    오전 9시에 초기화된다.
--
-- 되돌리기
--   drop table if exists public.ai_usage_log;
-- ============================================================================

create table if not exists public.ai_usage_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  -- 'plan_suggestions' | 'receipt_scan' | 'classify_transaction'
  feature    text not null,
  -- 한도를 세는 기준 날짜 (KST)
  used_on    date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now()
);

-- 한도 검사는 늘 (사람 · 기능 · 오늘) 로 센다
create index if not exists ai_usage_log_user_feature_day
  on public.ai_usage_log (user_id, feature, used_on);

alter table public.ai_usage_log enable row level security;

-- 본인 기록만 읽는다
drop policy if exists ai_usage_log_select on public.ai_usage_log;
create policy ai_usage_log_select on public.ai_usage_log
  for select using (user_id = auth.uid());

-- ⚠️ 앱에는 insert/update/delete 를 주지 않는다. 한도를 세는 표를
--    한도를 적용받는 쪽이 고칠 수 있으면 한도가 아니다.
revoke all on public.ai_usage_log from anon, authenticated;
grant select on public.ai_usage_log to anon, authenticated;

-- ⚠️ service_role 은 RLS 는 비켜 가지만 GRANT 는 비켜 가지 않는다.
grant select, insert on public.ai_usage_log to service_role;
