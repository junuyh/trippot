// TRIP-02 일정 선택. 시작일~종료일을 달력 하나에서 고른다.
//
// 외부 날짜 피커 패키지를 쓰지 않는다. date-fns 만으로 그린다.
// 새 네이티브 의존성을 추가하면 Expo Go 번들 여부에 따라 팀 전체가
// dev build 로 전환해야 할 수 있다. 그 리스크를 지지 않는다.
//
// 값은 'yyyy-MM-dd' 문자열로 주고받는다. trips.start_date / end_date 가
// date 타입이라 시각을 담지 않는다. (CLAUDE.md 9장)
import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  /** 'yyyy-MM-dd' */
  startDate: string | null;
  endDate: string | null;
  onChange: (next: { startDate: string | null; endDate: string | null }) => void;
  /** 과거 날짜 선택을 막는다. 기본 true */
  disablePast?: boolean;
};

const KEY = 'yyyy-MM-dd';

export function DateRangeCalendar({
  startDate,
  endDate,
  onChange,
  disablePast = true,
}: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const start = startDate ? parseISO(startDate) : null;
  const end = endDate ? parseISO(endDate) : null;

  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(start ?? today),
  );

  // 달력 격자. 앞뒤로 빈 칸을 두지 않고 이전·다음 달 날짜로 채운다.
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(visibleMonth)),
        end: endOfWeek(endOfMonth(visibleMonth)),
      }),
    [visibleMonth],
  );

  function handlePress(day: Date) {
    const key = format(day, KEY);

    // 시작일이 없거나 이미 범위가 완성됐으면 새 범위를 시작한다.
    if (!start || (start && end)) {
      onChange({ startDate: key, endDate: null });
      return;
    }
    // 시작일보다 앞을 누르면 그날이 새 시작일이 된다. 에러로 막지 않는다.
    if (isBefore(day, start)) {
      onChange({ startDate: key, endDate: null });
      return;
    }
    onChange({ startDate: format(start, KEY), endDate: key });
  }

  const canGoPrev = !disablePast
    ? true
    : !isBefore(startOfMonth(subMonths(visibleMonth, 1)), startOfMonth(today));

  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-3">
      {/* ── 월 이동 ── */}
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          disabled={!canGoPrev}
          onPress={() => setVisibleMonth((m) => subMonths(m, 1))}
          className={`h-9 w-9 items-center justify-center rounded-full active:bg-gray-100 ${
            canGoPrev ? '' : 'opacity-30'
          }`}
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>

        <Text className="text-base font-semibold text-gray-900">
          {format(visibleMonth, 'yyyy년 M월')}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </Pressable>
      </View>

      {/* ── 요일 ── */}
      <View className="flex-row">
        {WEEKDAYS.map((label, index) => (
          <View key={label} className="flex-1 items-center py-1.5">
            <Text
              className={`text-xs font-medium ${
                index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── 날짜 ── */}
      <View className="flex-row flex-wrap">
        {days.map((day) => {
          const outside = !isSameMonth(day, visibleMonth);
          const past = disablePast && isBefore(day, today);
          const disabled = past;

          const isStart = start ? isSameDay(day, start) : false;
          const isEnd = end ? isSameDay(day, end) : false;
          const inRange =
            start && end ? isBefore(start, day) && isBefore(day, end) : false;
          const edge = isStart || isEnd;

          return (
            <View key={day.toISOString()} className="w-[14.28%] items-center py-0.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={format(day, 'M월 d일')}
                accessibilityState={{ selected: edge || inRange, disabled }}
                disabled={disabled}
                onPress={() => handlePress(day)}
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  edge ? 'bg-blue-600' : inRange ? 'bg-blue-100' : 'active:bg-gray-100'
                }`}
              >
                <Text
                  className={`text-sm ${
                    edge
                      ? 'font-bold text-white'
                      : disabled
                        ? 'text-gray-300'
                        : outside
                          ? 'text-gray-300'
                          : inRange
                            ? 'font-medium text-blue-700'
                            : 'text-gray-800'
                  }`}
                >
                  {format(day, 'd')}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* ── 안내 ── */}
      <Text className="mt-2 px-1 text-xs text-gray-400">
        {!start
          ? '가는 날을 선택해 주세요.'
          : !end
            ? '오는 날을 선택해 주세요.'
            : '날짜를 다시 누르면 새로 선택할 수 있어요.'}
      </Text>
    </View>
  );
}
