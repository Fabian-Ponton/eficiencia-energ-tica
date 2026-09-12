import { computed, ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt.value = event as BeforeInstallPromptEvent;
});
window.addEventListener('appinstalled', () => {
  installed.value = true;
  deferredPrompt.value = null;
});

/** En iPhone y iPad no hay aviso de instalación: se instala desde Safari con «Añadir a pantalla de inicio». */
export const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useInstallPrompt() {
  const canPrompt = computed(() => deferredPrompt.value !== null);

  async function install(): Promise<boolean> {
    const event = deferredPrompt.value;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferredPrompt.value = null;
    return outcome === 'accepted';
  }

  return { canPrompt, installed, install, isIos };
}
