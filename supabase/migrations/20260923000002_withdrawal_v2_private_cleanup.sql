-- ============================================================================
-- 회원탈퇴 정책 v2 — 최종 탈퇴 시 개인성 데이터 정리 (2026-09-23 · docs/15_회원탈퇴정책_v2.md §17·§18·§21)
--
-- ⚠️⚠️ **이 migration 은 실제 데이터를 DELETE 한다.** 함수만 바꾸는
--        20260923000001 과 일부러 분리했다. 적용 전에 판정식 · 삭제 범위 · rollback 을 사람이 확인한다.
--
-- 무엇을 지우나 (모두 finalize_withdrawals() 안 · 30일이 지난 탈퇴 신청 계정에 대해서만)
--   ① 다른 사람 알림함에 남은 '이 사람이 actor' 인 알림  (data->>'actorUserId' 로만 식별)
--   ② 개인성 여행 — 탈퇴자 외 실제 참여자가 **한 번도 없었던** 여행과 그 종속 행(FK cascade)
--   ③ 개인성 모임 — 여행이 하나도 남지 않고 다른 멤버가 없었던 모임
--
-- 판정 원칙
--   · 참여 이력 판정 = trip_members.status in ('ACTIVE','LEFT') + user_id is not null + 탈퇴자 아님.
--     INVITED 는 참여로 보지 않는다(현재 어떤 경로도 INVITED 를 쓰지 않지만 정책을 코드에 남긴다).
--   · 제품상 개인여행(owner_type='PERSONAL', group_id is null)도 같은 판정으로 후보에 들어온다.
--     타입으로 가르지 않는다 — 기준은 언제나 "다른 실제 참여자가 있었는가" 하나다.
--   · 초대 링크 생성 · 초대 열람 · PENDING/거절된 참여 요청은 **참여로 보지 않는다.**
--   · contributions · community_posts · insurance_referrals · trip_invites · trip_cancel_requests 에
--     다른 사용자의 행이 하나라도 있으면 **지우지 않는다.**
--   ⚠️ notifications 는 보존 조건에서 **뺐다.** 초대 수신 · INVITE_RECEIVED · PENDING 요청은 실제 공동
--      참여가 아니라서, 남이 알림을 받았다는 이유로 개인성 여행을 보존하면 안 된다. 알림은 FK(set null)와
--      아래 structured cleanup 이 따로 처리한다. (법적·정산 성격의 보존 필수 알림 유형은 없다)
--   · 공유 여행은 어떤 경우에도 지우지 않는다. 탈퇴자는 '탈퇴한 회원' tombstone 으로만 남는다.
--
-- 되돌리기
--   삭제된 행은 되돌릴 수 없다(로컬 백업 없음). 함수 자체는 20260917000001 의 finalize_withdrawals
--   정의를 다시 실행하면 v1 동작(삭제 없음)으로 복구된다.
-- ============================================================================

create or replace function public.finalize_withdrawals()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  record;
  v_count integer := 0;
  v_trips_deleted  integer := 0;   -- (v2) 개인성 여행 정리 수
  v_groups_deleted integer := 0;   -- (v2) 개인성 모임 정리 수
  v_trip_id  uuid;
  v_group_id uuid;
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

    -- (v2) 다른 사람 알림함에 남은 **이 사람이 actor 인 알림**을 지운다.
    --      ⚠️ 이름 문자열을 전체 검색·치환하지 않는다. producer 가 넣어 둔 structured key 두 개
    --         (actorUserId · inviterUserId) 로만 안전하게 식별한다. 현재 알림에 그 밖의 사용자 키는 없다.
    --         키가 없는 옛 알림은 손대지 않는다(정책 Gap 으로 문서에 남긴다).
    delete from public.notifications n
     where (n.data ? 'actorUserId'   and n.data->>'actorUserId'   = v_user.id::text)
        or (n.data ? 'inviterUserId' and n.data->>'inviterUserId' = v_user.id::text);

    -- (v2) 개인성 여행 정리 — **탈퇴자 외 실제 참여자가 한 번도 없었던 여행만** 지운다.
    --      판정: trip_members 는 나가도 행이 LEFT 로 남으므로 "한 번이라도 참여한 다른 사용자" 를 그대로 잡는다.
    --      초대 링크 생성 · 초대 열람 · PENDING/거절된 참여 요청은 참여로 보지 않는다(정책 v2 §17).
    --      그 밖의 표에 다른 사용자의 행이 하나라도 있으면 지우지 않는다(보수적 다중 가드).
    for v_trip_id in
      select t.id
      from public.trips t
      where (
              t.owner_user_id = v_user.id
              or t.leader_user_id = v_user.id
              or exists (select 1 from public.trip_members m
                          where m.trip_id = t.id and m.user_id = v_user.id)
            )
        -- ⚠️ 행이 있는 것과 **실제 참여 이력이 있는 것**은 다르다. INVITED 는 참여가 아니다.
        --    LEFT 는 반드시 ACTIVE 를 거친 뒤에만 찍히므로(leave_trip · delegate_and_leave · finalize)
        --    ACTIVE · LEFT 두 상태가 곧 "한 번이라도 실제 참여자였다" 는 뜻이다.
        and not exists (select 1 from public.trip_members m2
                         where m2.trip_id = t.id and m2.user_id is not null and m2.user_id <> v_user.id
                           and m2.status in ('ACTIVE', 'LEFT'))
        and not exists (select 1 from public.contributions c
                         where c.trip_id = t.id and c.user_id is not null and c.user_id <> v_user.id)
        and not exists (select 1 from public.community_posts p
                         where p.trip_id = t.id and p.author_user_id is not null and p.author_user_id <> v_user.id)
        and not exists (select 1 from public.insurance_referrals ir
                         where ir.trip_id = t.id and ir.user_id is not null and ir.user_id <> v_user.id)
        and not exists (select 1 from public.trip_invites ti
                         where ti.trip_id = t.id and ti.created_by is not null and ti.created_by <> v_user.id)
        and not exists (select 1 from public.trip_cancel_requests cr
                         where cr.trip_id = t.id and cr.requested_by is not null and cr.requested_by <> v_user.id)
    loop
      -- 하위 행은 FK on delete cascade 로 함께 지워진다(예산 · 금고 · 납부 · 거래 · 정산 · 초대 · 멤버 · 취소요청).
      delete from public.trips t where t.id = v_trip_id;
      v_trips_deleted := v_trips_deleted + 1;
    end loop;

    -- (v2) 개인성 모임(container) 정리 — 여행이 하나도 남지 않았고, 다른 사용자가 멤버였던 적이 없을 때만.
    --      ⚠️ trips.group_id 는 on delete cascade 다. 남은 여행이 있으면 절대 지우지 않는다.
    for v_group_id in
      select g.id
      from public.groups g
      where exists (select 1 from public.group_members gm
                     where gm.group_id = g.id and gm.user_id = v_user.id)
        -- 과거 멤버도 막는다. group_members 역시 나가면 LEFT 행으로 남는다.
        and not exists (select 1 from public.group_members gm2
                         where gm2.group_id = g.id and gm2.user_id is not null and gm2.user_id <> v_user.id)
        and not exists (select 1 from public.trips t2 where t2.group_id = g.id)
    loop
      delete from public.groups g where g.id = v_group_id;
      v_groups_deleted := v_groups_deleted + 1;
    end loop;

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
