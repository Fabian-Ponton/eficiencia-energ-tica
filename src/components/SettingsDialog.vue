<script setup lang="ts">
import { IconBook2, IconCheck, IconCloud, IconCloudOff, IconDeviceMobile, IconDownload } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import SelectButton from 'primevue/selectbutton';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import CloudSyncDialog from '@/components/CloudSyncDialog.vue';
import { useInstallPrompt } from '@/composables/useInstallPrompt';
import { useTheme } from '@/composables/useTheme';
import { useCloudSync } from '@/sync/useCloudSync';

const visible = defineModel<boolean>('visible', { required: true });
const router = useRouter();
const { preference } = useTheme();
const { canPrompt, installed, install, isIos } = useInstallPrompt();
const cloud = useCloudSync();
const showCloud = ref(false);

const THEMES = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Automático', value: 'auto' },
];
function openManual() {
  visible.value = false;
  void router.push({ name: 'manual' });
}
const cloudText = computed(() => {
  if (!cloud.connected.value) return 'Desactivada: tus proyectos se guardan solo en este equipo.';
  if (!cloud.signedIn.value) return 'Proyecto de Supabase conectado; falta entrar con tu cuenta.';
  return cloud.label.value ?? 'Nube conectada.';
});
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Ajustes" :draggable="false" :style="{ width: 'min(480px, calc(100vw - 24px))' }">
    <div class="ajustes">
      <section>
        <h3 class="eyebrow">Apariencia</h3>
        <SelectButton v-model="preference" :options="THEMES" option-label="label" option-value="value" :allow-empty="false" />
      </section>

      <section>
        <h3 class="eyebrow">Sincronización en la nube</h3>
        <p class="estado">
          <component :is="cloud.signedIn.value ? IconCloud : IconCloudOff" :size="18" :class="{ ok: cloud.signedIn.value }" />
          {{ cloudText }}
        </p>
        <Button :label="cloud.connected.value ? 'Administrar la nube' : 'Configurar la nube'" severity="secondary" outlined @click="showCloud = true">
          <template #icon><IconCloud :size="18" /></template>
        </Button>
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
        <h3 class="eyebrow">Ayuda</h3>
        <p class="estado">Qué hace cada pantalla y qué datos necesita para funcionar.</p>
        <Button label="Manual de uso" severity="secondary" outlined @click="openManual">
          <template #icon><IconBook2 :size="18" /></template>
        </Button>
      </section>
    </div>
  </Dialog>
  <CloudSyncDialog v-model:visible="showCloud" />
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
.estado svg {
  flex-shrink: 0;
}
.ok {
  color: var(--good);
}
</style>
