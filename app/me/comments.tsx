// ============================================================================
// 작성한 댓글 (MY-01 → 내 커뮤니티 활동 → 작성한 댓글)
//
// ⚠️ 아직 화면과 이동 경로만 있다. **댓글 데이터를 가져오지 않는다.**
//    내가 쓴 댓글을 조회하는 query 가 없고, 댓글 정책도 커뮤니티 담당자와
//    확정되지 않았다. 임의로 query 를 만들거나 가짜 댓글을 넣지 않는다.
//    (community.ts 의 getComments 는 글 하나의 댓글용이라 여기에 맞지 않는다)
//
//    확정되면 posts.tsx · likes.tsx 처럼 load → Loading/Error/Empty/목록 을
//    붙이면 된다. 지금은 빈 상태만 보여준다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 이 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui';

export default function ScreenMyComments() {
  return (
    // 바탕은 작성한 게시글·좋아요와 같은 pot-visual 이다.
    <View className="flex-1 bg-pot-visual">
      <Stack.Screen options={{ title: '작성한 댓글', headerTitleAlign: 'center' }} />

      {/* 두 화면이 쓰는 것과 같은 공통 EmptyState 다. 위치·글자 단·색·여백이
          그쪽과 같아지도록 컴포넌트를 그대로 쓴다. */}
      <EmptyState icon="chatbubble-outline" title="작성한 댓글이 없습니다." />
    </View>
  );
}
