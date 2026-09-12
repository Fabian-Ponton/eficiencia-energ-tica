<script setup lang="ts">
import { IconAlertTriangle, IconArrowLeft, IconCamera, IconChevronDown, IconCloudCheck, IconGauge, IconHome, IconPlug, IconPlus, IconReceipt, IconWifiOff } from '@tabler/icons-vue';
import { useOnline } from '@vueuse/core';
import Drawer from 'primevue/drawer';
import { computed, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import EmptyState from '@/components/EmptyState.vue';
import { provideCurrentProject } from '@/composables/useCurrentProject';
import { ALL_STEPS, STAGES } from '@/navigation';

const route = useRoute();
const router = useRouter();
const online = useOnline();
const { project, projectId } = provideCurrentProject();
const showQuick = ref(false);

const routeName = computed(() => (typeof route.name === 'string' ? route.name : ''));
const isHome = computed(() => routeName.value === 'inicio');
const activeStage = computed(() =>
  routeName.value === 'etapa' ? String(route.params.stage) : (ALL_STEPS.find((s) => s.id === routeName.value)?.stage ?? null),
);
const pageTitle = computed(() => {
  if (routeName.value === 'etapa') return STAGES.find((s) => s.id === activeStage.value)?.label ?? '';
  return ALL_STEPS.find((s) => s.id === routeName.value)?.label ?? '';
});

const stageTarget = (id: string) =>
  id === 'informes' ? { name: 'informes', params: { projectId: projectId.value } } : { name: 'etapa', params: { projectId: projectId.value, stage: id } };

const QUICK = [
  { label: 'Agregar equipo', icon: IconPlug, step: 'inventario' },
  { label: 'Tomar foto', icon: IconCamera, step: 'inventario' },
  { label: 'Registrar lectura', icon: IconGauge, step: 'mediciones' },
  { label: 'Registrar factura', icon: IconReceipt, step: 'facturacion' },
];

async function quick(step: string) {
  showQuick.value = false;
  await router.push({ name: step, params: { projectId: projectId.value } });
}
</script>

<template>
  <div class="shell">
    <aside class="lateral">
      <RouterLink to="/" class="marca"><AppLogo /><span>PONTIA</span></RouterLink>
      <RouterLink to="/" class="selector" title="Cambiar de proyecto">
        <span class="mono selector-eyebrow">PROYECTO{{ project?.code ? ` · ${project.code}` : '' }}</span>
        <span class="selector-nombre">
          <span>{{ project?.name ?? 'Cargando…' }}</span>
          <IconChevronDown :size="16" class="selector-flecha" />
        </span>
      </RouterLink>
      <nav class="menu" aria-label="Pasos de la auditoría">
        <RouterLink :to="{ name: 'inicio', params: { projectId } }" class="item" :class="{ activo: isHome }">
          <IconHome :size="18" class="item-icono" /><span>Inicio</span>
        </RouterLink>
        <div v-for="stage in STAGES" :key="stage.id" class="grupo">
          <span class="mono grupo-titulo">{{ stage.label.toUpperCase() }}</span>
          <RouterLink
            v-for="step in stage.steps"
            :key="step.id"
            :to="{ name: step.id, params: { projectId } }"
            class="item"
            :class="{ activo: routeName === step.id }"
          >
            <component :is="step.icon" :size="18" class="item-icono" /><span>{{ step.label }}</span>
          </RouterLink>
        </div>
      </nav>
      <div class="red-lateral">
        <IconCloudCheck v-if="online" :size="16" class="red-icono" />
        <IconWifiOff v-else :size="16" class="red-icono fuera" />
        <span>{{ online ? 'En línea · guardado en el equipo' : 'Sin conexión · todo se guarda aquí' }}</span>
      </div>
    </aside>

    <div class="principal">
      <header class="barra-movil">
        <RouterLink to="/" class="volver" aria-label="Volver a proyectos"><IconArrowLeft :size="22" /></RouterLink>
        <div v-if="isHome" class="marca-movil"><AppLogo :size="28" /><span>PONTIA</span></div>
        <div v-else class="titulo-movil">
          <span class="mono titulo-eyebrow">{{ (project?.code ? `${project.code} · ` : '') + pageTitle.toUpperCase() }}</span>
          <span class="titulo-nombre">{{ project?.name ?? 'Cargando…' }}</span>
        </div>
        <span class="red-movil" :class="{ fuera: !online }">
          <IconCloudCheck v-if="online" :size="16" />
          <IconWifiOff v-else :size="16" />
          <span>{{ online ? 'Guardado' : 'Sin conexión' }}</span>
        </span>
      </header>

      <main class="contenido">
        <div v-if="project === null" class="no-encontrado card">
          <EmptyState :icon="IconAlertTriangle" title="No encontramos este proyecto" text="Puede que se haya eliminado de este equipo.">
            <RouterLink to="/">Volver a proyectos</RouterLink>
          </EmptyState>
        </div>
        <RouterView v-else-if="project" v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav class="inferior" aria-label="Etapas de la auditoría">
      <RouterLink :to="{ name: 'inicio', params: { projectId } }" class="tab" :class="{ activo: isHome }">
        <span class="indicador" /><IconHome :size="22" /><span>Inicio</span>
      </RouterLink>
      <RouterLink v-for="stage in STAGES" :key="stage.id" :to="stageTarget(stage.id)" class="tab" :class="{ activo: activeStage === stage.id }">
        <span class="indicador" /><component :is="stage.icon" :size="22" /><span>{{ stage.shortLabel }}</span>
      </RouterLink>
    </nav>

    <button type="button" class="fab" aria-label="Agregar registro" @click="showQuick = true">
      <IconPlus :size="26" stroke="2.2" />
    </button>
    <Drawer v-model:visible="showQuick" position="bottom" header="Agregar" :style="{ height: 'auto' }">
      <div class="rapidas">
        <button v-for="q in QUICK" :key="q.label" type="button" class="rapida" @click="quick(q.step)">
          <component :is="q.icon" :size="22" />
          <span>{{ q.label }}</span>
        </button>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100dvh;
}
.lateral {
  display: none;
}
.barra-movil {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 60px;
  padding: calc(6px + env(safe-area-inset-top)) 12px 6px 4px;
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 22px 22px;
  color: var(--on-navy);
}
.volver {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  color: var(--on-navy);
}
.marca-movil {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.titulo-movil {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.titulo-eyebrow {
  overflow: hidden;
  color: var(--on-navy-3);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.titulo-nombre {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.red-movil {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--on-navy-2);
  font-size: 12px;
}
.red-movil svg {
  color: var(--accent);
}
.red-movil.fuera svg {
  color: var(--warning);
}
.contenido {
  padding-bottom: calc(var(--bottom-nav-height) + 88px + env(safe-area-inset-bottom));
}
.no-encontrado {
  margin: 16px;
}
.inferior {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  height: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom));
  padding: 6px 4px env(safe-area-inset-bottom);
  border-top: 1px solid var(--border);
  background: var(--surface);
}
.tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  text-decoration: none;
}
.tab.activo {
  color: var(--navy);
  font-weight: 600;
}
.app-dark .tab.activo {
  color: var(--ink);
}
.indicador {
  position: absolute;
  top: -6px;
  width: 28px;
  height: 3px;
  border-radius: 0 0 3px 3px;
}
.tab.activo .indicador {
  background: var(--accent);
}
.fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--bottom-nav-height) + 16px + env(safe-area-inset-bottom));
  z-index: 41;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 16px;
  background: var(--accent);
  box-shadow: var(--shadow-fab);
  color: #fff;
  cursor: pointer;
  transition: transform 150ms var(--ease);
}
.fab:active {
  transform: scale(0.95);
}
.rapidas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-bottom: env(safe-area-inset-bottom);
}
.rapida {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.rapida svg {
  flex-shrink: 0;
  color: var(--accent-strong);
}

@media (min-width: 1024px) {
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  }
  .lateral {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
    height: 100dvh;
    overflow-y: auto;
    padding: 18px 14px 16px;
    background-color: var(--navy);
    background-image: var(--blueprint);
    background-size: 22px 22px;
    color: var(--on-navy);
  }
  .barra-movil,
  .inferior,
  .fab {
    display: none;
  }
  .contenido {
    padding-bottom: 32px;
  }
}
.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px;
  color: var(--on-navy);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-decoration: none;
}
.selector {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--on-navy);
  text-decoration: none;
}
.selector-eyebrow {
  color: var(--on-navy-3);
  font-size: 10px;
  letter-spacing: 0.1em;
}
.selector-nombre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}
.selector-nombre > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selector-flecha {
  flex-shrink: 0;
  color: var(--on-navy-3);
}
.menu {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grupo {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.grupo-titulo {
  padding: 0 10px 4px;
  color: #8a9bb8;
  font-size: 10px;
  letter-spacing: 0.1em;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--on-navy-2);
  font-size: 13px;
  text-decoration: none;
  transition: background-color 150ms var(--ease);
}
.item:hover {
  background: rgba(255, 255, 255, 0.06);
}
.item-icono {
  flex-shrink: 0;
  color: var(--on-navy-3);
}
.item.activo {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 600;
}
.item.activo .item-icono {
  color: var(--accent);
}
.red-lateral {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--on-navy-2);
  font-size: 12px;
}
.red-icono {
  flex-shrink: 0;
  color: var(--accent);
}
.red-icono.fuera {
  color: var(--warning);
}
</style>
