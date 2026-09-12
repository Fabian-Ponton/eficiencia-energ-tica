<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{ icon: Component; title: string; text?: string }>();
</script>

<template>
  <div class="vacio">
    <div class="insignia">
      <component :is="icon" :size="28" stroke="1.6" />
    </div>
    <h2>{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <div v-if="$slots.default" class="acciones"><slot /></div>
  </div>
</template>

<style scoped>
.vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px;
  text-align: center;
}
.insignia {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 4px;
  border-radius: 14px;
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .insignia {
  color: var(--ink);
}
h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
p {
  max-width: 420px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
</style>
