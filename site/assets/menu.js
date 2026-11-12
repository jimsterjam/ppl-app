// Menü auf dem Handy: der Knopf oben rechts klappt die Navigation auf und zu.
// Das Inline-Skript im Kopf setzt "js" (CSS versteckt dann das Menü hinter dem Knopf). Hat dieses Skript bis zum
// Ende des Ladens nicht "menu-ready" gesetzt (Netz, Blocker, 404), nimmt das Inline-Skript "js" wieder weg und die
// Navigation ist sichtbar.
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
  // Tipp außerhalb der Kopfzeile schließt das Menü
  document.addEventListener('click', (event) => {
    if (bar.classList.contains('is-open') && !bar.contains(event.target)) setOpen(false)
  })
  // Zurückwischen (Seite aus dem Zwischenspeicher): nicht mit offenem Menü zurückkommen
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) setOpen(false)
  })
  document.documentElement.classList.add('menu-ready')
}
