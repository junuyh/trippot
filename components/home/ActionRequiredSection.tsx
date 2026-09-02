import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { HOME_DANGER } from './palette';
import { SectionHeader } from './SectionHeader';
import type { HomeActionItem } from './types';

type Props = {
  actions: HomeActionItem[];
  onPressAction: (actionId: string) => void;
  /** '모두 보기' 를 눌렀을 때. 없으면 링크를 그리지 않는다. */
  onPressSeeAll?: () => void;
};

const NUM = { fontVariant: ['tabular-nums' as const] };

/**
 * 지금 챙겨야 할 것.
 *
 * 알림 목록이 아니라 **다음 행동 제안**이다. 한 줄을 누르면 그 일을 할 수 있는
 * 화면으로 바로 간다. 어디로 갈지는 화면 파일이 정한다. (CLAUDE.md 9장)
 *
 * 문장은 이미 세 조각으로 나뉘어 온다. 가운데 조각만 빨강으로 강조한다.
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
        <View className="rounded-2xl bg-white px-4 py-4">
          <Text className="text-center text-pot-mute" style={{ fontSize: 12.5, lineHeight: 18 }}>
            지금 챙길 일이 없어요. 준비가 잘 되고 있어요 👍
          </Text>
        </View>
      ) : (
        <View
          className="overflow-hidden rounded-2xl bg-white"
          style={{
            shadowColor: '#111827',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          {actions.map((action, index) => (
            <Pressable
              key={action.id}
              accessibilityRole="button"
              accessibilityLabel={`${action.textBefore}${action.highlight ?? ''}${action.textAfter}`}
              onPress={() => onPressAction(action.id)}
              className="flex-row items-center px-3.5 py-2.5 active:bg-pot-visual"
              style={index > 0 ? { borderTopWidth: 1, borderTopColor: '#F1F3F6' } : undefined}
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: action.tint }}
              >
                <Ionicons name={action.icon as never} size={16} color="#4B5563" />
              </View>

              <View className="ml-3 flex-1">
                <Text className="text-pot-ink" style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {action.textBefore}
                  {action.highlight ? (
                    <Text className="font-black" style={{ color: HOME_DANGER, ...NUM }}>
                      {action.highlight}
                    </Text>
                  ) : null}
                  {action.textAfter}
                </Text>
                <Text className="mt-0.5 text-pot-faint" style={{ fontSize: 10.5 }} numberOfLines={1}>
                  {action.subtitle}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={14} color="#C3C9D2" />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
