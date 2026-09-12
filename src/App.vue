<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog';
import Toast from 'primevue/toast';
import UndoBar from '@/components/UndoBar.vue';
import UpdatePrompt from '@/components/UpdatePrompt.vue';
import { useTheme } from '@/composables/useTheme';

useTheme();
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
