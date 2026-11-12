// Menü auf dem Handy: der Knopf oben rechts klappt Navigation und Sprachwahl auf und zu.
// Ohne JavaScript bleibt das Menü sichtbar (die Klasse "js" setzt nur das Inline-Skript im Kopf).
const button = document.querySelector('.menu-btn')
const bar = button?.closest('.bar')
if (button && bar) {
  const setOpen = (open) => {
    bar.classList.toggle('is-open', open)
    button.setAttribute('aria-expanded', String(open))
    button.setAttribute('aria-label', open ? button.dataset.labelClose : button.dataset.labelOpen)
  }
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && bar.classList.contains('is-open')) {
      setOpen(false)
      button.focus()
    }
  })
}
