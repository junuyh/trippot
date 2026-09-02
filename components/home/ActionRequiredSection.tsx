import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { SectionHeader } from './SectionHeader';
import type { HomeActionItem } from './types';

type Props = {
  actions: HomeActionItem[];
  onPressAction: (actionId: string) => void;
  /** '모두 보기' 를 눌렀을 때. 없으면 링크를 그리지 않는다. */
  onPressSeeAll?: () => void;
};

/**
 * 지금 챙겨야 할 것.
 *
 * 알림 목록이 아니라 **다음 행동 제안**이다. 한 줄을 누르면 그 일을 할 수 있는
 * 화면으로 바로 간다. 어디로 갈지는 화면 파일이 정한다. (CLAUDE.md 9장)
 *
 * 문장은 이미 완성된 상태로 받는다. 컴포넌트가 금액을 계산하지 않는다.
 */
export function ActionRequiredSection({ actions, onPressAction, onPressSeeAll }: Props) {
  return (
    <View>
      <SectionHeader
        title="지금 챙겨야 할 것"
        actionLabel={actions.length > 0 && onPressSeeAll ? '모두 보기' : undefined}
        onPressAction={onPressSeeAll}
      />

      {actions.length === 0 ? (
        <View className="rounded-2xl border border-pot-line bg-white px-4 py-5">
          <Text className="text-center text-pot-mute" style={{ fontSize: 13, lineHeight: 19 }}>
            지금 챙길 일이 없어요. 준비가 잘 되고 있어요 👍
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-pot-line bg-white">
          {actions.map((action, index) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={action.message}
              onPress={() => onPressAction(action.id)}
              className="flex-row items-center px-4 py-3.5 active:bg-pot-visual"
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: '#EFF1F4' } : undefined}
            >
              <View
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: action.tintSoft }}
              >
                <Text style={{ fontSize: 15 }}>{action.emoji}</Text>
              </View>

              <Text
                className="ml-3 flex-1 text-pot-ink"
                style={{ fontSize: 13.5, lineHeight: 19 }}
                numberOfLines={2}
              >
                {action.message}
              </Text>

              <Ionicons name="chevron-forward" size={15} color="#C3C9D2" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
