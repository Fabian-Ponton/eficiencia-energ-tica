<script setup lang="ts">
import { IconArrowDown, IconArrowUp, IconCamera, IconChevronRight, IconDownload, IconFileZip, IconPlug, IconReceipt } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import MonthlyBars from '@/components/charts/MonthlyBars.vue';
import EmptyState from '@/components/EmptyState.vue';
import EndUseBar from '@/components/EndUseBar.vue';
import PhotoThumb from '@/components/photos/PhotoThumb.vue';
import PhotoViewer from '@/components/photos/PhotoViewer.vue';
import UpcomingTasks from '@/components/UpcomingTasks.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { formatBytes } from '@/composables/useStorageInfo';
import { backupFileName, exportProjectZip } from '@/db/backup';
import { markBackup } from '@/db/projects';
import { isActive } from '@/db/records';
import { getDb } from '@/db/schema';
import { annualEnergyKwh } from '@/domain/calc/equipment';
import { sum } from '@/domain/calc/stats';
import { currentStage } from '@/domain/progress';
import type { EndUseCategory } from '@/domain/types';
import { ALL_STEPS, STAGES } from '@/navigation';
import { formatMillionsCop, formatNumber, formatPercent } from '@/utils/format';
import { deliverFile } from '@/utils/share';
import { relativeTime } from '@/utils/time';

const db = getDb();
const toast = useToast();
const { projectId, project, summary } = useCurrentProject();
const bills = useLiveQuery(() => db.bills.where('projectId').equals(projectId.value).filter(isActive).sortBy('period'), [projectId], []);
const equipment = useLiveQuery(() => db.equipment.where('projectId').equals(projectId.value).filter(isActive).toArray(), [projectId], []);
const photos = useLiveQuery(() => db.photos.where('projectId').equals(projectId.value).filter(isActive).reverse().sortBy('takenAt'), [projectId], []);

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthOf = (period: string) => MONTHS[Number(period.slice(5, 7)) - 1] ?? period;
const monthYear = (period: string) => `${monthOf(period)} ${period.slice(0, 4)}`;

const lastYear = computed(() => (bills.value ?? []).slice(-12));
const previousYear = computed(() => {
  const all = bills.value ?? [];
  return all.length >= 24 ? all.slice(-24, -12) : [];
});
const billedKwh = computed(() => (lastYear.value.length === 12 ? sum(lastYear.value.map((b) => b.kwh)) : null));
const estimatedKwh = computed(() => sum((equipment.value ?? []).map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth))));

const hero = computed(() => {
  if (billedKwh.value !== null) {
    const first = lastYear.value[0].period;
    const last = lastYear.value[lastYear.value.length - 1].period;
    return { label: `Consumo anual · ${monthYear(first)} – ${monthYear(last)}`, kwh: billedKwh.value, fromBills: true };
  }
  if (estimatedKwh.value > 0) return { label: 'Consumo anual estimado · censo de carga', kwh: estimatedKwh.value, fromBills: false };
  return null;
});
const change = computed(() => {
  if (billedKwh.value === null || previousYear.value.length !== 12) return null;
  const previous = sum(previousYear.value.map((b) => b.kwh));
  return previous > 0 ? (billedKwh.value - previous) / previous : null;
});
const annualCost = computed(() => (lastYear.value.length === 12 ? sum(lastYear.value.map((b) => b.costCop)) : null));
const intensity = computed(() => (hero.value && project.value?.areaM2 ? hero.value.kwh / project.value.areaM2 : null));
const equipmentCount = computed(() => sum((equipment.value ?? []).map((e) => e.quantity)));
const monthlyAverage = computed(() => (lastYear.value.length ? sum(lastYear.value.map((b) => b.kwh)) / lastYear.value.length : 0));

const endUses = computed(() => {
  const totals: Partial<Record<EndUseCategory, number>> = {};
  for (const e of equipment.value ?? []) totals[e.category] = (totals[e.category] ?? 0) + annualEnergyKwh(e, e.operatingDaysPerMonth);
  return totals;
});

const progress = computed(() => summary.value?.progress ?? []);
const current = computed(() => currentStage(progress.value));
const currentIndex = computed(() => {
  const i = STAGES.findIndex((s) => s.id === current.value?.id);
  return i < 0 ? STAGES.length - 1 : i;
});
const stages = computed(() =>
  STAGES.map((stage, i) => {
    const p = progress.value.find((x) => x.id === stage.id);
    const complete = p ? p.done === p.total : false;
    return { ...stage, percent: Math.round((p?.ratio ?? 0) * 100), complete, current: i === currentIndex.value && !complete, reached: i <= currentIndex.value };
  }),
);
const nextStep = computed(() => {
  for (const stage of progress.value) {
    const pending = stage.steps.find((s) => !s.done);
    if (pending) return ALL_STEPS.find((s) => s.id === pending.id);
  }
  return undefined;
});
const stageTarget = (id: string) =>
  id === 'informes' ? { name: 'informes', params: { projectId: projectId.value } } : { name: 'etapa', params: { projectId: projectId.value, stage: id } };

// Registro fotográfico: las más recientes, con el visor sobre todas
const viewing = ref<number | null>(null);
const recentPhotos = computed(() => (photos.value ?? []).slice(0, 8));

// Respaldo .zip: en el celular abre el menú de compartir; en el PC se descarga
const exporting = ref(false);
async function downloadBackup() {
  const p = project.value;
  if (!p) return;
  exporting.value = true;
  try {
    const blob = await exportProjectZip(db, p.id);
    const name = backupFileName(p);
    const result = await deliverFile(blob, name);
    if (result !== 'cancelado') {
      await markBackup(db, p.id);
      toast.add({ severity: 'success', summary: result === 'compartido' ? 'Respaldo compartido' : 'Respaldo descargado', detail: `${name} · ${formatBytes(blob.size)}`, life: 5000 });
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo crear el respaldo', detail: error instanceof Error ? error.message : String(error), life: 6000 });
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="inicio">
    <section class="hero">
      <span class="mono hero-eyebrow">
        PROYECTO{{ project?.code ? ` ${project.code}` : '' }}{{ project?.sector ? ` · ${project.sector.toUpperCase()}` : '' }}
      </span>
      <h1>{{ project?.name }}</h1>
      <span v-if="project?.client || project?.city" class="hero-lugar">{{ [project?.client, project?.city].filter(Boolean).join(' · ') }}</span>

      <div class="hero-cifra">
        <template v-if="hero">
          <span class="mono hero-eyebrow">{{ hero.label.toUpperCase() }}</span>
          <div class="valor">
            <span class="numero">{{ formatNumber(hero.kwh) }}</span>
            <span class="unidad">kWh</span>
          </div>
          <span v-if="change !== null" class="delta">
            <IconArrowDown v-if="change < 0" :size="16" class="baja" />
            <IconArrowUp v-else :size="16" class="sube" />
            {{ formatPercent(Math.abs(change)) }} {{ change < 0 ? 'menos' : 'más' }} que el año anterior
          </span>
          <span v-else-if="!hero.fromBills" class="delta">Registra 12 facturas para comparar con el consumo real.</span>
        </template>
        <span v-else class="delta">Aún no hay facturas ni equipos registrados.</span>
      </div>
    </section>

    <div class="rejilla">
      <div class="card indicadores">
        <div class="indicador">
          <span class="eyebrow">Costo</span>
          <span class="valor-kpi">{{ annualCost === null ? '—' : formatMillionsCop(annualCost) }}</span>
          <span class="nota">{{ annualCost === null ? 'sin facturas' : 'COP al año' }}</span>
        </div>
        <div class="indicador">
          <span class="eyebrow">Intensidad</span>
          <span class="valor-kpi">{{ intensity === null ? '—' : formatNumber(intensity, 1) }}</span>
          <span class="nota">{{ intensity === null ? 'falta el área' : 'kWh/m²·año' }}</span>
        </div>
        <div class="indicador">
          <span class="eyebrow">Equipos</span>
          <span class="valor-kpi">{{ formatNumber(equipmentCount) }}</span>
          <span class="nota">en el censo de carga</span>
        </div>
      </div>

      <section class="card proceso">
        <div class="encabezado">
          <h2>Proceso de auditoría</h2>
          <span class="eyebrow">{{ current ? `Etapa ${currentIndex + 1} de 4` : 'Completo' }}</span>
        </div>
        <div class="etapas">
          <div class="linea" />
          <div class="linea avance" :style="{ width: `${(currentIndex / (STAGES.length - 1)) * 75}%` }" />
          <RouterLink v-for="stage in stages" :key="stage.id" :to="stageTarget(stage.id)" class="etapa">
            <span class="nodo" :class="{ lleno: stage.complete || stage.current, borde: stage.reached && !stage.complete && !stage.current }">
              <component :is="stage.icon" :size="20" />
            </span>
            <span class="etapa-nombre" :class="{ tenue: !stage.reached }">{{ stage.shortLabel }}</span>
            <span class="pista"><span class="relleno" :style="{ width: `${stage.percent}%` }" /></span>
            <span class="mono etapa-pct">{{ stage.percent }} %</span>
          </RouterLink>
        </div>
      </section>

      <RouterLink v-if="nextStep" :to="{ name: nextStep.id, params: { projectId } }" class="card siguiente">
        <span class="siguiente-icono"><component :is="nextStep.icon" :size="22" /></span>
        <span class="siguiente-texto">
          <span class="eyebrow">Siguiente paso</span>
          <strong>{{ nextStep.label }}</strong>
          <span>{{ nextStep.description }}</span>
        </span>
        <IconChevronRight :size="20" class="siguiente-flecha" />
      </RouterLink>

      <UpcomingTasks />

      <section class="card grafica">
        <div class="encabezado">
          <h2>Consumo mensual</h2>
          <span class="eyebrow">kWh · facturas</span>
        </div>
        <template v-if="lastYear.length">
          <MonthlyBars :labels="lastYear.map((b) => monthOf(b.period))" :values="lastYear.map((b) => b.kwh)" unit="kWh" title="Consumo mensual facturado" />
          <div class="pie-grafica">
            <span>Promedio <strong class="num">{{ formatNumber(monthlyAverage) }}</strong> kWh/mes</span>
            <span>{{ lastYear.length }} {{ lastYear.length === 1 ? 'factura' : 'facturas' }}</span>
          </div>
        </template>
        <EmptyState v-else :icon="IconReceipt" title="Sin facturas todavía" text="Con 12 meses de facturas verás el comportamiento mensual y anual.">
          <RouterLink :to="{ name: 'facturacion', params: { projectId } }">Registrar facturas</RouterLink>
        </EmptyState>
      </section>

      <section class="card usos">
        <div class="encabezado">
          <h2>Consumo por uso final</h2>
          <span class="eyebrow">Censo de carga</span>
        </div>
        <EndUseBar v-if="equipment?.length" :totals="endUses" />
        <EmptyState v-else :icon="IconPlug" title="Sin equipos todavía" text="Registra el inventario para ver en qué se usa la energía.">
          <RouterLink :to="{ name: 'inventario', params: { projectId } }">Agregar equipos</RouterLink>
        </EmptyState>
      </section>

      <section class="card fotos">
        <div class="encabezado">
          <h2>Registro fotográfico</h2>
          <span class="eyebrow">{{ photos?.length ?? 0 }} {{ photos?.length === 1 ? 'foto' : 'fotos' }}</span>
        </div>
        <div v-if="recentPhotos.length" class="mosaico">
          <button v-for="(photo, i) in recentPhotos" :key="photo.id" type="button" class="miniatura" :aria-label="`Ver foto ${i + 1}`" @click="viewing = i">
            <PhotoThumb :blob="photo.thumb ?? photo.blob" :alt="photo.caption ?? ''" />
          </button>
        </div>
        <p v-else class="vacio-fotos"><IconCamera :size="18" />Las fotos de espacios, equipos y tableros aparecen aquí. Usa el botón de cámara para tomar una.</p>
        <PhotoViewer v-model:index="viewing" :photos="photos ?? []" />
      </section>

      <section class="card respaldo">
        <span class="respaldo-icono"><IconFileZip :size="22" /></span>
        <div class="respaldo-texto">
          <strong>Respaldo del proyecto</strong>
          <span>
            {{ project?.lastBackupAt ? `Último respaldo ${relativeTime(project.lastBackupAt)}.` : 'Aún no has descargado un respaldo.' }}
            Incluye datos y fotos; ábrelo en otro equipo con «Importar respaldo».
          </span>
        </div>
        <Button :label="exporting ? 'Preparando…' : 'Descargar .zip'" :loading="exporting" severity="secondary" outlined @click="downloadBackup">
          <template #icon><IconDownload :size="18" /></template>
        </Button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 16px 22px;
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 22px 22px;
  color: var(--on-navy);
}
.hero-eyebrow {
  color: var(--on-navy-3);
  font-size: 11px;
  letter-spacing: 0.08em;
}
h1 {
  margin: 0;
  font-size: 21px;
  font-weight: 600;
  line-height: 1.25;
}
.hero-lugar {
  color: #b9c5d9;
  font-size: 13px;
}
.hero-cifra {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}
.valor {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.numero {
  font-size: 52px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.01em;
}
.unidad {
  color: #cfd8e6;
  font-size: 18px;
  font-weight: 500;
}
.delta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #dfe6f1;
  font-size: 13px;
}
.baja {
  color: var(--accent);
}
.sube {
  color: var(--serious);
}
.rejilla {
  display: grid;
  gap: 12px;
  padding: 12px 16px;
}
.indicadores {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.indicador {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px;
}
.indicador + .indicador {
  border-left: 1px solid var(--divider);
}
.indicador .eyebrow {
  font-size: 10px;
}
.valor-kpi {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
}
.nota {
  color: var(--muted);
  font-size: 11px;
}
.card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.encabezado {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.proceso,
.grafica,
.usos,
.fotos {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px;
}
.etapas {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.linea {
  position: absolute;
  top: 19px;
  left: 12.5%;
  width: 75%;
  height: 2px;
  background: var(--border);
}
.linea.avance {
  background: var(--navy);
  transition: width 400ms var(--ease);
}
.app-dark .linea.avance {
  background: var(--accent);
}
.etapa {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--ink);
  text-decoration: none;
}
.nodo {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  box-sizing: border-box;
  border: 1.5px solid var(--field-border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--axis);
}
.nodo.lleno {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
}
.nodo.borde {
  border-color: var(--navy);
  color: var(--navy);
}
.app-dark .nodo.lleno {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.etapa-nombre {
  font-size: 12px;
  font-weight: 600;
}
.etapa-nombre.tenue {
  color: var(--muted);
  font-weight: 500;
}
.pista {
  width: 56px;
  height: 4px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--accent-tint);
}
.relleno {
  display: block;
  height: 100%;
  background: var(--accent);
}
.etapa-pct {
  color: var(--muted);
  font-size: 11px;
}
.siguiente {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  color: var(--ink);
  text-decoration: none;
}
.siguiente:hover {
  border-color: var(--accent);
}
.siguiente-icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.siguiente-texto {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}
.siguiente-texto strong {
  font-size: 15px;
}
.siguiente-texto span:last-child {
  color: var(--muted);
}
.siguiente-flecha {
  flex-shrink: 0;
  color: var(--muted);
}
.pie-grafica {
  display: flex;
  justify-content: space-between;
  color: var(--muted);
  font-size: 12px;
}
.pie-grafica strong {
  color: var(--ink);
  font-weight: 600;
}
.mosaico {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.miniatura {
  aspect-ratio: 1;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: var(--surface-2);
  cursor: pointer;
}
.miniatura img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 200ms var(--ease);
}
.miniatura:hover img {
  transform: scale(1.04);
}
.vacio-fotos {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.vacio-fotos svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.respaldo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.respaldo-icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--info-wash);
  color: var(--navy);
}
.app-dark .respaldo-icono {
  color: var(--ink);
}
.respaldo-texto {
  display: flex;
  flex: 1 1 220px;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.respaldo-texto strong {
  font-size: 15px;
}
.respaldo-texto span {
  color: var(--muted);
}

@media (min-width: 1024px) {
  .inicio {
    padding: 24px 28px;
  }
  .hero {
    padding: 22px 26px 26px;
    border-radius: 12px;
  }
  /* La gráfica ocupa dos filas a la derecha; «Siguiente paso» y los usos finales se apilan a la izquierda */
  .rejilla {
    grid-template-areas:
      'kpi kpi'
      'proceso proceso'
      'siguiente grafica'
      'usos grafica'
      'fotos respaldo';
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    padding: 12px 0 0;
  }
  .indicadores {
    grid-area: kpi;
  }
  .proceso {
    grid-area: proceso;
  }
  .siguiente {
    grid-area: siguiente;
  }
  .grafica {
    grid-area: grafica;
  }
  .usos {
    grid-area: usos;
  }
  .fotos {
    grid-area: fotos;
  }
  .respaldo {
    grid-area: respaldo;
  }
  /* Con tareas en el plan, «Próximas tareas» va junto al respaldo y las fotos pasan abajo a lo ancho */
  .rejilla:has(> .tareas) {
    grid-template-areas:
      'kpi kpi'
      'proceso proceso'
      'siguiente grafica'
      'usos grafica'
      'tareas respaldo'
      'fotos fotos';
  }
  .tareas {
    grid-area: tareas;
  }
  .mosaico {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}
</style>
