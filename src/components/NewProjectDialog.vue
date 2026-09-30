<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, reactive, ref, watch } from 'vue';
import ChoiceChips from '@/components/ui/ChoiceChips.vue';
import type { NewProjectInput } from '@/db/projects';
import { ENTITY_KINDS, SECTORS } from '@/domain/catalogs';
import { findEntity, findSite, knownEntities, type KnownEntity, type KnownSite } from '@/domain/entities';
import { tenureInfo, TENURES } from '@/domain/tenure';
import type { EntityKind, Project, Tenure } from '@/domain/types';

const visible = defineModel<boolean>('visible', { required: true });
const props = defineProps<{ previous?: readonly Project[] }>();
const emit = defineEmits<{ create: [input: NewProjectInput] }>();

const empty = () => ({
  name: '',
  code: '',
  client: '',
  city: '',
  siteName: '',
  sector: null as string | null,
  areaM2: null as number | null,
  entityKind: undefined as EntityKind | undefined,
  tenure: undefined as Tenure | undefined,
});
const form = reactive(empty());
const submitted = ref(false);

// Las entidades y sedes de los proyectos que ya están en el equipo se ofrecen para no volver a escribirlas
const entities = computed(() => knownEntities(props.previous ?? []));
const known = computed(() => findEntity(entities.value, form.client));
const TENURE_OPTIONS = TENURES.map((t) => ({ value: t.id, label: t.label }));

watch(visible, (open) => {
  if (!open) return;
  Object.assign(form, empty());
  submitted.value = false;
});

function useEntity(entity: KnownEntity) {
  form.client = entity.name;
  form.entityKind = entity.kind ?? form.entityKind;
  form.city = entity.city ?? form.city;
  form.sector = entity.sector ?? form.sector;
  form.siteName = '';
  // Con una sola sede registrada no hay nada que elegir
  if (entity.sites.length === 1) useSite(entity.sites[0]);
}
const useSite = (site: KnownSite) => {
  form.siteName = site.name;
};

function submit() {
  submitted.value = true;
  if (!form.name.trim()) return;
  const entity = known.value;
  const site = findSite(entity, form.siteName);
  emit('create', {
    name: form.name,
    code: form.code,
    client: form.client,
    nit: entity?.nit,
    city: form.city,
    address: site?.address,
    sector: form.sector ?? undefined,
    areaM2: form.areaM2 ?? undefined,
    entityKind: form.entityKind,
    entityOrder: form.entityKind === entity?.kind ? entity?.order : undefined,
    siteName: form.siteName,
    siteCode: site?.upmeCode,
    tenure: form.tenure,
  });
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Nuevo proyecto" :draggable="false" :style="{ width: 'min(560px, calc(100vw - 24px))' }">
    <form class="formulario" @submit.prevent="submit">
      <label class="campo completo">
        <span>Nombre del proyecto</span>
        <InputText v-model="form.name" placeholder="Ej.: Laboratorios · Sede Riohacha" :invalid="submitted && !form.name.trim()" autofocus />
        <small v-if="submitted && !form.name.trim()" class="error">Escribe un nombre para el proyecto.</small>
      </label>
      <label class="campo">
        <span>Código</span>
        <InputText v-model="form.code" placeholder="LAB-01" class="mono" />
      </label>
      <label class="campo">
        <span>Sector</span>
        <Select v-model="form.sector" :options="SECTORS" placeholder="Elegir" />
      </label>
      <label class="campo completo">
        <span>Entidad o cliente</span>
        <InputText v-model="form.client" placeholder="Ej.: Universidad de La Guajira" />
      </label>
      <div v-if="entities.length" class="campo completo">
        <span class="sugerencias-titulo">Usar una entidad ya registrada</span>
        <div class="sugerencias">
          <button v-for="e in entities" :key="e.name" type="button" class="sugerencia" :class="{ activa: known === e }" @click="useEntity(e)">{{ e.name }}</button>
        </div>
      </div>
      <div class="campo completo">
        <span>Tipo de entidad</span>
        <ChoiceChips v-model="form.entityKind" :options="ENTITY_KINDS" label="Tipo de entidad" fill clearable />
      </div>
      <label class="campo">
        <span>Sede</span>
        <InputText v-model="form.siteName" placeholder="Ej.: Sede Riohacha" />
      </label>
      <label class="campo">
        <span>Ciudad</span>
        <InputText v-model="form.city" placeholder="Ej.: Riohacha" />
      </label>
      <div v-if="known && known.sites.length > 1" class="campo completo">
        <span class="sugerencias-titulo">Sedes de esta entidad</span>
        <div class="sugerencias">
          <button v-for="s in known.sites" :key="s.name" type="button" class="sugerencia" @click="useSite(s)">{{ s.name }}</button>
        </div>
      </div>
      <div class="campo completo">
        <span>Tenencia del edificio</span>
        <ChoiceChips v-model="form.tenure" :options="TENURE_OPTIONS" label="Tenencia del edificio" clearable />
        <small v-if="form.tenure" class="ayuda">{{ tenureInfo(form.tenure)?.help }}</small>
      </div>
      <label class="campo">
        <span>Área total</span>
        <InputNumber v-model="form.areaM2" :min="0" :max-fraction-digits="1" locale="es-CO" suffix=" m²" placeholder="0 m²" />
      </label>
      <button type="submit" class="sr-only" tabindex="-1">Crear</button>
    </form>
    <template #footer>
      <Button label="Cancelar" severity="secondary" text @click="visible = false" />
      <Button label="Crear proyecto" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.campo > span {
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
}
.completo {
  grid-column: 1 / -1;
}
.error {
  color: var(--critical);
}
.ayuda {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
}
.sugerencias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sugerencia {
  min-height: 32px;
  padding: 0 12px;
  border: 1px dashed var(--field-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
}
.sugerencia:hover,
.sugerencia.activa {
  border-style: solid;
  border-color: var(--navy);
  color: var(--navy);
}
.app-dark .sugerencia:hover,
.app-dark .sugerencia.activa {
  border-color: var(--accent-strong);
  color: var(--ink);
}
@media (max-width: 520px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
