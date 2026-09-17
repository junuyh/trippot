// 모임 고르기 — 개인 여행 + 내가 속한 모임.
//
// 모임이 많아지면 라디오 줄만으로는 못 찾는다. 위에 검색칸을 두고, 입력하면
// 이름에 그 글자가 들어간 모임만 남긴다. 순서는 받은 순서(기본 목록) 그대로다.
//   · '개인 여행' 은 검색과 무관하게 항상 맨 위
//   · 지금 선택된 모임이 검색에 걸러져도 선택은 유지된다 (지워지지 않는다)
//
// ⚠️ 여기서 모임을 새로 만들거나 멤버를 고치지 않는다. 그건 GROUP-01/02 다.
//    이 화면은 "이 여행을 어느 모임에 붙일 것인가" 만 정한다.
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useDeferredPlaceholder } from "@/lib/hooks/useDeferredPlaceholder";

import { Loading } from "@/components/ui";
import type { Group } from "@/lib/supabase/queries/groups";

/** 이 개수 이하면 검색칸을 안 띄운다. 세 개 고르는데 검색칸은 과하다 */
const SEARCH_THRESHOLD = 5;

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
  const [query, setQuery] = useState("");
  // ⚠️ 첫 그림에서 플레이스홀더가 번진다. 한 틱 뒤에 넣어 다시 그리게 한다.
  const deferredPlaceholder = useDeferredPlaceholder("모임 이름으로 찾기");
  const showSearch = groups.length > SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  if (loading) return <Loading message="모임을 불러오는 중…" />;

  return (
    <View style={{ gap: 8 }}>
      {showSearch ? (
        <View
          className="flex-row items-center"
          style={{
            gap: 8,
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#e6e9ed",
            backgroundColor: "#fff",
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search-outline" size={16} color="#98a1ad" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={deferredPlaceholder}
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="모임 검색"
            style={{ flex: 1, fontSize: 14, color: "#111827", paddingVertical: 0 }}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="검색어 지우기" hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color="#c3c9d1" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Row
        label="개인 여행"
        description="혼자 준비하고 혼자 결산해요"
        selected={selectedGroupId === null}
        onPress={() => onSelect(null)}
      />
      {filtered.map((group) => (
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
      ) : filtered.length === 0 ? (
        <Text style={{ fontSize: 11, color: "#98a1ad", paddingVertical: 6 }}>
          ‘{query.trim()}’ 이 들어간 모임이 없어요.
        </Text>
      ) : null}
    </View>
  );
}
