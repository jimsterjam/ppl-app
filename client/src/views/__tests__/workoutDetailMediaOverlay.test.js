// Fund 28.11.: Das Großansicht-Fenster (Bild/Video/Demo) stand in der Übungsschleife von WorkoutDetailView. Bei n Übungen entstanden
// n gleiche Fenster, n Videos liefen gleichzeitig. Es muss genau einmal und außerhalb jeder Schleife stehen.
// (Die Ansicht ist für einen Mount-Test zu groß; deshalb wird die Vorlage mit dem Vue-Compiler geprüft.)
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@vue/compiler-sfc'

function overlays(source) {
  const ast = parse(source).descriptor.template.ast
  const found = []
  const hasClass = (node, cls) => (node.props || []).some((p) => p.type === 6 && p.name === 'class' && p.value && p.value.content.split(/\s+/).includes(cls))
  const isFor = (node) => (node.props || []).some((p) => p.type === 7 && p.name === 'for')
  const walk = (node, insideFor) => {
    if (node.type === 1) {
      const inFor = insideFor || isFor(node)
      if (hasClass(node, 'media-overlay')) {
        const tags = []
        const collect = (n) => {
          if (n.type === 1) {
            tags.push(n.tag)
            ;(n.children || []).forEach(collect)
          }
        }
        collect(node)
        found.push({ insideFor: inFor, tags })
      }
      for (const child of node.children || []) walk(child, inFor)
    } else if (node.children) {
      for (const child of node.children) walk(child, insideFor)
    }
  }
  walk(ast, false)
  return found
}

describe('WorkoutDetailView: Großansicht-Fenster', () => {
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../WorkoutDetailView.vue'), 'utf8')

  it('steht genau einmal und nicht in einer v-for-Schleife', () => {
    const found = overlays(source)
    expect(found).toHaveLength(1)
    expect(found[0].insideFor).toBe(false)
  })

  it('zeigt die Demo, sonst Video oder Foto', () => {
    const [overlay] = overlays(source)
    expect(overlay.tags).toEqual(expect.arrayContaining(['ExerciseDemo', 'video', 'img', 'button']))
  })

  it('Gegenprobe: die Prüfung erkennt ein Fenster in einer Schleife', () => {
    const bad = '<template><div><div v-for="e in list" :key="e"><div v-if="open" class="media-overlay"><img /></div></div></div></template>'
    const good = '<template><div><div v-for="e in list" :key="e"></div><div v-if="open" class="media-overlay"><img /></div></div></template>'
    expect(overlays(bad)[0].insideFor).toBe(true)
    expect(overlays(good)[0].insideFor).toBe(false)
  })
})
