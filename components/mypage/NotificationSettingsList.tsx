import { ScrollView, Switch, Text, View } from 'react-native';

import { NOTIFICATION_TYPE, type NotificationType } from '@/lib/constants/status';
import type { NotificationSettings } from '@/lib/supabase/queries/users';

/**
 * 화면에 보이는 순서와 문구. 알림 3종과 1:1 이다.
 *
 * ⚠️ type 문자열을 여기서 다시 적지 않고 NOTIFICATION_TYPE 을 그대로 쓴다.
 *    상수·저장 key·화면이 한 곳에서 갈라지지 않는다.
 */
const ROWS: { type: NotificationType; label: string; description: string }[] = [
  {
    type: NOTIFICATION_TYPE.FUND_GOAL_REACHED,
    label: '여행 준비금 목표 달성',
    description: '목표 여행비를 모두 모으면 알려드려요.',
  },
  {
    type: NOTIFICATION_TYPE.TRIP_D7,
    label: '여행 7일 전',
    description: '여행 시작 7일 전에 알려드려요.',
  },
  {
    type: NOTIFICATION_TYPE.SETTLEMENT_READY,
    label: '여행 후 정산',
    description: '여행이 끝나고 정산할 수 있을 때 알려드려요.',
  },
];

type Props = {
  settings: NotificationSettings;
  onToggle: (type: NotificationType, next: boolean) => void;
  /** 저장 중에는 스위치를 잠근다. 연타로 요청이 겹치지 않게 한다. */
  disabled?: boolean;
};

/**
 * 알림 수신 설정 3줄.
 *
 * ⚠️ 전체 끄기(master switch)를 두지 않는다. MVP 는 3개 각각만 설정한다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. 화면 파일이 부른다. (CLAUDE.md 9장)
 */
export function NotificationSettingsList({ settings, onToggle, disabled = false }: Props) {
  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-16 pt-2">
      {ROWS.map((row, index) => (
        <View
          key={row.type}
          className={`flex-row items-center py-4 ${
            index === ROWS.length - 1 ? '' : 'border-b border-pot-line'
          }`}
        >
          <View className="flex-1 pr-4">
            <Text className="text-base leading-6 text-pot-ink">{row.label}</Text>
            <Text className="mt-1 text-sm leading-5 text-pot-mute">{row.description}</Text>
          </View>

          <Switch
            value={settings[row.type]}
            onValueChange={(next) => onToggle(row.type, next)}
            disabled={disabled}
            accessibilityLabel={row.label}
          />
        </View>
      ))}
    </ScrollView>
  );
}
