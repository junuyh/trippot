// ============================================================================
// 약관 (MY-01 설정 → 약관)
//
// ⚠️ MVP 화면 검증용 임시 문서다. 실제 법률 문서가 아니다.
//    회사명·사업자정보·연락처·법적 책임 범위처럼 **확정되지 않은 사실을
//    지어내지 않는다.** 확정 전까지는 자리표시 문구만 둔다.
//
// ⚠️ useScreenView 를 부르지 않는다. SCREENS 에 약관 화면 상수가 없고,
//    events.ts 는 공유 파일이라 임의로 상수를 추가하지 않는다. (CLAUDE.md 8장)
// ============================================================================
import { Stack } from 'expo-router';

import { LegalDocument, type LegalSection } from '@/components/mypage';

const NOTICE = 'MVP 테스트를 위한 임시 약관입니다. 정식 약관은 확정 후 교체됩니다.';

const SECTIONS: LegalSection[] = [
  {
    heading: '제1조 목적',
    paragraphs: [
      '이 약관은 TripPot 이 제공하는 여행 자금 계획 서비스의 이용 조건과 절차를 정하는 것을 목적으로 합니다.',
      '본 문서는 MVP 테스트를 위한 임시 문서이며, 정식 약관이 확정되면 이 내용을 대체합니다.',
    ],
  },
  {
    heading: '제2조 서비스의 제공',
    paragraphs: [
      'TripPot 은 여행 예산 계획, 여행자금 준비, 소비 기록, 결산 기능을 제공합니다.',
      '제공 범위와 세부 기능은 서비스 개선에 따라 달라질 수 있습니다.',
    ],
  },
  {
    heading: '제3조 이용자의 의무',
    paragraphs: [
      '이용자는 서비스를 이용하며 다른 이용자의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.',
      '이용자가 입력한 여행 정보와 예산 정보의 정확성은 이용자 본인이 관리합니다.',
    ],
  },
  {
    heading: '제4조 서비스 변경 및 중단',
    paragraphs: [
      'TripPot 은 서비스의 내용을 변경하거나 일부 기능의 제공을 중단할 수 있습니다.',
      '변경 또는 중단이 있을 경우 서비스 내 공지를 통해 사전에 안내합니다.',
    ],
  },
  {
    heading: '제5조 책임의 제한',
    paragraphs: [
      '본 서비스가 제공하는 예산 추천은 참고 정보이며, 최종 판단과 결정은 이용자 본인에게 있습니다.',
      '구체적인 책임 범위는 정식 약관 확정 시 정해집니다.',
    ],
  },
];

export default function ScreenTerms() {
  return (
    <>
      {/* 다른 상세 화면과 같은 헤더. 뒤로 버튼은 root Stack 이 이미 그린다. */}
      <Stack.Screen options={{ title: '이용약관', headerTitleAlign: 'center' }} />
      <LegalDocument notice={NOTICE} sections={SECTIONS} />
    </>
  );
}
