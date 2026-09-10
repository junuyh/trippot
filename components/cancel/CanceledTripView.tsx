// ============================================================================
// TRIP-HOME-03 취소된 여행 — 전체 화면
//
// 취소가 확정된 뒤의 여행 홈이다. 전 항목 읽기 전용이다. (POL-CXL-005)
//
// ⚠️ **새 라우트가 아니다.** app/trips/[tripId]/index.tsx 의 status 분기에서
//    이 컴포넌트를 그린다. (스펙 §11 "취소된 여행 홈에 새 라우트" 금지)
//
// ⚠️ 금액은 **취소 시점 스냅샷**에서 읽는다. 실시간으로 다시 계산하지 않는다.
//    (POL-CXL-011) 취소 후에도 계좌 거래는 수신되지만 이 화면에 표시하지
//    않는다. (POL-CXL-012) 그래서 화면 파일이 스냅샷 값을 그대로 넘긴다.
//
// ⚠️ 72시간이 지나면 **되돌리기 수단이 없다.** '이 여행 다시 준비하기'(복사)를
//    두지 않는다. 옛 날짜·옛 시세 예산이 새 여행에 들어간다. (POL-CXL-031)
//
// ⚠️ 사용자 문구에 "해제" 를 쓰지 않는다. 모임통장 해지로 읽힌다. (POL-CXL-014)
// ============================================================================
import { Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { Button } from "@/components/ui";

import type { CancelFundType } from "./types";

type Props = {
  destination: string;
  /** 일정 · 인원 요약. 예) "2026.11.14 – 11.17 · 3명" */
  metaLabel: string;

  /**
   * 취소 경위 한 줄.
   * 모임 → "○○님이 요청하고 멤버 모두가 동의해서 N월 N일에 취소됐어요"
   * 개인 → "N월 N일에 이 여행을 취소했어요"
   */
  historyLabel: string;

  /** 72시간 안인가. false 면 기간 경과 문구로 바뀐다 */
  canRestore: boolean;
  /** 남은 시간 표시용. 예) "2일 7시간". canRestore 가 false 면 안 쓴다 */
  remainingLabel: string;
  onOpenRestore: () => void;

  // ── 취소 시점 스냅샷 ───────────────────────────────────────────────────
  fundType: CancelFundType;
  goalLabel: string;
  /** 이 여행에 쓴 돈. 0이면 null 이라 줄을 그리지 않는다 */
  spentLabel: string | null;
  /** 취소 시점 잔액 / 남은 금액. ZERO 면 null */
  remainingFundLabel: string | null;
};

export function CanceledTripView({
  destination,
  metaLabel,
  historyLabel,
  canRestore,
  remainingLabel,
  onOpenRestore,
  fundType,
  goalLabel,
  spentLabel,
  remainingFundLabel,
}: Props) {
  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1">
        {/* 되돌리기 배너 — 72시간 안에만 */}
        {canRestore ? (
          <View
            className="mx-5 mt-4 flex-row items-center rounded-2xl px-4 py-3.5"
            style={{ gap: 11, backgroundColor: "#EBF1FF" }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#0043D1" }}>
                예산과 계획은 그대로 있어요
              </Text>
              <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 18, color: "#3C6FD8" }}>
                {remainingLabel} 안에 되돌리면 전부 살아나요
              </Text>
            </View>
            <View style={{ flexShrink: 0 }}>
              <Button label="되돌리기" fullWidth={false} onPress={onOpenRestore} />
            </View>
          </View>
        ) : null}

        {/* 기록 */}
        <View className="mx-5 mt-3 rounded-2xl bg-white p-5">
          <View className="self-start rounded bg-gray-100 px-2 py-1">
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#8B94A2" }}>취소됨</Text>
          </View>
          <Text style={{ marginTop: 9, fontSize: 21, fontWeight: "800", color: "#111827" }}>
            {destination}
          </Text>
          <Text style={{ marginTop: 5, fontSize: 13, color: "#8B94A2" }}>{metaLabel}</Text>
          <View className="mt-4 rounded-xl bg-gray-100 px-3.5 py-3">
            <Text style={{ fontSize: 12.5, lineHeight: 20, color: "#4B5563" }}>
              {historyLabel}
            </Text>
          </View>
        </View>

        {/* 취소 시점 스냅샷 */}
        <Text
          style={{
            marginTop: 16,
            marginHorizontal: 20,
            marginBottom: 7,
            fontSize: 12.5,
            fontWeight: "700",
            color: "#8B94A2",
          }}
        >
          취소 시점 기록
        </Text>
        <View className="mx-5 rounded-2xl bg-white px-4 py-4">
          <SnapRow label="목표 여행비" value={goalLabel} />
          {spentLabel ? (
            <>
              <View className="my-2 h-px bg-gray-100" />
              <SnapRow label="이 여행에 쓴 돈" value={spentLabel} />
            </>
          ) : null}
          {remainingFundLabel ? (
            <>
              <View className="my-2 h-px bg-gray-100" />
              <SnapRow
                label={fundType === "ACCOUNT" ? "취소 시점 잔액" : "남은 금액"}
                value={remainingFundLabel}
              />
            </>
          ) : null}
        </View>

        {/*
          ⚠️ "해제" 를 쓰지 않는다. 계좌는 그대로 있고 이 여행의 자금 관리만
             끝났다는 뜻이다. (POL-CXL-014)
        */}
        {fundType === "ACCOUNT" ? (
          <Text
            style={{
              marginTop: 12,
              marginHorizontal: 20,
              fontSize: 11.5,
              lineHeight: 18,
              color: "#8B94A2",
            }}
          >
            연결한 계좌는 그대로예요. 이 여행의 자금 관리만 종료됐어요.
          </Text>
        ) : null}

        {/* 72시간이 지났으면 — 복사 기능을 제안하지 않는다 */}
        {!canRestore ? (
          <View className="mx-5 mt-4">
            <BranchNotice
              tone="info"
              title="되돌릴 수 있는 기간이 지났어요"
              body="이 기록은 계속 볼 수 있어요. 다시 가시려면 새 여행으로 만들어 주세요."
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline" style={{ gap: 10 }}>
      <Text style={{ fontSize: 13.5, color: "#4B5563" }}>{label}</Text>
      <Text
        style={{ flex: 1, fontSize: 14.5, fontWeight: "700", color: "#111827", textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}
