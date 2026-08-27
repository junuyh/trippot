// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database';

export type Settlement = Tables<'settlements'>;
export type SettlementInsert = TablesInsert<'settlements'>;

export async function getSettlement(tripId: string): Promise<Settlement | null> {
  // TODO: settlements 단건 조회 (trip_id UNIQUE). .maybeSingle() 사용.
  return null;
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
  // TODO: settlements insert 후 생성된 행 반환. trips.status 를 'SETTLED' 로 갱신.
  throw new Error('[queries/settlements] createSettlement 미구현');
}
