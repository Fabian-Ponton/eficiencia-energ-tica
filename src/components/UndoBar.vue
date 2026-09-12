<script setup lang="ts">
import { IconArrowBackUp, IconX } from '@tabler/icons-vue';
import { dismissUndo, runUndo, undoState } from '@/composables/useUndo';
</script>

<template>
  <Transition name="deshacer">
    <div v-if="undoState.offer" :key="undoState.offer.id" class="deshacer" role="status">
      <span class="texto">{{ undoState.offer.message }}</span>
      <button type="button" class="accion" @click="runUndo"><IconArrowBackUp :size="18" />Deshacer</button>
      <button type="button" class="cerrar" aria-label="Cerrar aviso" @click="dismissUndo"><IconX :size="16" /></button>
    </div>
  </Transition>
</template>

<style scoped>
.deshacer {
  position: fixed;
  right: 84px;
  bottom: calc(96px + env(safe-area-inset-bottom));
  left: 12px;
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 52px;
  padding: 6px 6px 6px 14px;
  border-radius: 12px;
  background: #0f1b33;
  box-shadow: var(--shadow-float);
  color: #fff;
  font-size: 14px;
}
.texto {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.accion {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #7fe0a6;
  font-weight: 600;
  cursor: pointer;
}
.accion:hover {
  background: rgba(255, 255, 255, 0.08);
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
  color: #b9c5d9;
  cursor: pointer;
}
.deshacer-enter-active,
.deshacer-leave-active {
  transition:
    opacity 200ms var(--ease),
    transform 200ms var(--ease);
}
.deshacer-enter-from,
.deshacer-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
@media (min-width: 1024px) {
  .deshacer {
    right: auto;
    bottom: 24px;
    left: 50%;
    width: min(520px, calc(100vw - 48px));
    margin-left: calc(min(520px, calc(100vw - 48px)) / -2);
  }
}
</style>
