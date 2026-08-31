/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ── TripPot 컬러칩 ──────────────────────────────────────────────
      // Tailwind 기본 색(blue-600, gray-900 …)은 그대로 살아 있다.
      // 여기 추가한 것은 새 이름이라 기존 화면 색을 바꾸지 않는다.
      //
      // ⚠️ mint / sun / sky 는 흰 바탕에서 글자색으로 쓰면 대비가 모자란다.
      //    채움(배경·막대)에 쓰고, 그 위 글자는 ink 를 얹는다.
      colors: {
        pot: {
          grape: '#B32DE6',   // 보라 — 강조
          sky: '#4DC9F6',     // 하늘 — 정보
          mint: '#00E39A',    // 민트 — 준비·달성
          sun: '#FFD84D',     // 노랑 — 기한·주목
          coral: '#FF7A5A',   // 코랄 — 초과·주의
          blossom: '#FF9EC4', // 분홍
          lilac: '#E3B7F2',   // 연보라
          paper: '#ECECEC',   // 밝은 바탕
          ink: '#0A0A0A',     // 먹 — 글자·버튼
        },
      },
    },
  },
  plugins: [],
};
