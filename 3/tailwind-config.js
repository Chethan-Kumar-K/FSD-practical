tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Young Serif"', 'Georgia', 'serif']
      },
      colors: {
        ink: '#17302D',
        spruce: { DEFAULT: '#0F4C47', deep: '#0A3532' },
        marigold: { DEFAULT: '#F2A900', deep: '#8F5F00' },
        sage: { DEFAULT: '#EAF1EC', dark: '#D5E2DA' },
        leaf: '#2F7D57'
      },
      // Custom Typography themes: "prose-carbon" for light backgrounds, "prose-hero" for the dark hero
      typography: {
        carbon: {
          css: {
            '--tw-prose-body': '#17302D',
            '--tw-prose-headings': '#0F4C47',
            '--tw-prose-lead': '#2B4A46',
            '--tw-prose-links': '#0F4C47',
            '--tw-prose-bold': '#0F4C47',
            '--tw-prose-counters': '#0F4C47',
            '--tw-prose-bullets': '#F2A900',
            '--tw-prose-hr': '#D5E2DA',
            '--tw-prose-quotes': '#0F4C47',
            '--tw-prose-quote-borders': '#F2A900',
            'h1, h2, h3': { fontFamily: '"Young Serif", Georgia, serif', fontWeight: '400', letterSpacing: '-0.01em' }
          }
        },
        hero: {
          css: {
            '--tw-prose-body': '#D5E8E2',
            '--tw-prose-headings': '#FFFFFF',
            '--tw-prose-lead': '#D5E8E2',
            '--tw-prose-links': '#F2A900',
            '--tw-prose-bold': '#FFFFFF',
            '--tw-prose-bullets': '#F2A900',
            'h1, h2, h3': { fontFamily: '"Young Serif", Georgia, serif', fontWeight: '400', letterSpacing: '-0.01em' }
          }
        }
      }
    }
  }
}
