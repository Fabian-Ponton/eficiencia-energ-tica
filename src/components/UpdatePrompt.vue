<script setup lang="ts">
import { IconCloudCheck, IconRefresh, IconX } from '@tabler/icons-vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW();

function close() {
  needRefresh.value = false;
  offlineReady.value = false;
}
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
.aviso {
  position: fixed;
  left: 50%;
  bottom: calc(var(--bottom-nav-height) + 16px + env(safe-area-inset-bottom));
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  border-radius: 10px;
  background: var(--navy);
  color: #fff;
  box-shadow: var(--shadow-float);
  font-size: 14px;
  transform: translateX(-50%);
}
.icono {
  flex-shrink: 0;
  color: var(--accent);
}
.accion {
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
    bottom: 24px;
  }
}
</style>
