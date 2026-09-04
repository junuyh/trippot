import { Text, View } from 'react-native';

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
 * ⚠️ 제목 아래 굵은 검정선을 두지 않는다. 홈·여행 준비 화면 어디에도 없는
 *    장치라 MY 만 튀었다.
 */
export function MenuSection({ title, children }: Props) {
  return (
    <View>
      <Text
        className="mb-1 text-pot-ink"
        style={{ fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: -0.5 }}
      >
        {title}
      </Text>

      <View>{children}</View>
    </View>
  );
}
