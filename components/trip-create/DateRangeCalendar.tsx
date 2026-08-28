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
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  setMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subYears,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

  // 년·월 선택 모드.
  //
  // 다음 달 버튼만 있으면 내년 여행을 계획할 때 버튼을 열몇 번 눌러야 한다.
  // 헤더의 '2026년 8월' 을 누르면 월 그리드로 바뀌고 연도도 함께 옮길 수 있다.
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

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

  // 월 선택 모드에서는 해 단위로 옮긴다. 올해보다 이전으로는 못 간다.
  const canGoPrevYear = !disablePast
    ? true
    : !isBefore(startOfYear(subYears(visibleMonth, 1)), startOfYear(today));

  return (
    <View className="rounded-2xl border border-gray-200 bg-white p-3">
      {/* ── 헤더 ── 년월을 누르면 월 선택으로 바뀐다 ── */}
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={monthPickerOpen ? '이전 해' : '이전 달'}
          disabled={monthPickerOpen ? !canGoPrevYear : !canGoPrev}
          onPress={() =>
            setVisibleMonth((m) => (monthPickerOpen ? subYears(m, 1) : subMonths(m, 1)))
          }
          className={`h-9 w-9 items-center justify-center rounded-full active:bg-gray-100 ${
            (monthPickerOpen ? canGoPrevYear : canGoPrev) ? '' : 'opacity-30'
          }`}
        >
          <Ionicons name="chevron-back" size={20} color="#374151" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            monthPickerOpen ? '달력으로 돌아가기' : '년월 선택'
          }
          accessibilityState={{ expanded: monthPickerOpen }}
          onPress={() => setMonthPickerOpen((open) => !open)}
          className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:bg-gray-100"
        >
          <Text className="text-base font-semibold text-gray-900">
            {monthPickerOpen
              ? format(visibleMonth, 'yyyy년')
              : format(visibleMonth, 'yyyy년 M월')}
          </Text>
          <Ionicons
            name={monthPickerOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#6b7280"
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={monthPickerOpen ? '다음 해' : '다음 달'}
          onPress={() =>
            setVisibleMonth((m) => (monthPickerOpen ? addYears(m, 1) : addMonths(m, 1)))
          }
          className="h-9 w-9 items-center justify-center rounded-full active:bg-gray-100"
        >
          <Ionicons name="chevron-forward" size={20} color="#374151" />
        </Pressable>
      </View>

      {/* ── 월 선택 ── */}
      {monthPickerOpen ? (
        <View className="flex-row flex-wrap py-1">
          {MONTHS.map((month) => {
            const monthDate = startOfMonth(setMonth(visibleMonth, month - 1));
            const disabled = disablePast && isBefore(monthDate, startOfMonth(today));
            const selected = isSameMonth(monthDate, visibleMonth);
            return (
              <View key={month} className="w-1/4 p-1">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${month}월`}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    setVisibleMonth(monthDate);
                    setMonthPickerOpen(false);
                  }}
                  className={`items-center justify-center rounded-xl py-3 ${
                    selected ? 'bg-blue-600' : 'active:bg-gray-100'
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? 'font-bold text-white'
                        : disabled
                          ? 'text-gray-300'
                          : 'text-gray-800'
                    }`}
                  >
                    {month}월
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
      <>

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

      </>
      )}

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
