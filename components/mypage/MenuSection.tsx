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
 * 제목 아래 굵은 보라 장식선은 뺐다. (2026-09-17 MY 최종) 대신 목록의 위·아래에
 *    hairline(pot-line) 을 둬 "눌리는 목록 한 덩어리" 로 읽히게 한다. 카드로 띄우지 않는다.
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
      <View
        className="mt-3"
        style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E5E8EC' }}
      >
        {children}
      </View>
    </View>
  );
}
