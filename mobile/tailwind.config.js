/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // The app is light-only (app.json userInterfaceStyle: light). "media" made
  // NativeWind throw on web whenever the page toggled its color scheme.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        blue:      "#0055CC",
        blueDk:    "#003D99",
        blueLt:    "#E8F0FF",
        yellow:    "#FFD000",
        green:     "#00A63E",
        greenLt:   "#E6F7ED",
        orange:    "#FF5C00",
        orangeLt:  "#FFF0E8",
        teal:      "#009E8E",
        tealLt:    "#E5F7F5",
        bg:        "#F2F4F8",
        dark:      "#0D1117",
        mid:       "#4A5568",
        muted:     "#9AA5B4",
        border:    "#DDE2EC",
      },
      fontFamily: {
        sans: ["Nunito_400Regular"],
        semibold: ["Nunito_600SemiBold"],
        bold: ["Nunito_700Bold"],
        extrabold: ["Nunito_800ExtraBold"],
        black: ["Nunito_900Black"],
      },
    },
  },
  plugins: [],
};
