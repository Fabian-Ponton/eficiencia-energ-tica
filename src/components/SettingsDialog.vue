<script setup lang="ts">
import { IconBook2, IconCheck, IconCloud, IconCloudOff, IconCopyright, IconDeviceMobile, IconDownload, IconLockOpen, IconUserCheck } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import { useConfirm } from 'primevue/useconfirm';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CloudSyncDialog from '@/components/CloudSyncDialog.vue';
import { useInstallPrompt } from '@/composables/useInstallPrompt';
import { useOwnership } from '@/composables/useOwnership';
import { useTheme } from '@/composables/useTheme';
import { copyrightLine, DEFAULT_HOLDER } from '@/domain/ownership';
import { readAccess, revokeAccess } from '@/domain/access';
import { useCloudSync } from '@/sync/useCloudSync';

const visible = defineModel<boolean>('visible', { required: true });
const router = useRouter();
const confirm = useConfirm();
const { preference } = useTheme();
const { canPrompt, installed, install, isIos } = useInstallPrompt();
const cloud = useCloudSync();
const showCloud = ref(false);

// ——— Propiedad y acceso ———
const { holder, setHolder } = useOwnership();
const titular = ref(holder.value ?? '');
const aceptado = ref(readAccess());
const aviso = computed(() => copyrightLine(titular.value));
const guardarTitular = () => setHolder(titular.value);
// Al abrir el diálogo se releen: el titular pudo cargarse después y el acceso pudo cambiar en otra pestaña
watch(visible, (abierto) => {
  if (!abierto) return;
  titular.value = holder.value ?? '';
  aceptado.value = readAccess();
});
function olvidarAcceso() {
  confirm.require({
    header: 'Olvidar el acceso',
    message: 'La próxima vez que abras PONTIA en este equipo se volverá a pedir la clave y el aviso. Tus auditorías no se tocan.',
    acceptLabel: 'Olvidar el acceso',
    rejectLabel: 'Cancelar',
    accept: () => {
      revokeAccess();
      aceptado.value = null;
      location.reload();
    },
  });
}

const THEMES = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Automático', value: 'auto' },
];
function openManual() {
  visible.value = false;
  void router.push({ name: 'manual' });
}
function openAuditor() {
  visible.value = false;
  void router.push({ name: 'auditor' });
}
const cloudText = computed(() => {
  if (!cloud.connected.value) return 'Desactivada: tus proyectos se guardan solo en este equipo.';
  if (!cloud.signedIn.value) return 'Proyecto de Supabase conectado; falta entrar con tu cuenta.';
  return cloud.label.value ?? 'Nube conectada.';
});
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Ajustes" :draggable="false" :style="{ width: 'min(480px, calc(100vw - 24px))' }">
    <div class="ajustes">
      <section>
        <h3 class="eyebrow">Apariencia</h3>
        <SelectButton v-model="preference" :options="THEMES" option-label="label" option-value="value" :allow-empty="false" />
      </section>

      <section>
        <h3 class="eyebrow">Auditor</h3>
        <p class="estado">Quién audita y con qué lo acredita (art. 6 de la Res. 40412). Se guarda solo en este equipo y nunca incluye la cédula.</p>
        <Button label="Perfil del auditor" severity="secondary" outlined @click="openAuditor">
          <template #icon><IconUserCheck :size="18" /></template>
        </Button>
      </section>

      <section>
        <h3 class="eyebrow">Sincronización en la nube</h3>
        <p class="estado">
          <component :is="cloud.signedIn.value ? IconCloud : IconCloudOff" :size="18" :class="{ ok: cloud.signedIn.value }" />
          {{ cloudText }}
        </p>
        <Button :label="cloud.connected.value ? 'Administrar la nube' : 'Configurar la nube'" severity="secondary" outlined @click="showCloud = true">
          <template #icon><IconCloud :size="18" /></template>
        </Button>
      </section>

      <section>
        <h3 class="eyebrow">Instalar la app</h3>
        <p v-if="installed" class="estado"><IconCheck :size="18" class="ok" />PONTIA ya está instalada en este equipo.</p>
        <Button v-else-if="canPrompt" label="Instalar PONTIA" @click="install">
          <template #icon><IconDownload :size="18" /></template>
        </Button>
        <p v-else-if="isIos" class="estado">
          <IconDeviceMobile :size="18" />
          En Safari toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
        </p>
        <p v-else class="estado">Abre PONTIA en Chrome o Edge para instalarla como app.</p>
      </section>

      <section class="completa">
        <h3 class="eyebrow">Propiedad y acceso</h3>
        <p class="estado">
          <IconCopyright :size="18" />
          Quién es el titular de los derechos. Aparece en el pie de la app y en todo lo que PONTIA genera.
        </p>
        <label class="campo-titular">
          <span class="sr-only">Titular de los derechos</span>
          <InputText v-model="titular" fluid :placeholder="DEFAULT_HOLDER" @change="guardarTitular" />
        </label>
        <p class="vista-previa">{{ aviso }}</p>
        <p v-if="aceptado" class="estado">
          <IconLockOpen :size="18" />
          Acceso aceptado en este equipo el {{ aceptado.at.replace('T', ' a las ') }}.
        </p>
        <Button label="Olvidar el acceso en este equipo" severity="secondary" outlined @click="olvidarAcceso">
          <template #icon><IconLockOpen :size="18" /></template>
        </Button>
      </section>

      <section>
        <h3 class="eyebrow">Ayuda</h3>
        <p class="estado">Qué hace cada pantalla y qué datos necesita para funcionar.</p>
        <Button label="Manual de uso" severity="secondary" outlined @click="openManual">
          <template #icon><IconBook2 :size="18" /></template>
        </Button>
      </section>
    </div>
  </Dialog>
  <CloudSyncDialog v-model:visible="showCloud" />
</template>

<style scoped>
.ajustes {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
h3 {
  margin: 0;
}
.estado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.estado svg {
  flex-shrink: 0;
}
.ok {
  color: var(--good);
}
.completa {
  align-self: stretch;
}
.campo-titular {
  width: 100%;
}
.vista-previa {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}
</style>
