import { Text, View } from 'react-native';

import { PASSPORT } from './passport';

type Props = {
  title: string;
  children: React.ReactNode;
};

/**
 * 섹션 제목 + 목록.
 *
 * ⚠️ 제목 단은 HOME 의 SectionHeader 와 같다. (16 / 800 / -0.5)
 *    같은 서비스인데 홈은 16, MY 만 18 이면 다른 앱처럼 읽힌다.
 *
 * ⚠️ 목록을 흰 카드로 감싸지 않는다. 하단 전체가 이미 흰 바탕이라
 *    그 위에 흰 카드를 얹으면 경계가 보이지 않으면서 그림자만 남는다.
 *    구분은 divider 가 한다. (MenuRow)
 *
 * 제목 아래 장식선(보라 2px · 회색 hairline)은 두지 않는다. (2026-09-17 MY 최종)
 *    섹션은 여백으로만 가르고, 눌리는 느낌은 MenuRow 의 구분선 · 눌림 배경 · chevron 이 낸다.
 */
export function MenuSection({ title, children }: Props) {
  return (
    <View>
      {/* 제목 색 = 여권의 MY TRAVEL PASSPORT 와 같은 진보라. (2026-09-14) 아래 선과 한 벌이다. */}
      <Text
        style={{
          fontSize: 16,
          lineHeight: 21,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: PASSPORT.accent,
        }}
      >
        {title}
      </Text>
      {/* 제목과 목록 사이는 선이 아니라 여백으로만 가른다. (2026-09-17) 행 사이 구분선은 MenuRow 가 긋는다. */}
      <View className="mt-2">{children}</View>
    </View>
  );
}
