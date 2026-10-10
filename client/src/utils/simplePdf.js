// Minimaler PDF-Schreiber ohne Abhängigkeit (für den Monatsbericht). Kann Text (Helvetica und
// Helvetica-Bold, Standardschriften jedes PDF-Programms - keine eingebettete Schrift), Linien, Rechtecke,
// Linienzüge und Kreise. Koordinaten in Punkt (1/72 Zoll) mit Ursprung OBEN LINKS, y wächst nach unten.
// Ohne Vue-Imports, damit direkt testbar.
//
// Zeichen: WinAnsi (Latin-1 plus Gedankenstrich, Anführungszeichen, Aufzählungspunkt). Alles andere
// wird zu "?" - Übungsnamen sind englisch, die App-Texte deutsch/englisch, das reicht.

export const PAGE_A4 = Object.freeze({ width: 595.28, height: 841.89 })

// Breiten der Standardschriften (Adobe-AFM, 1/1000 em) für ASCII 32-126.
const HELVETICA = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
const HELVETICA_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]

// Unicode -> WinAnsi-Byte für Zeichen außerhalb von Latin-1
const WIN_ANSI_EXTRA = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x201e, 0x84], [0x2026, 0x85], [0x2018, 0x91], [0x2019, 0x92],
  [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97]
])
// Zeichen, die als Leerzeichen bzw. Bindestrich gelten
const SPACE_LIKE = new Set([0x00a0, 0x202f, 0x2009, 0x2007])

function toWinAnsiByte(codePoint) {
  if (SPACE_LIKE.has(codePoint)) return 0x20
  if (codePoint === 0x2212) return 0x2d // typografisches Minus
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint
  if (WIN_ANSI_EXTRA.has(codePoint)) return WIN_ANSI_EXTRA.get(codePoint)
  return 0x3f // "?"
}

/** Text als WinAnsi-Bytes (Zeilenumbrüche und Steuerzeichen werden zu Leerzeichen). */
export function encodeWinAnsi(text) {
  const bytes = []
  for (const char of String(text ?? '')) {
    const cp = char.codePointAt(0)
    bytes.push(cp < 0x20 ? 0x20 : toWinAnsiByte(cp))
  }
  return bytes
}

/** Breite eines Textes in Punkt. Akzentbuchstaben zählen wie ihr Grundbuchstabe, Rest wie eine Ziffer. */
export function textWidth(text, size, bold = false) {
  const table = bold ? HELVETICA_BOLD : HELVETICA
  let units = 0
  for (const byte of encodeWinAnsi(text)) {
    if (byte >= 0x20 && byte <= 0x7e) {
      units += table[byte - 0x20]
    } else {
      const base = String.fromCharCode(byte).normalize('NFD')[0]
      const code = base ? base.charCodeAt(0) : 0
      units += code >= 0x20 && code <= 0x7e ? table[code - 0x20] : (byte === 0xdf ? 611 : 556)
    }
  }
  return units * size / 1000
}

/** Text in Zeilen umbrechen, die höchstens maxWidth breit sind (zu lange Wörter werden getrennt). */
export function wrapText(text, maxWidth, size, bold = false) {
  const lines = []
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (textWidth(candidate, size, bold) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      let rest = word
      while (textWidth(rest, size, bold) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1
        while (cut > 1 && textWidth(rest.slice(0, cut), size, bold) > maxWidth) cut -= 1
        lines.push(rest.slice(0, cut))
        rest = rest.slice(cut)
      }
      line = rest
    }
    lines.push(line)
  }
  return lines
}

function num(value) {
  return (Math.round(value * 100) / 100).toString()
}

function colorOps(color, stroke) {
  const [r, g, b] = Array.isArray(color) ? color : [0, 0, 0]
  return `${num(r)} ${num(g)} ${num(b)} ${stroke ? 'RG' : 'rg'}`
}

function pdfString(bytes) {
  let out = '('
  for (const byte of bytes) {
    const char = String.fromCharCode(byte)
    out += char === '(' || char === ')' || char === '\\' ? `\\${char}` : (byte < 0x20 || byte > 0x7e ? `\\${byte.toString(8).padStart(3, '0')}` : char)
  }
  return `${out})`
}

class Page {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.ops = []
  }

  #y(y) {
    return this.height - y
  }

  /** @param {{ size?: number, bold?: boolean, color?: number[], align?: 'left'|'right'|'center' }} [style] */
  text(x, y, text, { size = 10, bold = false, color = [0, 0, 0], align = 'left' } = {}) {
    const width = textWidth(text, size, bold)
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
    this.ops.push(`BT ${colorOps(color, false)} /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(left)} ${num(this.#y(y))} Td ${pdfString(encodeWinAnsi(text))} Tj ET`)
  }

  line(x1, y1, x2, y2, { color = [0, 0, 0], width = 1, dash = null } = {}) {
    const dashOp = dash ? `[${dash.map(num).join(' ')}] 0 d` : '[] 0 d'
    this.ops.push(`q ${colorOps(color, true)} ${num(width)} w ${dashOp} ${num(x1)} ${num(this.#y(y1))} m ${num(x2)} ${num(this.#y(y2))} l S Q`)
  }

  /** Rechteck von (x, y) oben links; fill und/oder stroke. */
  rect(x, y, width, height, { fill = null, stroke = null, lineWidth = 1 } = {}) {
    if (!fill && !stroke) return
    const parts = ['q']
    if (fill) parts.push(colorOps(fill, false))
    if (stroke) parts.push(colorOps(stroke, true), `${num(lineWidth)} w`)
    parts.push(`${num(x)} ${num(this.#y(y + height))} ${num(width)} ${num(height)} re`, fill && stroke ? 'B' : fill ? 'f' : 'S', 'Q')
    this.ops.push(parts.join(' '))
  }

  polyline(points, { color = [0, 0, 0], width = 1 } = {}) {
    if (points.length < 2) return
    const path = points.map(([px, py], i) => `${num(px)} ${num(this.#y(py))} ${i === 0 ? 'm' : 'l'}`).join(' ')
    this.ops.push(`q ${colorOps(color, true)} ${num(width)} w 1 j 1 J ${path} S Q`)
  }

  circle(cx, cy, radius, { fill = [0, 0, 0] } = {}) {
    const k = 0.5523 * radius
    const x = cx
    const y = this.#y(cy)
    this.ops.push(`q ${colorOps(fill, false)} ${num(x + radius)} ${num(y)} m `
      + `${num(x + radius)} ${num(y + k)} ${num(x + k)} ${num(y + radius)} ${num(x)} ${num(y + radius)} c `
      + `${num(x - k)} ${num(y + radius)} ${num(x - radius)} ${num(y + k)} ${num(x - radius)} ${num(y)} c `
      + `${num(x - radius)} ${num(y - k)} ${num(x - k)} ${num(y - radius)} ${num(x)} ${num(y - radius)} c `
      + `${num(x + k)} ${num(y - radius)} ${num(x + radius)} ${num(y - k)} ${num(x + radius)} ${num(y)} c f Q`)
  }
}

/**
 * @param {{ title?: string, author?: string, width?: number, height?: number }} [options]
 * @returns {{ addPage: () => Page, pageCount: () => number, getPage: (index: number) => Page|null, toBytes: () => Uint8Array }}
 */
export function createPdf({ title = '', author = '', width = PAGE_A4.width, height = PAGE_A4.height } = {}) {
  const pages = []

  return {
    addPage() {
      const page = new Page(width, height)
      pages.push(page)
      return page
    },
    pageCount: () => pages.length,
    getPage: (index) => pages[index] || null,
    toBytes() {
      if (!pages.length) pages.push(new Page(width, height))
      // Objektnummern: 1 Katalog, 2 Seitenbaum, 3/4 Schriften, 5 Info, danach je Seite (Seite, Inhalt)
      const objects = []
      const pageObj = (i) => 6 + i * 2
      const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')
      objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
      objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`
      objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
      objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
      objects[5] = `<< /Title ${pdfString(encodeWinAnsi(title))} /Author ${pdfString(encodeWinAnsi(author))} /Producer (PPL Fundamentals) >>`
      pages.forEach((page, i) => {
        const content = page.ops.join('\n')
        objects[pageObj(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`
        objects[pageObj(i) + 1] = { stream: content }
      })

      const chunks = []
      let length = 0
      const push = (text) => {
        // Inhalt besteht nur aus ASCII (Sonderzeichen sind als Oktalcode maskiert)
        const bytes = new Uint8Array(text.length)
        for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff
        chunks.push(bytes)
        length += bytes.length
      }
      const offsets = []
      push('%PDF-1.4\n')
      for (let n = 1; n < objects.length; n += 1) {
        offsets[n] = length
        const body = objects[n]
        if (typeof body === 'string') push(`${n} 0 obj\n${body}\nendobj\n`)
        else push(`${n} 0 obj\n<< /Length ${body.stream.length} >>\nstream\n${body.stream}\nendstream\nendobj\n`)
      }
      const xrefAt = length
      push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`)
      for (let n = 1; n < objects.length; n += 1) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
      push(`trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

      const out = new Uint8Array(length)
      let at = 0
      for (const chunk of chunks) {
        out.set(chunk, at)
        at += chunk.length
      }
      return out
    }
  }
}
