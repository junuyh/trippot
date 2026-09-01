-- ============================================================================
-- transactions 에 환불·취소 상태 추가
--
-- 결산 흐름 스펙이 '환불 내역' 필터와 '환불 예정 금액' 을 요구한다.
-- 지금은 이걸 표현할 방법이 없다.
--
-- ⚠️ 환불을 입금(DEPOSIT) 거래로 넣으면 안 된다.
--    누적 모금액 = 등록 금액 + 입금 합계 이므로 환불이 모금으로 잡혀
--    여행 준비율이 잘못 올라간다. 환불은 **지출의 취소**지 모금이 아니다.
--
-- ⚠️ amount 를 음수로 만들지도 않는다. check (amount >= 0) 이 막고 있고,
--    음수를 허용하면 모든 합계 계산이 부호를 신경 써야 한다.
--    금액은 양수로 두고 성격을 이 칼럼으로 구분한다.
--
--   NONE      일반 거래
--   PENDING   환불 예정. 아직 돈이 돌아오지 않았다
--   REFUNDED  환불 완료. 실제 지출에서 빼야 한다
--   CANCELED  결제 취소. 처음부터 없던 거래로 본다
--
-- 실제 지출 집계에서 REFUNDED / CANCELED 를 제외한다.
-- PENDING 은 아직 돈이 나간 상태라 지출에 남기고, 화면에만 '환불 예정' 으로 알린다.
-- ============================================================================

alter table public.transactions
  add column if not exists refund_status text not null default 'NONE'
    check (refund_status in ('NONE', 'PENDING', 'REFUNDED', 'CANCELED'));

create index if not exists idx_transactions_refund_status
  on public.transactions (trip_id, refund_status)
  where refund_status <> 'NONE';

comment on column public.transactions.refund_status is
  '환불·취소 상태. 금액은 양수로 두고 성격만 여기서 구분한다. '
  'REFUNDED/CANCELED 는 실제 지출 집계에서 제외하고, PENDING 은 지출에 남긴다. '
  '환불을 DEPOSIT 거래로 넣으면 누적 모금액이 잘못 늘어난다. (IA v2 §2-4-1)';
