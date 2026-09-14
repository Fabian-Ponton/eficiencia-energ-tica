<script setup lang="ts">
import { IconCloudCheck, IconRefresh, IconX } from '@tabler/icons-vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { watch } from 'vue';

const UNA_HORA = 60 * 60 * 1000;

// La app instalada busca versiones nuevas al abrirse, al volver a ella y cada hora; el auditor decide cuándo actualizar
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) void registration.update();
    };
    setInterval(check, UNA_HORA);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});

function close() {
  needRefresh.value = false;
  offlineReady.value = false;
}

// «Ya funciona sin conexión» es solo informativo: se oculta solo; el de versión nueva espera a que el auditor decida
let timer: ReturnType<typeof setTimeout> | undefined;
watch(offlineReady, (ready) => {
  clearTimeout(timer);
  if (ready) timer = setTimeout(() => (offlineReady.value = false), 6000);
});
</script>

<template>
  <Transition name="list">
    <div v-if="needRefresh || offlineReady" class="aviso" role="status">
      <IconRefresh v-if="needRefresh" :size="20" class="icono" />
      <IconCloudCheck v-else :size="20" class="icono" />
      <span>{{ needRefresh ? 'Hay una versión nueva de PONTIA.' : 'PONTIA ya funciona sin conexión en este equipo.' }}</span>
      <button v-if="needRefresh" type="button" class="accion" @click="updateServiceWorker()">Actualizar</button>
      <button type="button" class="cerrar" aria-label="Cerrar aviso" @click="close">
        <IconX :size="18" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/* En el celular va arriba, bajo la barra, para no tapar el botón «+» ni la barra de etapas */
.aviso {
  position: fixed;
  top: calc(68px + env(safe-area-inset-top));
  right: 0;
  left: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  max-width: calc(100vw - 24px);
  margin-inline: auto;
  padding: 8px 8px 8px 14px;
  border-radius: 10px;
  background: var(--navy);
  color: #fff;
  box-shadow: var(--shadow-float);
  font-size: 14px;
}
.icono {
  flex-shrink: 0;
  color: var(--accent);
}
.accion {
  flex-shrink: 0;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--accent-strong);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.cerrar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--on-navy-2);
  cursor: pointer;
}
@media (min-width: 1024px) {
  .aviso {
    top: auto;
    right: 24px;
    bottom: 24px;
    left: auto;
    margin: 0;
  }
}
</style>
