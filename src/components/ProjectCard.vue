<script setup lang="ts">
import { IconCheck, IconChevronRight, IconTrash } from '@tabler/icons-vue';
import { computed } from 'vue';
import ProgressSegments from '@/components/ProgressSegments.vue';
import type { ProjectSummary } from '@/db/projects';
import { currentStage } from '@/domain/progress';
import { STAGES } from '@/navigation';
import { formatNumber } from '@/utils/format';
import { relativeTime } from '@/utils/time';

const props = defineProps<{ summary: ProjectSummary }>();
defineEmits<{ open: []; remove: [] }>();

const project = computed(() => props.summary.project);
const current = computed(() => currentStage(props.summary.progress));
const finished = computed(() => !current.value);
const stageIndex = computed(() => (current.value ? STAGES.findIndex((s) => s.id === current.value?.id) + 1 : STAGES.length));
const stageLabel = computed(() => STAGES.find((s) => s.id === current.value?.id)?.shortLabel ?? '');
const started = computed(() => props.summary.progress.some((s) => s.done > 0));
</script>

<template>
  <article class="card proyecto">
    <button type="button" class="abrir" :aria-label="`Abrir ${project.name}`" @click="$emit('open')" />
    <div class="cabecera">
      <div class="titulos">
        <span v-if="project.code || project.sector" class="eyebrow">{{ [project.code, project.sector].filter(Boolean).join(' · ') }}</span>
        <span class="nombre">{{ project.name }}</span>
        <span v-if="project.client || project.city" class="lugar">{{ [project.client, project.city].filter(Boolean).join(' · ') }}</span>
      </div>
      <span v-if="finished" class="chip terminado"><IconCheck :size="14" stroke="2.4" />Terminado</span>
      <span v-else-if="started" class="chip"><span class="punto" />En curso</span>
      <span v-else class="chip nuevo">Nuevo</span>
    </div>

    <div class="avance">
      <ProgressSegments :progress="summary.progress" />
      <span v-if="finished" class="texto">Informe entregado · <strong>PGEE en seguimiento</strong></span>
      <span v-else class="texto">
        Etapa {{ stageIndex }} de 4 ·
        <strong>{{ stageLabel }} {{ Math.round((current?.ratio ?? 0) * 100) }} %</strong>
      </span>
    </div>

    <div class="metricas">
      <div>
        <span class="valor" :class="{ vacio: summary.billedAnnualKwh === null }">
          {{ summary.billedAnnualKwh === null ? '—' : formatNumber(summary.billedAnnualKwh) }}
        </span>
        <span class="unidad">{{ summary.billedAnnualKwh === null ? 'sin facturas aún' : 'kWh/año' }}</span>
      </div>
      <div>
        <span class="valor" :class="{ vacio: !project.areaM2 }">{{ project.areaM2 ? formatNumber(project.areaM2) : '—' }}</span>
        <span class="unidad">m²</span>
      </div>
      <div>
        <span class="valor">{{ formatNumber(summary.equipmentCount) }}</span>
        <span class="unidad">equipos</span>
      </div>
    </div>

    <div class="pie">
      <span>Actualizado {{ relativeTime(project.updatedAt) }}</span>
      <div class="acciones">
        <button type="button" class="eliminar" aria-label="Eliminar proyecto" @click.stop="$emit('remove')">
          <IconTrash :size="18" />
        </button>
        <span class="ir">Abrir<IconChevronRight :size="16" /></span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.proyecto {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.proyecto:hover {
  border-color: var(--field-border);
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
}
.abrir {
  position: absolute;
  inset: 0;
  z-index: 0;
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  cursor: pointer;
}
.cabecera,
.avance,
.metricas,
.pie {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
.cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.titulos {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.nombre {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.3;
}
.lugar {
  color: var(--ink-2);
  font-size: 13px;
}
.chip {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--info-wash);
  color: var(--navy);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.app-dark .chip {
  color: var(--ink);
}
.punto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.chip.terminado {
  gap: 4px;
  background: var(--accent-wash);
  color: var(--accent-ink);
}
.chip.nuevo {
  background: var(--surface-2);
  color: var(--ink-2);
}
.avance {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.texto {
  color: var(--ink-2);
  font-size: 12px;
}
.texto strong {
  color: var(--ink);
  font-weight: 600;
}
.metricas {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-top: 10px;
  border-top: 1px solid var(--divider);
}
.metricas > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.metricas > div + div {
  padding-left: 12px;
  border-left: 1px solid var(--divider);
}
.valor {
  font-size: 15px;
  font-weight: 600;
}
.valor.vacio {
  color: var(--muted);
}
.unidad {
  color: var(--muted);
  font-size: 11px;
}
.pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
}
.acciones {
  display: flex;
  align-items: center;
  gap: 4px;
}
.eliminar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  pointer-events: auto;
}
.eliminar:hover {
  background: var(--critical-wash);
  color: var(--critical);
}
.ir {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--accent-strong);
  font-size: 13px;
  font-weight: 600;
}
</style>
