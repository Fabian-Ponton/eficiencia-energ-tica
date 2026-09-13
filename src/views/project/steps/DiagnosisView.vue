<script setup lang="ts">
import { IconCamera, IconLoader2, IconPlus, IconSparkles, IconZoomCheck } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, shallowRef } from 'vue';
import EmptyState from '@/components/EmptyState.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { useCurrentProject } from '@/composables/useCurrentProject';
import { useFabAction } from '@/composables/useFab';
import { usePhotoCounts, useProjectRecords } from '@/composables/useProjectRecords';
import { useQuickAdd } from '@/composables/useQuickAdd';
import { useRecordEditor } from '@/composables/useRecordEditor';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { endUseOf } from '@/domain/catalogs';
import { findingFromSuggestion, pendingSuggestions, SEVERITY_ORDER, type SuggestedFinding } from '@/domain/diagnosis';
import type { EndUseCategory, Finding } from '@/domain/types';
import { loadReportData } from '@/reports/data';
import { buildAuditModel } from '@/reports/model';
import { FINDING_STATE, SEVERITY_STATUS } from '@/ui/icons';
import { formatNumber } from '@/utils/format';
import FindingForm from './FindingForm.vue';

const db = getDb();
const toast = useToast();
const { projectId } = useCurrentProject();
const desktop = useMediaQuery('(min-width: 1024px)');
const { rows: findings, ready } = useProjectRecords('findings', (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.createdAt - a.createdAt);
const photoCounts = usePhotoCounts('hallazgo');

// Sugerencias: las reglas del análisis aplicadas a los datos de hoy
const suggestions = shallowRef<SuggestedFinding[]>([]);
const loadingSuggestions = ref(true);
onMounted(async () => {
  try {
    suggestions.value = buildAuditModel(await loadReportData(db, projectId.value)).findings;
  } catch {
    suggestions.value = [];
  } finally {
    loadingSuggestions.value = false;
  }
});
const pending = computed(() => pendingSuggestions(suggestions.value, findings.value));
const TONE_SEVERITY = { critical: 'critico', serious: 'alto', warning: 'medio', info: 'bajo', good: 'bajo' } as const;

const adopting = ref(false);
async function adopt(list: readonly SuggestedFinding[]) {
  if (adopting.value || !list.length) return;
  adopting.value = true;
  try {
    for (const s of list) await saveRecord(db, 'findings', findingFromSuggestion(s, projectId.value));
    toast.add({ severity: 'success', summary: list.length === 1 ? 'Hallazgo agregado' : `${list.length} hallazgos agregados`, detail: 'Complétalos con fotos y tu criterio.', life: 3000 });
  } finally {
    adopting.value = false;
  }
}

type Filter = 'todos' | Finding['status'];
const filter = ref<Filter>('todos');
const FILTERS = computed(() => [
  { value: 'todos' as const, label: `Todos · ${findings.value.length}` },
  ...(['abierto', 'en-medida', 'cerrado'] as const).map((s) => ({ value: s, label: `${FINDING_STATE[s].label} · ${findings.value.filter((f) => f.status === s).length}` })),
]);
const visibleFindings = computed(() => (filter.value === 'todos' ? findings.value : findings.value.filter((f) => f.status === filter.value)));

const stats = computed(() => {
  const count = (fn: (f: Finding) => boolean) => formatNumber(findings.value.filter(fn).length);
  return [
    { label: 'Hallazgos', value: formatNumber(findings.value.length) },
    { label: 'Críticos y altos', value: count((f) => f.severity === 'critico' || f.severity === 'alto') },
    { label: 'Abiertos', value: count((f) => f.status === 'abierto') },
    { label: 'Con evidencia', value: count((f) => (photoCounts.value.get(f.id) ?? 0) > 0), unit: 'con fotos' },
  ];
});

const categoryLabel = (c?: Finding['category']) =>
  !c ? null : c === 'electrico' ? 'Sistema eléctrico' : c === 'envolvente' ? 'Envolvente' : endUseOf(c as EndUseCategory).label;

const { visible, draft, isNew, errors, saving, openNew, openEdit, save, remove } = useRecordEditor('findings', {
  empty: () => ({ id: crypto.randomUUID(), projectId: projectId.value, title: '', severity: 'medio', auto: false, status: 'abierto' }),
  validate: (d) => ({ title: d.title.trim() ? undefined : 'Escribe el hallazgo en pocas palabras.' }),
  describe: (d) => d.title || 'Hallazgo',
  photoEntity: 'hallazgo',
});
useFabAction({ label: 'Agregar hallazgo', icon: IconPlus, run: () => openNew() });
useQuickAdd(() => openNew());
</script>

<template>
  <div class="vista">
    <PageHeader step="diagnostico" :stats="findings.length ? stats : undefined">
      <template v-if="desktop" #actions>
        <Button label="Agregar hallazgo" @click="openNew()">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </template>
    </PageHeader>

    <section v-if="loadingSuggestions || pending.length" class="card seccion sugerencias">
      <div class="cabecera-seccion">
        <h2><IconSparkles :size="18" />Sugeridos por los datos</h2>
        <span class="eyebrow">reglas del análisis · {{ loadingSuggestions ? 'revisando…' : `${pending.length} por revisar` }}</span>
        <Button v-if="pending.length > 1" label="Agregar todos" size="small" severity="secondary" outlined :disabled="adopting" @click="adopt(pending)" />
      </div>
      <p v-if="loadingSuggestions" class="nota"><IconLoader2 :size="15" class="girar" />Aplicando las reglas a los datos del proyecto…</p>
      <ul v-else class="lista-sugerencias">
        <li v-for="s in pending" :key="s.title" class="sugerencia">
          <StatusChip v-bind="SEVERITY_STATUS[TONE_SEVERITY[s.tone]]" />
          <span class="texto-sugerencia">
            <strong>{{ s.title }}</strong>
            <span>{{ s.detail }}</span>
          </span>
          <Button label="Agregar" size="small" text :disabled="adopting" @click="adopt([s])">
            <template #icon><IconPlus :size="16" /></template>
          </Button>
        </li>
      </ul>
    </section>

    <template v-if="findings.length">
      <ChoiceChips v-model="filter" :options="FILTERS" label="Filtrar por estado" />
      <TransitionGroup name="list" tag="div" class="rejilla">
        <button v-for="f in visibleFindings" :key="f.id" type="button" class="card hallazgo" :class="f.severity" @click="openEdit(f)">
          <span class="fila">
            <strong class="titulo">{{ f.title }}</strong>
            <StatusChip v-bind="SEVERITY_STATUS[f.severity]" />
          </span>
          <span v-if="f.description" class="descripcion">{{ f.description }}</span>
          <span class="datos">
            <StatusChip v-bind="FINDING_STATE[f.status]" />
            <span v-if="categoryLabel(f.category)" class="dato">{{ categoryLabel(f.category) }}</span>
            <span v-if="f.auto" class="dato"><IconSparkles :size="13" />Sugerido</span>
            <span v-if="photoCounts.get(f.id)" class="dato"><IconCamera :size="14" />{{ photoCounts.get(f.id) }}</span>
          </span>
        </button>
      </TransitionGroup>
      <div v-if="!visibleFindings.length" class="card">
        <EmptyState :icon="IconZoomCheck" title="Nada en este estado" text="Cambia el filtro para ver los demás hallazgos." />
      </div>
    </template>

    <div v-else-if="ready && !loadingSuggestions" class="card">
      <EmptyState
        :icon="IconZoomCheck"
        title="Aún no hay hallazgos"
        text="Registra lo que encontraste en el recorrido —equipos en mal estado, cargas encendidas sin uso, tableros calientes— con su evidencia fotográfica, o agrega los que sugieren los datos."
      >
        <Button label="Agregar el primer hallazgo" @click="openNew()" />
      </EmptyState>
    </div>

    <FormSheet
      v-model:visible="visible"
      :title="isNew ? 'Nuevo hallazgo' : draft.title || 'Hallazgo'"
      eyebrow="Diagnóstico"
      :saving="saving"
      :can-delete="!isNew"
      @submit="save"
      @delete="remove()"
    >
      <FindingForm :key="draft.id" v-model:draft="draft" :errors="errors" :project-id="projectId" />
    </FormSheet>
  </div>
</template>

<style scoped>
.sugerencias {
  border-left: 3px solid var(--accent);
}
.nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.lista-sugerencias {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sugerencia {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 10px;
  padding: 10px 0;
}
.sugerencia + .sugerencia {
  border-top: 1px solid var(--divider);
}
.texto-sugerencia {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 13px;
}
.texto-sugerencia strong {
  font-size: 14px;
}
.texto-sugerencia span {
  color: var(--ink-2);
}
.rejilla {
  display: grid;
  gap: 10px;
}
.hallazgo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-left: 3px solid var(--info-text, var(--border));
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 150ms var(--ease),
    box-shadow 150ms var(--ease);
}
.hallazgo:hover {
  box-shadow: 0 4px 16px rgba(16, 35, 75, 0.08);
}
.hallazgo.critico {
  border-left-color: var(--critical-text);
}
.hallazgo.alto {
  border-left-color: var(--serious-text);
}
.hallazgo.medio {
  border-left-color: var(--warning-text);
}
.hallazgo.bajo {
  border-left-color: var(--field-border);
}
.fila {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.titulo {
  font-size: 15px;
  line-height: 1.3;
}
.descripcion {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 13px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.datos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.dato {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
@media (max-width: 640px) {
  .sugerencia {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .sugerencia > :first-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
@media (min-width: 1024px) {
  .rejilla {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
