<script setup lang="ts">
import { useObjectUrl } from '@vueuse/core';
import { toRef } from 'vue';

const props = defineProps<{ blob: Blob; alt?: string }>();
// La dirección temporal de la foto se libera sola al cambiar o al cerrar la pantalla
const url = useObjectUrl(toRef(props, 'blob'));
</script>

<template>
  <img v-if="url" :src="url" :alt="alt ?? ''" loading="lazy" decoding="async" draggable="false" />
</template>
