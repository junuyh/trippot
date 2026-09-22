-- ============================================================================
-- 개인 소유 가상 계좌 (테스트 빌드 · 2026-09-22)
--
-- 왜: 테스트 빌드에서 회원 가입 시 카카오뱅크·토스뱅크 가상 계좌(각 200만 원)를
--     자동으로 만들어 두려 한다. 그런데 financial_accounts 는 group_id 로만 소유를
--     표현해서, 여행·모임이 없는 가입 직후에는 만든 사람도 자기 계좌를 못 읽었다
--     (2026-09-21 테스트 · PR #171 커밋 메시지). 소유자 칼럼을 더해 "내 계좌" 를
--     RLS 가 알게 한다.
--
-- 무엇: financial_accounts.owner_user_id (nullable · users FK · cascade)
--       select / update / delete 정책에 "owner_user_id = auth.uid()" 를 더한다.
--       insert 정책은 기존대로 with check (true). 모임 계좌(group_id) 규칙은 그대로.
--
-- 두 번 실행해도 안전하다 (if not exists / drop policy if exists).
-- ============================================================================

alter table public.financial_accounts
  add column if not exists owner_user_id uuid references public.users (id) on delete cascade;

create index if not exists financial_accounts_owner_user_id_idx
  on public.financial_accounts (owner_user_id);

comment on column public.financial_accounts.owner_user_id is
  '개인 소유 계좌의 주인. 모임 계좌는 group_id, 개인 계좌는 owner_user_id 를 쓴다. 둘 다 null 이면 연결된 fund_sources 로만 접근된다';

drop policy if exists "financial_accounts_select" on public.financial_accounts;
create policy "financial_accounts_select" on public.financial_accounts
  for select to authenticated
  using (
    public.financial_accounts.owner_user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );

drop policy if exists "financial_accounts_modify" on public.financial_accounts;
create policy "financial_accounts_modify" on public.financial_accounts
  for update to authenticated
  using (
    public.financial_accounts.owner_user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );

drop policy if exists "financial_accounts_delete" on public.financial_accounts;
create policy "financial_accounts_delete" on public.financial_accounts
  for delete to authenticated
  using (
    public.financial_accounts.owner_user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = public.financial_accounts.group_id
        and gm.user_id = auth.uid()
        and gm.status = 'ACTIVE'
    )
    or exists (
      select 1 from public.fund_sources fs
      where fs.financial_account_id = public.financial_accounts.id
        and public.can_access_trip(fs.trip_id)
    )
  );
