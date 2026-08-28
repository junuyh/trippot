import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREENS } from '@/lib/analytics/events';
import { useScreenView } from '@/lib/hooks/useScreenView';
export default function ScreenFUND03() {
  const { tripId, transactionId } = useLocalSearchParams<{ tripId: string; transactionId: string }>();
  useScreenView(SCREENS.TRANSACTION_DETAIL);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pb-10 pt-6">
      <Stack.Screen options={{ title: '거래 상세' }} />
      <View>
        <Text className="text-xs font-semibold tracking-wide text-blue-600">FUND-03</Text>
        <Text className="mt-1 text-2xl font-bold text-gray-900">거래 상세</Text>
        <Text className="mt-1 text-xs text-gray-400">/trips/:tripId/transactions/:transactionId</Text>
        <View className="mt-4 gap-1 rounded-lg bg-gray-100 px-3 py-2">
            <Text className="text-xs text-gray-500">tripId: {tripId}</Text>
            <Text className="text-xs text-gray-500">transactionId: {transactionId}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
