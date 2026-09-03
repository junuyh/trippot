import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { GroupSortMode } from '@/lib/supabase/queries/groups';

/** 화면에 보이는 정렬 이름. 두 가지뿐이다. (2026-09-03 정책) */
export const GROUP_SORT_LABEL: Record<GroupSortMode, string> = {
  RECENT_TRIP: '최근 여행순',
  CREATED_AT: '모임 생성순',
};

const SORT_OPTIONS: GroupSortMode[] = ['RECENT_TRIP', 'CREATED_AT'];

type Props = {
  sortMode: GroupSortMode;
  editMode: boolean;
  /** 정렬 목록이 열려 있는지. 열고 닫는 것은 화면이 정한다. */
  sortOpen: boolean;
  onToggleEdit: () => void;
  onPressSort: () => void;
  onSelectSort: (mode: GroupSortMode) => void;
};

/**
 * 목록 상단. 왼쪽 정렬 선택, 오른쪽 편집/완료.
 *
 * ⚠️ 정렬은 바텀시트가 아니라 **정렬 글자 바로 아래 붙는 작은 목록**이다.
 *    두 줄짜리 선택 때문에 화면 아래에서 시트가 올라오는 것은 과하다.
 *    dim overlay 도 두지 않는다. 바깥을 누르면 닫히는 것은 화면이 깐
 *    투명 Pressable 이 맡는다. (app/(tabs)/groups.tsx)
 *
 * ⚠️ 목록의 기준점은 **정렬/편집 row 를 감싼 relative View** 다.
 *    거기에 top: '100%' 라 목록이 row 아래 끝에서 시작한다. trigger 를
 *    가리지 않는다. 좌표를 숫자로 박으면 글자 크기가 바뀔 때 어긋난다.
 */
export function GroupListHeader({
  sortMode,
  editMode,
  sortOpen,
  onToggleEdit,
  onPressSort,
  onSelectSort,
}: Props) {
  return (
    <View className="px-4 pb-2.5 pt-4">
      {/*
        ⚠️ 이 relative View 가 목록의 기준점(anchor)이다.
           바깥 컨테이너(px-4 pb-2.5 pt-4)를 기준으로 삼으면 padding 이
           끼어들어 목록 top 이 어디에 오는지가 padding 값에 따라 흔들린다.
           row 만 감싸면 '100%' 가 곧 row 의 아래 끝이다.
      */}
      <View className="relative">
        <View className="flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: sortOpen }}
            accessibilityLabel={`정렬 ${GROUP_SORT_LABEL[sortMode]}. 눌러서 변경`}
            hitSlop={8}
            onPress={onPressSort}
            className="-ml-1 flex-row items-center rounded-lg px-1 py-1 active:opacity-60"
          >
            <Text className="text-pot-mute" style={{ fontSize: 12.5 }}>
              {GROUP_SORT_LABEL[sortMode]}
            </Text>
            <Ionicons
              name={sortOpen ? 'chevron-up' : 'chevron-down'}
              size={13}
              color="#747B88"
            />
          </Pressable>

          {/*
            일반 모드에만 편집 아이콘을 붙인다. 편집 중에는 '완료' 글자만 둔다.
            지금 무엇을 하는 버튼인지가 글자로 이미 분명하고, 아이콘이 남아 있으면
            '편집을 더 하라' 는 뜻으로 읽힌다.

            ⚠️ 아이콘은 글자보다 약하게 둔다. (pot-faint) 이 줄은 카드보다 먼저
               시선이 가면 안 된다.
            ⚠️ 두 글자('편집'·'완료') 폭이 같고 오른쪽 정렬이라, 아이콘이 빠져도
               버튼 오른쪽 끝은 그대로다. 왼쪽만 아이콘 폭만큼 줄어든다.
            ⚠️ create-outline 을 쓰지 않는다. 커뮤니티가 '글쓰기'(새로 만들기) 로
               쓰고 있어서 목록 편집과 뜻이 겹친다. pencil 은 '고치기' 다.
          */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editMode ? '편집 완료' : '목록 편집'}
            hitSlop={10}
            onPress={onToggleEdit}
            className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:opacity-60"
          >
            {editMode ? null : <Ionicons name="pencil-outline" size={13} color="#8B94A2" />}
            <Text className="font-semibold text-pot-ink" style={{ fontSize: 12.5 }}>
              {editMode ? '완료' : '편집'}
            </Text>
          </Pressable>
        </View>

        {sortOpen ? (
          <View
            // top '100%' = 정렬 row 의 아래 끝. 거기서 6 만 띄운다.
          // left 0 은 이 anchor 의 왼쪽 끝이고, 정렬 글자와 같은 줄에 선다.
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: 6,
            left: 0,
            minWidth: 148,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            paddingVertical: 4,
            shadowColor: '#111827',
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          {SORT_OPTIONS.map((mode) => {
            const selected = mode === sortMode;
            return (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={GROUP_SORT_LABEL[mode]}
                onPress={() => onSelectSort(mode)}
                className="flex-row items-center gap-2 px-3 py-2.5 active:bg-pot-visual"
              >
                {/* 체크 자리는 늘 비워 둔다. 선택이 바뀌어도 글자가 움직이지 않는다. */}
                <View style={{ width: 14 }}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#111827" /> : null}
                </View>
                <Text
                  className={selected ? 'font-semibold text-pot-ink' : 'text-pot-mute'}
                  style={{ fontSize: 13 }}
                >
                  {GROUP_SORT_LABEL[mode]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        ) : null}
      </View>
    </View>
  );
}
