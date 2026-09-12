import { useColorMode } from '@vueuse/core';
import { computed } from 'vue';

// Una sola instancia para toda la app: agrega la clase .app-dark a <html> según la preferencia guardada
const mode = useColorMode({
  selector: 'html',
  attribute: 'class',
  modes: { light: 'app-light', dark: 'app-dark' },
  storageKey: 'pontia-tema',
});

export function useTheme() {
  return {
    /** Preferencia elegida: 'light', 'dark' o 'auto' (sigue al sistema). */
    preference: mode.store,
    isDark: computed(() => mode.state.value === 'dark'),
  };
}
