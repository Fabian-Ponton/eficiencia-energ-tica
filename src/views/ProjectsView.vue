<script setup lang="ts">
import { IconAdjustmentsHorizontal, IconAlertTriangle, IconDatabase, IconFileImport, IconHistory, IconPlus, IconSearch, IconStack2 } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import EmptyState from '@/components/EmptyState.vue';
import InstallCard from '@/components/InstallCard.vue';
import NewProjectDialog from '@/components/NewProjectDialog.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import SettingsDialog from '@/components/SettingsDialog.vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { formatBytes, useStorageInfo } from '@/composables/useStorageInfo';
import { offerUndo } from '@/composables/useUndo';
import { backupFileName, describeBackup, exportProjectZip, openBackup, restoreBackup, type BackupInfo, type OpenedBackup, type RestoreMode } from '@/db/backup';
import { importLegacyIntoDb, readLegacyLocalStorage, type LegacyData } from '@/db/legacyImport';
import { addProject, listProjects, markBackup, restoreProject, softDeleteProject, summarizeProject, type NewProjectInput, type ProjectSummary } from '@/db/projects';
import { createSampleProject } from '@/db/sampleProject';
import { getDb } from '@/db/schema';
import { deliverFile } from '@/utils/share';
import { relativeTime } from '@/utils/time';

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

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

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

// La primera vez puede tardar unos segundos mientras se descargan las pantallas del proyecto
const sampleLoading = ref(false);
async function loadSample() {
  if (sampleLoading.value) return;
  sampleLoading.value = true;
  try {
    const project = await createSampleProject(db);
    toast.add({ severity: 'success', summary: 'Proyecto de ejemplo listo', detail: 'Datos ilustrativos del Bloque 6 para conocer la app.', life: 4000 });
    await open(project.id);
  } finally {
    sampleLoading.value = false;
  }
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
  const { id, name } = summary.project;
  confirm.require({
    header: 'Eliminar proyecto',
    message: `¿Eliminar «${name}»? Podrás deshacerlo enseguida.`,
    rejectProps: { label: 'Cancelar', severity: 'secondary', outlined: true },
    acceptProps: { label: 'Eliminar', severity: 'danger' },
    accept: async () => {
      await softDeleteProject(db, id);
      offerUndo(`Se eliminó «${name}»`, () => restoreProject(db, id));
    },
  });
}

// Respaldo .zip: para guardar copias y para pasar un proyecto del celular al PC
async function exportProject(summary: ProjectSummary) {
  const project = summary.project;
  try {
    const blob = await exportProjectZip(db, project.id);
    const name = backupFileName(project);
    const result = await deliverFile(blob, name);
    if (result === 'cancelado') return;
    await markBackup(db, project.id);
    toast.add({ severity: 'success', summary: result === 'compartido' ? 'Respaldo compartido' : 'Respaldo descargado', detail: `${name} · ${formatBytes(blob.size)}`, life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo crear el respaldo', detail: message(error), life: 6000 });
  }
}

const fileInput = ref<HTMLInputElement>();
const importing = ref(false);
const pending = shallowRef<{ backup: OpenedBackup; info: BackupInfo } | null>(null);

async function onBackupChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  importing.value = true;
  try {
    const backup = await openBackup(file);
    const info = await describeBackup(db, backup);
    // Si el proyecto está aquí, el auditor decide; si estaba eliminado, el respaldo lo recupera
    if (info.existing && !info.existing.deletedAt) pending.value = { backup, info };
    else await restore(backup, info.existing ? 'reemplazar' : 'auto');
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo importar el respaldo', detail: message(error), life: 7000 });
  } finally {
    importing.value = false;
  }
}

async function restore(backup: OpenedBackup, mode: RestoreMode) {
  pending.value = null;
  try {
    const { project, outcome } = await restoreBackup(db, backup, mode);
    await storage.requestPersistence();
    toast.add({
      severity: 'success',
      summary: outcome === 'reemplazado' ? 'Proyecto actualizado con el respaldo' : 'Proyecto importado',
      detail: outcome === 'copia' ? `Se creó «${project.name}».` : `«${project.name}» ya está en este equipo.`,
      life: 5000,
    });
    await open(project.id);
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo importar el respaldo', detail: message(error), life: 7000 });
  }
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

      <InstallCard />

      <TransitionGroup v-if="visible.length" name="list" tag="div" class="lista">
        <ProjectCard v-for="s in visible" :key="s.project.id" :summary="s" @open="open(s.project.id)" @remove="remove(s)" @export="exportProject(s)" />
      </TransitionGroup>

      <div v-else-if="summaries && !all.length" class="card">
        <EmptyState :icon="IconStack2" title="Crea tu primera auditoría" text="Todo lo que registres queda guardado en este equipo y funciona sin internet.">
          <Button label="Nuevo proyecto" @click="showNew = true" />
          <Button label="Ver proyecto de ejemplo" severity="secondary" outlined :loading="sampleLoading" @click="loadSample" />
          <Button label="Importar respaldo" severity="secondary" text :loading="importing" @click="fileInput?.click()">
            <template #icon><IconFileImport :size="18" /></template>
          </Button>
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
          El navegador podría liberar espacio. Instala la app y descarga respaldos para proteger tus datos.
        </span>
      </section>

      <div v-if="all.length" class="secundarias">
        <Button label="Importar respaldo" severity="secondary" outlined :loading="importing" @click="fileInput?.click()">
          <template #icon><IconFileImport :size="18" /></template>
        </Button>
        <Button label="Proyecto de ejemplo" severity="secondary" outlined :loading="sampleLoading" @click="loadSample">
          <template #icon><IconStack2 :size="18" /></template>
        </Button>
      </div>
      <input ref="fileInput" type="file" accept=".zip,application/zip" class="sr-only" tabindex="-1" aria-hidden="true" @change="onBackupChosen" />
    </main>

    <div class="accion-movil">
      <Button class="boton-grande" label="Nuevo proyecto" @click="showNew = true">
        <template #icon><IconPlus :size="22" stroke="2.2" /></template>
      </Button>
    </div>

    <NewProjectDialog v-model:visible="showNew" @create="create" />
    <SettingsDialog v-model:visible="showSettings" />

    <Dialog
      :visible="pending !== null"
      modal
      header="Este proyecto ya está en este equipo"
      :draggable="false"
      :style="{ width: 'min(520px, calc(100vw - 24px))' }"
      @update:visible="(isOpen: boolean) => !isOpen && (pending = null)"
    >
      <div v-if="pending" class="dialogo-respaldo">
        <p>«{{ pending.info.name }}» ya existe aquí. ¿Qué hacemos con el respaldo?</p>
        <dl class="comparacion">
          <div>
            <dt class="eyebrow">En este equipo</dt>
            <dd>Modificado {{ relativeTime(pending.info.existing?.updatedAt ?? Date.now()) }}</dd>
          </div>
          <div>
            <dt class="eyebrow">En el respaldo</dt>
            <dd>Creado {{ relativeTime(Date.parse(pending.info.exportedAt)) }}</dd>
          </div>
        </dl>
        <p class="nota-dialogo">
          «Reemplazar» deja este equipo igual al respaldo: lo que se haya registrado aquí después se pierde. «Importar como copia» conserva los dos.
        </p>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" text @click="pending = null" />
        <Button label="Importar como copia" severity="secondary" outlined @click="pending && restore(pending.backup, 'copia')" />
        <Button label="Reemplazar" severity="danger" @click="pending && restore(pending.backup, 'reemplazar')" />
      </template>
    </Dialog>
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
.app-dark .filtro.activo {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.nuevo-escritorio {
  display: none;
  margin-left: auto;
}
.lista {
  display: grid;
  gap: 12px;
}
.aviso-legado {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
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
  color: var(--warning-text);
}
.secundarias {
  display: flex;
  flex-wrap: wrap;
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
.dialogo-respaldo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}
.dialogo-respaldo p {
  margin: 0;
}
.comparacion {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--divider);
}
.comparacion div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--surface);
}
.comparacion dd {
  margin: 0;
  font-weight: 600;
}
.nota-dialogo {
  color: var(--muted);
  font-size: 13px;
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
