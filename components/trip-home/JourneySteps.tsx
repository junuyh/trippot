// TRIP-HOME 출발까지의 여정 — 5단계.
// HTML 시안(.journey / .steps) 치수를 그대로 옮겼다.
//   카드  padding 18/12/14 · border #edf0f2 · radius 14
//   dot   41px · 지나온 단계는 잉크 채움 · 현재 단계는 포인트 컬러 테두리 + 링
//   아직 먼 단계는 흑백 처리
import { Text, View } from 'react-native';

import type { JourneyStage } from '@/lib/budget/vault';
import type { CountryTheme } from '@/lib/constants/countryTheme';

type Props = {
  stages: JourneyStage[];
  theme: CountryTheme;
};

function shortWon(value: number): string {
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}

export function JourneySteps({ stages, theme }: Props) {
  const nextIndex = stages.findIndex((stage) => !stage.reached);

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#edf0f2',
        borderRadius: 14,
        paddingTop: 18,
        paddingHorizontal: 12,
        paddingBottom: 14,
      }}
    >
      <View className="flex-row">
        {/* 단계를 잇는 선. HTML 은 left/right 10% 에 걸친 한 줄이다 */}
        <View
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: 20,
            height: 1,
            backgroundColor: '#dfe2e6',
          }}
        />

        {stages.map((stage, index) => {
          const done = stage.reached;
          const current = index === nextIndex;
          const dim = !done && !current;

          return (
            <View key={stage.key} className="flex-1 items-center">
              <View
                style={{
                  width: 41,
                  height: 41,
                  borderRadius: 20.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? '#111827' : '#f1f2f3',
                  borderWidth: current ? 2 : 1,
                  borderColor: done ? '#111827' : current ? theme.primary : '#e0e3e6',
                  ...(current
                    ? {
                        backgroundColor: '#fff',
                        // HTML 의 box-shadow 0 0 0 4px rgba(...,.1) 링
                        shadowColor: theme.primary,
                        shadowOpacity: 0.28,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 3,
                      }
                    : null),
                }}
              >
                <Text style={{ fontSize: 20, opacity: dim ? 0.45 : 1 }}>{stage.emoji}</Text>
              </View>

              <Text
                numberOfLines={1}
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  marginTop: 8,
                  color: dim ? '#a1a7b1' : '#111827',
                }}
              >
                {stage.label}
              </Text>
              <Text style={{ fontSize: 8, color: '#9299a5' }}>{shortWon(stage.threshold)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
