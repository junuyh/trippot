// ============================================================================
// 여행자보험 제휴 팝업 (BM 1)
//
// 여행자보험 카테고리에 **세부 계획을 추가한 직후** 뜬다.
// "보험을 챙겨야겠다" 고 방금 스스로 결정한 순간이라, 견적을 보여주기에
// 가장 자연스러운 자리다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장)
//
// ============================================================================
// 이미지를 파일로 두지 않고 화면에서 그리는 이유
// ============================================================================
//
//   ① 보험 광고에 실제 도시 사진을 쓰면 그 장소·업체와 제휴가 있다는 오해를
//      부른다. destinationPhoto 의 위키미디어 사진은 라이선스 표시 의무도 있다.
//   ② 목적지마다 국기 색이 달라야 하는데, 목적지 12개 × 이미지 파일은
//      관리가 안 된다. 색만 갈아 끼우면 끝나는 편이 낫다.
//   ③ 원격 이미지는 네트워크가 없으면 안 뜬다. 팝업의 절반이 빈칸이 된다.
//
// ⚠️ 비율은 4:3 고정이다(aspectRatio). 높이를 px 로 박으면 기기 폭에 따라
//    비율이 깨진다.
//
// ⚠️ 새 이벤트를 만들지 않았다. 이 팝업의 성과는 CTA 를 눌러 넘어간 뒤
//    INSURANCE-01 에서 screen_viewed(insurance) → insurance_cta_clicked
//    (placement=budget_detail) 로 이미 잡힌다. (docs/06 v4 §7-7)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import type { CountryTheme } from '@/lib/constants/countryTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** '보험료 비교하기'. 화면 파일이 INSURANCE-01 로 보낸다 */
  onCompare: () => void;
  theme: CountryTheme;
  /** '오사카' */
  destination: string;
  days: number;
  headcount: number;
  /** 가장 저렴한 제휴사의 예상 보험료. 계산이 안 되면 null */
  fromPremium: number | null;
};

export function InsurancePromoModal({
  visible,
  onClose,
  onCompare,
  theme,
  destination,
  days,
  headcount,
  fromPremium,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        바깥을 눌러도 닫힌다. 광고 팝업에서 닫는 방법이 X 하나뿐이면
        사용자가 갇혔다고 느낀다.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/50 px-7"
      >
        {/* 카드 안쪽 터치는 닫기로 새지 않게 막는다 */}
        <Pressable
          onPress={() => {}}
          className="w-full overflow-hidden rounded-3xl bg-white"
        >
          {/* ── 4:3 비주얼 ─────────────────────────────────────────── */}
          <View
            style={{ aspectRatio: 4 / 3, backgroundColor: theme.primarySoft }}
            className="items-center justify-center"
          >
            {/* 국기 색 띠. 배경 전체를 원색으로 채우지 않는다 */}
            <View className="absolute left-0 right-0 top-0 h-1.5 flex-row">
              <View style={{ flex: 1, backgroundColor: theme.stripe[0] }} />
              <View style={{ flex: 1, backgroundColor: theme.stripe[1] }} />
            </View>

            {/* 배경 국가명. 아주 옅게 깔아 여백을 채운다 */}
            {theme.nameEn ? (
              <Text
                numberOfLines={1}
                style={{ color: theme.neutral, opacity: 0.06 }}
                className="absolute text-[64px] font-black tracking-widest"
              >
                {theme.nameEn}
              </Text>
            ) : null}

            <View
              style={{ backgroundColor: theme.primary }}
              className="h-[74px] w-[74px] items-center justify-center rounded-full"
            >
              <Ionicons name="shield-checkmark" size={38} color={theme.onPrimary} />
            </View>

            <Text
              style={{ color: theme.neutral }}
              className="mt-3.5 text-[17px] font-black"
            >
              {destination} {days}일 · {headcount}명
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              이 일정에 맞는 보장을 골라 보세요
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              hitSlop={10}
              className="absolute right-3 top-4 h-7 w-7 items-center justify-center rounded-full bg-black/25"
            >
              <Ionicons name="close" size={15} color="#ffffff" />
            </Pressable>
          </View>

          {/* ── 본문 ───────────────────────────────────────────────── */}
          <View className="gap-3 p-5">
            <Text className="text-[17px] font-bold leading-6 text-gray-900">
              보험료, 지금 한 번에{'\n'}비교해 볼까요?
            </Text>

            <View className="gap-1.5">
              {['제휴사 3곳 예상 보험료를 한 화면에서', '보장 범위를 바꿔 가며 비교', '예산에 잡아 둔 금액과 바로 대조'].map(
                (line) => (
                  <View key={line} className="flex-row items-center gap-1.5">
                    <Ionicons name="checkmark" size={13} color={theme.primary} />
                    <Text className="flex-1 text-xs text-gray-600">{line}</Text>
                  </View>
                ),
              )}
            </View>

            {/*
              금액은 있을 때만 그린다. 일정이 없으면 견적을 못 내는데
              '0원부터' 라고 쓰면 거짓말이 된다.
            */}
            {fromPremium !== null ? (
              <View className="flex-row items-baseline gap-1.5 rounded-xl bg-gray-50 px-3.5 py-3">
                <Text className="text-xs text-gray-500">예상</Text>
                <Text className="text-[19px] font-black text-gray-900">
                  {fromPremium.toLocaleString('ko-KR')}원
                </Text>
                <Text className="text-xs text-gray-500">부터</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="보험료 비교하기"
              onPress={onCompare}
              style={{ backgroundColor: theme.primary }}
              className="mt-0.5 flex-row items-center justify-center gap-1 rounded-xl py-3.5 active:opacity-90"
            >
              <Text
                style={{ color: theme.onPrimary }}
                className="text-[15px] font-bold"
              >
                보험료 비교하고 가입하기
              </Text>
              <Ionicons name="arrow-forward" size={15} color={theme.onPrimary} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음에 하기"
              onPress={onClose}
              className="items-center py-1"
            >
              <Text className="text-xs text-gray-400">다음에 할게요</Text>
            </Pressable>

            {/* ⚠️ 제휴사가 가상이라는 사실을 팝업에서도 밝힌다 */}
            <Text className="text-center text-[10px] text-gray-400">
              제휴사는 서비스 준비 중 예시예요 · 가입 시 트립팟이 수수료를 받아요
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
