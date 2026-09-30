<script setup lang="ts">
import { IconAlertTriangle, IconArrowLeft, IconCheck, IconCircleCheck, IconCircleDashed, IconCloudCheck, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import NumberInput from '@/components/ui/NumberInput.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import { getSettings, saveAuditorProfile } from '@/db/settings';
import { getDb } from '@/db/schema';
import { AUDITOR_KINDS, auditorChecklist, CONTE_CATEGORIES, DEMAND_SECTORS, emptyAuditor, registryReminderDate, REGISTRY_STATUS_LABEL } from '@/domain/auditor';
import { groupStatus } from '@/domain/compliance';
import type { AuditorProfile, ProfessionalRegistry } from '@/domain/types';
import { formatDate } from '@/utils/dates';

/**
 * Perfil del auditor (Res. 40412 de 2024, art. 6). Se guarda solo en este equipo: no viaja en la nube ni en los respaldos, y nunca incluye la
 * cédula. Sirve para verificar el artículo y para imprimir «Datos del auditor» en el informe.
 */
const db = getDb();
const profile = reactive<AuditorProfile>(emptyAuditor());
const status = ref<'guardado' | 'guardando' | 'error'>('guardado');
const ready = ref(false);
let loaded = false;

onMounted(async () => {
  const saved = (await getSettings(db)).auditor;
  if (saved) Object.assign(profile, { ...emptyAuditor(), ...JSON.parse(JSON.stringify(saved)) });
  ready.value = true;
  await nextTick();
  loaded = true;
});

const persist = useDebounceFn(async () => {
  try {
    await saveAuditorProfile(db, profile);
    status.value = 'guardado';
  } catch {
    status.value = 'error';
  }
}, 600);
watch(
  profile,
  () => {
    if (!loaded) return;
    status.value = 'guardando';
    void persist();
  },
  { deep: true },
);

const checklist = computed(() => auditorChecklist(profile));
const verification = computed(() => groupStatus(checklist.value));
const reminder = computed(() => registryReminderDate(profile));

const KIND_OPTIONS = AUDITOR_KINDS.map((k) => ({ value: k.id, label: k.label }));
const kindHint = computed(() => AUDITOR_KINDS.find((k) => k.id === profile.kind)?.hint);
const TRAINING_KINDS = [
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificacion', label: 'Certificación' },
] as const;
const SECTOR_OPTIONS = DEMAND_SECTORS.map((s) => ({ value: s.id, label: s.label }));
const REGISTRY_STATES = (Object.keys(REGISTRY_STATUS_LABEL) as (keyof typeof REGISTRY_STATUS_LABEL)[]).map((s) => ({ value: s, label: REGISTRY_STATUS_LABEL[s] }));

const newId = () => crypto.randomUUID();
const addTraining = () => profile.training.push({ id: newId(), kind: 'diploma', institution: '', program: '', backed: false });
const addExperience = () => profile.experience.push({ id: newId(), sector: 'oficial', description: '', backed: false });

/** Las matrículas se crean al escribir el primer dato: sin ellas el perfil no lleva un objeto vacío. */
function registry(kind: 'copnia' | 'conte'): ProfessionalRegistry {
  profile[kind] ??= {};
  return profile[kind] as ProfessionalRegistry;
}
const toggleCategory = (category: string) => {
  const r = registry('conte');
  const list = new Set(r.categories ?? []);
  if (list.has(category)) list.delete(category);
  else list.add(category);
  r.categories = CONTE_CATEGORIES.filter((c) => list.has(c));
};
const hasCategory = (category: string) => profile.conte?.categories?.includes(category) ?? false;

/** Campo de texto ligado a una matrícula. */
const field = (kind: 'copnia' | 'conte', key: 'number' | 'profession' | 'issuedAt' | 'verifiedAt' | 'link') => ({
  get: () => profile[kind]?.[key] ?? '',
  set: (value: string) => {
    registry(kind)[key] = value || undefined;
  },
});
const registryFields = {
  copnia: { number: field('copnia', 'number'), profession: field('copnia', 'profession'), issuedAt: field('copnia', 'issuedAt'), verifiedAt: field('copnia', 'verifiedAt'), link: field('copnia', 'link') },
  conte: { number: field('conte', 'number'), issuedAt: field('conte', 'issuedAt'), verifiedAt: field('conte', 'verifiedAt'), link: field('conte', 'link') },
};
</script>

<template>
  <div class="pagina">
    <header class="cabecera">
      <div class="contenido barra">
        <RouterLink to="/" class="volver" aria-label="Volver a proyectos"><IconArrowLeft :size="20" /></RouterLink>
        <div class="marca"><AppLogo /><span>PONTIA</span></div>
        <span class="guardado" :class="{ alerta: status === 'error' }" role="status">
          <IconLoader2 v-if="status === 'guardando'" :size="16" class="girar" />
          <IconAlertTriangle v-else-if="status === 'error'" :size="16" />
          <IconCloudCheck v-else :size="16" />
          {{ { guardado: 'Guardado', guardando: 'Guardando…', error: 'No se pudo guardar' }[status] }}
        </span>
      </div>
    </header>

    <main class="contenido cuerpo">
      <section class="card portada">
        <span class="eyebrow">Res. 40412 de 2024 · art. 6</span>
        <h1>Perfil del auditor</h1>
        <p class="entrada">
          Quién hace la auditoría y con qué la acredita. Se guarda <strong>solo en este equipo</strong>: no viaja en la nube ni en los respaldos, y <strong>nunca incluye la cédula</strong>. El informe lo imprime como
          «Datos del auditor» y tú decides si muestra los números de matrícula.
        </p>
        <div class="estado-verificacion">
          <StatusChip v-if="verification.complete" tone="good" label="Los requisitos del art. 6 están completos" :icon="IconCheck" />
          <StatusChip v-else tone="warning" :label="`${verification.missing.length === 1 ? 'Falta' : 'Faltan'} ${verification.missing.length} de ${verification.total} requisitos del art. 6`" :icon="IconAlertTriangle" />
        </div>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Quién audita</h2>
          <span class="eyebrow">art. 6 · tipo y nombre</span>
        </div>
        <div class="campo">
          <span class="etiqueta">Tipo de auditor</span>
          <ChoiceChips v-model="profile.kind" :options="KIND_OPTIONS" label="Tipo de auditor" />
          <small v-if="kindHint" class="ayuda">{{ kindHint }}</small>
        </div>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">{{ profile.kind === 'juridica' ? 'Razón social' : 'Nombre completo' }}</span>
            <InputText v-model="profile.name" :placeholder="profile.kind === 'juridica' ? 'Razón social de la empresa' : 'Nombre y apellidos'" />
          </label>
          <label v-if="profile.kind === 'juridica'" class="campo">
            <span class="etiqueta">NIT</span>
            <InputText v-model="profile.nit" class="mono" inputmode="numeric" placeholder="900.000.000-0" />
          </label>
        </div>
        <label class="fila-interruptor">
          <span>
            {{ profile.kind === 'juridica' ? 'Reuní el certificado de existencia y representación legal y el RUT' : 'Reuní la cédula (o el RUT)' }}
            <small>La entidad los verifica (art. 6, par. 2, literal a). Aquí solo se marca que están reunidos: PONTIA no guarda el número ni la copia.</small>
          </span>
          <input v-model="profile.identityDocs" type="checkbox" class="casilla" :aria-label="'Documento de identidad reunido'" />
        </label>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Formación</h2>
          <span class="eyebrow">diploma o certificación en gestión de la energía, auditorías energéticas o afines</span>
          <Button label="Agregar" size="small" severity="secondary" outlined @click="addTraining">
            <template #icon><IconPlus :size="16" /></template>
          </Button>
        </div>
        <p v-if="!profile.training.length" class="nota">Sin formación registrada todavía. Para una persona jurídica, va la del personal vinculado (art. 6, par. 1).</p>
        <div v-for="(t, index) in profile.training" :key="t.id" class="fila">
          <div class="campo">
            <span class="etiqueta">Documento</span>
            <ChoiceChips v-model="t.kind" :options="TRAINING_KINDS" :label="`Tipo de documento de formación ${index + 1}`" />
          </div>
          <div class="form-grid">
            <label class="campo">
              <span class="etiqueta">Institución que lo otorgó</span>
              <InputText v-model="t.institution" placeholder="Universidad, organismo certificador…" />
            </label>
            <label class="campo">
              <span class="etiqueta">Programa o certificación</span>
              <InputText v-model="t.program" placeholder="Ej.: Auditor de sistemas de gestión de la energía" />
            </label>
            <label class="campo">
              <span class="etiqueta">Horas</span>
              <NumberInput v-model="t.hours" :decimals="0" suffix="h" />
            </label>
            <label class="campo">
              <span class="etiqueta">Fecha</span>
              <input v-model="t.date" type="date" class="p-inputtext p-component" />
            </label>
          </div>
          <div class="pie-fila">
            <label class="casilla-fila"><input v-model="t.backed" type="checkbox" class="casilla" /> Tengo el documento que lo acredita</label>
            <button type="button" class="boton-icono" :aria-label="`Quitar la formación ${t.program || index + 1}`" @click="profile.training.splice(index, 1)"><IconTrash :size="18" /></button>
          </div>
        </div>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Experiencia</h2>
          <span class="eyebrow">al menos una auditoría certificada por un tercero</span>
          <Button label="Agregar" size="small" severity="secondary" outlined @click="addExperience">
            <template #icon><IconPlus :size="16" /></template>
          </Button>
        </div>
        <p class="nota">La experiencia certificada por un tercero no la puede cumplir la aplicación: solo la registra y le avisa qué falta (art. 6, par. 2, literal d).</p>
        <div v-for="(e, index) in profile.experience" :key="e.id" class="fila">
          <div class="campo">
            <span class="etiqueta">Sector de demanda</span>
            <ChoiceChips v-model="e.sector" :options="SECTOR_OPTIONS" :label="`Sector de la experiencia ${index + 1}`" />
          </div>
          <div class="form-grid">
            <label class="campo completo">
              <span class="etiqueta">Auditoría realizada</span>
              <InputText v-model="e.description" placeholder="Ej.: Auditoría energética de un edificio de la administración pública" />
            </label>
            <label class="campo">
              <span class="etiqueta">Año</span>
              <NumberInput v-model="e.year" :decimals="0" :grouping="false" :min="1990" :max="2100" />
            </label>
            <label class="campo">
              <span class="etiqueta">Tercero que la certifica</span>
              <InputText v-model="e.certifier" placeholder="Entidad o empresa que expide el certificado" />
            </label>
            <label class="campo">
              <span class="etiqueta">Fecha del certificado</span>
              <input v-model="e.certifiedAt" type="date" class="p-inputtext p-component" />
            </label>
          </div>
          <div class="pie-fila">
            <label class="casilla-fila"><input v-model="e.backed" type="checkbox" class="casilla" /> Tengo el certificado del tercero</label>
            <button type="button" class="boton-icono" :aria-label="`Quitar la experiencia ${e.description || index + 1}`" @click="profile.experience.splice(index, 1)"><IconTrash :size="18" /></button>
          </div>
        </div>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Matrículas</h2>
          <span class="eyebrow">COPNIA · CONTE · solo los campos</span>
        </div>
        <p class="nota">
          PONTIA no inventa una vigencia legal para las matrículas: el CONTE indica que la matrícula es vitalicia salvo suspensión y el COPNIA no fija plazo a su certificado. Anota la fecha de la última consulta y, si quieres, un
          recordatorio interno.
        </p>

        <h3 class="subtitulo">Matrícula profesional · COPNIA</h3>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Número</span>
            <InputText :model-value="registryFields.copnia.number.get()" class="mono" @update:model-value="(v) => registryFields.copnia.number.set(String(v ?? ''))" />
          </label>
          <label class="campo">
            <span class="etiqueta">Profesión</span>
            <InputText :model-value="registryFields.copnia.profession.get()" placeholder="Ej.: Ingeniería eléctrica" @update:model-value="(v) => registryFields.copnia.profession.set(String(v ?? ''))" />
          </label>
          <label class="campo">
            <span class="etiqueta">Fecha de expedición</span>
            <input :value="registryFields.copnia.issuedAt.get()" type="date" class="p-inputtext p-component" @input="(e) => registryFields.copnia.issuedAt.set((e.target as HTMLInputElement).value)" />
          </label>
          <label class="campo">
            <span class="etiqueta">Última consulta</span>
            <input :value="registryFields.copnia.verifiedAt.get()" type="date" class="p-inputtext p-component" @input="(e) => registryFields.copnia.verifiedAt.set((e.target as HTMLInputElement).value)" />
          </label>
          <label class="campo completo">
            <span class="etiqueta">Enlace de consulta</span>
            <InputText :model-value="registryFields.copnia.link.get()" placeholder="Dirección de la consulta pública" @update:model-value="(v) => registryFields.copnia.link.set(String(v ?? ''))" />
          </label>
        </div>
        <div class="campo">
          <span class="etiqueta">Estado</span>
          <ChoiceChips :model-value="profile.copnia?.status" :options="REGISTRY_STATES" label="Estado de la matrícula profesional" clearable @update:model-value="(v) => (registry('copnia').status = v)" />
        </div>

        <h3 class="subtitulo">Matrícula técnica · CONTE</h3>
        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Número</span>
            <InputText :model-value="registryFields.conte.number.get()" class="mono" @update:model-value="(v) => registryFields.conte.number.set(String(v ?? ''))" />
          </label>
          <label class="campo">
            <span class="etiqueta">Fecha de expedición</span>
            <input :value="registryFields.conte.issuedAt.get()" type="date" class="p-inputtext p-component" @input="(e) => registryFields.conte.issuedAt.set((e.target as HTMLInputElement).value)" />
          </label>
          <label class="campo">
            <span class="etiqueta">Última consulta</span>
            <input :value="registryFields.conte.verifiedAt.get()" type="date" class="p-inputtext p-component" @input="(e) => registryFields.conte.verifiedAt.set((e.target as HTMLInputElement).value)" />
          </label>
          <label class="campo">
            <span class="etiqueta">Enlace de consulta</span>
            <InputText :model-value="registryFields.conte.link.get()" placeholder="Dirección de la consulta pública" @update:model-value="(v) => registryFields.conte.link.set(String(v ?? ''))" />
          </label>
        </div>
        <div class="campo">
          <span class="etiqueta">Clases de la matrícula</span>
          <div class="clases" role="group" aria-label="Clases de la matrícula técnica">
            <button v-for="c in CONTE_CATEGORIES" :key="c" type="button" class="clase" :class="{ activa: hasCategory(c) }" :aria-pressed="hasCategory(c)" @click="toggleCategory(c)">{{ c }}</button>
          </div>
        </div>
        <div class="campo">
          <span class="etiqueta">Estado</span>
          <ChoiceChips :model-value="profile.conte?.status" :options="REGISTRY_STATES" label="Estado de la matrícula técnica" clearable @update:model-value="(v) => (registry('conte').status = v)" />
        </div>

        <div class="form-grid">
          <label class="campo">
            <span class="etiqueta">Recordatorio para volver a consultar (meses)</span>
            <NumberInput v-model="profile.reminderMonths" :decimals="0" :min="1" :max="120" suffix="meses" />
            <small v-if="reminder" class="ayuda">Próxima consulta sugerida: {{ formatDate(reminder) }}.</small>
            <small v-else class="ayuda">Es un recordatorio interno, no un plazo de la ley.</small>
          </label>
        </div>
        <label class="fila-interruptor">
          <span>Ocultar los números de matrícula en el informe<small>El informe dice que la matrícula está registrada, sin imprimir el número.</small></span>
          <input v-model="profile.hideRegistryNumbers" type="checkbox" class="casilla" aria-label="Ocultar los números de matrícula en el informe" />
        </label>
      </section>

      <section class="card seccion">
        <div class="cabecera-seccion">
          <h2>Verificación del artículo 6</h2>
          <span class="eyebrow">{{ verification.done }} de {{ verification.total }} requisitos</span>
        </div>
        <ul class="requisitos">
          <li v-for="item in checklist.items" :key="item.id" :class="{ completo: item.ok }">
            <component :is="item.ok ? IconCircleCheck : IconCircleDashed" :size="20" />
            <span>{{ item.label }}<small v-if="item.level === 'recomendado'"> · recomendado</small></span>
          </li>
        </ul>
        <p class="nota">Nada de esto bloquea el trabajo: un perfil incompleto se puede seguir llenando y el informe sale igual.</p>
      </section>
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
.guardado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 12%);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.guardado.alerta {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.cuerpo {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}
.portada {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}
.entrada {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.estado-verificacion {
  display: flex;
}
.nota {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.subtitulo {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 600;
}
.fila {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.pie-fila {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.casilla-fila {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}
.casilla {
  width: 20px;
  height: 20px;
  accent-color: var(--accent-strong);
}
.clases {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.clase {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--field-border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink-2);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
}
.clase.activa {
  border-color: var(--navy);
  background: var(--navy);
  color: #fff;
}
.app-dark .clase.activa {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
}
.requisitos {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.requisitos li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--warning-text);
  font-size: 14px;
}
.requisitos li.completo {
  color: var(--good-text);
}
.requisitos li svg {
  flex-shrink: 0;
}
.requisitos small {
  color: var(--muted);
}
@media (max-width: 639px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
