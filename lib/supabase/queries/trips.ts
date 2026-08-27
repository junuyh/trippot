// 담당자가 본문을 채우는 스텁이다. 시그니처와 반환 타입만 확정돼 있다.
//
// 채울 때 지킬 것 (CLAUDE.md 7장)
//   - 모든 DB Query 는 이 폴더 안에만 둔다. 화면·컴포넌트에서 supabase.from() 직접 호출 금지.
//   - 다른 사용자·모임·여행 데이터에 접근할 수 있는 Query 를 만들지 않는다.
//   - Supabase error 가 있으면 throw 한다. 화면은 그걸 Error 상태로 처리한다.
//   - 타입은 types/database.ts 생성 타입만 쓴다. 직접 정의하지 않는다.
import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Trip = Tables<'trips'>;
export type TripInsert = TablesInsert<'trips'>;
export type TripUpdate = TablesUpdate<'trips'>;

/** 내가 볼 수 있는 여행 목록 (본인 개인 여행 + 소속 모임 여행). */
export async function getTrips(userId: string): Promise<Trip[]> {
  // TODO: trips 조회. owner_user_id = userId 이거나, 내가 속한 group_id 의 여행.
  //       status = 'DELETED' 는 제외한다. start_date 내림차순 정렬.
  return [];
}

/** 잘못된 tripId 면 null 을 반환한다. 화면은 Empty/Error 로 처리한다. */
export async function getTripById(tripId: string): Promise<Trip | null> {
  // TODO: trips 단건 조회. .maybeSingle() 을 써서 없을 때 throw 하지 않게 한다.
  return null;
}

export async function createTrip(input: TripInsert): Promise<Trip> {
  // TODO: trips insert 후 생성된 행 반환.
  //       owner_type='PERSONAL' 이면 owner_user_id, 'GROUP' 이면 group_id 가 필수다.
  //       (DB CHECK trips_owner_shape 로도 막혀 있다)
  throw new Error('[queries/trips] createTrip 미구현');
}

export async function updateTrip(tripId: string, patch: TripUpdate): Promise<Trip> {
  // TODO: trips update 후 갱신된 행 반환.
  throw new Error('[queries/trips] updateTrip 미구현');
}
