// 여행 유형 결과 저장·조회. (TYPE-01)
//
// ⚠️ 유형은 **결산이 확정된 뒤에만** 만든다. (IA v2 §2-6-3)
//    결산 중에는 거래 분류가 남아 있어 카테고리별 실제가 계속 바뀐다.
//    그 위에서 유형을 뽑으면 확정 전후로 다른 유형이 나온다.
//
// ⚠️ 한 번 만든 결과를 다시 계산해 덮어쓰지 않는다.
//    결산과 마찬가지로 그 시점의 기록이어야 한다.
import {
  resolveTravelType,
  type TypeInput,
  type TravelTypeResult,
} from "@/lib/budget/travelType";
import type { SpendingProfileType } from "@/lib/constants/status";
import { supabase } from "@/lib/supabase/client";
import type { Json, Tables } from "@/types/database";

export type TravelType = Tables<"travel_types">;

export type TripTypeResult = {
  /** 유형 코드. travel_types.code */
  code: SpendingProfileType;
  name: string;
  description: string | null;
  score: number;
  accuracyBp: number;
  evidence: TravelTypeResult["evidence"];
  generatedAt: string;
};

/** 저장된 유형 결과. 없으면 null */
export async function getTripTypeResult(
  tripId: string,
): Promise<TripTypeResult | null> {
  const { data, error } = await supabase
    .from("trip_type_results")
    .select(
      "basis_summary_json, generated_at, travel_types(code, name, description)",
    )
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.travel_types) return null;

  const basis = data.basis_summary_json as {
    score?: number;
    accuracyBp?: number;
    evidence?: TravelTypeResult["evidence"];
  };

  return {
    code: data.travel_types.code as SpendingProfileType,
    name: data.travel_types.name,
    description: data.travel_types.description,
    score: basis.score ?? 0,
    accuracyBp: basis.accuracyBp ?? 0,
    evidence: basis.evidence ?? [],
    generatedAt: data.generated_at,
  };
}

/**
 * 유형을 계산해 저장한다. 이미 있으면 그대로 돌려준다.
 *
 * ⚠️ 덮어쓰지 않는다. 결산 확정 시점의 기록이라 다시 계산하면 안 된다.
 *    (trip_type_results.trip_id 에 unique 가 걸려 있다)
 */
export async function ensureTripTypeResult(
  tripId: string,
  inputs: TypeInput[],
): Promise<TripTypeResult | null> {
  const existing = await getTripTypeResult(tripId);
  if (existing) return existing;
  if (inputs.length === 0) return null;

  const resolved = resolveTravelType(inputs);

  const { data: type, error: typeError } = await supabase
    .from("travel_types")
    .select("id, code, name, description")
    .eq("code", resolved.type)
    .maybeSingle();
  if (typeError) throw typeError;
  // 마스터에 없는 코드면 저장하지 않는다. 화면은 유형 없이 그린다.
  if (!type) return null;

  const basis = {
    score: resolved.score,
    accuracyBp: resolved.accuracyBp,
    evidence: resolved.evidence,
  } as unknown as Json;

  const { data: created, error } = await supabase
    .from("trip_type_results")
    .insert({
      trip_id: tripId,
      primary_type_id: type.id,
      basis_summary_json: basis,
      rule_version: "v1",
    })
    .select("generated_at")
    .single();

  // 동시에 두 번 들어와 unique 에 걸리면 이미 만들어진 것을 읽는다
  if (error) return getTripTypeResult(tripId);

  return {
    code: type.code as SpendingProfileType,
    name: type.name,
    description: type.description,
    score: resolved.score,
    accuracyBp: resolved.accuracyBp,
    evidence: resolved.evidence,
    generatedAt: created.generated_at,
  };
}
