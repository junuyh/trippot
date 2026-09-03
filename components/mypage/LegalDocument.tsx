import { ScrollView, Text, View } from 'react-native';

/** 문서 한 조항. 제목 + 본문 여러 문단. */
export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

type Props = {
  /** 맨 위 안내. MVP 임시 문서임을 알린다. */
  notice: string;
  sections: LegalSection[];
};

/**
 * 약관·개인정보처리방침처럼 읽기만 하는 문서 화면의 본문.
 *
 * 두 화면의 구조가 같아서 본문만 공통으로 둔다.
 * 헤더는 각 화면이 Stack.Screen 으로 직접 정한다. (제목이 다르다)
 *
 * ⚠️ 데이터가 없는 정적 화면이지만 UI 는 components/ 에 둔다. (CLAUDE.md 9장)
 */
export function LegalDocument({ notice, sections }: Props) {
  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-16 pt-5"
      // 문서가 짧아도 스크롤이 되는지 바로 확인할 수 있게 한다.
      showsVerticalScrollIndicator
    >
      {/* MVP 임시 문서 안내. 본문과 섞이지 않게 배경을 준다. */}
      <View className="rounded-lg bg-pot-visual px-4 py-3">
        <Text className="text-sm leading-5 text-pot-mute">{notice}</Text>
      </View>

      {sections.map((section) => (
        <View key={section.heading} className="mt-7">
          <Text className="text-base font-semibold leading-6 text-pot-ink">
            {section.heading}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text key={paragraph} className="mt-2 text-sm leading-6 text-pot-mute">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
