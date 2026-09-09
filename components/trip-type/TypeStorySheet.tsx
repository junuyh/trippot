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
  /** 캡처·공유 중. 중복 제출 방지 */
  busy: boolean;
};

/**
 * ⚠️ ViewShot ref 를 화면 파일이 들고 있어야 캡처할 수 있어서 forwardRef 다.
 *    캡처 대상은 미리보기로 보여주는 그 카드 그대로다.
 */
export const TypeStorySheet = forwardRef<ViewShot, Props>(function TypeStorySheet(
  { visible, onClose, card, onShare, busy },
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
          <Text className="text-[13px] font-bold text-white">이미지로 공유</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
});
