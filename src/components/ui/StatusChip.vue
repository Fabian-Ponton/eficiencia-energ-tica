<script setup lang="ts">
import type { Component } from 'vue';
import type { Tone } from '@/ui/icons';

defineProps<{ tone: Tone; label: string; icon?: Component }>();
</script>

<template>
  <span class="estado" :class="tone">
    <component :is="icon" v-if="icon" :size="14" stroke="2.2" />
    {{ label }}
  </span>
</template>

<style scoped>
.estado {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
}
.good {
  background: var(--good-wash);
  color: var(--good-text);
}
.warning {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.serious {
  background: var(--serious-wash);
  color: var(--serious-text);
}
.critical {
  background: var(--critical-wash);
  color: var(--critical-text);
}
.info {
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .info {
  color: var(--ink);
}
.neutral {
  background: var(--surface-2);
  color: var(--ink-2);
}
</style>
