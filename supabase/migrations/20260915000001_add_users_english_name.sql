-- 여권 영문 이름 (MY-01 여권 ENGLISH NAME · MY-02 계정관리에서 수정)
-- 선택값. 사용자가 입력한 그대로 저장한다. 자동 변환 · 검증 · 기본값 없음.
-- rollback: alter table public.users drop column english_name;
alter table public.users
  add column english_name text;
