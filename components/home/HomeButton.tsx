import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /** 저장 중 중복 제출 방지. true 면 스피너가 뜨고 눌리지 않는다. (CLAUDE.md 9장) */
  loading?: boolean;
  disabled?: boolean;
};

/**
 * HOME-01 전용 검은 버튼.
 *
 * ⚠️ components/ui/Button 을 쓰지 않는 이유:
 *    공용 Button 의 primary 는 bg-blue-600 이고, 그 파일은 CLAUDE.md 5장 [공유] 다.
 *    거기를 고치면 25개 화면 버튼이 전부 바뀌어 다른 담당자 화면까지 영향을 준다.
 *    버튼 검은색 통일을 HOME-01 범위로 한정하기로 해서 화면 전용으로 둔다.
 *    전체 적용이 확정되면 이 파일을 지우고 공용 Button 을 고치는 쪽이 맞다.
 *
 * 색은 컬러칩의 pot-ink 다. (tailwind.config.js)
 * 모양·크기·상태 처리는 공용 Button 과 같게 맞췄다.
 */
export function HomeButton({ label, loading = false, disabled = false, ...rest }: Props) {
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      className={`w-full flex-row items-center justify-center rounded-xl bg-pot-ink px-5 py-3.5 active:bg-black ${
        off ? 'opacity-40' : ''
      }`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Text className="text-base font-semibold text-white">{label}</Text>
      )}
    </Pressable>
  );
}
