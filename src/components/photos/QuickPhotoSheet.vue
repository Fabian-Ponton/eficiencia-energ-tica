<script setup lang="ts">
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, ref, watch } from 'vue';
import FormSheet from '@/components/ui/FormSheet.vue';
import { useProjectRecords } from '@/composables/useProjectRecords';
import { saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { PHOTO_KINDS } from '@/domain/catalogs';
import type { EntityType, Photo, PhotoKind } from '@/domain/types';
import PhotoThumb from './PhotoThumb.vue';

/** Después de «Tomar foto» desde el botón «+»: la foto ya está guardada; aquí se vincula y se describe. */
const visible = defineModel<boolean>('visible', { required: true });
const props = defineProps<{ photo: Photo | null; projectId: string }>();

const db = getDb();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es', { numeric: true });
const { rows: areas } = useProjectRecords('areas', byName);
const { rows: equipment } = useProjectRecords('equipment', byName);
const { rows: nodes } = useProjectRecords('electrical', byName);

const link = ref('proyecto');
const kind = ref<PhotoKind>('vista-general');
const caption = ref('');
const saving = ref(false);

watch(
  () => props.photo,
  (photo) => {
    if (!photo) return;
    kind.value = photo.kind;
    caption.value = photo.caption ?? '';
    link.value = photo.entityType === 'proyecto' ? 'proyecto' : `${photo.entityType}:${photo.entityId}`;
  },
  { immediate: true },
);

const groups = computed(() => [
  { label: 'General', items: [{ value: 'proyecto', label: 'Proyecto (sin vincular)' }] },
  ...(areas.value.length ? [{ label: 'Espacios', items: areas.value.map((a) => ({ value: `area:${a.id}`, label: a.name })) }] : []),
  ...(equipment.value.length
    ? [{ label: 'Equipos', items: equipment.value.map((e) => ({ value: `equipo:${e.id}`, label: e.code ? `${e.name} · ${e.code}` : e.name })) }]
    : []),
  ...(nodes.value.length ? [{ label: 'Sistema eléctrico', items: nodes.value.map((n) => ({ value: `electrico:${n.id}`, label: n.name })) }] : []),
]);

async function save() {
  if (!props.photo) return;
  const [entityType, entityId] = link.value === 'proyecto' ? ['proyecto', props.projectId] : link.value.split(':');
  saving.value = true;
  try {
    await saveRecord(db, 'photos', { ...props.photo, entityType: entityType as EntityType, entityId, kind: kind.value, caption: caption.value });
    visible.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <FormSheet v-model:visible="visible" title="Clasificar la foto" eyebrow="Foto guardada" submit-label="Listo" :saving="saving" @submit="save">
    <div class="contenido">
      <div v-if="photo" class="vista-previa"><PhotoThumb :blob="photo.thumb ?? photo.blob" alt="Foto recién tomada" /></div>
      <p class="ayuda">La foto ya quedó guardada en el proyecto. Vincúlala con un espacio, un equipo o un tablero para encontrarla en su ficha y en el informe.</p>
      <div class="form-grid">
        <label class="campo completo">
          <span class="etiqueta">Vincular con</span>
          <Select v-model="link" :options="groups" option-label="label" option-value="value" option-group-label="label" option-group-children="items" filter />
        </label>
        <label class="campo">
          <span class="etiqueta">Tipo de foto</span>
          <Select v-model="kind" :options="[...PHOTO_KINDS]" option-label="label" option-value="id" />
        </label>
        <label class="campo">
          <span class="etiqueta">Descripción</span>
          <InputText v-model="caption" placeholder="Opcional" />
        </label>
      </div>
    </div>
  </FormSheet>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}
.vista-previa {
  overflow: hidden;
  max-height: 240px;
  border-radius: var(--radius-card);
  background: var(--surface-2);
}
.vista-previa img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 240px;
  object-fit: contain;
}
.ayuda {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
</style>
