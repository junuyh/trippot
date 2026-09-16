-- ============================================================================
-- 회원탈퇴 30일 유예 (확정 제품 정책 · 2026-09-17 · docs/15_회원탈퇴정책_v1.md)
--
--   ACTIVE ─(탈퇴 신청)→ PENDING_WITHDRAWAL ─(30일 경과 · cron)→ WITHDRAWN
--                              └─(30일 이내 탈퇴 취소)→ ACTIVE
--
-- 상태는 users 의 두 시각으로 가른다. 새 enum · status 컬럼을 만들지 않는다.
--   ACTIVE              withdrawal_requested_at is null  and deleted_at is null
--   PENDING_WITHDRAWAL  withdrawal_requested_at not null and deleted_at is null   (예정일 = 요청일 + 30일)
--   WITHDRAWN           deleted_at not null                                       (최종 탈퇴 · tombstone)
--
-- 지키는 것
--   - public.users 행은 hard delete 하지 않는다. 모임 · 여행 · 납부 · 지출 · 정산 · 게시글 · 댓글이
--     users.id 를 참조하고 대부분 on delete cascade 라, 행을 지우면 다른 멤버의 공동 기록이 사라진다.
--     최종 탈퇴는 **식별정보 비식별화 + 현재 권한 제거** 다. 금액 · 기록 · 합계는 하나도 바뀌지 않는다.
--   - users_id_fkey(auth.users on delete cascade) 를 뗀다. 최종 탈퇴 때 auth.users(카카오 identity 포함)를
--     지워도 public.users tombstone 이 남아야 하기 때문이다. 이후 같은 카카오 계정으로 로그인하면
--     auth 가 새 id 를 발급하고 앱이 새 users 행을 만든다 = 신규 회원. 옛 기록과 자동 연결하지 않는다.
--     FK 를 떼는 대신 anon 의 users 쓰기 권한을 거둔다(⑥). 행을 만드는 경로는 로그인 사용자뿐이다.
--   - 여행장은 자동 위임하지 않는다. 다른 ACTIVE 멤버가 있는 **진행 중(PLANNING · TRAVELING)** 여행의
--     여행장은 탈퇴 신청 자체를 막고(LEADER_MUST_DELEGATE), 기존 delegate_trip_leader 로 위임한 뒤 다시 신청한다.
--     끝난 여행(ENDED · SETTLED) 은 막지 않는다. 과거 여행의 leader_user_id 는 이력으로 그대로 둔다.
--   - 초대 링크는 여행 단위라 건드리지 않는다. trip_invites.created_by 는 users.id 를 참조하며 tombstone 이 남는다.
--   - Storage 객체는 SQL 로 지우지 않는다(메타 행만 지워지고 실제 파일이 남는다). 프로필 이미지 파일 정리는
--     Storage API 를 쓰는 서버 경로(Edge Function)가 필요하다 — 이 migration 범위 밖. finalize 는 URL 만 비운다.
--
-- 오류 계약 (message 를 코드 그대로 · queries/tripJoinRequests 와 같은 방식)
--   AUTH_REQUIRED · NOT_FOUND · LEADER_MUST_DELEGATE · ALREADY_WITHDRAWN
--
-- rollback:
--   select cron.unschedule(jobid) from cron.job where jobname = 'account_withdrawal_finalize';
--   drop function if exists public.finalize_withdrawals();
--   drop function if exists public.cancel_withdrawal();
--   drop function if exists public.request_withdrawal();
--   grant insert, update, delete on public.users to anon;                      -- (되돌릴 이유는 없다)
--   alter table public.users add constraint users_id_fkey
--     foreign key (id) references auth.users (id) on delete cascade;           -- (탈퇴 완료 행이 있으면 실패한다)
--   alter table public.users drop column if exists withdrawal_requested_at;
-- ============================================================================

-- ① 탈퇴 신청 시각. 예정일은 여기서 + 30일로 계산한다 (별도 컬럼 없음).
alter table public.users
  add column if not exists withdrawal_requested_at timestamptz;

comment on column public.users.withdrawal_requested_at is
  '회원탈퇴 신청 시각. 30일 뒤 finalize_withdrawals() 가 최종 탈퇴 처리. null 이면 신청 없음 · 탈퇴 취소 시 null 로 되돌린다';

-- ② auth.users cascade 를 뗀다. (최종 탈퇴 = auth 삭제 + public tombstone 유지)
alter table public.users drop constraint if exists users_id_fkey;

-- ③ 탈퇴 신청 — 본인만. 멱등(이미 신청했으면 같은 예정일 반환).
create or replace function public.request_withdrawal()
returns table (withdrawal_effective_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_user public.users%rowtype;
  v_now  timestamptz := now();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_user from public.users u where u.id = v_uid;
  if not found or v_user.deleted_at is not null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- 여행장 방어: 다른 ACTIVE 멤버가 있는 진행 중(PLANNING · TRAVELING) 여행의 여행장이면 위임이 먼저다.
  -- 혼자뿐인 여행(개인 여행 · 남은 멤버 없음)과 끝난 여행은 막지 않는다.
  if exists (
    select 1
    from public.trips t
    where t.leader_user_id = v_uid
      and t.status in ('PLANNING', 'TRAVELING')
      and exists (
        select 1 from public.trip_members tm
        where tm.trip_id = t.id and tm.status = 'ACTIVE' and tm.user_id <> v_uid
      )
  ) then
    raise exception using errcode = 'P0003', message = 'LEADER_MUST_DELEGATE';
  end if;

  if v_user.withdrawal_requested_at is null then
    update public.users set withdrawal_requested_at = v_now where id = v_uid;
    return query select v_now + interval '30 days';
  else
    return query select v_user.withdrawal_requested_at + interval '30 days';
  end if;
end;
$$;

-- ④ 탈퇴 취소 — 30일 이내 · 본인만. 기존 id · 관계 데이터는 그대로다(아무것도 바꾼 게 없으니).
create or replace function public.cancel_withdrawal()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_user public.users%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'AUTH_REQUIRED';
  end if;

  select * into v_user from public.users u where u.id = v_uid;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_user.deleted_at is not null then
    raise exception using errcode = 'P0003', message = 'ALREADY_WITHDRAWN';
  end if;

  update public.users set withdrawal_requested_at = null where id = v_uid;
end;
$$;

-- ⑤ 최종 탈퇴 — cron 전용. 30일이 지난 신청을 처리한다. 처리한 계정 수를 돌려준다.
--    공동 기록(trips · budgets · 납부 · 입출금 · 지출 · 정산 · 게시글 · 댓글 · reactions)은 손대지 않는다.
--    바꾸는 것은 "지금 권한"과 "식별정보"뿐이다.
create or replace function public.finalize_withdrawals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  record;
  v_count integer := 0;
  v_now   timestamptz := now();
begin
  for v_user in
    select u.id
    from public.users u
    where u.deleted_at is null
      and u.withdrawal_requested_at is not null
      and u.withdrawal_requested_at + interval '30 days' <= v_now
  loop
    -- 현재 권한 제거. 행은 남긴다(LEFT = 기존 상태값 · 과거 참여 이력 유지).
    update public.trip_members
       set status = 'LEFT', left_at = v_now
     where user_id = v_user.id and status in ('ACTIVE', 'INVITED');

    update public.group_members
       set status = 'LEFT'
     where user_id = v_user.id and status in ('ACTIVE', 'INVITED');

    -- 승인 가능한 상태로 남지 않게. 기존 CANCELED 상태 재사용 · 행 유지.
    update public.trip_join_requests
       set status = 'CANCELED', decided_at = v_now
     where user_id = v_user.id and status = 'PENDING';

    -- 개인 데이터: 알림은 본인에게만 의미가 있다.
    delete from public.notifications where user_id = v_user.id;

    -- 식별정보 비식별화 + 최종 탈퇴 표시. id 는 공동 기록 참조 무결성을 위해 남긴다(tombstone).
    -- name 은 not null 이라 대체 문구를 넣는다. 조회 query 들은 deleted_at 으로 걸러 이름을 null 로 내린다.
    -- profile_image_url 은 비운다. Storage 파일 자체는 Storage API 경로(후속)에서 지운다.
    update public.users
       set name                       = '탈퇴한 회원',
           english_name               = null,
           profile_image_url          = null,
           auth_provider              = null,
           auth_provider_user_id      = null,
           notification_settings_json = '{}'::jsonb,
           deleted_at                 = v_now
     where id = v_user.id;

    -- 카카오 identity 포함 auth 계정 삭제. 같은 카카오 계정의 다음 로그인 = 새 auth id = 신규 회원.
    -- 실패하면(권한 등) 앱이 tombstone(deleted_at) 을 보고 세션을 끊는다 — 되살리지 않는다.
    begin
      delete from auth.users where id = v_user.id;
    exception when others then
      null;
    end;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ⑥ 권한.
--    함수: 신청·취소는 로그인 사용자만, 최종 처리는 cron(DB owner)만.
revoke all on function public.request_withdrawal()   from public, anon, authenticated;
revoke all on function public.cancel_withdrawal()    from public, anon, authenticated;
revoke all on function public.finalize_withdrawals() from public, anon, authenticated;
grant execute on function public.request_withdrawal() to authenticated;
grant execute on function public.cancel_withdrawal()  to authenticated;

--    users: FK 를 뗐으니 anon 이 users 행을 만들거나 고치는 길을 닫는다. authenticated 의 자기 프로필
--    생성·수정(ensureUserProfile · 이름/사진 변경)은 그대로. 나머지 정책 정리는 Final RLS Audit 에서.
revoke insert, update, delete, truncate, references, trigger on public.users from anon;

-- ⑦ 하루 1회 (UTC 18:30 = KST 03:30 · notifications_cleanup_730d 직후). 멱등 재등록.
create extension if not exists pg_cron;

do $$
declare
  v_id bigint;
begin
  for v_id in select jobid from cron.job where jobname = 'account_withdrawal_finalize' loop
    perform cron.unschedule(v_id);
  end loop;
end;
$$;

select cron.schedule(
  'account_withdrawal_finalize',
  '30 18 * * *',
  $$ select public.finalize_withdrawals() $$
);
