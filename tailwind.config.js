/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ── TripPot 뉴트럴 ──────────────────────────────────────────────
      // components/trip-home/TravelTicketCard 와 lib/constants/countryTheme 가
      // 쓰는 값과 같다. 화면마다 다른 회색을 쓰지 않으려고 이름을 붙였다.
      //
      // ⚠️ 배경과 기본 카드는 항상 화이트·쿨그레이다. (countryTheme.ts 규칙)
      //    포인트 컬러는 국가 테마(theme.primary)에서 오고
      //    진행률·D-Day 배지처럼 의미가 있는 곳에만 쓴다.
      colors: {
        pot: {
          ink: '#111827',    // 본문·숫자
          mute: '#747B88',   // 보조 글자
          faint: '#8B94A2',  // 라벨 (FROM · TO 같은 마이크로 카피)
          line: '#E5E8EC',   // 경계선
          dash: '#CBD0D6',   // 절취선
          visual: '#F5F7FA', // 티켓 윗칸 바탕
        },
        // ── TripPot 브랜드 컬러 (확정 · 2026-09-16) ────────────────────────
        // lib/constants/brandColor.ts 의 BRAND 와 같은 값. 일반 화면의 CTA · 선택 상태에만 쓴다.
        // 국가 테마(theme.primary)를 대체하지 않는다.
        brand: {
          DEFAULT: '#64139E', // Brand Primary
          pressed: '#521080', // Primary Pressed — 눌린 상태만
          soft: '#F6F0FA',    // Primary Soft — 선택된 탭·칩 배경
        },
      },
    },
  },
  plugins: [],
};
