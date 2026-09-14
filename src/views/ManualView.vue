<script setup lang="ts">
import { IconArrowLeft, IconChevronDown, IconDeviceFloppy, IconDownload, IconHelpCircle, IconListCheck, IconPlayerPlay, IconPrinter } from '@tabler/icons-vue';
import { useEventListener } from '@vueuse/core';
import Button from 'primevue/button';
import { useToast } from 'primevue/usetoast';
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import { MANUAL_DATA, MANUAL_FAQ, MANUAL_HIGHLIGHTS, MANUAL_MINIMUM, MANUAL_SECTIONS, MANUAL_START, MANUAL_WHAT } from '@/content/manual';
import { findStep, stepEyebrow, STAGES } from '@/navigation';
import { deliverFile } from '@/utils/share';

const toast = useToast();

const stageOf = (id: string) => STAGES.find((s) => s.id === id);
const stepOf = (id: string) => findStep(id);

/** El índice no puede usar enlaces «#…»: el router trabaja con hash y cambiaría de pantalla. */
function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// El manual en Word se arma con el mismo texto de esta pantalla
const downloading = ref(false);
async function download() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const { generateManual } = await import('@/reports/docx/manual');
    const file = await generateManual();
    const result = await deliverFile(file.blob, file.fileName);
    if (result === 'cancelado') return;
    toast.add({ severity: 'success', summary: result === 'compartido' ? 'Manual compartido' : 'Manual descargado', detail: file.fileName, life: 5000 });
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo generar el manual', detail: error instanceof Error ? error.message : String(error), life: 7000 });
  } finally {
    downloading.value = false;
  }
}

/** Al imprimir, las preguntas frecuentes se abren todas: si no, el papel sale sin las respuestas. */
const openQuestions = () => document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
useEventListener(window, 'beforeprint', openQuestions);
function print() {
  openQuestions();
  window.print();
}

const NEEDS = [
  { id: 'obligatorio', label: 'Obligatorio', text: 'Sin este dato la pantalla no puede calcular.' },
  { id: 'recomendado', label: 'Recomendado', text: 'Funciona sin él, pero el resultado queda incompleto.' },
  { id: 'opcional', label: 'Opcional', text: 'Suma precisión o detalle al informe.' },
];
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div class="contenido barra">
        <RouterLink to="/" class="volver" aria-label="Volver a proyectos"><IconArrowLeft :size="20" /></RouterLink>
        <div class="marca"><AppLogo /><span>PONTIA</span></div>
      </div>
    </header>

    <main class="contenido cuerpo">
      <section class="card portada">
        <span class="eyebrow">Manual de uso</span>
        <h1>Cómo se usa PONTIA</h1>
        <p class="entrada">{{ MANUAL_WHAT }}</p>
        <ul class="destacados">
          <li v-for="h in MANUAL_HIGHLIGHTS" :key="h.title">
            <strong>{{ h.title }}</strong>
            <span>{{ h.text }}</span>
          </li>
        </ul>
        <div class="acciones">
          <Button label="Descargar en Word" :loading="downloading" @click="download">
            <template #icon><IconDownload :size="18" /></template>
          </Button>
          <Button label="Imprimir" severity="secondary" outlined @click="print">
            <template #icon><IconPrinter :size="18" /></template>
          </Button>
        </div>
      </section>

      <nav class="indice card" aria-label="Contenido del manual">
        <span class="eyebrow">Contenido</span>
        <div class="chips">
          <button type="button" class="chip" @click="goTo('primeros-pasos')">Primeros pasos</button>
          <button v-for="section in MANUAL_SECTIONS" :key="section.id" type="button" class="chip" @click="goTo(`etapa-${section.id}`)">
            {{ stageOf(section.id)?.label }}
          </button>
          <button type="button" class="chip" @click="goTo('datos-minimos')">Datos mínimos</button>
          <button type="button" class="chip" @click="goTo('tus-datos')">Tus datos</button>
          <button type="button" class="chip" @click="goTo('preguntas')">Preguntas</button>
        </div>
      </nav>

      <section id="primeros-pasos" class="bloque">
        <h2 class="titulo-bloque"><IconPlayerPlay :size="20" />Primeros pasos</h2>
        <ol class="card pasos-inicio">
          <li v-for="(step, i) in MANUAL_START" :key="step.title">
            <span class="numero mono">{{ i + 1 }}</span>
            <span class="texto">
              <strong>{{ step.title }}</strong>
              <span>{{ step.text }}</span>
            </span>
          </li>
        </ol>
      </section>

      <section v-for="section in MANUAL_SECTIONS" :id="`etapa-${section.id}`" :key="section.id" class="bloque">
        <h2 class="titulo-bloque">
          <component :is="stageOf(section.id)?.icon" :size="20" />
          {{ stageOf(section.id)?.label }}
        </h2>
        <p class="intro">{{ section.intro }}</p>

        <article v-for="step in section.steps" :key="step.id" class="card pantalla">
          <header class="pantalla-cabecera">
            <span class="icono"><component :is="stepOf(step.id)?.icon" :size="20" /></span>
            <span class="titulos">
              <span class="eyebrow">{{ stepEyebrow(step.id) }}</span>
              <h3>{{ stepOf(step.id)?.label }}</h3>
            </span>
          </header>
          <p class="que-hace">{{ step.what }}</p>

          <span class="eyebrow etiqueta">Datos que necesita</span>
          <ul class="entradas">
            <li v-for="input in step.inputs" :key="input.label">
              <span class="dato">
                <span class="marca-need" :class="input.need" />
                {{ input.label }}
              </span>
              <span class="need" :class="input.need">{{ input.need }}</span>
              <span class="fuente">{{ input.source }}</span>
            </li>
          </ul>

          <p class="resultado"><strong>Qué obtienes:</strong> {{ step.result }}</p>
          <p v-if="step.tip" class="consejo">{{ step.tip }}</p>
        </article>
      </section>

      <section id="datos-minimos" class="bloque">
        <h2 class="titulo-bloque"><IconListCheck :size="20" />Datos mínimos para cada resultado</h2>
        <p class="intro">Si algo aparece vacío en la app, casi siempre falta uno de estos datos.</p>
        <ul class="card minimos">
          <li v-for="row in MANUAL_MINIMUM" :key="row.goal">
            <span class="meta">{{ row.goal }}</span>
            <span class="necesita">{{ row.needs }}</span>
          </li>
        </ul>
        <ul class="leyenda">
          <li v-for="n in NEEDS" :key="n.id">
            <span class="need" :class="n.id">{{ n.label }}</span>
            <span>{{ n.text }}</span>
          </li>
        </ul>
      </section>

      <section id="tus-datos" class="bloque">
        <h2 class="titulo-bloque"><IconDeviceFloppy :size="20" />Dónde se guardan tus datos</h2>
        <ul class="card lista-datos">
          <li v-for="d in MANUAL_DATA" :key="d.title">
            <strong>{{ d.title }}</strong>
            <span>{{ d.text }}</span>
          </li>
        </ul>
      </section>

      <section id="preguntas" class="bloque">
        <h2 class="titulo-bloque"><IconHelpCircle :size="20" />Preguntas frecuentes</h2>
        <div class="card preguntas">
          <details v-for="f in MANUAL_FAQ" :key="f.q">
            <summary>
              {{ f.q }}
              <IconChevronDown :size="18" class="flecha" />
            </summary>
            <p>{{ f.a }}</p>
          </details>
        </div>
      </section>

      <p class="cierre">
        PONTIA · plataforma de auditoría y eficiencia energética. Este manual se descarga en Word con el mismo contenido de esta pantalla.
      </p>
    </main>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100dvh;
  padding-bottom: 32px;
  background: var(--page);
}
.contenido {
  width: min(100%, 880px);
  margin: 0 auto;
  padding: 0 16px;
}
.cabecera {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--navy);
  color: var(--on-navy);
}
.barra {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
}
.volver {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: -6px;
  border-radius: 999px;
  color: var(--on-navy);
}
.marca {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-top: 16px;
}
.bloque {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 72px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.titulo-bloque {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
  font-size: 19px;
  font-weight: 600;
}
.titulo-bloque svg {
  flex-shrink: 0;
  color: var(--accent-strong);
}
.intro {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}

/* Portada */
.portada {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}
.entrada {
  margin: 0;
  color: var(--ink-2);
}
.destacados {
  display: grid;
  gap: 10px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}
.destacados li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--surface-2);
  font-size: 13.5px;
}
.destacados strong {
  font-size: 14px;
}
.destacados span {
  color: var(--muted);
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

/* Índice */
.indice {
  padding: 12px 14px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.chip {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 140ms var(--ease);
}
.chip:hover {
  background: var(--accent-wash);
  color: var(--accent-ink);
}

/* Primeros pasos */
.pasos-inicio {
  margin: 0;
  padding: 6px 0;
  list-style: none;
  counter-reset: paso;
}
.pasos-inicio li {
  display: flex;
  gap: 12px;
  padding: 10px 14px;
}
.pasos-inicio li + li {
  border-top: 1px solid var(--divider);
}
.numero {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--accent-wash);
  color: var(--accent-ink);
  font-size: 13px;
  font-weight: 600;
}
.pasos-inicio .texto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}
.pasos-inicio .texto span {
  color: var(--muted);
}

/* Ficha de cada pantalla */
.pantalla {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  break-inside: avoid;
}
.pantalla-cabecera {
  display: flex;
  align-items: center;
  gap: 12px;
}
.icono {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--accent-wash);
  color: var(--accent-strong);
}
.titulos {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.que-hace {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.etiqueta {
  margin-top: 2px;
}
.entradas {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.entradas li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  padding: 9px 0;
  border-top: 1px solid var(--divider);
}
.dato {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.marca-need {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--axis);
}
.marca-need.obligatorio {
  background: var(--critical);
}
.marca-need.recomendado {
  background: var(--accent);
}
.fuente {
  grid-column: 1 / -1;
  padding-left: 15px;
  color: var(--muted);
  font-size: 13px;
}
.need {
  align-self: start;
  justify-self: end;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.need.obligatorio {
  background: var(--critical-wash);
  color: var(--critical-text);
}
.need.recomendado {
  background: var(--accent-wash);
  color: var(--accent-ink);
}
.resultado {
  margin: 2px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--info-wash);
  font-size: 13.5px;
}
.consejo {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--warning);
  color: var(--ink-2);
  font-size: 13px;
  font-style: italic;
}

/* Datos mínimos */
.minimos {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}
.minimos li {
  display: grid;
  gap: 2px;
  padding: 10px 14px;
}
.minimos li + li {
  border-top: 1px solid var(--divider);
}
.meta {
  font-size: 14px;
  font-weight: 600;
}
.necesita {
  color: var(--muted);
  font-size: 13px;
}
.leyenda {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.leyenda li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}

/* Tus datos */
.lista-datos {
  margin: 0;
  padding: 4px 0;
  list-style: none;
}
.lista-datos li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  font-size: 14px;
}
.lista-datos li + li {
  border-top: 1px solid var(--divider);
}
.lista-datos span {
  color: var(--muted);
  font-size: 13px;
}

/* Preguntas */
.preguntas {
  padding: 2px 0;
}
details + details {
  border-top: 1px solid var(--divider);
}
summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
.flecha {
  flex-shrink: 0;
  color: var(--axis);
  transition: transform 160ms var(--ease);
}
details[open] .flecha {
  transform: rotate(180deg);
}
details p {
  margin: 0;
  padding: 0 14px 14px;
  color: var(--ink-2);
  font-size: 13.5px;
}
.cierre {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

@media (min-width: 720px) {
  .destacados {
    grid-template-columns: 1fr 1fr;
  }
  .minimos li {
    grid-template-columns: 5fr 7fr;
    gap: 16px;
    align-items: baseline;
  }
  .entradas li {
    grid-template-columns: minmax(180px, 1fr) 2fr auto;
    align-items: baseline;
  }
  .fuente {
    order: 2;
  }
  .need {
    order: 3;
  }
  .fuente {
    grid-column: auto;
    padding-left: 0;
  }
  h1 {
    font-size: 28px;
  }
}

/* Al imprimir (o guardar en PDF) queda solo el manual */
@media print {
  .cabecera,
  .indice,
  .acciones {
    display: none;
  }
  .pagina {
    background: #fff;
  }
  .card {
    border-color: #ddd;
  }
  details {
    break-inside: avoid;
  }
  details p {
    display: block;
  }
}
</style>
