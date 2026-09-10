// ============================================================================
// CXL-06 동의 요청 확인 — 바텀시트 (요청자가 아닌 멤버)
//
// 푸시나 여행 홈 배너로 들어온다. 여기서 동의·반대를 고른다.
//
// ⚠️ **동의는 번복할 수 없다.** (POL-CXL-067) 이미 투표한 멤버가 들어오면
//    이 시트가 아니라 CXL-07 로 보낸다. 그 판단은 화면 파일이 한다.
//
// ⚠️ 사유가 없으면 **"사유를 남기지 않았어요" 를 명시한다.** 빈칸으로 두면
//    화면이 덜 만들어진 것으로 읽히고, 멤버는 왜 취소하는지 모른 채 판단한다.
//
// ⚠️ "한 명이라도 반대하면 요청이 바로 사라져요" 를 **반드시 먼저 알린다.**
//    (POL-CXL-062) 자기 한 표가 어떤 무게인지 모르고 누르면 안 된다.
//
// ⚠️ 사유는 앱 안에서만 보여준다. 푸시 본문에는 넣지 않는다. (POL-CXL-029)
//    그건 알림 쪽 규칙이고 이 화면과는 별개다.
// ============================================================================
import { Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { BottomSheet, Button } from "@/components/ui";

type Props = {
  visible: boolean;
  onClose: () => void;

  /** 취소를 요청한 사람 이름 */
  requesterName: string;
  destination: string;
  /** 요청 만료일 표시용 */
  expiresAtLabel: string;

  /** 요청자가 남긴 사유 문구. 안 골랐으면 null */
  reasonLabel: string | null;

  /** 연결 계좌의 모은 돈. 없으면 null 이면 관련 줄을 그리지 않는다 */
  fundBalanceLabel: string | null;

  onAgree: () => void;
  onDisagree: () => void;
  /** 처리 중. 두 버튼 모두 잠근다 */
  deciding: boolean;
};

export function CancelVoteSheet({
  visible,
  onClose,
  requesterName,
  destination,
  expiresAtLabel,
  reasonLabel,
  fundBalanceLabel,
  onAgree,
  onDisagree,
  deciding,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`${requesterName}님이 여행 취소를 요청했어요`}
      description={`멤버 모두가 동의하면 ${destination} 여행이 취소돼요.`}
      footer={
        <View style={{ gap: 8 }}>
          <View className="flex-row" style={{ gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="반대하기"
                variant="secondary"
                disabled={deciding}
                onPress={onDisagree}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="취소에 동의하기"
                variant="danger"
                loading={deciding}
                onPress={onAgree}
              />
            </View>
          </View>
          <Text
            style={{ fontSize: 11.5, lineHeight: 18, color: "#8B94A2", textAlign: "center" }}
          >
            {requesterName}님과 다른 멤버에게 결과가 전달돼요.
          </Text>
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 16 }}>
        {/* 사유 — 없으면 없다고 명시한다 */}
        {reasonLabel ? (
          <BranchNotice
            tone="info"
            title={`${requesterName}님이 남긴 사유`}
            body={reasonLabel}
          />
        ) : (
          <BranchNotice
            tone="info"
            title="사유를 남기지 않았어요"
            body={`궁금한 점은 ${requesterName}님에게 직접 물어봐 주세요.`}
          />
        )}

        <View>
          <Effect>
            한 명이라도 반대하면 <Strong>요청이 바로 사라져요</Strong>
          </Effect>
          <Effect>{expiresAtLabel}까지 동의가 모이지 않으면 요청이 자동으로 취소돼요</Effect>
          <Effect keep>
            동의를 기다리는 동안에도 <Strong>예산과 계획은 그대로 수정할 수 있어요</Strong>
          </Effect>
          {fundBalanceLabel ? (
            <Effect>
              모은 돈 {fundBalanceLabel}의 정산은 이용 중인 금융사에서 직접 진행해요
            </Effect>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

function Effect({ children, keep = false }: { children: React.ReactNode; keep?: boolean }) {
  return (
    <View className="flex-row" style={{ gap: 10, paddingVertical: 10 }}>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          marginTop: 8,
          backgroundColor: keep ? "#2563eb" : "#C3CBD5",
        }}
      />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 22, color: "#4B5563" }}>{children}</Text>
    </View>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: "700", color: "#111827" }}>{children}</Text>;
}
