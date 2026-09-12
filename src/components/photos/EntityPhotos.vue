<script setup lang="ts">
import { IconCamera, IconLoader2, IconPhotoPlus } from '@tabler/icons-vue';
import { useMediaQuery } from '@vueuse/core';
import { useToast } from 'primevue/usetoast';
import { computed, ref } from 'vue';
import { useLiveQuery } from '@/composables/useLiveQuery';
import { isActive, saveRecord } from '@/db/records';
import { getDb } from '@/db/schema';
import { PHOTO_KINDS } from '@/domain/catalogs';
import type { EntityType, PhotoKind } from '@/domain/types';
import { toLocalDateTime } from '@/utils/dates';
import { compressImage } from '@/utils/image';
import PhotoThumb from './PhotoThumb.vue';
import PhotoViewer from './PhotoViewer.vue';

const props = withDefaults(
  defineProps<{
    projectId: string;
    entityType: EntityType;
    entityId: string;
    /** Tipo de la primera foto (p. ej. la placa de un equipo); las siguientes son vistas generales. */
    defaultKind?: PhotoKind;
    title?: string;
    hint?: string;
  }>(),
  { defaultKind: 'vista-general', title: 'Fotos', hint: undefined },
);

const db = getDb();
const toast = useToast();
const touch = useMediaQuery('(pointer: coarse)');
const live = useLiveQuery(
  () =>
    db.photos
      .where('[entityType+entityId]')
      .equals([props.entityType, props.entityId])
      .filter(isActive)
      .sortBy('takenAt'),
  [() => props.entityType, () => props.entityId],
);
const photos = computed(() => live.value ?? []);
const pending = ref(0);
const viewing = ref<number | null>(null);
const kindLabel = (kind: PhotoKind) => PHOTO_KINDS.find((k) => k.id === kind)?.label ?? kind;

async function add(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  let first = photos.value.length === 0;
  for (const file of files) {
    pending.value++;
    try {
      const image = await compressImage(file);
      await saveRecord(db, 'photos', {
        id: crypto.randomUUID(),
        projectId: props.projectId,
        entityType: props.entityType,
        entityId: props.entityId,
        kind: first ? props.defaultKind : 'vista-general',
        takenAt: toLocalDateTime(new Date(file.lastModified || Date.now())),
        blob: image.blob,
        thumb: image.thumb,
        width: image.width,
        height: image.height,
      });
      first = false;
    } catch (error) {
      toast.add({ severity: 'error', summary: 'No se pudo guardar la foto', detail: error instanceof Error ? error.message : String(error), life: 6000 });
    } finally {
      pending.value--;
    }
  }
}
</script>

<template>
  <section class="fotos">
    <h3 class="form-seccion-titulo">
      <IconCamera :size="16" />{{ title }}
      <span v-if="photos.length" class="conteo">{{ photos.length }}</span>
    </h3>
    <p v-if="hint" class="ayuda">{{ hint }}</p>
    <div class="tira">
      <button v-for="(photo, i) in photos" :key="photo.id" type="button" class="foto" :aria-label="`Ver foto ${i + 1}: ${kindLabel(photo.kind)}`" @click="viewing = i">
        <PhotoThumb :blob="photo.thumb ?? photo.blob" :alt="photo.caption ?? ''" />
        <span class="tipo">{{ kindLabel(photo.kind) }}</span>
      </button>
      <div v-for="n in pending" :key="`cargando-${n}`" class="foto cargando" aria-label="Procesando foto">
        <IconLoader2 :size="22" class="girar" />
      </div>
      <label v-if="touch" class="foto agregar">
        <input type="file" accept="image/*" capture="environment" class="sr-only" @change="add" />
        <IconCamera :size="22" />
        <span>Cámara</span>
      </label>
      <label class="foto agregar">
        <input type="file" accept="image/*" multiple class="sr-only" @change="add" />
        <IconPhotoPlus :size="22" />
        <span>{{ touch ? 'Galería' : 'Agregar fotos' }}</span>
      </label>
    </div>
    <PhotoViewer v-model:index="viewing" :photos="photos" />
  </section>
</template>

<style scoped>
.fotos {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.conteo {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-wash);
  color: var(--accent-ink);
  font-size: 10.5px;
}
.ayuda {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
.tira {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-snap-type: x proximity;
}
.foto {
  position: relative;
  flex: 0 0 auto;
  width: 88px;
  height: 88px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-2);
  cursor: pointer;
  scroll-snap-align: start;
}
.foto img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tipo {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  padding: 10px 6px 3px;
  background: linear-gradient(transparent, rgba(8, 15, 30, 0.78));
  color: #fff;
  font-size: 10px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agregar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-style: dashed;
  border-color: var(--field-border);
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 600;
}
.app-dark .agregar {
  color: var(--accent);
}
.agregar:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.cargando {
  display: grid;
  place-items: center;
  color: var(--muted);
  cursor: default;
}
</style>
