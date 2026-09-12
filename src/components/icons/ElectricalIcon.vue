<script setup lang="ts">
import type { ElectricalKind } from '@/domain/types';

/** Íconos propios del sistema eléctrico, con el mismo trazo que Tabler. */
withDefaults(defineProps<{ kind: ElectricalKind; size?: number; stroke?: number | string }>(), { size: 24, stroke: 1.8 });
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Torre de la red en media tensión -->
    <template v-if="kind === 'red'">
      <path d="M8 21l4-18 4 18" />
      <path d="M5 7h14" />
      <path d="M6.5 11h11" />
      <path d="M9.9 14l4.2 4.5" />
      <path d="M14.1 14l-4.2 4.5" />
    </template>
    <!-- Símbolo del transformador: dos devanados -->
    <template v-else-if="kind === 'transformador'">
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </template>
    <!-- Medidor de energía con pantalla y disco -->
    <template v-else-if="kind === 'medidor'">
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <rect x="7.5" y="6" width="9" height="4" rx="1" />
      <circle cx="12" cy="15.5" r="2.5" />
      <path d="M12 15.5l1.6-1.6" />
    </template>
    <!-- Acometida: conductor que baja al tablero -->
    <template v-else-if="kind === 'acometida'">
      <circle cx="4" cy="6" r="1.6" />
      <path d="M5.6 6H8a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h4.4" />
      <circle cx="20" cy="18" r="1.6" />
      <path d="M8 3.5v5" />
      <path d="M16 15.5v5" />
    </template>
    <!-- Tablero con sus interruptores -->
    <template v-else-if="kind === 'tablero'">
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M12 5.5v13" />
      <path d="M8 8h2" />
      <path d="M14 8h2" />
      <path d="M8 12h2" />
      <path d="M14 12h2" />
      <path d="M8 16h2" />
      <path d="M14 16h2" />
    </template>
    <!-- Circuito ramal: interruptor -->
    <template v-else>
      <path d="M2 14h4.5" />
      <circle cx="7.5" cy="14" r="1" />
      <path d="M8.4 13.5l8-5" />
      <circle cx="16.5" cy="14" r="1" />
      <path d="M17.5 14H22" />
    </template>
  </svg>
</template>
