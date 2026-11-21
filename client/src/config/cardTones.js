// Kartenfarben (Absprache Jimmy 21.11.): Der Ton färbt nur Karten und Kacheln (--card-bg, --card-soft),
// der Seitenhintergrund bleibt. Eine Wahl für beide Modi: dunkel ein dunkler Ton, hell die Pastellvariante.
// Graphit ist der Standard und braucht keine Regeln (die Werte aus style.css). Die Werte hier und die Regeln in style.css
// müssen übereinstimmen - das prüft cardTones.test.js (inkl. Lesbarkeit mit allen Akzentfarben).
// Die Kennungen sind historische Arbeitstitel; angezeigt wird (settings.cardTone<Kennung>): nacht = Blau, wald = Grün,
// beere = Violett, bordeaux = Rot. Neue Töne: Kennung + Regeln in style.css + Namen DE/EN (prüft cardTones.test.js).
export const CARD_TONES = ['graphit', 'schwarz', 'nacht', 'wald', 'beere', 'bordeaux', 'petrol', 'schiefer']
export const DEFAULT_CARD_TONE = 'graphit'

export const CARD_TONE_COLORS = {
  graphit: {
    dark: { card: '#12141b', soft: '#1c1f28' },
    light: { card: '#ffffff', soft: '#f8f9fd' }
  },
  schwarz: {
    dark: { card: '#000000', soft: '#090909' },
    light: { card: '#e4e6eb', soft: '#f2f2f5' }
  },
  nacht: {
    dark: { card: '#0e1e3d', soft: '#162644' },
    light: { card: '#d6e4fb', soft: '#eaf2fd' }
  },
  wald: {
    dark: { card: '#0c251b', soft: '#152d23' },
    light: { card: '#d3eedf', soft: '#e9f6ef' }
  },
  beere: {
    dark: { card: '#2a1142', soft: '#311949' },
    light: { card: '#e7ddf7', soft: '#f3eefb' }
  },
  bordeaux: {
    dark: { card: '#3a121c', soft: '#411a24' },
    light: { card: '#f8dce2', soft: '#fceef0' }
  },
  petrol: {
    dark: { card: '#082327', soft: '#112b2f' },
    light: { card: '#cdeef0', soft: '#e6f6f8' }
  },
  schiefer: {
    dark: { card: '#1b1e25', soft: '#23262d' },
    light: { card: '#dde1eb', soft: '#eef0f5' }
  }
}
