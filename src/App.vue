<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import UndoBar from '@/components/UndoBar.vue';
import UpdatePrompt from '@/components/UpdatePrompt.vue';
import { useTheme } from '@/composables/useTheme';
import { startCloudSync } from '@/sync/useCloudSync';

useTheme();
// Si el usuario conectó su nube, sincroniza al abrir, al volver la conexión y cada 10 minutos
startCloudSync();
</script>

<template>
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
