import { format, isValid, parseISO } from 'date-fns';
import { ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui';

import type { NotificationDetailItem } from './types';

type Props = {
  notification: NotificationDetailItem;
  /** 상태·CTA 를 아직 계산 중이면 버튼 자리를 비워 둔다. */
  resolving: boolean;
  onPressCta: (href: string) => void;
};

/** 2026.09.16 14:05 · KST. 잘못된 값이면 null. */
function toDateTimeLabel(iso: string): string | null {
  const at = parseISO(iso);
  return isValid(at) ? format(at, 'yyyy.MM.dd HH:mm') : null;
}

/**
 * 알림 상세 (docs/14 §6).
 *
 * title · body 는 **발생 당시의 스냅샷**이라 그대로 보여준다. 아래 상태 pill 과 CTA 만
 * 지금 상태로 계산된 값이다(화면 파일 → resolveNotificationAction). 과거 버튼을 다시 그리지 않는다.
 * ⚠️ supabase · track() 을 직접 부르지 않는다. (CLAUDE.md 9장)
 */
export function NotificationDetailView({ notification, resolving, onPressCta }: Props) {
  const at = toDateTimeLabel(notification.createdAt);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-16 pt-6">
      {notification.statusLabel ? (
        <View className="mb-3 self-start rounded-full bg-pot-visual px-3 py-1">
          <Text className="text-pot-mute" style={{ fontSize: 12, fontWeight: '700' }}>
            {notification.statusLabel}
          </Text>
        </View>
      ) : null}

      <Text
        className="text-pot-ink"
        style={{ fontSize: 20, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 }}
      >
        {notification.title}
      </Text>

      {at ? (
        <Text className="mt-2 text-pot-faint" style={{ fontSize: 12.5, lineHeight: 18 }}>
          {at}
        </Text>
      ) : null}

      {notification.body ? (
        <Text className="mt-5 text-pot-ink" style={{ fontSize: 15.5, lineHeight: 24 }}>
          {notification.body}
        </Text>
      ) : null}

      {notification.tripLabel ? (
        <View className="mt-6 rounded-2xl bg-pot-visual px-4 py-3">
          <Text className="text-pot-faint" style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 }}>
            관련 여행
          </Text>
          <Text className="mt-1 text-pot-ink" style={{ fontSize: 14.5, lineHeight: 21 }}>
            {notification.tripLabel}
          </Text>
        </View>
      ) : null}

      {!resolving && notification.cta ? (
        <View className="mt-8">
          <Button
            label={notification.cta.label}
            variant="brand"
            onPress={() => onPressCta(notification.cta!.href)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
