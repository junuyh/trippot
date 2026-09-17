// ============================================================================
// 배너·목록이 문자열로 받은 아이콘을 알맞은 셋으로 그린다 (2026-09-18)
//
// lib/trip/tripActions 는 **순수 함수**라 @expo/vector-icons 타입을 물고 오지
// 않는다. 그래서 아이콘이 문자열로 건너온다. 지금까지는 그 문자열을 그대로
// Ionicons 에 넘겼는데, 셋이 하나뿐이라 가능했던 일이다.
//
// ⚠️ 이 앱의 아이콘은 거의 전부 Ionicons 다. **다른 셋은 필요할 때만 쓴다.**
//    접두어가 없으면 Ionicons 다 — 기존 값이 그대로 돈다.
//
//      'person-add-outline'            Ionicons (접두어 없음)
//      'mci:account-clock-outline'     MaterialCommunityIcons
//
// ⚠️ 왜 셋을 늘렸나 — '승인 대기' 에 맞는 글리프가 Ionicons 에 없다.
//    사람이 기다리고 있고 내 결정이 남았다는 상태인데, Ionicons 에는 사람과
//    시계(또는 사람과 체크)를 함께 그린 아이콘이 없다. 체크 동그라미
//    (checkmark-circle-outline)로 갔다가 **"이미 승인됨" 으로 읽힌다**는
//    지적을 받았다. 아직 안 한 일에 완료 표시를 단 셈이었다. (2026-09-18 다빈)
//
// ⚠️ 접두어를 늘릴 때는 **정말 Ionicons 에 없는 경우인지** 먼저 본다. 셋이
//    늘어날수록 선 굵기가 섞여 배너들이 한 벌로 안 읽힌다.
// ============================================================================
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  /** 'person-add-outline' 또는 'mci:account-clock-outline' */
  name: string;
  size: number;
  color: string;
  style?: React.ComponentProps<typeof Ionicons>["style"];
};

export function ActionIcon({ name, size, color, style }: Props) {
  if (name.startsWith("mci:")) {
    return (
      <MaterialCommunityIcons
        name={name.slice(4) as never}
        size={size}
        color={color}
        style={style}
      />
    );
  }
  return <Ionicons name={name as never} size={size} color={color} style={style} />;
}
