// Kartenfarben (Absprache Jimmy 21.11.): Der Ton färbt nur Karten und Kacheln (--card-bg, --card-soft, --surface-strong),
// der Seitenhintergrund bleibt. Eine Wahl für beide Modi: dunkel ein dunkler Ton, hell die Pastellvariante.
// Graphit ist der Standard und braucht keine Regeln (die Werte aus style.css). Die Werte hier und die Regeln in style.css
// müssen übereinstimmen - das prüft cardTones.test.js (inkl. Lesbarkeit mit allen Akzentfarben).
export const CARD_TONES = ['graphit', 'schwarz', 'nacht', 'wald', 'beere', 'bordeaux', 'petrol', 'schiefer']
export const DEFAULT_CARD_TONE = 'graphit'

export const CARD_TONE_COLORS = {
  graphit: {
    dark: { card: '#12141b', soft: '#1c1f28', strong: '#1d1f28' },
    light: { card: '#ffffff', soft: '#f8f9fd', strong: '#e5e8f2' }
  },
  schwarz: {
    dark: { card: '#000000', soft: '#090909', strong: '#0f0f0f' },
    light: { card: '#e4e6eb', soft: '#f2f2f5', strong: '#dddfe4' }
  },
  nacht: {
    dark: { card: '#0e1e3d', soft: '#162644', strong: '#1c2c49' },
    light: { card: '#d6e4fb', soft: '#eaf2fd', strong: '#d0ddf3' }
  },
  wald: {
    dark: { card: '#0c251b', soft: '#152d23', strong: '#1b3229' },
    light: { card: '#d3eedf', soft: '#e9f6ef', strong: '#cde7d8' }
  },
  beere: {
    dark: { card: '#2a1142', soft: '#311949', strong: '#371f4d' },
    light: { card: '#e7ddf7', soft: '#f3eefb', strong: '#e0d6f0' }
  },
  bordeaux: {
    dark: { card: '#3a121c', soft: '#411a24', strong: '#46202a' },
    light: { card: '#f8dce2', soft: '#fceef0', strong: '#f1d5db' }
  },
  petrol: {
    dark: { card: '#082327', soft: '#112b2f', strong: '#173034' },
    light: { card: '#cdeef0', soft: '#e6f6f8', strong: '#c7e7e9' }
  },
  schiefer: {
    dark: { card: '#1b1e25', soft: '#23262d', strong: '#292c32' },
    light: { card: '#dde1eb', soft: '#eef0f5', strong: '#d6dae4' }
  }
}
