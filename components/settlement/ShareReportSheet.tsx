// ============================================================================
// 정산 리포트 공유 시트 (SETTLE-01)
//
// 한 버튼에서 두 가지를 고른다.
//
//   영수증(이미지) 카톡·인스타에 올리는 세로 한 장. 자랑용
//   명세서(PDF)    모임원에게 보내는 증빙. 카테고리 표 + 거래 내역
//
// ⚠️ 둘을 한 버튼에 묶지 않는다. 쓰임이 완전히 다르다. 명세서를 인스타에
//    올리지 않고, 카드로 "내 돈 어디 갔냐" 에 답할 수 없다.
//
// ⚠️ 카드를 **미리 보여준 뒤** 저장하게 한다. 공유는 되돌릴 수 없는 행동이라,
//    무엇이 나가는지 모르고 누르게 하면 안 된다.
//
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 화면 파일이 부른다.
//    (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { BottomSheet } from '@/components/ui';
import type { CountryTheme } from '@/lib/constants/countryTheme';
import type { DestinationCode } from '@/lib/constants/destinations';
import type { SettlementReport } from '@/lib/settlement/report';

import { SettlementCard } from './SettlementCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  report: SettlementReport;
  theme: CountryTheme;
  flag: string;
  nameEn: string;
  countryKo: string | null;
  destinationCode: DestinationCode | null;
  airportCode: string | null;
  onShareCard: () => void;
  onSharePdf: () => void;
  /** 'card' | 'pdf' | null. 만드는 중인 것 */
  busy: 'card' | 'pdf' | null;
};

/**
 * ⚠️ ViewShot ref 를 화면 파일이 들고 있어야 캡처할 수 있어서 forwardRef 다.
 *    캡처 대상은 **미리보기로 보여주는 그 카드 그대로**다. 따로 숨겨 둔 사본을
 *    캡처하면 보이는 것과 나가는 것이 달라질 수 있다.
 */
export const ShareReportSheet = forwardRef<ViewShotRef, Props>(function ShareReportSheet(
  { visible, onClose, report, theme, flag, nameEn, countryKo, destinationCode, airportCode, onShareCard, onSharePdf, busy },
  ref,
) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="정산 리포트 공유">
      <ScrollView contentContainerClassName="items-center gap-5 px-5 pb-6 pt-1">
        <Text className="self-stretch text-xs leading-5 text-gray-500">
          확정된 값으로 만들어요. 나중에 예산을 고쳐도 이미 공유한 문서는 바뀌지
          않아요.
        </Text>

        {/* 미리보기 = 캡처 대상 */}
        <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
          <SettlementCard
            report={report}
            theme={theme}
            flag={flag}
            nameEn={nameEn}
            countryKo={countryKo}
            destinationCode={destinationCode}
            airportCode={airportCode}
          />
        </ViewShot>

        <View className="w-full gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="정산 영수증 이미지로 공유하기"
            disabled={busy !== null}
            onPress={onShareCard}
            className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-90"
            style={{ backgroundColor: theme.primary, opacity: busy ? 0.6 : 1 }}
          >
            {busy === 'card' ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Ionicons name="image-outline" size={16} color={theme.onPrimary} />
            )}
            <Text className="text-[13px] font-bold" style={{ color: theme.onPrimary }}>
              이 영수증 이미지로 공유
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="정산 명세서 PDF로 공유하기"
            disabled={busy !== null}
            onPress={onSharePdf}
            className="h-12 flex-row items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white active:bg-gray-50"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy === 'pdf' ? (
              <ActivityIndicator size="small" color="#3d4654" />
            ) : (
              <Ionicons name="document-text-outline" size={16} color="#3d4654" />
            )}
            <Text className="text-[13px] font-bold text-gray-700">
              정산 명세서 PDF로 공유
            </Text>
          </Pressable>
        </View>

        <View className="w-full gap-1 rounded-xl bg-gray-50 p-3.5">
          <Text className="text-[11px] text-gray-500">
            <Text className="font-bold">영수증 이미지</Text>는 여행 결과를 한 장으로
            보여줘요. 카톡·인스타에 올리기 좋아요.
          </Text>
          <Text className="text-[11px] text-gray-500">
            <Text className="font-bold">명세서</Text>는 카테고리별 계획·실제와 거래
            내역까지 담아요. 함께 간 사람에게 보내기 좋아요.
          </Text>
        </View>
      </ScrollView>
    </BottomSheet>
  );
});
