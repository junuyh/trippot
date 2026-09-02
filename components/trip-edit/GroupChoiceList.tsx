// 여행계 고르기 — 개인 여행 + 내가 속한 모임.
//
// ⚠️ 여기서 모임을 새로 만들거나 멤버를 고치지 않는다. 그건 GROUP-01/02 다.
//    이 화면은 "이 여행을 어느 모임에 붙일 것인가" 만 정한다.
import { Pressable, Text, View } from "react-native";

import { Loading } from "@/components/ui";
import type { Group } from "@/lib/supabase/queries/groups";

type Props = {
  groups: Group[];
  loading: boolean;
  /** null 이면 개인 여행 */
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
};

function Row({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center active:opacity-80"
      style={{
        gap: 12,
        borderWidth: 1,
        borderColor: selected ? "#111827" : "#e6e9ed",
        borderRadius: 14,
        backgroundColor: selected ? "#f7f8fa" : "#fff",
        paddingHorizontal: 14,
        paddingVertical: 13,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: selected ? 5 : 1,
          borderColor: selected ? "#111827" : "#cfd5dd",
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}>
          {label}
        </Text>
        <Text style={{ marginTop: 3, fontSize: 11, color: "#8b95a3" }}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export function GroupChoiceList({
  groups,
  loading,
  selectedGroupId,
  onSelect,
}: Props) {
  if (loading) return <Loading message="모임을 불러오는 중…" />;

  return (
    <View style={{ gap: 8 }}>
      <Row
        label="개인 여행"
        description="혼자 준비하고 혼자 결산해요"
        selected={selectedGroupId === null}
        onPress={() => onSelect(null)}
      />
      {groups.map((group) => (
        <Row
          key={group.id}
          label={group.name}
          description="이 모임의 여행으로 관리해요"
          selected={selectedGroupId === group.id}
          onPress={() => onSelect(group.id)}
        />
      ))}
      {groups.length === 0 ? (
        <Text style={{ fontSize: 11, color: "#98a1ad" }}>
          아직 참여 중인 모임이 없어요. 모임 탭에서 만들 수 있어요.
        </Text>
      ) : null}
    </View>
  );
}
