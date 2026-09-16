/**
 * 국가색을 흰색에 섞어 불투명한 파스텔을 만든다.
 *
 * ⚠️ components/home/DestinationSuggestCard · NextTripBanner 의 pastel 과 같은 식이다.
 *    알파를 쓰면 겹친 자리마다 색이 달라져 같은 톤으로 맞출 수 없다.
 *    countryTheme 은 여러 화면이 함께 쓰는 파일이라 그쪽에 올리지 않았다. (CLAUDE.md 5장)
 */
export function pastel(hex: string, ratio: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const mix = (start: number) => {
    const channel = parseInt(value.slice(start, start + 2), 16);
    return Math.round(255 + (channel - 255) * ratio);
  };
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(0))}${to2(mix(2))}${to2(mix(4))}`;
}
