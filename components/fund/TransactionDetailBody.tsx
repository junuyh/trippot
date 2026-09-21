// ============================================================================
// FUND-03 거래 상세 본문 (시안 v1)
//
// **목록의 바텀시트와 별도 화면이 같은 본문을 쓴다.**
// 두 곳에서 따로 그리면 한쪽만 고쳐져 같은 거래가 다르게 보인다.
//
// 보여주는 규칙 (시안 v1)
//   · 직접 입력 거래 — '기록 방식 · 직접 입력'
//   · 계좌 거래     — 기록 방식 + 연결 계좌
//   · 입금          — 예산 카테고리·연결 계획을 **숨긴다**
//   · 지출          — 예산 카테고리를 보여준다
//   · 계획 연결됨    — 연결된 계획 + '계획 연결 해제'
//   · 환불          — 원거래 정보와 환불 상태를 함께
//
// ⚠️ **정상 거래에는 '확인 완료' 를 두지 않는다.** 확정된 거래에 확인 버튼이
//    있으면 사용자는 매번 눌러야 하는 줄 안다. 미분류·확인 필요일 때만 낸다.
//
// ⚠️ 카테고리 변경도 확인 필요일 때만 낸다. 이미 분류된 거래를 아무 때나
//    바꾸게 두면 결산 직전에 실제 사용액이 조용히 움직인다.
//
// supabase / track 을 직접 부르지 않는다. 화면이 부른다. (CLAUDE.md 9장)
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import type { CountryTheme } from "@/lib/constants/countryTheme";
import {
  amountSign,
  statusLabel,
  transactionIcon,
  type IconInput,
} from "@/lib/constants/transactionIcon";
import {
  CATEGORY_CODE_LABEL,
  REFUND_STATUS,
  TRANSACTION_TYPE,
  type CategoryCode,
} from "@/lib/constants/status";

const GREEN = "#16835d";
const RED = "#e83d4d";

export type TransactionDetail = IconInput & {
  name: string;
  /** 'yyyy년 M월 d일' */
  dateLabel: string;
  amount: number;
  /** 계좌에서 자동으로 들어온 거래인가 */
  fromAccount: boolean;
  /** 마스킹된 계좌번호. 없으면 null (NFR-002) */
  maskedAccountNumber: string | null;
  /** 연결된 계획 이름. 없으면 null */
  planName: string | null;
  /** 확인이 필요한 거래인가 */
  needsReview: boolean;
  /** 확인이 필요한 이유. 없으면 null */
  reviewNote: string | null;
};

type Props = {
  theme: CountryTheme;
  detail: TransactionDetail;
  /** 없으면 카테고리 변경을 감춘다 (결산 확정 등) */
  onChangeCategory?: () => void;
  /** 계획에 연결한다. 연결된 계획이 없고 후보가 있을 때만 넘긴다 */
  onLinkPlan?: () => void;
  /** 연결된 계획이 있을 때만 쓴다 */
  onUnlinkPlan?: () => void;
  /** 확인 필요 거래에만 낸다 */
  onConfirm?: () => void;
  busy?: boolean;
};

function won(value: number): string {
  return `${Math.abs(value).toLocaleString("ko-KR")}원`;
}

export function TransactionDetailBody({
  theme,
  detail,
  onChangeCategory,
  onLinkPlan,
  onUnlinkPlan,
  onConfirm,
  busy = false,
}: Props) {
  const deposit = detail.transactionType === TRANSACTION_TYPE.DEPOSIT;
  const refunded =
    detail.refundStatus === REFUND_STATUS.REFUNDED ||
    detail.refundStatus === REFUND_STATUS.CANCELED;
  const sign = amountSign(detail);

  // ⚠️ 입금에는 예산 카테고리·연결 계획을 넣지 않는다. 예산을 쓴 게 아니다.
  const rows: [string, string][] = [
    ["거래명", detail.name],
    ["거래일", detail.dateLabel],
    ["기록 방식", detail.fromAccount ? "계좌 자동 기록" : "직접 입력"],
    ...(detail.fromAccount
      ? ([["연결 계좌", detail.maskedAccountNumber ?? "연결 계좌"]] as [
          string,
          string,
        ][])
      : []),
    ...(deposit
      ? []
      : ([
          [
            "예산 카테고리",
            detail.categoryCode
              ? CATEGORY_CODE_LABEL[detail.categoryCode]
              : "미분류",
          ],
        ] as [string, string][])),
    ...(!deposit && detail.planName
      ? ([["연결된 계획", detail.planName]] as [string, string][])
      : []),
    ...(refunded || detail.refundStatus === REFUND_STATUS.PENDING
      ? ([
          [
            "원거래",
            `${detail.name} · ${sign === "+" ? "−" : ""}${won(detail.amount)}`,
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <View>
      <View className="flex-row items-center" style={{ gap: 10, marginTop: 4 }}>
        <Text style={{ fontSize: 22 }}>{transactionIcon(detail)}</Text>
        <Text style={{ fontSize: 11, color: "#8490a0" }}>
          {deposit ? "입금" : refunded ? "환불" : "출금"}
        </Text>
      </View>

      <Text
        style={{
          marginTop: 4,
          fontSize: 30,
          fontWeight: "900",
          letterSpacing: -1,
          color: sign === "+" ? theme.primary : "#111827",
        }}
      >
        {sign}
        {detail.amount.toLocaleString("ko-KR")}
        <Text style={{ fontSize: 14, letterSpacing: 0 }}>원</Text>
      </Text>

      {/*
        상태 안내.

        ⚠️ **분류를 확인해야 하거나 환불된 거래에만 낸다.** (2026-09-21 2차)
           정상 거래에까지 "분류를 확인한 거래예요" 를 적어 두니, 사용자는
           자기가 뭘 확정한 적이 있나 되짚게 됐다. 아무 할 일이 없으면
           아무 말도 하지 않는 게 맞다.
      */}
      {detail.needsReview || refunded ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 10,
            padding: 11,
            backgroundColor: detail.needsReview ? "#fff4f5" : "#eff9f4",
          }}
        >
          <Text
            style={{
              fontSize: 10,
              lineHeight: 15,
              color: detail.needsReview ? RED : GREEN,
            }}
          >
            {detail.reviewNote ??
              (refunded
                ? "환불 금액을 반영했어요. 이 거래는 지출 합계에서 빠져요."
                : "분류를 확인해 주세요.")}
          </Text>
        </View>
      ) : null}

      <View
        style={{ marginTop: 16, borderTopWidth: 1, borderColor: "#e6e9ed" }}
      >
        {rows.map(([label, value]) => (
          <View
            key={label}
            className="flex-row items-center justify-between"
            style={{
              gap: 12,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: "#e6e9ed",
            }}
          >
            <Text style={{ fontSize: 10, color: "#8490a0" }}>{label}</Text>
            <Text
              style={{
                flex: 1,
                textAlign: "right",
                fontSize: 11,
                fontWeight: "700",
                color: "#111827",
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </View>

      {/*
        ⚠️ 확인이 필요한 거래에만 손댈 수 있게 한다.
           정상 거래에 '확인 완료' 가 있으면 매번 눌러야 하는 줄 안다. (시안 v1)
      */}
      {detail.needsReview && (onChangeCategory || onUnlinkPlan) ? (
        <View className="flex-row" style={{ gap: 8, marginTop: 17 }}>
          {onChangeCategory ? (
            <View style={{ flex: 1 }}>
              <Button
                label="카테고리 변경"
                variant="secondary"
                onPress={onChangeCategory}
                disabled={busy}
              />
            </View>
          ) : null}
          {detail.planName && onUnlinkPlan ? (
            <View style={{ flex: 1 }}>
              <Button
                label="계획 연결 해제"
                variant="secondary"
                onPress={onUnlinkPlan}
                disabled={busy}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/*
        ⚠️ 계획에 붙이는 것도 여기서 한다. 지금까지는 **푸는 것만** 있었다.
           계좌에서 들어온 거래는 자동으로 계획에 붙지만, 직접 적었거나
           자동 연결이 빗나간 거래는 사용자가 붙일 방법이 없었다.
           계획과 실제를 비교하는 게 이 서비스의 일인데 그 연결을 손으로
           만들 수 없으면 비교가 반쪽이 된다.
      */}
      {!detail.planName && onLinkPlan ? (
        <View style={{ marginTop: 17 }}>
          <Button
            label="세부 계획에 연결"
            variant="secondary"
            onPress={onLinkPlan}
            disabled={busy}
          />
        </View>
      ) : null}

      {/* 계획 연결 해제는 확인 필요가 아니어도 필요하다. 여기서만 풀 수 있다 (스펙 9장) */}
      {!detail.needsReview && detail.planName && onUnlinkPlan ? (
        <View style={{ marginTop: 17 }}>
          <Button
            label="계획 연결 해제"
            variant="secondary"
            onPress={onUnlinkPlan}
            disabled={busy}
          />
        </View>
      ) : null}

      {detail.needsReview && onConfirm ? (
        <View style={{ marginTop: 8 }}>
          <Button label="확인 완료" onPress={onConfirm} loading={busy} />
        </View>
      ) : null}
    </View>
  );
}
