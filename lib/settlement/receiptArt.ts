// ============================================================================
// 정산 영수증 가운데 그림 — 고르기 + PDF 용 SVG 문자열
//
// 영수증 이미지(SettlementCard)와 명세서 PDF(reportHtml)가 **같은 그림**을 쓴다.
// 세 가지 중 하나다. 전부 선(잉크 한 색)으로만 그린다.
//   outline   국가 실루엣 + 도시 핀       (countryOutline · 국가를 알 때만)
//   landmark  랜드마크 (후지산·에펠탑…)   (countryLandmark · 모르면 언덕과 해)
//   route     ICN → 도착 공항 비행 경로   (공항 코드가 있을 때만)
//
// ⚠️ "랜덤" 이지만 **여행마다 고정**이다. 목적지+출발일을 시드로 쓴다.
//    같은 여행의 영수증이 열 때마다 다른 그림이면 공유한 이미지와 PDF 가
//    서로 다른 그림을 갖게 된다. 쓸 수 없는 그림은 후보에서 빼고 뽑는다.
//
// ⚠️ 순수 함수다. RN 컴포넌트는 같은 좌표를 react-native-svg 로 그리고,
//    여기서는 PDF 에 넣을 SVG 문자열만 만든다. 외부 리소스를 쓰지 않는다.
// ============================================================================
import { countryLandmark } from '@/lib/constants/countryLandmark';
import { CITY_PIN, countryOutline } from '@/lib/constants/countryOutline';
import type { DestinationCode } from '@/lib/constants/destinations';

export type ReceiptArtVariant = 'outline' | 'landmark' | 'route';

export type ReceiptArtInput = {
  countryKo: string | null;
  destinationCode: DestinationCode | null;
  airportCode: string | null;
};

/** 문자열 → 0 이상 정수. 흔한 djb2. 암호용이 아니라 고르기용이다 */
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * 여행마다 고정된 그림을 고른다.
 * @param seed 목적지 + 출발일처럼 여행을 특정하는 문자열
 */
export function pickReceiptArt(seed: string, input: ReceiptArtInput): ReceiptArtVariant {
  const candidates: ReceiptArtVariant[] = [];
  if (countryOutline(input.countryKo)) candidates.push('outline');
  // 랜드마크는 국가를 몰라도 기본 그림이 있어 항상 후보다
  candidates.push('landmark');
  if (input.airportCode) candidates.push('route');
  return candidates[hash(seed) % candidates.length];
}

// ── PDF 용 SVG ───────────────────────────────────────────────────────────────

const INK = '#141b28';

/**
 * 그림 상자 안에 들어갈 SVG. 상자 크기는 px 단위로 받는다.
 * 폰트는 상속하므로 <text> 에 family 를 따로 주지 않는다.
 */
export function receiptArtSvg(
  variant: ReceiptArtVariant,
  input: ReceiptArtInput,
  width: number,
  height: number,
): string {
  const outline = countryOutline(input.countryKo);
  const pin = input.destinationCode ? CITY_PIN[input.destinationCode] : null;

  if (variant === 'outline' && outline) {
    const [, , vw, vh] = outline.viewBox.split(' ').map(Number);
    const scale = Math.min((width * 0.84) / vw, (height * 0.84) / vh);
    const ox = (width - vw * scale) / 2;
    const oy = (height - vh * scale) / 2;
    const paths = outline.paths
      .map(
        (d) =>
          `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${(1.1 / scale).toFixed(3)}" stroke-linejoin="round"/>`,
      )
      .join('');
    const pinSvg = pin
      ? `<circle cx="${pin.x}" cy="${pin.y}" r="${(5.5 / scale).toFixed(3)}" fill="none" stroke="${INK}" stroke-width="${(1.4 / scale).toFixed(3)}"/><circle cx="${pin.x}" cy="${pin.y}" r="${(2 / scale).toFixed(3)}" fill="${INK}"/>`
      : '';
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${paths}${pinSvg}</g></svg>`;
  }

  if (variant === 'landmark' || variant === 'outline') {
    const mark = countryLandmark(input.countryKo);
    const scale = Math.min((width * 0.8) / 100, (height * 0.8) / 60);
    const ox = (width - 100 * scale) / 2;
    const oy = (height - 60 * scale) / 2;
    const sw = (1.3 / scale).toFixed(3);
    const paths = mark.paths
      .map((p) => `<path d="${p.d}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`)
      .join('');
    const circles = (mark.circles ?? [])
      .map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${INK}" stroke-width="${sw}"/>`)
      .join('');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${paths}${circles}<line x1="-4" y1="60" x2="104" y2="60" stroke="${INK}" stroke-width="${sw}"/></g></svg>`;
  }

  // route
  const y = height * 0.62;
  const x1 = 26;
  const x2 = width - 26;
  const cx = (x1 + x2) / 2;
  const top = height * 0.22;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <path d="M ${x1} ${y} Q ${cx} ${top - 30} ${x2} ${y}" fill="none" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 4"/>
  <circle cx="${x1}" cy="${y}" r="3.5" fill="none" stroke="${INK}" stroke-width="1.4"/>
  <circle cx="${x2}" cy="${y}" r="3.5" fill="${INK}"/>
  <text x="${cx}" y="${top + 4}" text-anchor="middle" font-size="16" fill="${INK}">✈</text>
  <text x="${x1}" y="${y + 18}" text-anchor="middle" font-size="9" font-weight="700" fill="${INK}">ICN</text>
  <text x="${x2}" y="${y + 18}" text-anchor="middle" font-size="9" font-weight="700" fill="${INK}">${input.airportCode ?? '—'}</text>
</svg>`;
}
