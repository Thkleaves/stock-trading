import type { Directive } from 'vue'

export const vClickOutside: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    el._clickOutsideHandler = (event: MouseEvent) => {
      if (!el.contains(event.target as Node)) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutsideHandler)
  },
  unmounted(el) {
    if (el._clickOutsideHandler) {
      document.removeEventListener('click', el._clickOutsideHandler)
    }
  },
}

declare global {
  interface HTMLElement {
    _clickOutsideHandler?: (event: MouseEvent) => void
  }
}
