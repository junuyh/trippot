// TRIP-03 지난 여행 반영 근거 바텀시트.
//
// "지난 여행 2건을 4개 항목에 반영했어요" 옆의 '어떻게 반영되나요?' 로 연다.
// 비율만 보여주면 사용자는 그 숫자를 믿을 근거가 없다. 항목별 예상·실제를
// 그대로 펼쳐 보여준다. 이 프로젝트의 핵심은 '근거 있는 예산'이다.
//
// 별도 화면(라우트)을 만들지 않는다. 화면 ID 가 늘면 담당·단계 관리가 어긋난다.
// components/groups 의 시트들과 같은 react-native 기본 Modal 패턴이다.
// 새 라이브러리를 넣지 않는다.
//
// ⚠️ 한 건이 아니라 결산을 마친 n건을 합산한 값이다. (CLAUDE.md 3장, docs/06 §7-6)
//    "지난 도쿄 여행" 처럼 한 건을 가리키면 실제 계산 근거와 어긋난다.
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { CATEGORY_CODE_LABEL, type CategoryCode } from '@/lib/constants/status';

export type PastTripRow = {
  categoryCode: CategoryCode;
  plannedAmount: number;
  actualAmount: number;
  /** 부호 있는 퍼센트. 0 이면 차이가 없다는 뜻이다 */
  diffPercent: number;
  /** 편차가 상한에 걸려 실제로는 더 작게 반영됐는가 */
  clamped: boolean;
  /** 편차가 작아 반영하지 않은 항목인가 */
  ignored: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 집계에 쓴 결산 완료 여행 수 */
  tripCount: number;
  rows: PastTripRow[];
};

function won(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function PastTripSheet({ visible, onClose, tripCount, rows }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[82%] rounded-t-3xl bg-white px-5 pb-9 pt-3"
          onPress={() => {}}
        >
          <View className="mx-auto mb-4 h-1 w-9 rounded-full bg-gray-200" />

          <Text className="text-lg font-bold leading-6 text-gray-900">
            지난 여행이{'\n'}이번 예산에 반영돼요
          </Text>
          <Text className="mt-1.5 text-xs text-gray-500">
            결산을 마친 여행 {tripCount}건을 합산했어요
          </Text>

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {/* 표 머리 */}
            <View className="flex-row border-b border-gray-200 pb-2">
              <Text className="flex-1 text-xs font-medium text-gray-400">항목</Text>
              <Text className="w-[76px] text-right text-xs font-medium text-gray-400">예상</Text>
              <Text className="w-[76px] text-right text-xs font-medium text-gray-400">실제</Text>
              <Text className="w-[56px] text-right text-xs font-medium text-gray-400">차이</Text>
            </View>

            {rows.map((row) => (
              <View
                key={row.categoryCode}
                className="flex-row items-center border-b border-gray-50 py-3"
              >
                <Text className="flex-1 text-xs font-bold text-gray-900">
                  {CATEGORY_CODE_LABEL[row.categoryCode]}
                </Text>
                <Text className="w-[76px] text-right text-xs text-gray-600">
                  {won(row.plannedAmount)}
                </Text>
                <Text className="w-[76px] text-right text-xs text-gray-600">
                  {won(row.actualAmount)}
                </Text>
                <Text
                  className={`w-[56px] text-right text-xs font-bold ${
                    row.diffPercent === 0
                      ? 'text-gray-300'
                      : row.ignored
                        ? 'text-gray-400'
                        : row.diffPercent > 0
                          ? 'text-red-600'
                          : 'text-emerald-700'
                  }`}
                >
                  {row.diffPercent === 0
                    ? '—'
                    : `${row.diffPercent > 0 ? '+' : '−'}${Math.abs(row.diffPercent)}%`}
                </Text>
              </View>
            ))}

            {/*
              무엇을 반영하지 않았는지도 알려준다.
              표에 숫자가 있는데 예산이 안 움직이면 사용자는 계산이 틀렸다고 본다.
            */}
            {rows.some((row) => row.ignored) ? (
              <Text className="mt-3 text-[11px] leading-4 text-gray-400">
                차이가 5%보다 작은 항목은 반영하지 않아요. 그 정도는 예산을 고칠 만한 차이가
                아니에요.
              </Text>
            ) : null}

            {rows.some((row) => row.clamped) ? (
              <Text className="mt-1.5 text-[11px] leading-4 text-gray-400">
                차이가 50%를 넘는 항목은 50%까지만 반영해요. 한 번의 예외가 다음 예산을 통째로
                흔들지 않게 하기 위해서예요.
              </Text>
            ) : null}

            <View className="mt-4 rounded-xl bg-gray-50 p-3.5">
              <Text className="text-xs leading-5 text-gray-600">
                <Text className="font-bold text-gray-900">
                  이번 여행지의 기준 가격으로 예산을 계산한 뒤, 위 차이만큼 항목별로 조정해요.
                </Text>
                {'\n'}
                반영하지 않으면 여행지 기준 가격만으로 계산해요.
              </Text>
            </View>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            className="mt-4 h-12 items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200"
          >
            <Text className="text-sm font-bold text-gray-900">닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
