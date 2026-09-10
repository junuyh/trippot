// ============================================================================
// 영수증으로 지출 기록 — 사진 고르기 → 읽기 → 결과 돌려주기
//
// 화면이 이 훅을 쓴다. 결과를 받으면 화면이 자기 지출 입력 폼에 채운다.
// 저장은 언제나 사용자가 '기록하기' 를 눌러야 된다.
//
// ⚠️ 이 훅은 DB 에 쓰지 않는다. Edge Function 호출은 queries/receiptScan 이 한다.
// ============================================================================
import { useCallback, useState } from "react";
import { Alert } from "react-native";

import type { ReceiptScanResult } from "@/lib/budget/receiptScan";
import { pickReceiptImage, type ReceiptImageSource } from "@/lib/receipt/pickReceiptImage";
import { scanReceipt } from "@/lib/supabase/queries/receiptScan";

export type ReceiptScanPhase = "idle" | "picking" | "scanning";

export function useReceiptScan(context: {
  destination: string | null;
  tripStart: string | null;
  tripEnd: string | null;
}) {
  const [phase, setPhase] = useState<ReceiptScanPhase>("idle");

  /**
   * @returns 읽은 값. 취소·권한 거부·못 읽음이면 null (못 읽음은 안내를 띄운 뒤)
   */
  const scan = useCallback(
    async (source: ReceiptImageSource): Promise<ReceiptScanResult | null> => {
      if (phase !== "idle") return null;
      setPhase("picking");
      try {
        const picked = await pickReceiptImage(source);
        if (picked.status === "denied") {
          Alert.alert(
            source === "camera" ? "카메라 권한이 필요해요" : "사진 접근 권한이 필요해요",
            "설정에서 허용해 주세요.",
          );
          return null;
        }
        if (picked.status === "canceled") return null;

        setPhase("scanning");
        const result = await scanReceipt({
          imageBase64: picked.image.base64,
          mimeType: picked.image.mimeType,
          destination: context.destination,
          tripStart: context.tripStart,
          tripEnd: context.tripEnd,
        });
        if (!result) {
          Alert.alert(
            "영수증을 읽지 못했어요",
            "글자가 잘 보이게 다시 찍거나, 직접 입력해 주세요.",
          );
          return null;
        }
        return result;
      } catch {
        Alert.alert("영수증을 읽지 못했어요", "잠시 뒤 다시 시도해 주세요.");
        return null;
      } finally {
        setPhase("idle");
      }
    },
    [context.destination, context.tripEnd, context.tripStart, phase],
  );

  return { scan, phase, busy: phase !== "idle" };
}
