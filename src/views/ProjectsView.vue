<script setup lang="ts">
import { IconAdjustmentsHorizontal, IconAlertTriangle, IconDatabase, IconHistory, IconPlus, IconSearch, IconStack2 } from '@tabler/icons-vue';
import Button from 'primevue/button';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import EmptyState from '@/components/EmptyState.vue';
import NewProjectDialog from '@/components/NewProjectDialog.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { formatBytes, useStorageInfo } from '@/composables/useStorageInfo';
import { importLegacyIntoDb, readLegacyLocalStorage, type LegacyData } from '@/db/legacyImport';
import { addProject, listProjects, restoreProject, softDeleteProject, summarizeProject, type NewProjectInput, type ProjectSummary } from '@/db/projects';
import { createSampleProject } from '@/db/sampleProject';
import { getDb } from '@/db/schema';

const db = getDb();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const storage = useStorageInfo();

const summaries = useLiveQuery(async () => Promise.all((await listProjects(db)).map((p) => summarizeProject(db, p))), [], []);

type Filter = 'todos' | 'curso' | 'terminados';
const filter = ref<Filter>('todos');
const search = ref('');
const showNew = ref(false);
const showSettings = ref(false);
const lastDeleted = ref<ProjectSummary | null>(null);

const isFinished = (s: ProjectSummary) => s.progress.every((stage) => stage.done === stage.total);
const all = computed(() => summaries.value ?? []);
const counts = computed(() => ({
  todos: all.value.length,
  curso: all.value.filter((s) => !isFinished(s)).length,
  terminados: all.value.filter(isFinished).length,
}));
const visible = computed(() => {
  const q = search.value.trim().toLowerCase();
  return all.value.filter((s) => {
    if (filter.value === 'curso' && isFinished(s)) return false;
    if (filter.value === 'terminados' && !isFinished(s)) return false;
    if (!q) return true;
    const p = s.project;
    return [p.name, p.client, p.city, p.code].some((text) => text?.toLowerCase().includes(q));
  });
});
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'curso', label: 'En curso' },
  { id: 'terminados', label: 'Terminados' },
];

// Datos que PONTIA 1.6 haya dejado en este navegador
const LEGACY_DONE_KEY = 'pontia-legacy-importado';
function readLegacy(): LegacyData | null {
  try {
    return localStorage.getItem(LEGACY_DONE_KEY) ? null : readLegacyLocalStorage(localStorage);
  } catch {
    return null;
  }
}
const legacy = ref<LegacyData | null>(readLegacy());

const open = (id: string) => router.push({ name: 'inicio', params: { projectId: id } });

async function create(input: NewProjectInput) {
  const project = await addProject(db, input);
  showNew.value = false;
  await storage.requestPersistence();
  await open(project.id);
}

async function loadSample() {
  const project = await createSampleProject(db);
  toast.add({ severity: 'success', summary: 'Proyecto de ejemplo listo', detail: 'Datos ilustrativos del Bloque 6 para conocer la app.', life: 4000 });
  await open(project.id);
}

async function importLegacy() {
  if (!legacy.value) return;
  const imported = await importLegacyIntoDb(db, legacy.value);
  try {
    localStorage.setItem(LEGACY_DONE_KEY, String(Date.now()));
  } catch {
    // Sin acceso al almacenamiento: el aviso volverá a aparecer, pero los datos ya quedaron importados
  }
  legacy.value = null;
  toast.add({
    severity: imported.warnings.length ? 'warn' : 'success',
    summary: 'Datos de PONTIA 1.6 importados',
    detail: imported.warnings.length ? imported.warnings.join(' ') : `Se creó el proyecto «${imported.project.name}».`,
    life: 7000,
  });
}

function remove(summary: ProjectSummary) {
  confirm.require({
    header: 'Eliminar proyecto',
    message: `¿Eliminar «${summary.project.name}»? Podrás deshacerlo enseguida.`,
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Eliminar', severity: 'danger' },
    accept: async () => {
      await softDeleteProject(db, summary.project.id);
      lastDeleted.value = summary;
    },
  });
}

async function undoDelete() {
  if (!lastDeleted.value) return;
  await restoreProject(db, lastDeleted.value.project.id);
  lastDeleted.value = null;
}

const storagePercent = computed(() =>
  storage.usage.value !== null && storage.quota.value ? Math.max(1, Math.round((storage.usage.value / storage.quota.value) * 100)) : 0,
);
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div class="contenido">
        <div class="barra">
          <div class="marca">
            <AppLogo />
            <span>PONTIA</span>
          </div>
          <button type="button" class="boton-ajustes" aria-label="Ajustes" @click="showSettings = true">
            <IconAdjustmentsHorizontal :size="20" />
          </button>
        </div>
        <div class="titulo">
          <h1>Proyectos</h1>
          <span class="mono subtitulo">{{ counts.todos }} AUDITORÍA{{ counts.todos === 1 ? '' : 'S' }} · GUARDADAS EN ESTE EQUIPO</span>
        </div>
        <label class="buscador">
          <IconSearch :size="18" />
          <span class="sr-only">Buscar proyectos</span>
          <input v-model="search" type="search" placeholder="Buscar por cliente, ciudad o código" />
        </label>
      </div>
    </header>

    <main class="contenido cuerpo">
      <div class="filtros" role="tablist" aria-label="Filtrar proyectos">
        <button
          v-for="f in FILTERS"
          :key="f.id"
          type="button"
          role="tab"
          class="filtro"
          :class="{ activo: filter === f.id }"
          :aria-selected="filter === f.id"
          @click="filter = f.id"
        >
          {{ f.label }} · {{ counts[f.id] }}
        </button>
        <Button class="nuevo-escritorio" label="Nuevo proyecto" @click="showNew = true">
          <template #icon><IconPlus :size="18" stroke="2.2" /></template>
        </Button>
      </div>

      <section v-if="legacy" class="card aviso-legado">
        <IconHistory :size="22" class="icono-legado" />
        <div class="texto-legado">
          <strong>Encontramos datos de PONTIA 1.6 en este navegador</strong>
          <span>Impórtalos como un proyecto nuevo; tus fotos quedan asociadas a cada equipo.</span>
        </div>
        <Button label="Importar" size="small" @click="importLegacy" />
      </section>

      <section v-if="lastDeleted" class="card aviso-borrado" role="status">
        <span>Se eliminó «{{ lastDeleted.project.name }}».</span>
        <Button label="Deshacer" size="small" text @click="undoDelete" />
      </section>

      <TransitionGroup v-if="visible.length" name="list" tag="div" class="lista">
        <ProjectCard
          v-for="s in visible"
          :key="s.project.id"
          :summary="s"
          @open="open(s.project.id)"
          @remove="remove(s)"
        />
      </TransitionGroup>

      <div v-else-if="summaries && !all.length" class="card">
        <EmptyState :icon="IconStack2" title="Crea tu primera auditoría" text="Todo lo que registres queda guardado en este equipo y funciona sin internet.">
          <Button label="Nuevo proyecto" @click="showNew = true" />
          <Button label="Ver proyecto de ejemplo" severity="secondary" outlined @click="loadSample" />
        </EmptyState>
      </div>

      <div v-else-if="summaries" class="card">
        <EmptyState :icon="IconSearch" title="Sin resultados" text="Prueba con otro nombre, ciudad o código." />
      </div>

      <section class="card almacenamiento">
        <div class="fila">
          <div class="icono-caja"><IconDatabase :size="20" /></div>
          <div class="texto-almacen">
            <strong>Almacenamiento en este equipo</strong>
            <span v-if="storage.usage.value !== null && storage.quota.value">
              {{ formatBytes(storage.usage.value) }} de {{ formatBytes(storage.quota.value) }} · funciona sin internet
            </span>
            <span v-else>Funciona sin internet</span>
          </div>
        </div>
        <div class="pista"><div class="uso" :style="{ width: `${storagePercent}%` }" /></div>
        <span v-if="storage.persisted.value === false" class="nota">
          <IconAlertTriangle :size="16" class="alerta" />
          El navegador podría liberar espacio. Instala la app para proteger tus datos.
        </span>
      </section>

      <div v-if="all.length" class="secundarias">
        <Button label="Proyecto de ejemplo" severity="secondary" outlined @click="loadSample">
          <template #icon><IconStack2 :size="18" /></template>
        </Button>
      </div>
    </main>

    <div class="accion-movil">
      <Button class="boton-grande" label="Nuevo proyecto" @click="showNew = true">
        <template #icon><IconPlus :size="22" stroke="2.2" /></template>
      </Button>
    </div>

    <NewProjectDialog v-model:visible="showNew" @create="create" />
    <SettingsDialog v-model:visible="showSettings" />
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100dvh;
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}
.contenido {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
}
.cabecera {
  padding: calc(14px + env(safe-area-inset-top)) 16px 18px;
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 22px 22px;
  color: var(--on-navy);
}
.cabecera .contenido {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.boton-ajustes {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--on-navy-2);
  cursor: pointer;
}
.titulo {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
}
.subtitulo {
  color: var(--on-navy-3);
  font-size: 11px;
  letter-spacing: 0.08em;
}
.buscador {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--on-navy-2);
}
.buscador input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--on-navy);
  font: inherit;
  font-size: 14px;
}
.buscador input::placeholder {
  color: var(--on-navy-3);
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.filtro {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
}
.filtro.activo {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
  font-weight: 600;
}
.nuevo-escritorio {
  display: none;
  margin-left: auto;
}
.lista {
  display: grid;
  gap: 12px;
}
.aviso-legado,
.aviso-borrado {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.aviso-legado {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.icono-legado {
  flex-shrink: 0;
  color: var(--accent-strong);
}
.texto-legado {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.aviso-borrado {
  justify-content: space-between;
  font-size: 14px;
}
.almacenamiento {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
.fila {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icono-caja {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--page);
  color: var(--ink);
}
.texto-almacen {
  display: flex;
  flex-direction: column;
  gap: 1px;
  font-size: 14px;
}
.texto-almacen span {
  color: var(--muted);
  font-size: 12px;
}
.pista {
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--divider);
}
.uso {
  height: 100%;
  background: var(--navy);
}
.app-dark .uso {
  background: var(--accent);
}
.nota {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-2);
  font-size: 12px;
}
.alerta {
  flex-shrink: 0;
  color: var(--warning-ink);
}
.secundarias {
  display: flex;
  gap: 10px;
}
.accion-movil {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.boton-grande {
  width: 100%;
  height: 52px;
  font-size: 16px;
}
@media (min-width: 768px) {
  .pagina {
    padding-bottom: 48px;
  }
  .cabecera {
    padding: 20px 32px 24px;
  }
  .cuerpo {
    padding: 20px 32px;
  }
  .lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .accion-movil {
    display: none;
  }
  .nuevo-escritorio {
    display: inline-flex;
  }
}
</style>
