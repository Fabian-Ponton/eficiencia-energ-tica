<script setup lang="ts">
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from '@tabler/icons-vue';
import Drawer from 'primevue/drawer';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { computed, ref, watch } from 'vue';
import { offerUndo } from '@/composables/useUndo';
import { restoreRecords, saveRecord, softDeleteRecords } from '@/db/records';
import { getDb } from '@/db/schema';
import { PHOTO_KINDS } from '@/domain/catalogs';
import type { Photo, PhotoKind } from '@/domain/types';
import { formatDateTime } from '@/utils/dates';
import PhotoThumb from './PhotoThumb.vue';

/** Posición de la foto abierta; `null` con el visor cerrado. */
const index = defineModel<number | null>('index', { required: true });
const props = defineProps<{ photos: readonly Photo[] }>();
const db = getDb();

const current = computed(() => (index.value === null ? undefined : props.photos[index.value]));
const visible = computed({
  get: () => current.value !== undefined,
  set: (open: boolean) => {
    if (!open) index.value = null;
  },
});
const caption = ref('');
watch(current, (photo) => (caption.value = photo?.caption ?? ''), { immediate: true });
// Al eliminar la última foto, el visor pasa a la anterior o se cierra
watch(
  () => props.photos.length,
  (length) => {
    if (index.value === null) return;
    if (length === 0) index.value = null;
    else if (index.value >= length) index.value = length - 1;
  },
);

function go(step: number) {
  if (index.value === null || !props.photos.length) return;
  index.value = (index.value + step + props.photos.length) % props.photos.length;
}

async function update(changes: { kind?: PhotoKind; caption?: string }) {
  const photo = current.value;
  if (photo) await saveRecord(db, 'photos', { ...photo, ...changes });
}

function saveCaption() {
  const photo = current.value;
  if (photo && caption.value.trim() !== (photo.caption ?? '')) void update({ caption: caption.value });
}

async function remove() {
  const photo = current.value;
  if (!photo) return;
  await softDeleteRecords(db, 'photos', [photo.id]);
  offerUndo('Se eliminó la foto', () => restoreRecords(db, 'photos', [photo.id]));
}

// Deslizar el dedo hacia los lados cambia de foto
let startX: number | null = null;
const onPointerDown = (event: PointerEvent) => (startX = event.clientX);
function onPointerUp(event: PointerEvent) {
  if (startX === null) return;
  const dx = event.clientX - startX;
  startX = null;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
}

const kindLabel = (kind: PhotoKind) => PHOTO_KINDS.find((k) => k.id === kind)?.label ?? kind;
</script>

<template>
  <Drawer v-model:visible="visible" position="full" class="visor" block-scroll>
    <template #container>
      <div v-if="current" class="marco" @keydown.left="go(-1)" @keydown.right="go(1)">
        <header class="barra">
          <span class="mono conteo">{{ (index ?? 0) + 1 }} / {{ photos.length }}</span>
          <span class="fecha">{{ kindLabel(current.kind) }} · {{ formatDateTime(current.takenAt) }}</span>
          <button type="button" class="boton" aria-label="Cerrar" @click="visible = false"><IconX :size="22" /></button>
        </header>

        <div class="imagen" @pointerdown="onPointerDown" @pointerup="onPointerUp">
          <PhotoThumb :blob="current.blob" :alt="current.caption || kindLabel(current.kind)" class="foto" />
          <button v-if="photos.length > 1" type="button" class="boton lado anterior" aria-label="Foto anterior" @click="go(-1)">
            <IconChevronLeft :size="26" />
          </button>
          <button v-if="photos.length > 1" type="button" class="boton lado siguiente" aria-label="Foto siguiente" @click="go(1)">
            <IconChevronRight :size="26" />
          </button>
        </div>

        <footer class="pie">
          <Select
            :model-value="current.kind"
            :options="[...PHOTO_KINDS]"
            option-label="label"
            option-value="id"
            class="tipo"
            aria-label="Tipo de foto"
            @update:model-value="(kind: PhotoKind) => update({ kind })"
          />
          <InputText v-model="caption" class="texto" placeholder="Descripción de la foto" aria-label="Descripción" @blur="saveCaption" @keydown.enter="saveCaption" />
          <button type="button" class="boton eliminar" aria-label="Eliminar foto" @click="remove"><IconTrash :size="20" /></button>
        </footer>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.marco {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
.barra {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 16px;
}
.conteo {
  color: #d7deea;
  font-size: 13px;
}
.fecha {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #9fb0cc;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.boton {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
}
.boton:hover {
  background: rgba(255, 255, 255, 0.16);
}
.imagen {
  position: relative;
  display: grid;
  flex: 1;
  place-items: center;
  min-height: 0;
  padding: 8px;
  touch-action: pan-y;
}
.foto {
  max-width: 100%;
  max-height: 100%;
  border-radius: 6px;
  object-fit: contain;
  user-select: none;
}
.lado {
  position: absolute;
  top: 50%;
  margin-top: -22px;
}
.anterior {
  left: 12px;
}
.siguiente {
  right: 12px;
}
.pie {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 14px;
}
.tipo {
  flex: 0 0 auto;
  width: 190px;
}
.texto {
  flex: 1;
  min-width: 0;
}
.eliminar {
  color: #f29090;
}
@media (max-width: 560px) {
  .pie {
    flex-wrap: wrap;
  }
  .tipo {
    flex: 1 1 auto;
    width: auto;
  }
  .texto {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
