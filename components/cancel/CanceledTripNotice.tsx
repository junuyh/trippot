// ============================================================================
// TRIP-HOME-03 취소된 여행 — 여행 홈 맨 위에 얹는 알림
//
// ⚠️ **여행 홈을 대체하지 않는다.** 처음에는 요약 카드 한 장으로 만들었는데,
//    되돌릴 수 있는 여행인데도 여행이 통째로 사라진 것처럼 보였다.
//    (2026-09-13 다빈 확인) 티켓·예산·자금은 여행 홈에 그대로 두고 회색으로
//    죽이고, 이 알림만 위에 얹는다. 스펙 문구도 "전 항목 읽기 전용" 이다.
//    (POL-CXL-005) '감추기' 가 아니라 '못 고치게 하기' 다.
//
// ⚠️ 금액은 **취소 시점 스냅샷**이다. 실시간으로 다시 계산하지 않는다.
//    (POL-CXL-011) 취소 후에도 계좌 거래는 수신되지만 이 화면에 반영하지
//    않는다. (POL-CXL-012) 화면 파일이 스냅샷 값을 그대로 넘긴다.
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

export function CanceledTripNotice({
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
    <View style={{ gap: 10 }}>
      {/*
        ⚠️ '취소됨' 을 여기서 말한다. 아래 여행 홈은 회색으로 죽어 있을 뿐
           스스로 취소됐다고 말하지 않는다. 이 줄을 빼면 회색인 이유를 모른다.
      */}
      <View className="flex-row items-center" style={{ gap: 7 }}>
        <View className="rounded bg-gray-200 px-2 py-1">
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#4B5563" }}>취소됨</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 12.5, color: "#6B7280" }} numberOfLines={2}>
          {historyLabel}
        </Text>
      </View>

      {/* 되돌리기 — 72시간 안에만 */}
      {canRestore ? (
        <View
          className="flex-row items-center rounded-2xl px-4 py-3.5"
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
      ) : (
        /* 72시간이 지났으면 — 복사 기능을 제안하지 않는다 (POL-CXL-031) */
        <BranchNotice
          tone="info"
          title="되돌릴 수 있는 기간이 지났어요"
          body="이 기록은 계속 볼 수 있어요. 다시 가시려면 새 여행으로 만들어 주세요."
        />
      )}

      {/*
        취소 시점 기록.
        ⚠️ 아래 여행 홈의 숫자도 같은 스냅샷이다. 두 곳이 다른 말을 하면 안 된다.
      */}
      {/*
        ⚠️ 흰 배경을 쓰지 않는다. 여행 홈(TRIP-HOME-01)의 페이지 바탕이 흰색이라
           흰 카드는 테두리 없이 배경에 녹아 카드로 안 보인다. (2026-09-13 확인)
      */}
      <View className="rounded-2xl px-4 py-4" style={{ backgroundColor: "#F5F6F8" }}>
        <Text
          style={{ marginBottom: 9, fontSize: 12.5, fontWeight: "700", color: "#8B94A2" }}
        >
          취소 시점 기록
        </Text>
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
        <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
          연결한 계좌는 그대로예요. 이 여행의 자금 관리만 종료됐어요.
        </Text>
      ) : null}
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
