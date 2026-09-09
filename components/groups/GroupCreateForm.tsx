// ============================================================================
// 새 모임 만들기 폼 (/groups/new)
//
// 여행 정보 수정 > 여행 멤버 초대하기 에서 온다. 고른 모임에 여행중·완료된
// 여행이 하나라도 있으면 그 모임에 새 사람을 섞지 않고 새 모임을 만든다.
// 사용자에게 따로 묻는 건 **모임 이름**뿐이고, 여행 이동은 화면이 알아서 한다.
//
// ⚠️ 기존 모임원은 **기본으로 전부 데려온다.** 새 모임은 "이 여행을 같이 갈
//    사람들" 이라, 지금 함께 준비하던 사람을 빼는 쪽이 예외다. 빼고 싶은
//    사람만 체크를 풀게 한다.
//
// ⚠️ 모임장(나)은 목록에 넣지 않는다. 만드는 사람은 무조건 새 모임의 OWNER 라
//    고를 수 있는 것처럼 보이면 안 된다.
//
// ⚠️ 개인 여행에서 왔으면 데려올 모임원이 없다. 그때는 이름만 받는다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Input } from "@/components/ui";

/** 데려올 수 있는 기존 모임원 한 명 */
export type MovableMember = {
  userId: string;
  name: string;
};

type Props = {
  groupName: string;
  onChangeGroupName: (value: string) => void;
  /** 검증 실패 메시지. null 이면 정상 */
  groupNameError: string | null;
  /** 입력칸을 벗어날 때 검증한다. 저장 버튼이 disabled 라 눌러서는 띄울 수 없다 */
  onBlurGroupName: () => void;

  /** 이전 모임의 나머지 멤버. 개인 여행에서 왔으면 빈 배열 */
  members: MovableMember[];
  /** 데려갈 사람의 userId */
  selectedUserIds: string[];
  onToggleMember: (userId: string) => void;

  /** 이전 모임 이름. 안내 문구에 쓴다. 개인 여행이면 null */
  fromGroupName: string | null;
  /** 여행지 이름. 안내 문구에 쓴다 */
  destination: string;

  disabled?: boolean;
};

export function GroupCreateForm({
  groupName,
  onChangeGroupName,
  groupNameError,
  onBlurGroupName,
  members,
  selectedUserIds,
  onToggleMember,
  fromGroupName,
  destination,
  disabled = false,
}: Props) {
  return (
    <View className="gap-5">
      {/*
        무슨 일이 일어나는지 먼저 알린다. 모임 이름만 묻고 여행이 조용히
        옮겨지면, 사용자는 왜 모임이 바뀌었는지 나중에 알게 된다.
      */}
      <View className="rounded-2xl bg-pot-visual px-4 py-3.5">
        <Text className="font-bold text-pot-ink" style={{ fontSize: 13 }}>
          {destination} 여행이 새 모임으로 옮겨져요
        </Text>
        <Text className="mt-1.5 text-pot-mute" style={{ fontSize: 11.5, lineHeight: 18 }}>
          {fromGroupName
            ? `${fromGroupName}에는 이미 다녀온 여행이 있어서, 이번 여행만 새 모임으로 옮겨요. 지난 여행 기록은 ${fromGroupName}에 그대로 남아요.`
            : "이 여행을 함께할 새 모임을 만들어요. 예산과 모은 돈, 지출 기록은 여행을 그대로 따라가요."}
        </Text>
      </View>

      <Input
        label="모임 이름"
        required
        value={groupName}
        onChangeText={onChangeGroupName}
        onBlur={onBlurGroupName}
        placeholder={`예) ${destination} 가는 사람들`}
        error={groupNameError}
        editable={!disabled}
        maxLength={20}
        returnKeyType="done"
      />

      {members.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row items-baseline">
            <Text className="font-bold text-pot-ink" style={{ fontSize: 13 }}>
              함께 옮길 사람
            </Text>
            <Text className="ml-auto text-pot-faint" style={{ fontSize: 11 }}>
              {selectedUserIds.length}명 선택
            </Text>
          </View>

          {/*
            나는 지울 수 없는 고정 행이다. 만드는 사람이 곧 새 모임의 OWNER 라
            체크박스로 두면 자기를 뺄 수 있는 것처럼 보인다.
          */}
          <View className="h-12 flex-row items-center gap-2 rounded-xl bg-gray-100 px-3.5">
            <Ionicons name="person" size={15} color="#6b7280" />
            <Text className="text-sm font-bold text-gray-700">나</Text>
            <View className="ml-auto rounded-full bg-white px-2 py-0.5">
              <Text className="font-semibold text-pot-mute" style={{ fontSize: 10.5 }}>
                모임장
              </Text>
            </View>
          </View>

          {members.map((member) => {
            const on = selectedUserIds.includes(member.userId);
            return (
              <Pressable
                key={member.userId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={member.name}
                disabled={disabled}
                onPress={() => onToggleMember(member.userId)}
                className={`h-12 flex-row items-center gap-2.5 rounded-xl border px-3.5 active:opacity-70 ${
                  on ? "border-blue-600 bg-white" : "border-gray-200 bg-white"
                } ${disabled ? "opacity-40" : ""}`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md ${
                    on ? "bg-blue-600" : "border border-gray-300 bg-white"
                  }`}
                >
                  {on ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
                </View>
                <Text numberOfLines={1} className="shrink text-sm text-gray-800">
                  {member.name}
                </Text>
              </Pressable>
            );
          })}

          <Text className="text-pot-faint" style={{ fontSize: 11, lineHeight: 18 }}>
            체크를 풀면 그 사람은 새 모임에 오지 않아요. 이전 모임에는 그대로 남아요.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
