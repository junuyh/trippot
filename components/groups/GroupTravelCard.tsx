import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { formatDateRange, formatMemberCount } from './format';
import type { GroupTravelCardData, GroupTripItem } from './types';

/** 카드에 그리는 진행 중 여행 최대 건수. 초과분은 둘째 줄 끝에 '외 N건' 으로 접는다. */
const MAX_VISIBLE_TRIPS = 2;

/**
 * 진행 중 여행 한 줄의 높이(px).
 * 줄마다 높이를 고정해야 글꼴 기본 행간에 흔들리지 않는다.
 */
const TRIP_LINE_HEIGHT = 20;

/**
 * 진행 중 여행 영역의 고정 높이. 항상 2줄분이다.
 *
 * 여행이 0건이든 6건이든 이 높이는 변하지 않는다.
 * 이 고정이 "같은 화면의 모든 카드는 같은 높이" 정책의 핵심이다.
 */
const TRIP_SLOT_HEIGHT = TRIP_LINE_HEIGHT * MAX_VISIBLE_TRIPS;

type Props = {
  group: GroupTravelCardData;
  /** 일반 모드에서 카드를 눌렀을 때. 편집 모드에서는 불리지 않는다. 어디로 갈지는 화면이 종류를 보고 정한다. */
  onPress: (card: GroupTravelCardData) => void;

  // ── 편집 모드 ────────────────────────────────────────────────────────
  editMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (groupId: string) => void;
  /** 저장 중. Chevron 을 잠근다. (NFR-005 중복 실행 방지) */
  actionsDisabled?: boolean;
};

/** 한 줄짜리 여행 표시. 여행지는 말줄임되고 날짜는 끝까지 남는다. */
function TripLine({ trip, suffix }: { trip: GroupTripItem; suffix?: string }) {
  return (
    <View style={{ height: TRIP_LINE_HEIGHT }} className="flex-row items-center">
      <Text numberOfLines={1} className="shrink text-pot-ink" style={{ fontSize: 13.5, lineHeight: 20 }}>
        {trip.destination ?? '여행지 미정'}
      </Text>
      <Text numberOfLines={1} className="shrink-0 text-pot-mute" style={{ fontSize: 12, lineHeight: 20 }}>
        {` · ${formatDateRange(trip.startDate, trip.endDate)}${suffix ?? ''}`}
      </Text>
    </View>
  );
}

/**
 * 모임 카드. (docs/09_IA_v1.md §3-1)
 *
 * 모임명 · 멤버(인원 수) · 진행 중인 여행 · 지난 여행 수 를 담는다.
 *
 * 일반 모드 — 카드를 누르면 모임 상세로 간다. (docs/03 POL-NAV-001)
 * 편집 모드 — 상세 이동을 막고 선택 토글로 바꾼다.
 *
 * ── 높이 정책 ─────────────────────────────────────────────────────────────
 * 폭은 부모가 정하고, 높이는 콘텐츠와 무관하게 정해진다.
 *   - 모든 텍스트가 1줄 고정 + 명시적 leading
 *   - 진행 중 여행 영역은 건수와 무관하게 TRIP_SLOT_HEIGHT 고정
 *   - 편집 UI(선택 원)는 제목 줄 오른쪽 배지 자리에 들어가 세로에 영향이 없다
 * 따라서 편집 모드로 들어가도 카드 크기가 그대로다.
 */
export function GroupTravelCard({
  group,
  onPress,
  editMode = false,
  selected = false,
  onToggleSelect,
  actionsDisabled = false,
}: Props) {
  const { ongoingTrips, pastTripCount } = group;

  const visibleTrips = ongoingTrips.slice(0, MAX_VISIBLE_TRIPS);
  const hiddenCount = ongoingTrips.length - visibleTrips.length;

  // 개인 여행은 숨길 수 없다. 숨김 설정이 group_id 기준이라 대상이 없다.
  const selectable = group.kind === 'GROUP';

  function handlePress() {
    if (editMode) {
      if (selectable) onToggleSelect?.(group.groupId);
      return;
    }
    onPress(group);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        editMode
          ? selectable
            ? `${group.name} ${selected ? '선택 해제' : '선택'}`
            : `${group.name} (숨길 수 없음)`
          : group.kind === 'GROUP'
            ? `${group.name} 모임 상세로 이동`
            : `${group.name} 상세로 이동`
      }
      accessibilityState={{ selected: editMode && selectable ? selected : undefined }}
      onPress={handlePress}
      // 카드 껍데기는 MyTripCard · 내 여행 CountCard 와 같은 값이다. (2xl · 흰색 · 같은 그림자)
      // 같은 앱의 카드가 화면마다 다른 모서리·그림자를 쓰면 다른 제품처럼 읽힌다.
      className="rounded-2xl bg-white px-4 py-3.5 active:opacity-80"
      style={{
        shadowColor: '#111827',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View>
        {/*
          제목 줄 — 이름은 **왼쪽 정렬**, 오른쪽에 종류 배지.

          ⚠️ 가운데 정렬을 버렸다. (2026-09-13) 앱의 다른 카드(MyTripCard ·
             GroupAccountList · 상세의 Section 제목)가 전부 왼쪽 정렬이라
             이 카드만 가운데면 다른 제품처럼 읽혔다.

          ⚠️ 편집 모드로 들어가도 이름이 좌우로 움직이지 않는다.
             선택 원은 왼쪽에 끼워 넣지 않고 **오른쪽 배지 자리에 대신** 놓는다.
             왼쪽에 두면 이름이 원 폭만큼 밀린다. 오른쪽은 어차피 이름이
             shrink 되는 쪽이라 위치가 흔들리지 않는다.

          ⚠️ 높이 23 고정 — 제목 줄이 늘어나면 카드 높이 정책이 깨진다.
        */}
        <View className="flex-row items-center" style={{ height: 23 }}>
          <Text
            numberOfLines={1}
            className="flex-1 font-black text-pot-ink"
            style={{ fontSize: 16.5, lineHeight: 23, letterSpacing: -0.5 }}
          >
            {group.name}
          </Text>

          {editMode && selectable ? (
            <View className="ml-3 justify-center">
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={selected ? '#2563eb' : '#d1d5db'}
              />
            </View>
          ) : (
            // 종류 배지. MyTripCard 의 상태 배지(pot-visual · 10~11 · bold)와 같은 언어다.
            // 개인 여행은 모임원이 없어 인원 대신 종류('개인')를 적는다.
            // 제목이 이미 '개인 여행' 이라 배지까지 같은 말이면 두 번 읽힌다.
            // 아이콘은 글자를 돕는 정도(faint)로만 둔다.
            <View className="ml-3 flex-row items-center rounded-full bg-pot-visual py-0.5 pl-1.5 pr-2">
              <Ionicons
                name={group.kind === 'GROUP' ? 'people-outline' : 'person-outline'}
                size={11}
                color="#8B94A2"
              />
              <Text className="ml-1 font-bold text-pot-mute" style={{ fontSize: 11 }}>
                {group.kind === 'GROUP' ? formatMemberCount(group.memberCount) : '개인'}
              </Text>
            </View>
          )}
        </View>

        {/* 구분선은 마이페이지 MenuRow 와 같은 #F1F3F6. pot-line 은 카드 안에서는 진했다. */}
        <View
          className="mt-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: '#F1F3F6' }}
        >
          <Text className="font-semibold text-pot-faint" style={{ fontSize: 11, lineHeight: 15 }}>
            준비 중인 여행
          </Text>

          <View style={{ height: TRIP_SLOT_HEIGHT }} className="mt-1">
            {visibleTrips.length === 0 ? (
              <View style={{ height: TRIP_LINE_HEIGHT }} className="justify-center">
                <Text className="text-pot-faint" style={{ fontSize: 13, lineHeight: 20 }}>
                  준비 중인 여행이 없어요.
                </Text>
              </View>
            ) : (
              visibleTrips.map((trip, index) => {
                const isLastVisible = index === visibleTrips.length - 1;
                const suffix =
                  isLastVisible && hiddenCount > 0 ? ` · 외 ${hiddenCount}건` : undefined;
                return <TripLine key={trip.tripId} trip={trip} suffix={suffix} />;
              })
            )}
          </View>

          {/* 지난 여행 수. 보조 정보라 가장 약한 단(faint · 11.5)이다. 숫자만 tabular. */}
          <Text
            className="mt-2.5 text-pot-faint"
            style={{ fontSize: 11.5, lineHeight: 16, fontVariant: ['tabular-nums'] }}
          >
            {`지난 여행 ${pastTripCount}회`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
