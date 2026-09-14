// ============================================================================
// CXL-07 동의 현황 — 전체 화면
//
// 누가 동의했고 누가 아직인지 보여준다. 요청자와 멤버 모두 들어온다.
//
// ⚠️ **반대가 나오면 진행바를 0% 로 만든다.** 만장일치가 조건이라 반대 1명이면
//    성립 불가가 확정된다. 그런데 바가 채워진 채 남아 있으면 "아직 되는 중"
//    으로 읽힌다.
//
// ⚠️ 반대 후에는 나머지 동의를 받지 않는다. (POL-CXL-062) 그래서 반대가
//    나오면 CTA 가 '철회하기' 에서 '여행 홈으로' 로 바뀐다. 철회할 요청이
//    이미 없다.
//
// ⚠️ 사유는 **있을 때만** 그린다. 없는데 빈 섹션을 두면 덜 만든 화면으로 읽힌다.
//
// ⚠️ 만료·출발일 안내를 하단에 반드시 남긴다. 요청이 왜 사라졌는지 나중에
//    묻지 않게 하려면 미리 알려야 한다.
// ============================================================================
import { Text, View } from "react-native";

import { Button } from "@/components/ui";

import type { VoteItem } from "./types";

type Props = {
  /** 취소를 요청한 사람 이름 */
  requesterName: string;
  /** 요청 일시 표시용. 예) "9월 7일" */
  requestedAtLabel: string;

  /** 요청자를 제외한 동의 대상 */
  votes: VoteItem[];

  /** 요청자가 남긴 사유 문구. 안 골랐으면 null */
  reasonLabel: string | null;

  expiresAtLabel: string;
  departureLabel: string;

  /** 내가 요청자인가. CTA 가 갈린다 */
  isRequester: boolean;
  onWithdraw: () => void;
  onGoTripHome: () => void;
  withdrawing: boolean;
};

export function VoteProgressView({
  requesterName,
  requestedAtLabel,
  votes,
  reasonLabel,
  expiresAtLabel,
  departureLabel,
  isRequester,
  onWithdraw,
  onGoTripHome,
  withdrawing,
}: Props) {
  const total = votes.length;
  const agreed = votes.filter((v) => v.vote === "AGREE").length;
  const rejected = votes.some((v) => v.vote === "DISAGREE");
  // ⚠️ 반대가 나오면 0%. 진행 중이라는 오해를 없앤다
  const percent = rejected || total === 0 ? 0 : Math.round((agreed / total) * 100);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1">
        {/* 히어로 */}
        <View className="mx-5 mt-4 rounded-2xl bg-white p-5">
          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              letterSpacing: -1.2,
              color: "#111827",
              textAlign: "center",
            }}
          >
            {agreed}
            <Text style={{ fontSize: 22, color: "#8B94A2" }}>/{total}</Text>
          </Text>
          <Text
            style={{ marginTop: 5, fontSize: 13, color: "#8B94A2", textAlign: "center" }}
          >
            {rejected
              ? "한 명이 반대해서 취소되지 않아요"
              : "멤버 모두가 동의하면 여행이 취소돼요"}
          </Text>
          <View
            className="overflow-hidden rounded-full bg-gray-100"
            style={{ height: 7, marginTop: 14 }}
          >
            <View
              style={{ height: "100%", width: `${percent}%`, backgroundColor: "#2563eb" }}
            />
          </View>
        </View>

        {/* 요청자 + 멤버 목록 */}
        <View className="mx-5 mt-3 overflow-hidden rounded-2xl bg-white">
          <Row
            name={requesterName}
            badge="요청"
            sub={`${requestedAtLabel} 취소를 요청했어요`}
            first
          />
          {votes.map((vote) => (
            <Row
              key={vote.userId}
              name={vote.name}
              sub={
                vote.vote === "AGREE"
                  ? `${vote.votedAtLabel ?? ""} 동의했어요`.trim()
                  : vote.vote === "DISAGREE"
                    ? `${vote.votedAtLabel ?? ""} 반대했어요`.trim()
                    : "아직 확인하지 않았어요"
              }
              status={vote.vote}
            />
          ))}
        </View>

        {/* 사유 — 있을 때만 */}
        {reasonLabel ? (
          <>
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
              멤버에게 함께 보이는 사유
            </Text>
            <View className="mx-5 rounded-2xl bg-white px-4 py-3.5">
              <Text style={{ fontSize: 13.5, color: "#111827" }}>{reasonLabel}</Text>
            </View>
          </>
        ) : null}

        {/* 만료 정보 */}
        <View className="mx-5 mt-3 rounded-2xl bg-white px-4 py-4">
          <InfoRow label="요청 만료" value={expiresAtLabel} />
          <View className="my-2 h-px bg-gray-100" />
          <InfoRow label="출발일" value={departureLabel} />
        </View>

        <Text
          style={{
            marginTop: 12,
            marginHorizontal: 20,
            fontSize: 11.5,
            lineHeight: 18,
            color: "#8B94A2",
          }}
        >
          {expiresAtLabel}까지 동의가 모이지 않거나 출발일이 되면 요청이 자동으로 취소돼요.
          여행은 그대로 남아요.
        </Text>
      </View>

      <View className="border-t border-gray-100 bg-white px-5 pb-8 pt-3">
        {/*
          ⚠️ 반대가 나왔으면 철회할 요청이 없다. 요청자여도 '여행 홈으로' 다.
        */}
        {isRequester && !rejected ? (
          <Button
            label="취소 요청 철회하기"
            variant="secondary"
            loading={withdrawing}
            onPress={onWithdraw}
          />
        ) : (
          <Button label="여행 홈으로" variant="secondary" onPress={onGoTripHome} />
        )}
      </View>
    </View>
  );
}

function Row({
  name,
  sub,
  badge,
  status,
  first = false,
}: {
  name: string;
  sub: string;
  badge?: string;
  status?: "AGREE" | "DISAGREE" | null;
  first?: boolean;
}) {
  return (
    <View
      className="flex-row items-center px-4 py-3.5"
      style={{ gap: 10, borderTopWidth: first ? 0 : 1, borderTopColor: "#F1F3F6" }}
    >
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center" style={{ gap: 5 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
            {name}
          </Text>
          {badge ? (
            <View className="rounded bg-gray-100 px-1.5 py-0.5">
              <Text style={{ fontSize: 10.5, fontWeight: "800", color: "#8B94A2" }}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ marginTop: 2, fontSize: 11.5, color: "#8B94A2" }}>{sub}</Text>
      </View>
      {status !== undefined ? <StatusBadge status={status} /> : null}
    </View>
  );
}

function StatusBadge({ status }: { status: "AGREE" | "DISAGREE" | null | undefined }) {
  const map = {
    AGREE: { t: "동의", bg: "#E6F9F1", fg: "#00805A" },
    DISAGREE: { t: "반대", bg: "#FDF0F0", fg: "#B4272B" },
    WAIT: { t: "대기", bg: "#FFF7E8", fg: "#8A5A00" },
  } as const;
  const v = status === "AGREE" ? map.AGREE : status === "DISAGREE" ? map.DISAGREE : map.WAIT;
  return (
    <View className="shrink-0 rounded px-2 py-1" style={{ backgroundColor: v.bg }}>
      <Text style={{ fontSize: 11.5, fontWeight: "800", color: v.fg }}>{v.t}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
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
