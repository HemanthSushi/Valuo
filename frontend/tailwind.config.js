const moonmist = '#DCDCCA';
const pastelstone = '#C4C0AC';
const schooner = '#88867C';
const attractiveblack = '#222222';

const stoneScale = {
  50: moonmist,
  100: moonmist,
  200: moonmist,
  300: pastelstone,
  400: schooner,
  500: schooner,
  600: attractiveblack,
  700: attractiveblack,
  800: attractiveblack,
  900: attractiveblack,
  950: attractiveblack,
  DEFAULT: schooner,
};

module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': attractiveblack,
          '2': schooner,
          '3': attractiveblack,
          '4': schooner,
          '5': attractiveblack
        },
        // Everhome Signature 4-Color Palette
        moonmist,
        pastelstone,
        schooner,
        attractiveblack,

        // Global Palette Enforcement: All color scales map exclusively to the 4 colors
        white: moonmist,
        black: attractiveblack,
        slate: stoneScale,
        gray: stoneScale,
        zinc: stoneScale,
        neutral: stoneScale,
        stone: stoneScale,
        red: stoneScale,
        orange: stoneScale,
        amber: stoneScale,
        yellow: stoneScale,
        lime: stoneScale,
        green: stoneScale,
        emerald: stoneScale,
        teal: stoneScale,
        cyan: stoneScale,
        sky: stoneScale,
        blue: stoneScale,
        indigo: stoneScale,
        violet: stoneScale,
        purple: stoneScale,
        fuchsia: stoneScale,
        pink: stoneScale,
        rose: stoneScale,
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['"IBM Plex Sans"', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.15s ease-out',
        'accordion-up': 'accordion-up 0.15s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};