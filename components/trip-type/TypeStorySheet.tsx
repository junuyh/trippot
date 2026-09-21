// ============================================================================
// 여행 유형 공유 시트 (TYPE-01)
//
// 미리보기 → 이미지로 공유. 유형 결과지는 데이터로 완성되는 이미지라 사용자가
// 손댈 게 없다. 그래서 스토리 이미지 시트와 달리 편집 기능이 없다.
//
// ⚠️ 카드를 **미리 보여준 뒤** 공유하게 한다. (ShareReportSheet 와 같은 원칙)
// ⚠️ 이 컴포넌트는 supabase 도 track() 도 부르지 않는다. 캡처·공유는 화면 파일이
//    한다. (CLAUDE.md 9장)
// ============================================================================
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { BottomSheet } from '@/components/ui';
import { travelTypeTheme } from '@/lib/constants/travelTypeTheme';

import { TypeStoryCard } from './TypeStoryCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  card: ComponentProps<typeof TypeStoryCard>;
  onShare: () => void;
  /**
   * 이미지 복사 결과 알림. 몇 초 뒤 사라진다. 없으면 그리지 않는다.
   *
   * ⚠️ **시트 안에 그린다.** (2026-09-21 3차) 화면 쪽 토스트로 띄웠더니
   *    이 시트(Modal) 뒤에 가려 보이지 않았다. 사용자가 보고 있는 면은
   *    시트다. 알림도 거기 있어야 한다.
   */
  notice?: string | null;
  /** 캡처·공유 중. 중복 제출 방지 */
  busy: boolean;
};

/**
 * ⚠️ ViewShot ref 를 화면 파일이 들고 있어야 캡처할 수 있어서 forwardRef 다.
 *    캡처 대상은 미리보기로 보여주는 그 카드 그대로다.
 */
export const TypeStorySheet = forwardRef<ViewShot, Props>(function TypeStorySheet(
  { visible, onClose, card, onShare, notice = null, busy },
  ref,
) {
  const theme = travelTypeTheme(card.code);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="내 여행 유형 공유">
      <ScrollView contentContainerClassName="items-center gap-4 px-5 pb-6 pt-1">
        <Text className="self-stretch text-xs leading-5 text-gray-500">
          정산을 확정한 시점의 결과로 만들어요. 스토리에 올리면 친구도 자기 유형을
          확인하러 올 수 있어요.
        </Text>

        {notice ? (
          <View
            className="self-stretch rounded-xl px-3.5 py-2.5"
            style={{ backgroundColor: 'rgba(20, 27, 40, 0.92)' }}
          >
            <Text className="text-[12px] leading-[17px] text-white">{notice}</Text>
          </View>
        ) : null}

        {/* 미리보기 = 캡처 대상 */}
        <View className="overflow-hidden rounded-2xl" style={{ elevation: 4 }}>
          <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
            <TypeStoryCard {...card} />
          </ViewShot>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="여행 유형 이미지로 공유하기"
          disabled={busy}
          onPress={onShare}
          className="h-12 w-full flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-90"
          style={{ backgroundColor: theme.ink === '#FFFFFF' ? theme.bg : theme.ink, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="share-outline" size={16} color="#fff" />
          )}
          <Text className="text-[13px] font-bold text-white">이미지 공유하기</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
});
