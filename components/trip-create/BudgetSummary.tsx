// TRIP-03 예상 여행비 비교.
//
// ⚠️ AC-01 — 추천형·사용자형 **두 경로 모두** 이 비교를 거쳐 목표를 확정한다.
//    직접 입력을 골라도 시스템 추천액을 나란히 보여준다.
//    이 차이가 '추천 대비 사용자 예산' 지표의 근거가 된다.
//
// NFR-004 — 추천은 추정치임을 표시하고 기준 시점을 함께 보여준다.
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

type Props = {
  /** 시스템 추천 총액 (불변) */
  recommendedTotal: number;
  /** 사용자가 확정할 총액 */
  targetTotal: number;
  headcount: number;
  perPersonAmount: number;
  /** 기준 시점 'YYYY-MM-DD' */
  baselineUpdatedAt: string;
  /** 지역 평균을 쓴 경우의 안내 문구. 있으면 그대로 노출한다 */
  estimateNotice: string | null;
};

function formatBaselineMonth(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  return `${year}년 ${Number(month)}월 기준`;
}

export function BudgetSummary({
  recommendedTotal,
  targetTotal,
  headcount,
  perPersonAmount,
  baselineUpdatedAt,
  estimateNotice,
}: Props) {
  const diff = targetTotal - recommendedTotal;

  return (
    <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <View>
        <Text className="text-xs text-gray-500">목표 여행비</Text>
        <Text className="mt-0.5 text-3xl font-bold text-gray-900">
          {targetTotal.toLocaleString('ko-KR')}
          <Text className="text-xl">원</Text>
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          {headcount}명 · 1인 {perPersonAmount.toLocaleString('ko-KR')}원
        </Text>
      </View>

      <View className="h-px bg-gray-100" />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500">추천 예산</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-gray-700">
            {recommendedTotal.toLocaleString('ko-KR')}원
          </Text>
          {diff !== 0 ? (
            <Text
              className={`text-sm font-semibold ${diff > 0 ? 'text-red-500' : 'text-blue-600'}`}
            >
              {diff > 0 ? '+' : ''}
              {diff.toLocaleString('ko-KR')}
            </Text>
          ) : (
            <Text className="text-sm font-medium text-gray-400">그대로</Text>
          )}
        </View>
      </View>

      {/* NFR-004 */}
      <View className="flex-row items-start gap-1.5 rounded-xl bg-gray-50 px-3 py-2.5">
        <Ionicons name="information-circle-outline" size={15} color="#9ca3af" />
        <Text className="flex-1 text-xs leading-4 text-gray-500">
          {estimateNotice ? `${estimateNotice} ` : ''}
          추천 금액은 추정치예요. {formatBaselineMonth(baselineUpdatedAt)}.
        </Text>
      </View>
    </View>
  );
}
