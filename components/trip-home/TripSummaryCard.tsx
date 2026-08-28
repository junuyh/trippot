// TRIP-HOME 여행 요약. 여행지·일정·인원·D-Day.
//
// 준비 홈은 "우리 여행 준비가 지금 어느 정도 됐지?" 에 답하는 화면이다. (docs/02 §3)
// 맨 위에서 이 여행이 무엇인지부터 확인시킨다.
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Text, View } from 'react-native';

import { TRIP_STATUS, TRIP_STATUS_LABEL, type TripStatus } from '@/lib/constants/status';

type Props = {
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  headcount: number;
  status: TripStatus;
  /** 모임 여행이면 모임명. 개인 여행이면 null */
  groupName: string | null;
};

/**
 * 오늘 기준 D-Day 문구.
 *
 * 여행 중이면 며칠째인지, 끝났으면 종료 표시를 낸다.
 * 날짜가 없으면 null 이다. (trips.start_date 는 nullable)
 */
function dDayLabel(startDate: string | null, endDate: string | null): string | null {
  if (!startDate) return null;
  const today = new Date();
  const start = parseISO(startDate);
  const daysToStart = differenceInCalendarDays(start, today);

  if (daysToStart > 0) return `D-${daysToStart}`;
  if (daysToStart === 0) return 'D-DAY';

  if (endDate) {
    const daysToEnd = differenceInCalendarDays(parseISO(endDate), today);
    if (daysToEnd >= 0) return `여행 ${-daysToStart + 1}일째`;
  }
  return '여행 종료';
}

function periodLabel(startDate: string | null, endDate: string | null): string | null {
  if (!startDate || !endDate) return null;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const nights = differenceInCalendarDays(end, start);
  return `${format(start, 'yyyy.MM.dd')} – ${format(end, 'MM.dd')} · ${nights}박 ${nights + 1}일`;
}

export function TripSummaryCard({
  destination,
  startDate,
  endDate,
  headcount,
  status,
  groupName,
}: Props) {
  const dday = dDayLabel(startDate, endDate);
  const period = periodLabel(startDate, endDate);
  const ongoing = status === TRIP_STATUS.PLANNING || status === TRIP_STATUS.TRAVELING;

  return (
    <View className="gap-3 rounded-2xl bg-blue-600 p-5">
      <View className="flex-row items-center justify-between">
        <View className="rounded-full bg-white/20 px-2.5 py-1">
          <Text className="text-xs font-medium text-white">
            {groupName ?? '개인 여행'}
          </Text>
        </View>
        {dday ? (
          <Text className="text-sm font-bold text-white">{ongoing ? dday : TRIP_STATUS_LABEL[status]}</Text>
        ) : null}
      </View>

      <View>
        <Text className="text-2xl font-bold text-white">{destination ?? '여행지 미정'}</Text>
        {period ? <Text className="mt-1 text-sm text-blue-100">{period}</Text> : null}
      </View>

      <View className="flex-row items-center gap-1">
        <Ionicons name="people-outline" size={14} color="#dbeafe" />
        <Text className="text-sm text-blue-100">{headcount}명</Text>
      </View>
    </View>
  );
}
