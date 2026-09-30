<script setup lang="ts">
import { IconAlertOctagon, IconAlertTriangle, IconCircleCheck, IconHelpCircle } from '@tabler/icons-vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { RISK_LEVELS, type RiskLevel } from '@/domain/safety';
import type { Tone } from '@/ui/icons';

/** Nivel de riesgo de la matriz del RETIE con su color, su ícono y su texto: nunca solo color. Sin valorar dice «Por valorar». */
defineProps<{ level: RiskLevel | null }>();

const STYLE: Record<RiskLevel, { tone: Tone; icon: typeof IconAlertOctagon }> = {
  'muy-alto': { tone: 'critical', icon: IconAlertOctagon },
  alto: { tone: 'serious', icon: IconAlertTriangle },
  medio: { tone: 'warning', icon: IconAlertTriangle },
  bajo: { tone: 'good', icon: IconCircleCheck },
  'muy-bajo': { tone: 'good', icon: IconCircleCheck },
};
</script>

<template>
  <StatusChip v-if="level" :tone="STYLE[level].tone" :icon="STYLE[level].icon" :label="`Riesgo ${RISK_LEVELS[level].label.toLowerCase()}`" />
  <StatusChip v-else tone="neutral" :icon="IconHelpCircle" label="Por valorar" />
</template>
