import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { Button } from './Button';

type Props = {
  title: string;
  description?: string;
  /** 있으면 버튼을 그린다. */
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

/** 화면 4상태 중 Empty. 데이터가 없을 때 쓴다. (CLAUDE.md 9장) */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = 'file-tray-outline',
}: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      <Ionicons name={icon} size={44} color="#d1d5db" />
      <Text className="mt-4 text-center text-base font-semibold text-gray-900">{title}</Text>
      {description ? (
        <Text className="mt-1.5 text-center text-sm leading-5 text-gray-500">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View className="mt-6 w-full max-w-xs">
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
