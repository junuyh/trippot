// ============================================================================
// CXL-03 최종 확인 — 바텀시트
//
// 취소를 실행하기 직전에 **무엇이 멈추고 무엇이 남는지** 알린다.
// 영향 줄이 조건별로 켜지고 꺼진다. 스펙 §7 의 조합표를 그대로 옮겼다.
//
// ⚠️ 자금 박스는 **환불 예정액을 계산하지 않는다.** (POL-CXL-016)
//    환불 가능 여부·수수료·환불일은 항공사·숙박업체가 가진 정보고, 환불은
//    실제로 입금된 뒤에만 관측된다. 대신 "지금 기준 금액이에요" 를 붙인다.
//
// ⚠️ 남은 금액은 **화면이 계산하지 않는다.** 화면 파일이 계산해 넘긴다.
//    ACCOUNT 는 현재 잔액을 그대로 쓴다 — 이미 지출이 빠진 값이라 또 빼면
//    이중 차감이다. (POL-CXL-015)
//
// ⚠️ "N원씩 정산하면 돼요" 같은 **지시형 표현을 쓰지 않는다.**
//    trip.headcount 는 여행 인원이지 돈 낸 사람 수가 아니고, CONTRIB-01 이
//    뼈대라 납부 비례 계산이 불가능하다. '똑같이 나누면' · '약' 이 그 장치다.
//
// ⚠️ 실행 중 버튼을 잠근다. 중복 제출이 곧 중복 요청이다. (NFR-005)
// ============================================================================
import { Text, View } from "react-native";

import { BranchNotice } from "@/components/invite";
import { BottomSheet, Button } from "@/components/ui";

import type { CancelFundSummary } from "./types";

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * 시트가 **완전히 내려간 뒤**(iOS). 다음 시트를 이어서 열 때 쓴다.
   *
   * ⚠️ 닫는 중에 새 Modal 을 띄우면 iOS 가 조용히 무시하고, 보이지 않는 Modal 이
   *    화면 전체의 터치를 삼킨다. 타이머로 어림잡지 말고 이 신호를 쓴다.
   */
  onDismiss?: () => void;

  isEnded: boolean;
  needsAgreement: boolean;
  voteTargetCount: number;

  /** 계좌를 연결한 여행인가. 동기화 중단 줄을 그릴지 정한다 */
  hasLinkedAccount: boolean;
  /** 이미 쓴 돈. 0이면 관련 줄을 그리지 않는다 */
  spentLabel: string | null;

  /** 요청 만료일 표시용. 예) "9월 14일" */
  expiresAtLabel: string;

  /** 자금 요약. fundType 이 ZERO 면 박스를 통째로 숨긴다 */
  fund: CancelFundSummary;

  /** 뒤로 — CXL-01 로 */
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
};

export function CancelConfirmSheet({
  visible,
  onClose,
  onDismiss,
  isEnded,
  needsAgreement,
  voteTargetCount,
  hasLinkedAccount,
  spentLabel,
  expiresAtLabel,
  fund,
  onBack,
  onConfirm,
  submitting,
}: Props) {
  const cta = needsAgreement ? "취소 요청하기" : isEnded ? "안 갔어요" : "여행 취소하기";
  /** 요청 단계면 "취소가 확정되면" 을 앞에 붙인다. 아직 취소가 아니다 */
  const whenConfirmed = needsAgreement ? "취소가 확정되면 " : "";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismiss={onDismiss}
      title={needsAgreement ? "취소를 요청하면 이렇게 돼요" : "취소하면 이렇게 돼요"}
      description={
        needsAgreement
          ? "요청 중에도 예산과 계획은 그대로 수정할 수 있어요."
          : "되돌리고 싶으면 3일 안에 되돌릴 수 있어요."
      }
      footer={
        <View className="flex-row" style={{ gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="돌아가기" variant="secondary" disabled={submitting} onPress={onBack} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={cta} variant="danger" loading={submitting} onPress={onConfirm} />
          </View>
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 16 }}>
        {/* 영향 안내 — 조건부 조합 (스펙 §7) */}
        <View>
          {needsAgreement ? (
            <Effect>
              멤버 <Strong>{voteTargetCount}명이 모두 동의하면</Strong> 취소돼요
            </Effect>
          ) : null}

          <Effect>
            {whenConfirmed}여행 준비가 종료되고 <Strong>진행 중인 여행에서 사라져요</Strong>
          </Effect>

          {needsAgreement ? <Effect>멤버들에게 취소 요청 알림이 가요</Effect> : null}

          {hasLinkedAccount ? (
            <Effect>{whenConfirmed}이 여행의 계좌 내역 업데이트가 멈춰요</Effect>
          ) : null}

          <Effect keep>
            지금까지 만든 <Strong>예산과 여행 정보는 보관돼요</Strong>
          </Effect>

          {spentLabel ? (
            <Effect>
              이미 사용한 <Strong>{spentLabel}</Strong> 내역도 함께 보관돼요
            </Effect>
          ) : null}

          {/*
            ⚠️ 날짜가 지났고 지출이 있으면 마지막 줄이 통째로 바뀐다.
               결산할 수 있었던 여행이라 "결산도 안 만들어진다" 를 알려야 한다.
          */}
          <Effect keep>
            {isEnded && spentLabel
              ? "결산과 여행 유형은 만들어지지 않고, 다음 여행 추천에도 반영되지 않아요"
              : "다음 여행 추천에는 반영되지 않아요"}
          </Effect>
        </View>

        {/* 만료 경고 — 모임 여행일 때만 */}
        {needsAgreement ? (
          <BranchNotice
            tone="warn"
            title={`${expiresAtLabel}까지 동의가 모이지 않으면 요청이 사라져요`}
            body="출발일이 되어도 요청은 자동으로 취소돼요. 그때 여행은 그대로 남아 있어요."
          />
        ) : null}

        {/* 자금 박스 — ZERO 면 통째로 숨긴다 (POL-CXL-015) */}
        {fund.fundType !== "ZERO" ? (
          <View className="rounded-xl bg-gray-100 p-4">
            <Text style={{ fontSize: 12, color: "#8B94A2" }}>{fund.label}</Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 21,
                fontWeight: "800",
                letterSpacing: -0.6,
                color: "#111827",
              }}
            >
              {fund.remainingLabel}
            </Text>

            {/*
              ⚠️ 1명이면 분배 줄을 숨긴다. 혼자인데 "1명이 똑같이 나누면" 은
                 말이 안 된다. (POL-CXL-017)
            */}
            {fund.perPersonLabel ? (
              <View
                style={{
                  marginTop: 13,
                  paddingTop: 13,
                  borderTopWidth: 1,
                  borderTopColor: "#E3E7EB",
                }}
              >
                <Text style={{ fontSize: 12, color: "#8B94A2" }}>
                  {fund.headcount}명이 똑같이 나누면
                </Text>
                <Text
                  style={{ marginTop: 3, fontSize: 15.5, fontWeight: "800", color: "#2563eb" }}
                >
                  1인당 약 {fund.perPersonLabel}
                </Text>
              </View>
            ) : null}

            <Text style={{ marginTop: 13, fontSize: 12, lineHeight: 19, color: "#4B5563" }}>
              {fund.fundType === "ACCOUNT"
                ? "연결한 계좌 자체에는 아무 영향이 없어요. 지금 기준 금액이에요. 실제 정산은 이용 중인 금융사에서 진행해 주세요."
                : "기록은 그대로 보관돼요. 지금 기준 금액이에요. 실제 정산은 멤버끼리 진행해 주세요."}
            </Text>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** 영향 한 줄. keep 이면 점이 파란색 — "남는 것" 이라는 뜻 */
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
