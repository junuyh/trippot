// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { TRIP_STATUS } from '@/lib/constants/status';
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database';

export type Settlement = Tables<'settlements'>;
export type SettlementInsert = TablesInsert<'settlements'>;

export async function getSettlement(tripId: string): Promise<Settlement | null> {
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * 결산 확정.
 *
 * - 여행 기간 종료 시 자동으로 유도하되, **사용자 확인 후** 이 함수를 부른다.
 * - 확정 시점의 카테고리별 값을 category_snapshot_json 에 스냅샷으로 보존한다.
 * - difference_rate_bp 는 basis point(만분율) 정수다. 1250 = 12.50%.
 *   소수점 연산을 하지 않기 위한 것이니 실수로 저장하지 않는다.
 */
export async function createSettlement(input: SettlementInsert): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .insert(input)
    .select()
    .single();

  if (error) throw error;

  // 결산이 만들어지면 여행은 SETTLED 다.
  //
  // ⚠️ 트랜잭션이 없다. settlements 는 만들어졌는데 status 갱신이 실패하면
  //    '결산은 있는데 상태가 ENDED 인 여행' 이 남는다. 그러면 준비 홈이
  //    결산 완료를 알아채지 못한다.
  //    settlements.trip_id 가 UNIQUE 라 결산이 두 번 만들어지지는 않으므로,
  //    실패하면 결산 행을 지워 되돌린다.
  const { error: statusError } = await supabase
    .from('trips')
    .update({ status: TRIP_STATUS.SETTLED })
    .eq('id', input.trip_id);

  if (statusError) {
    await supabase.from('settlements').delete().eq('id', data.id);
    throw statusError;
  }

  return data;
}

/**
 * 계획 대비 실제의 차이를 basis point(만분율) 정수로 계산한다.
 *
 * 1250 = 12.50%. **소수점 연산을 하지 않기 위한 것**이라 실수로 저장하지 않는다.
 * (CLAUDE.md 9장 — 비율도 소수점을 피해 정수로 저장한다)
 *
 * 목표가 0이면 비율이 성립하지 않는다. 0을 돌려준다.
 * 예) (4,116,000 - 4,200,000) / 4,200,000 = -2.00% → -200
 */
export function differenceRateBp(targetAmount: number, actualAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.round(((actualAmount - targetAmount) / targetAmount) * 10000);
}
