import { defineStore } from 'pinia'

export const useToastStore = defineStore('toast', {
  state: () => ({
    messages: [] // { id, type, text, position, timeout }
  }),
  actions: {
    show(text, { type = 'success', duration = 2500, position } = {}) {
      const id = Date.now() + Math.random().toString(16).slice(2)
      const msg = { id, type, text }
      if (position) msg.position = position
      this.messages.push(msg)
      if (duration > 0) {
        setTimeout(() => this.dismiss(id), duration)
      }
      return id
    },
    dismiss(id) {
      this.messages = this.messages.filter(m => m.id !== id)
    },
    clear() { this.messages = [] }
  }
})
