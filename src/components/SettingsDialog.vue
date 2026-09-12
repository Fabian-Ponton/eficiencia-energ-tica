<script setup lang="ts">
import { IconCheck, IconDeviceMobile, IconDownload } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SelectButton from 'primevue/selectbutton';
import { useInstallPrompt } from '@/composables/useInstallPrompt';
import { useTheme } from '@/composables/useTheme';

const visible = defineModel<boolean>('visible', { required: true });
const { preference } = useTheme();
const { canPrompt, installed, install, isIos } = useInstallPrompt();

const THEMES = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Automático', value: 'auto' },
];
const legacyUrl = `${import.meta.env.BASE_URL}legacy/`;
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Ajustes" :draggable="false" :style="{ width: 'min(480px, calc(100vw - 24px))' }">
    <div class="ajustes">
      <section>
        <h3 class="eyebrow">Apariencia</h3>
        <SelectButton v-model="preference" :options="THEMES" option-label="label" option-value="value" :allow-empty="false" />
      </section>

      <section>
        <h3 class="eyebrow">Instalar la app</h3>
        <p v-if="installed" class="estado"><IconCheck :size="18" class="ok" />PONTIA ya está instalada en este equipo.</p>
        <Button v-else-if="canPrompt" label="Instalar PONTIA" @click="install">
          <template #icon><IconDownload :size="18" /></template>
        </Button>
        <p v-else-if="isIos" class="estado">
          <IconDeviceMobile :size="18" />
          En Safari toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
        </p>
        <p v-else class="estado">Abre PONTIA en Chrome o Edge para instalarla como app.</p>
      </section>

      <section>
        <h3 class="eyebrow">Versión anterior</h3>
        <a :href="legacyUrl">Abrir PONTIA 1.6</a>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
.ajustes {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
h3 {
  margin: 0;
}
.estado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.ok {
  color: var(--good);
}
a {
  font-weight: 600;
}
</style>
