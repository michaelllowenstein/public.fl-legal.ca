/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a3a5c',
          light:   '#2d6a9f',
          gold:    '#afafaf',
          cream:   '#79a2b7',
          dark:    '#353f49',
        },
      },
      fontFamily: {
        display: ['"Lato"', 'Georgia', 'serif'],
        body:    ['"Lennox"',  'Georgia', 'serif'],
        sans:    ['"Lato"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:   '0 2px 12px 0 rgba(15,34,53,0.10)',
        dialog: '0 8px 48px 0 rgba(15,34,53,0.28)',
      },
      keyframes: {
        // Dialog backdrop
        dialogIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        dialogOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        // Panel entrance
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // Toast
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Page content entrance
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        // Skeleton shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0'  },
        },
        // Reading progress bar
        progressIn: {
          from: { transform: 'scaleX(0)' },
          to:   { transform: 'scaleX(1)' },
        },
        // Fade in only
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'dialog-in':  'dialogIn 0.18s ease both',
        'dialog-out': 'dialogOut 0.15s ease both',
        'scale-in':   'scaleIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both',
        'slide-down': 'slideDown 0.2s ease both',
        'fade-up':    'fadeUp 0.38s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':    'fadeIn 0.24s ease both',
        'shimmer':    'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1a3a5c',
          light:   '#2d6a9f',
          gold:    '#bfbfbf',
          cream:   '#f5f0e8',
          dark:    '#0f2235',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"PT Serif"', 'Georgia', 'serif'],
        sans:    ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        'xl':  '12px',
        'lg':  '8px',
      },
      boxShadow: {
        card:   '0 2px 10px 0 rgba(15,34,53,0.12)',
        dialog: '0 8px 28px 0 rgba(15,34,53,0.30)',
      },
      keyframes: {
        dialogIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        dialogOut: { from: { opacity: '1' }, to: { opacity: '0' } },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to:   { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'dialog-in':  'dialogIn 0.18s ease both',
        'dialog-out': 'dialogOut 0.15s ease both',
        'scale-in':   'scaleIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both',
        'slide-down': 'slideDown 0.2s ease both',
        'fade-up':    'fadeUp 0.38s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in':    'fadeIn 0.24s ease both',
        'shimmer':    'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};