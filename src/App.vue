<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';
import { ref, watch } from 'vue';
import AccessGate from '@/components/AccessGate.vue';
import UndoBar from '@/components/UndoBar.vue';
import UpdatePrompt from '@/components/UpdatePrompt.vue';
import { useTheme } from '@/composables/useTheme';
import { readAccess } from '@/domain/access';
import { startCloudSync } from '@/sync/useCloudSync';
import { missingChunk } from '@/utils/chunks';

useTheme();
// Aviso de propiedad y clave de acceso: se piden una vez por equipo (ver domain/access.ts)
const entro = ref(Boolean(readAccess()));
// Si el usuario conectó su nube, sincroniza al abrir, al volver la conexión y cada 10 minutos
startCloudSync();

// El router enciende este aviso cuando una pantalla no se pudo descargar ni siquiera tras recargar
const toast = useToast();
watch(
  missingChunk,
  (falta) => {
    if (!falta) return;
    toast.add({
      severity: 'warn',
      summary: 'No se pudo abrir la pantalla',
      detail: 'Falta una parte de la app en este equipo. Conéctate un momento a internet y vuelve a intentarlo.',
      life: 10000,
    });
  },
  { immediate: true },
);
</script>

<template>
  <AccessGate v-if="!entro" @granted="entro = true" />
  <template v-else>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
    <Toast position="top-center" />
    <ConfirmDialog />
    <UndoBar />
    <UpdatePrompt />
  </template>
</template>
