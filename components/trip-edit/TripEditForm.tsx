// ============================================================================
// 여행 기본 정보 수정 폼 (TRIP-HOME-01 → /trips/:tripId/edit)
//
// 일정 · 인원 · 여행계만 고친다.
//
// ⚠️ **목적지는 여기서 못 바꾼다.** 목적지가 바뀌면 추천 예산의 기준 단가가
//    통째로 달라지는데, 이미 확정한 planned_amount 를 자동으로 덮어쓸 수는
//    없다. (CLAUDE.md 4장 — 사용자 확정값은 사용자만 바꾼다)
//    목적지를 바꾸려는 사람은 사실 새 여행을 만들려는 것이다.
//
// ⚠️ 일정이 바뀌어도 예산 금액은 따라 바뀌지 않는다. 그래서 화면에 그렇게 적는다.
//    말없이 안 바뀌면 사용자는 바뀐 줄 알고 예산을 다시 확인하지 않는다.
//
// supabase / track 을 직접 부르지 않는다. 화면이 부른다. (CLAUDE.md 9장)
// ============================================================================
import { Text, View } from "react-native";

import { DateRangeCalendar, HeadcountStepper } from "@/components/trip-create";
import { Button } from "@/components/ui";
import type { Group } from "@/lib/supabase/queries/groups";

import { GroupChoiceList } from "./GroupChoiceList";

type Props = {
  /** 화면 맨 위에 띄우는 여행 이름. 읽기 전용이다 */
  destination: string;

  startDate: string | null;
  endDate: string | null;
  onChangeDates: (next: {
    startDate: string | null;
    endDate: string | null;
  }) => void;

  headcount: number;
  onChangeHeadcount: (value: number) => void;

  groups: Group[];
  groupsLoading: boolean;
  /** null 이면 개인 여행 */
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;

  /** 저장 가능한 상태인가. 검증은 화면이 한다 */
  canSubmit: boolean;
  saving: boolean;
  /** 저장 실패 안내. 없으면 null */
  errorMessage: string | null;
  onSubmit: () => void;
};

export function TripEditForm({
  destination,
  startDate,
  endDate,
  onChangeDates,
  headcount,
  onChangeHeadcount,
  groups,
  groupsLoading,
  selectedGroupId,
  onSelectGroup,
  canSubmit,
  saving,
  errorMessage,
  onSubmit,
}: Props) {
  return (
    <View style={{ gap: 28 }}>
      <View>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "900",
            letterSpacing: 1.1,
            color: "#98a1ad",
          }}
        >
          TRIP INFO
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 22,
            fontWeight: "800",
            color: "#111827",
          }}
        >
          {destination}
        </Text>
        <Text
          style={{
            marginTop: 8,
            fontSize: 12,
            lineHeight: 18,
            color: "#7f8998",
          }}
        >
          일정과 인원, 함께 가는 여행계를 고칠 수 있어요. 여행지를 바꾸려면 새
          여행을 만들어 주세요.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
          여행 일정
        </Text>
        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          onChange={onChangeDates}
          // 이미 시작한 여행의 시작일을 고치는 일이 있다. 과거를 막지 않는다.
          disablePast={false}
        />
        <Text style={{ fontSize: 11, lineHeight: 17, color: "#98a1ad" }}>
          일정을 바꿔도 이미 정한 예산 금액은 그대로예요. 필요하면 전체 예산에서
          직접 고쳐 주세요.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
          인원
        </Text>
        <HeadcountStepper value={headcount} onChange={onChangeHeadcount} />
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>
          여행계
        </Text>
        <GroupChoiceList
          groups={groups}
          loading={groupsLoading}
          selectedGroupId={selectedGroupId}
          onSelect={onSelectGroup}
        />
      </View>

      {errorMessage ? (
        <Text style={{ fontSize: 12, color: "#d1373f" }}>{errorMessage}</Text>
      ) : null}

      <Button
        label="저장하기"
        loading={saving}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </View>
  );
}
