import { describe, it, expect } from 'vitest'
import { createPdf, encodeWinAnsi, textWidth, wrapText, PAGE_A4 } from '../simplePdf.js'

const latin1 = (bytes) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

describe('simplePdf: Text', () => {
  it('WinAnsi: Umlaute, ß, Gedankenstrich; Unbekanntes wird zu ?', () => {
    expect(encodeWinAnsi('äöüß')).toEqual([0xe4, 0xf6, 0xfc, 0xdf])
    expect(encodeWinAnsi('a–b')).toEqual([0x61, 0x96, 0x62])
    expect(encodeWinAnsi('a−b')).toEqual([0x61, 0x2d, 0x62]) // typografisches Minus
    expect(encodeWinAnsi('x y')).toEqual([0x78, 0x20, 0x79])
    expect(encodeWinAnsi('日本')).toEqual([0x3f, 0x3f])
    expect(encodeWinAnsi('a\nb')).toEqual([0x61, 0x20, 0x62])
  })

  it('Breiten stimmen mit den Adobe-Schriftmetriken überein (Helvetica / Bold)', () => {
    // "Hello" = H722 + e556 + l222 + l222 + o556
    expect(textWidth('Hello', 10)).toBeCloseTo(22.78, 5)
    expect(textWidth('Hello', 10, true)).toBeCloseTo((722 + 556 + 278 + 278 + 611) / 100, 5)
    expect(textWidth('ä', 1000)).toBe(textWidth('a', 1000))
  })

  it('wrapText: bricht an Wortgrenzen, trennt zu lange Wörter, behält Absätze', () => {
    const lines = wrapText('eins zwei drei vier fünf sechs', 60, 10)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(textWidth(line, 10)).toBeLessThanOrEqual(60)
    expect(lines.join(' ')).toBe('eins zwei drei vier fünf sechs')

    const long = wrapText('Donaudampfschifffahrtsgesellschaftskapitän', 50, 10)
    expect(long.length).toBeGreaterThan(1)
    for (const line of long) expect(textWidth(line, 10)).toBeLessThanOrEqual(50)

    expect(wrapText('a\n\nb', 100, 10)).toEqual(['a', '', 'b'])
  })
})

describe('simplePdf: Dokument', () => {
  function sample() {
    const pdf = createPdf({ title: 'Test (Titel)', author: 'ppl' })
    const page = pdf.addPage()
    page.text(50, 60, 'Grüße (aus) Köln \\ ok', { size: 12, bold: true, color: [0.2, 0.4, 0.6] })
    page.line(50, 70, 200, 70, { dash: [2, 2] })
    page.rect(50, 80, 100, 30, { fill: [0.9, 0.9, 0.9], stroke: [0, 0, 0] })
    page.polyline([[50, 150], [100, 120], [150, 140]], { color: [1, 0, 0], width: 2 })
    page.circle(100, 120, 3, { fill: [1, 0, 0] })
    pdf.addPage().text(50, 60, 'Seite 2', {})
    return pdf
  }

  it('gültiger Aufbau: Kopf, Ende, Seitenzahl, xref-Offsets zeigen auf die Objekte', () => {
    const pdf = sample()
    expect(pdf.pageCount()).toBe(2)
    const text = latin1(sample().toBytes())
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/Count 2')
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2)

    const xrefStart = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1])
    expect(text.slice(xrefStart, xrefStart + 4)).toBe('xref')
    const entries = text.slice(xrefStart).split('\n').filter((line) => /^\d{10} 00000 n $/.test(line))
    expect(entries.length).toBe(Number(text.match(/\/Size (\d+)/)[1]) - 1)
    entries.forEach((line, index) => {
      const offset = Number(line.slice(0, 10))
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`)
    })
  })

  it('Länge der Inhaltsströme stimmt, Sonderzeichen sind maskiert', () => {
    const text = latin1(sample().toBytes())
    for (const match of text.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(match[2].length).toBe(Number(match[1]))
    }
    // Klammern und Backslash im Text sind maskiert, Umlaute als Oktalcode
    expect(text).toContain('\\(aus\\)')
    expect(text).toContain('\\\\ ok')
    expect(text).toContain('Gr\\374\\337e')
    // Titel mit Klammern
    expect(text).toContain('/Title (Test \\(Titel\\))')
  })

  it('Ursprung oben links: y = 60 auf A4 wird zu Höhe - 60', () => {
    const text = latin1(sample().toBytes())
    expect(text).toContain(`50 ${PAGE_A4.height - 60 > 0 ? Math.round((PAGE_A4.height - 60) * 100) / 100 : 0} Td`)
  })

  it('ohne Seiten entsteht trotzdem ein gültiges Dokument mit einer leeren Seite', () => {
    const text = latin1(createPdf().toBytes())
    expect(text).toContain('/Count 1')
  })
})
