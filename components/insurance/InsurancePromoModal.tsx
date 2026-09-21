// ============================================================================
// 여행자보험 제휴 팝업 (BM 1)
//
// 시안: docs/Team/tripPot/html/TripPot — 일본 국기색 여행자보험.html (.promo)
//
// 여행자보험 카테고리에 **세부 계획을 추가한 직후** 뜬다.
// "보험을 챙겨야겠다" 고 방금 스스로 결정한 순간이라, 견적을 보여주기에
// 가장 자연스러운 자리다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장)
//
// ⚠️ 비율은 4:3 고정이다(aspectRatio). 높이를 px 로 박으면 기기 폭에 따라
//    비율이 깨진다. 위쪽 43% 가 비주얼, 나머지가 본문이다.
//
// ⚠️ 이미지를 파일로 두지 않고 화면에서 그린다.
//    ① 보험 광고에 실제 도시 사진을 쓰면 그 장소와 제휴가 있다는 오해를 부른다
//    ② 목적지 12개 × 이미지 파일은 관리가 안 된다. 색만 갈아 끼우는 편이 낫다
//    ③ 원격 이미지는 네트워크가 없으면 팝업 절반이 빈칸이 된다
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
  /**
   * 완전히 닫힌 뒤에 불린다. 이 팝업이 닫히고 나서 다른 시트를 열어야 할 때
   * 쓴다 — iOS 는 Modal 이 닫히는 도중에 다른 Modal 을 열면 두 번째가 안 뜬다.
   */
  onDismiss?: () => void;
  onClose: () => void;
  /** '견적 확인하기'. 화면 파일이 INSURANCE-01 로 보낸다 */
  onCompare: () => void;
  theme: CountryTheme;
  /** '오사카' */
  destination: string;
  days: number;
  headcount: number;
  /** 예산에 잡아 둔 여행자보험 금액. 없으면 그 칸을 그리지 않는다 */
  budgetAmount: number | null;
  /** 가장 저렴한 제휴사의 예상 보험료. 계산이 안 되면 null */
  fromPremium: number | null;
  /** 비교할 견적 수 */
  quoteCount: number;
};

function won(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function InsurancePromoModal({
  visible,
  onDismiss,
  onClose,
  onCompare,
  theme,
  destination,
  days,
  headcount,
  budgetAmount,
  fromPremium,
  quoteCount,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      {/*
        바깥을 눌러도 닫힌다. 광고 팝업에서 닫는 방법이 X 하나뿐이면
        사용자가 갇혔다고 느낀다.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/45 px-7"
      >
        {/* 카드 안쪽 터치는 닫기로 새지 않게 막는다 */}
        <Pressable
          onPress={() => {}}
          className="w-full max-w-[348px] overflow-hidden rounded-[19px] bg-white"
        >
          {/* ── 4:3 비주얼 ─────────────────────────────────────────── */}
          <View style={{ aspectRatio: 4 / 3 }}>
            <View className="h-[43%] overflow-hidden bg-white px-[18px] pt-[17px]">
              {/*
                오른쪽 위 국기색 원. 시안의 유일한 큰 색면이다.
                ⚠️ 방패와 겹치지 않게 모서리 밖으로 더 밀어낸다. 겹치면 같은
                   색끼리 뭉쳐서 방패가 안 보인다.
              */}
              <View
                className="absolute h-[132px] w-[132px] rounded-full"
                style={{ backgroundColor: theme.primary, right: -46, top: -52 }}
              />

              <Text
                className="text-[10px] font-extrabold tracking-[1.2px]"
                style={{ color: theme.primary }}
              >
                TRAVEL SAFETY CHECK
              </Text>

              <View className="mt-3.5 flex-row items-center">
                <Text
                  className="flex-1 text-[20px] font-bold leading-6"
                  style={{ color: theme.neutral }}
                >
                  여행자보험도{'\n'}예산 안에서 준비해요.
                </Text>

                {/*
                  방패. clip-path 가 없으니 둥근 사각형으로 대신한다.
                  ⚠️ 흰 바탕이다. 뒤의 국기색 원 위에 걸쳐도 형태가 남는다.
                */}
                <View
                  className="h-[56px] w-[50px] items-center justify-center rounded-2xl border"
                  style={{ backgroundColor: '#ffffff', borderColor: theme.primarySoft }}
                >
                  <Ionicons name="shield-checkmark" size={26} color={theme.primary} />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="닫기"
                onPress={onClose}
                hitSlop={10}
                className="absolute right-3 top-3 h-[29px] w-[29px] items-center justify-center rounded-full bg-white/90"
              >
                <Ionicons name="close" size={16} color="#101828" />
              </Pressable>
            </View>

            {/* ── 본문 ─────────────────────────────────────────────── */}
            <View className="flex-1 justify-between px-[18px] pb-4 pt-3.5">
              <Text className="text-[11px] leading-4 text-gray-500">
                {destination} {days}일 · {headcount}명 조건으로 비교 가능한 보험료를
                찾았어요.
              </Text>

              {/*
                예산이 없으면 왼쪽 칸을 그리지 않는다. '0원' 이라고 쓰면
                예산을 0으로 잡았다는 뜻이 되어 사실과 다르다.
              */}
              <View className="my-3 flex-row border-y border-gray-200 py-2.5">
                {budgetAmount !== null ? (
                  <View className="flex-1">
                    <Text className="text-[9px] text-gray-400">잡아둔 예산</Text>
                    <Text className="mt-1 text-[13px] font-bold text-gray-900">
                      {won(budgetAmount)}
                    </Text>
                  </View>
                ) : null}
                <View
                  className={`flex-1 ${budgetAmount !== null ? 'border-l border-gray-200 pl-3' : ''}`}
                >
                  <Text className="text-[9px] text-gray-400">가장 저렴한 견적</Text>
                  <Text className="mt-1 text-[13px] font-bold text-gray-900">
                    {fromPremium !== null ? `${won(fromPremium)}부터` : '—'}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-1.5">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="나중에 하기"
                  onPress={onClose}
                  className="h-10 flex-[0.7] items-center justify-center rounded-lg border border-gray-200 bg-white active:bg-gray-50"
                >
                  <Text className="text-[11px] font-bold text-gray-500">나중에</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${quoteCount}개 견적 확인하기`}
                  onPress={onCompare}
                  className="h-10 flex-[1.6] items-center justify-center rounded-lg active:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Text
                    className="text-[11px] font-black"
                    style={{ color: theme.onPrimary }}
                  >
                    {quoteCount}개 견적 확인하기 →
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
