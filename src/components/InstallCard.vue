<script setup lang="ts">
import { IconDeviceMobile, IconDownload, IconShare3, IconX } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { computed, ref } from 'vue';
import { useInstallPrompt } from '@/composables/useInstallPrompt';

/** Aviso para instalar PONTIA. En iPhone y iPad no hay botón: Apple solo permite «Añadir a pantalla de inicio». */
const { canPrompt, installed, install, isIos } = useInstallPrompt();

const HIDDEN_KEY = 'pontia:instalar-oculto';
const hidden = ref(false);
try {
  hidden.value = localStorage.getItem(HIDDEN_KEY) === '1';
} catch {
  // Sin acceso al almacenamiento el aviso simplemente se muestra
}
function hide() {
  hidden.value = true;
  try {
    localStorage.setItem(HIDDEN_KEY, '1');
  } catch {
    // Volverá a aparecer la próxima vez; no pasa nada
  }
}
const visible = computed(() => !installed.value && !hidden.value);
const showButton = computed(() => canPrompt.value && !isIos);
</script>

<template>
  <section v-if="visible" class="card instalar">
    <span class="icono"><component :is="isIos ? IconDeviceMobile : IconDownload" :size="22" /></span>
    <strong class="titulo">Instala PONTIA en este equipo</strong>
    <button type="button" class="cerrar" aria-label="Ocultar este aviso" @click="hide"><IconX :size="18" /></button>
    <div class="texto">
      <span v-if="isIos">
        En iPhone y iPad se instala desde <strong>Safari</strong>: toca <IconShare3 :size="15" class="en-linea" /><strong>Compartir</strong>, en la barra de abajo, y luego
        <strong>«Añadir a pantalla de inicio»</strong>. Apple no permite un botón de instalación dentro de la página.
      </span>
      <span v-else-if="canPrompt">Queda como una app: abre sin internet, usa la cámara y guarda todo en este equipo.</span>
      <span v-else>Ábrela en Chrome, Edge o Safari para instalarla como app.</span>
      <span class="nota">Se actualiza sola: cuando publique una versión nueva te avisa con el botón «Actualizar», sin volver a instalarla.</span>
    </div>
    <Button v-if="showButton" class="boton" label="Instalar PONTIA" size="small" @click="install">
      <template #icon><IconDownload :size="18" /></template>
    </Button>
  </section>
</template>

<style scoped>
/* Ícono y botón de cerrar arriba; el texto y el botón de instalar ocupan el ancho en el celular */
.instalar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px 12px;
  padding: 12px 14px;
  border-color: var(--accent);
  background: var(--accent-wash);
}
.icono {
  display: grid;
  grid-row: 1;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--surface);
  color: var(--accent-strong);
}
.app-dark .icono {
  color: var(--accent);
}
.titulo {
  grid-row: 1;
  grid-column: 2;
  align-self: center;
  font-size: 14px;
}
/* El texto ocupa todo el ancho: en el celular no cabe al lado del ícono */
.texto {
  display: flex;
  grid-row: 2;
  grid-column: 1 / -1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  font-size: 13px;
}
.en-linea {
  margin: 0 3px -3px 1px;
}
.nota {
  color: var(--muted);
  font-size: 12px;
}
.cerrar {
  display: grid;
  grid-row: 1;
  grid-column: 3;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}
.cerrar:hover {
  background: var(--surface);
}
.boton {
  grid-row: 3;
  grid-column: 1 / -1;
  justify-self: start;
}
</style>
