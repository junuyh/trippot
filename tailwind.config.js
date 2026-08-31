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
      // 따뜻한 무채색 위에 빨강 하나만 쓴다.
      // ⚠️ red 는 강조 한 곳에만 쓴다. 여러 군데 쓰면 강조가 사라진다.
      colors: {
        pot: {
          ink: '#121212',   // 먹 — 글자·버튼
          mute: '#8C8A85',  // 보조 글자
          line: '#DAD7D1',  // 경계선·절취선
          paper: '#FAF9F7', // 카드 바탕
          stone: '#EAE8E3', // 페이지 바탕 (따뜻한 밝은 회색)
          sand: '#C4BAAE',  // 베이지 보조
          red: '#EE3524',   // 단 하나의 강조색
        },
      },
    },
  },
  plugins: [],
};
