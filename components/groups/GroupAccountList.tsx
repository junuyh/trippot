import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { GroupAccountItem } from './types';

type Props = {
  accounts: GroupAccountItem[];
};

/**
 * 3-2. 연결 계좌. (docs/09_IA_v1.md §3-2)
 *
 * 계좌 연결은 서비스 이용 필수조건이 아니다. 0개가 정상 상태다. (POL-FUND-001)
 *
 * ⚠️ 은행명과 잔액은 MVP 에서 표시하지 않는다. (types.ts GroupAccountItem 주석)
 *    계좌번호는 DB 에 이미 마스킹된 값이 들어 있어 그대로 쓴다. (NFR-002)
 */
export function GroupAccountList({ accounts }: Props) {
  if (accounts.length === 0) {
    return <Text className="text-sm text-gray-400">연결된 계좌가 없어요.</Text>;
  }

  return (
    <View className="gap-2.5">
      {accounts.map((account) => (
        <View key={account.accountId} className="flex-row items-center">
          <Ionicons name="card-outline" size={16} color="#9ca3af" />
          <Text className="ml-2 text-sm text-gray-800">
            {account.maskedAccountNumber ?? '계좌번호 없음'}
          </Text>
        </View>
      ))}
    </View>
  );
}
