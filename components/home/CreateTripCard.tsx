// 1-4. 새 여행 만들기 — 홈 맨 아래 카드. (docs/09_IA_v2.md §1-4)
//
// 목록을 다 훑고 내려온 사람이 마지막에 만나는 자리다.
// 상단바에는 만들기 버튼이 없다. 인사말과 같은 줄에 끼어 답답해 보인다는 평을
// 받아 뺐다. (HomeHeader 주석 참조) 그래서 여기가 유일한 진입점이다.
//
// 2026-09-03 여행 준비 홈의 가이드 카드(components/trip-home/TripGuideCards)와
// 같은 짜임으로 맞췄다. 앞서 젤리 버튼으로 만들었더니 유치하다는 평을 받았다.
//   카드   radius 15 · padding 17 · 옅은 컬러 배경
//   제목   16px · weight 800 · letterSpacing -0.5
//   본문   10px · lineHeight 15 · #596272
//   링크   10px · weight 900 · 포인트 컬러 + '→'
//   일러스트 흰 동그라미 안 큰 이모지, 오른쪽 아래
//
// ⚠️ 글 폭을 68% 로 묶는다. 그러지 않으면 오른쪽 일러스트 위로 글자가 올라간다.
//    가이드 카드가 쓰는 값과 같다.
import { Pressable, Text, View } from 'react-native';

import { HOME_CAPTION, HOME_RADIUS, HOME_TINT_SKY } from './palette';

type Props = {
  onPress: () => void;
};

/** 가이드 카드의 '여행 팁' 링크와 같은 파랑. */
const LINK = '#2a5caa';

export function CreateTripCard({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="새 여행 만들기"
      onPress={onPress}
      className="overflow-hidden active:opacity-90"
      style={{
        minHeight: 132,
        borderRadius: HOME_RADIUS.guide,
        padding: 17,
        backgroundColor: HOME_TINT_SKY,
      }}
    >
      <Text
        style={{
          fontSize: 16,
          lineHeight: 20,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: '#111827',
          maxWidth: '68%',
        }}
      >
        다음 여행,{'\n'}지금부터 준비해요
      </Text>
      <Text
        style={{
          fontSize: 10,
          lineHeight: 15,
          color: HOME_CAPTION,
          marginTop: 7,
          maxWidth: '68%',
        }}
      >
        여행지와 일정만 정하면{'\n'}필요한 예산을 계산해 드려요.
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '900', color: LINK, marginTop: 10 }}>
        새 여행 만들기 →
      </Text>

      {/* 일러스트 */}
      <View
        style={{ position: 'absolute', right: 12, bottom: 10, width: 96, height: 96 }}
        className="items-center justify-center"
        pointerEvents="none"
      >
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 41,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 38 }}>🧳</Text>
        </View>
      </View>
    </Pressable>
  );
}
