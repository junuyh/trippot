// TRIP-03 지난 여행 소비 패턴 카드.
//
// ⚠️ 해제해도 카드를 지우지 않는다. (요청 §3)
//    지우면 사용자는 방금 무엇을 껐는지도, 다시 켤 방법도 잃는다.
//    반영 중 / 반영 안 함 두 상태를 같은 자리에서 보여준다.
//
// 카테고리별 개별 제외는 BudgetCategoryList 가 계속 담당한다.
// 여기는 '전체' 만 다룬다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

type Props = {
  /** 하나라도 반영 중인가 */
  applied: boolean;
  /** 지난 여행에서 더 쓴 카테고리 라벨 */
  increasedLabels: string[];
  /** 지난 여행에서 덜 쓴 카테고리 라벨 */
  decreasedLabels: string[];
  onToggleAll: () => void;
  onPressDetail: () => void;
  disabled?: boolean;
};

/**
 * 무엇이 반영됐는지 한 줄로 설명한다.
 *
 * ⚠️ '식비를', '쇼핑은' 처럼 조사를 붙이지 않는다. 카테고리 이름의 받침에 따라
 *    조사가 달라지는데 그 규칙이 프로젝트에 없다. 조사가 필요 없는 문장으로 쓴다.
 */
function describe(increased: string[], decreased: string[]): string {
  const more = increased.join('·');
  const less = decreased.join('·');

  if (more && less) {
    return `지난 여행에서 더 쓴 항목(${more})과 덜 쓴 항목(${less})을 추천 예산에 반영했어요.`;
  }
  if (more) return `지난 여행에서 더 쓴 항목(${more})을 추천 예산에 반영했어요.`;
  if (less) return `지난 여행에서 덜 쓴 항목(${less})을 추천 예산에 반영했어요.`;
  return '지난 여행의 소비 패턴을 추천 예산에 반영했어요.';
}

export function PastPatternCard({
  applied,
  increasedLabels,
  decreasedLabels,
  onToggleAll,
  onPressDetail,
  disabled = false,
}: Props) {
  return (
    <View
      className={`mt-2.5 flex-row items-start gap-2.5 rounded-2xl px-3.5 py-3 ${
        applied ? 'bg-emerald-50' : 'bg-gray-100'
      }`}
    >
      <View className="mt-px">
        <Ionicons name="sparkles-outline" size={18} color={applied ? '#047857' : '#4b5563'} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            className={`flex-1 text-xs font-extrabold ${
              applied ? 'text-emerald-800' : 'text-gray-600'
            }`}
          >
            {applied
              ? '지난 여행 소비 패턴을 반영했어요'
              : '지난 여행 소비 패턴을 반영하지 않았어요'}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={applied ? '지난 여행 반영 해제' : '지난 여행 다시 반영'}
            disabled={disabled}
            onPress={onToggleAll}
            className={`rounded-lg px-2 py-1.5 ${
              applied ? 'bg-white/70 active:bg-white' : 'bg-white active:bg-gray-50'
            } ${disabled ? 'opacity-40' : ''}`}
          >
            <Text
              className={`text-[11px] font-extrabold ${
                applied ? 'text-emerald-700' : 'text-gray-600'
              }`}
            >
              {applied ? '반영 해제' : '다시 반영'}
            </Text>
          </Pressable>
        </View>

        <Text
          className={`mt-1 text-[11px] leading-[17px] ${
            applied ? 'text-emerald-800/80' : 'text-gray-500'
          }`}
        >
          {applied
            ? describe(increasedLabels, decreasedLabels)
            : '현재 여행지와 일정만을 기준으로 추천 예산을 보여드려요.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지난 여행이 어떻게 반영되는지 보기"
          onPress={onPressDetail}
          className="mt-1 self-start rounded-lg py-1 pr-2 active:opacity-60"
        >
          <Text
            className={`text-[11px] font-extrabold ${
              applied ? 'text-emerald-700' : 'text-gray-600'
            }`}
          >
            자세히 보기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
