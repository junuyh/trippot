// ============================================================================
// CXL-05 되돌리기 확인 — 바텀시트
//
// ⚠️ **항상 거친다.** 계좌 변동이 없어도 건너뛰지 않는다. (POL-CXL-036)
//    되돌리기는 멤버 전원에게 알림이 가는 행동이라 즉시 실행하면 안 된다.
//
// ⚠️ 변동 목록은 **최대 5건만 보여주고 요약은 전체로 계산한다.**
//    표시된 5건만 더하면 "반영 후 남은 돈" 이 실제와 달라진다.
//    그래서 이 컴포넌트는 changes 를 전부 받고, 자르는 건 여기서 한다.
//
// ⚠️ **버튼 문구를 변동 유무로 바꾸지 않는다.** 같은 자리의 같은 행동인데
//    라벨이 바뀌면 다른 기능으로 오인한다. "반영" 은 리드 문장이 맡는다.
//
// ⚠️ 되돌리기에는 동의를 받지 않는다. 원래 상태로 복귀하는 것이라 새 결정이
//    아니다. (POL-CXL-038)
// ============================================================================
import { Text, View } from "react-native";

import { BottomSheet, Button } from "@/components/ui";

import type { CancelChangeItem, CancelFundType } from "./types";

/** 목록에 보여줄 최대 건수. 나머지는 "그 외 N건" 으로 묶는다 */
const VISIBLE = 5;

type Props = {
  visible: boolean;
  onClose: () => void;

  destination: string;
  /** 모임 여행이면 멤버 알림 고지를 붙인다 */
  isGroupTrip: boolean;

  /**
   * 취소 후 발생한 계좌 변동 **전부**. 잘라서 넘기지 않는다.
   * 요약 금액이 전체 합산이어야 하기 때문이다.
   */
  changes: CancelChangeItem[];
  /** 반영 후 남은 돈. 화면 파일이 전체 합산으로 계산해 넘긴다 */
  afterLabel: string;
  /** ZERO 면 요약 행을 숨긴다 */
  fundType: CancelFundType;

  onRestore: () => void;
  restoring: boolean;
};

export function RestoreConfirmSheet({
  visible,
  onClose,
  destination,
  isGroupTrip,
  changes,
  afterLabel,
  fundType,
  onRestore,
  restoring,
}: Props) {
  const has = changes.length > 0;
  const shown = changes.slice(0, VISIBLE);
  const rest = changes.length - shown.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${destination} 여행을 다시 준비할까요?`}
      description={
        has
          ? "취소한 뒤에 달라진 게 있어요. 아래 내역까지 반영해서 다시 준비할게요."
          : "취소하기 전 상태로 돌아가요. 예산과 계획은 그대로예요."
      }
      footer={
        <View style={{ gap: 8 }}>
          {/* ⚠️ 문구 고정. 변동 유무로 바꾸지 않는다 */}
          <Button label="다시 준비하기" loading={restoring} onPress={onRestore} />
          <Button label="닫기" variant="ghost" disabled={restoring} onPress={onClose} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
        {has ? (
          <View className="overflow-hidden rounded-xl border border-gray-200">
            {shown.map((change, index) => (
              <View
                key={change.id}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: "#EDEFF2",
                }}
              >
                <Text style={{ fontSize: 11.5, color: "#8B94A2" }}>{change.dateLabel}</Text>
                <View
                  className="flex-row items-baseline"
                  style={{ marginTop: 3, gap: 8 }}
                >
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: "#111827" }}>
                    {change.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: "800",
                      color: change.amount < 0 ? "#E5484D" : "#2563eb",
                    }}
                  >
                    {change.amount < 0 ? "-" : "+"}
                    {Math.abs(change.amount).toLocaleString("ko-KR")}원
                  </Text>
                </View>
              </View>
            ))}

            {rest > 0 ? (
              <View
                style={{
                  paddingVertical: 11,
                  borderTopWidth: 1,
                  borderTopColor: "#EDEFF2",
                  backgroundColor: "#FAFBFC",
                }}
              >
                <Text style={{ fontSize: 12, color: "#8B94A2", textAlign: "center" }}>
                  그 외 {rest}건도 함께 반영돼요
                </Text>
              </View>
            ) : null}

            {/*
              ⚠️ 이 값은 **전체 합산**이다. 위에 보이는 5건만 더한 값이 아니다.
                 화면 파일이 changes 전부로 계산해 넘긴다.
            */}
            {fundType !== "ZERO" ? (
              <View
                className="flex-row items-baseline"
                style={{
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: "#EDEFF2",
                  backgroundColor: "#F2F4F6",
                }}
              >
                <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" }}>
                  반영 후 남은 돈
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
                  {afterLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {isGroupTrip ? (
          <Text style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2" }}>
            멤버들에게도 다시 준비한다고 알려드려요.
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
