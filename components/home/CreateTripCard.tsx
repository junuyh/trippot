// 1-4. 새 여행 만들기 — 홈 맨 아래. (docs/09_IA_v2.md §1-4)
//
// 목록을 다 훑고 내려온 사람이 마지막에 만나는 자리다.
// 상단바에는 만들기 버튼이 없다. 인사말과 같은 줄에 끼어 답답해 보인다는 평을
// 받아 뺐다. (HomeHeader 주석 참조) 그래서 여기가 유일한 진입점이다.
//
//   ┌──────────────────────────────────────┐
//   │ ┌───┐  새 여행 만들기            ┌───┐│
//   │ │ 🧳+│  예산부터 일정까지 한 번에  │ → ││
//   │ └───┘  계획해요                  └───┘│
//   └──────────────────────────────────────┘
//
// 시안 그대로다 — 왼쪽에 옅은 라일락 아이콘 타일, 가운데 제목 + 한 줄 설명,
// 오른쪽에 검은 동그라미 화살표.
//
// ⚠️ 지나온 모양들
//    ① 옅은 하늘색 바탕 + 헤드라인 + 캐리어 그림 + 컬러 버튼 → "광고 같다"
//    ② 점선 테두리 흰 카드 → "너무 안 보인다" (홈 바탕도 흰색이라 테두리뿐이었다)
//    ③ 꽉 찬 검은 버튼 한 줄
//    ④ 지금 — 카드 한 장이되 광고 장치는 없다.
//
//    ①이 광고로 읽힌 건 색 때문이 아니라 **권유하는 헤드라인 + 분위기 그림**
//    때문이었다. 지금은 제목이 곧 할 일("새 여행 만들기")이고, 그림은 분위기가
//    아니라 그 동작을 가리키는 아이콘이다. 오른쪽 화살표가 누를 곳임을 알린다.
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { HOME_RADIUS } from './palette';

type Props = {
  onPress: () => void;
};

const INK = '#111827';
const LABEL = '#9aa3af';
const LINE = '#eef0f3';
/** 아이콘 타일 바탕. 옅은 라일락. */
const TILE_BG = '#EFEDFB';
const TILE = 52;
const ARROW = 36;

export function CreateTripCard({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="새 여행 만들기"
      onPress={onPress}
      className="flex-row items-center bg-white active:opacity-90"
      style={{
        borderRadius: HOME_RADIUS.ticket + 2,
        borderWidth: 1,
        borderColor: LINE,
        padding: 14,
        shadowColor: INK,
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {/* 아이콘 타일. 캐리어에 작은 + 를 겹쳐 '새로 만든다' 를 가리킨다. */}
      <View
        style={{
          width: TILE,
          height: TILE,
          borderRadius: 16,
          backgroundColor: TILE_BG,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="briefcase-outline" size={23} color={INK} />
        <View
          style={{
            position: 'absolute',
            right: 9,
            bottom: 9,
            backgroundColor: TILE_BG,
            borderRadius: 8,
          }}
        >
          <Ionicons name="add" size={13} color={INK} />
        </View>
      </View>

      <View className="ml-3.5 flex-1 pr-2">
        <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.4, color: INK }}>
          새 여행 만들기
        </Text>
        <Text style={{ fontSize: 11.5, lineHeight: 16, color: LABEL, marginTop: 2 }}>
          예산부터 일정까지 한 번에 계획해요
        </Text>
      </View>

      {/* 화살표. 장식이 아니라 '누르면 넘어간다' 는 표시다.
          카드 전체가 누름 영역이라 이 동그라미는 따로 누를 수 없다. */}
      <View
        pointerEvents="none"
        style={{
          width: ARROW,
          height: ARROW,
          borderRadius: ARROW / 2,
          backgroundColor: INK,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}
