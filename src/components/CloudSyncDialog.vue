<script setup lang="ts">
import { IconAlertTriangle, IconCircleCheck, IconCloudUpload, IconCopy, IconLoader2, IconRefresh } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ToggleSwitch from 'primevue/toggleswitch';
import { useToast } from 'primevue/usetoast';
import { computed, ref, watch } from 'vue';
import schemaSql from '@/sync/esquema.sql?raw';
import { useCloudSync } from '@/sync/useCloudSync';
import { formatNumber } from '@/utils/format';
import { relativeTime } from '@/utils/time';

/** Conexión con el proyecto de Supabase del usuario: URL y clave anon, cuenta y sincronización. */
const visible = defineModel<boolean>('visible', { required: true });
const toast = useToast();
const cloud = useCloudSync();

const url = ref('');
const anonKey = ref('');
const email = ref('');
const password = ref('');
const editing = ref(false);
const working = ref<'conectar' | 'entrar' | 'crear' | 'sincronizar' | null>(null);

// Al abrir, el formulario muestra lo que ya está guardado (la clave no se muestra completa)
watch(visible, (open) => {
  if (!open) return;
  url.value = cloud.state.cloud?.url ?? '';
  anonKey.value = cloud.state.cloud?.anonKey ?? '';
  email.value = cloud.state.cloud?.session?.email ?? '';
  password.value = '';
  editing.value = false;
});

const host = computed(() => {
  try {
    return new URL(cloud.state.cloud?.url ?? '').host;
  } catch {
    return cloud.state.cloud?.url ?? '';
  }
});
const showConnection = computed(() => !cloud.connected.value || editing.value);
const report = computed(() => cloud.state.lastReport);
const lastSync = computed(() => {
  const at = cloud.state.cloud?.lastSyncAt;
  return at ? `Última sincronización ${relativeTime(at)}` : 'Aún no se ha sincronizado este equipo.';
});

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function run<T>(kind: NonNullable<typeof working.value>, task: () => Promise<T>): Promise<T | undefined> {
  if (working.value) return undefined;
  working.value = kind;
  try {
    return await task();
  } catch (error) {
    toast.add({ severity: 'error', summary: 'No se pudo completar', detail: message(error), life: 7000 });
    return undefined;
  } finally {
    working.value = null;
  }
}

const connect = () =>
  run('conectar', async () => {
    await cloud.connect(url.value, anonKey.value);
    editing.value = false;
    toast.add({ severity: 'success', summary: 'Proyecto de Supabase conectado', detail: host.value, life: 3500 });
  });

async function access(kind: 'entrar' | 'crear') {
  const result = await run(kind, () => (kind === 'entrar' ? cloud.signIn(email.value, password.value) : cloud.signUp(email.value, password.value)));
  if (!result) return;
  password.value = '';
  if (result === 'confirmar') {
    toast.add({ severity: 'info', summary: 'Revisa tu correo', detail: 'Supabase envió un enlace para confirmar la cuenta; después usa «Entrar».', life: 8000 });
    return;
  }
  toast.add({ severity: 'success', summary: 'Sesión iniciada', detail: 'Ya puedes sincronizar tus proyectos.', life: 3500 });
  await sync();
}

async function sync() {
  const done = await run('sincronizar', () => cloud.syncNow());
  if (!done) return;
  toast.add({
    severity: 'success',
    summary: 'Sincronización lista',
    detail: `${formatNumber(done.pushed)} cambios subidos y ${formatNumber(done.pulled)} recibidos${done.photosUp + done.photosDown ? ` · ${formatNumber(done.photosUp + done.photosDown)} fotos` : ''}.`,
    life: 4000,
  });
}

async function copySql() {
  try {
    await navigator.clipboard.writeText(schemaSql);
    toast.add({ severity: 'success', summary: 'SQL copiado', detail: 'Pégalo en el editor SQL de tu proyecto de Supabase y ejecútalo.', life: 5000 });
  } catch {
    toast.add({ severity: 'warn', summary: 'No se pudo copiar', detail: 'El archivo está en la guía: src/sync/esquema.sql.', life: 6000 });
  }
}

const signOut = () => run('entrar', () => cloud.signOut());
const forget = () =>
  run('conectar', async () => {
    await cloud.forget();
    url.value = '';
    anonKey.value = '';
    toast.add({ severity: 'info', summary: 'Conexión olvidada', detail: 'Tus proyectos siguen en este equipo.', life: 3500 });
  });
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Sincronización en la nube" :draggable="false" :style="{ width: 'min(580px, calc(100vw - 24px))' }">
    <div class="nube">
      <p class="intro">
        Tus proyectos siguen guardados en este equipo y funcionan sin internet. Con tu propio proyecto de Supabase, PONTIA guarda además una copia en la nube para trabajar los mismos
        proyectos en el celular y en el PC. Cada cuenta ve solo sus datos.
      </p>

      <section class="paso" :class="{ hecho: cloud.connected.value && !editing }">
        <h3><span class="numero">1</span>Tu proyecto de Supabase</h3>
        <template v-if="showConnection">
          <label class="campo">
            <span class="etiqueta">URL del proyecto</span>
            <InputText v-model="url" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off" spellcheck="false" />
          </label>
          <label class="campo">
            <span class="etiqueta">Clave pública (anon)</span>
            <InputText v-model="anonKey" type="password" autocomplete="off" spellcheck="false" placeholder="eyJhbGciOi…" />
            <small class="ayuda">Está en Supabase → Project Settings → API. Nunca pegues la clave «service_role»: esa da acceso a todo.</small>
          </label>
          <div class="acciones">
            <Button :label="working === 'conectar' ? 'Probando…' : 'Probar y guardar'" :disabled="working !== null || !url || !anonKey" @click="connect">
              <template #icon><component :is="working === 'conectar' ? IconLoader2 : IconCloudUpload" :size="18" :class="{ girar: working === 'conectar' }" /></template>
            </Button>
            <Button label="Copiar el SQL de PONTIA" severity="secondary" outlined @click="copySql">
              <template #icon><IconCopy :size="18" /></template>
            </Button>
          </div>
        </template>
        <p v-else class="estado">
          <IconCircleCheck :size="18" class="ok" />Conectado a <span class="mono">{{ host }}</span>
          <button type="button" class="enlace" @click="editing = true">Cambiar</button>
        </p>
      </section>

      <section class="paso" :class="{ hecho: cloud.signedIn.value, bloqueado: !cloud.connected.value }">
        <h3><span class="numero">2</span>Tu cuenta</h3>
        <template v-if="cloud.connected.value && !cloud.signedIn.value">
          <div class="form-grid">
            <label class="campo">
              <span class="etiqueta">Correo</span>
              <InputText v-model="email" type="email" autocomplete="username" />
            </label>
            <label class="campo">
              <span class="etiqueta">Contraseña</span>
              <InputText v-model="password" type="password" autocomplete="current-password" @keyup.enter="access('entrar')" />
            </label>
          </div>
          <div class="acciones">
            <Button :label="working === 'entrar' ? 'Entrando…' : 'Entrar'" :disabled="working !== null || !email || !password" @click="access('entrar')" />
            <Button :label="working === 'crear' ? 'Creando…' : 'Crear cuenta'" severity="secondary" outlined :disabled="working !== null || !email || !password" @click="access('crear')" />
          </div>
          <small class="ayuda">La cuenta se crea en tu proyecto de Supabase. PONTIA guarda la sesión en este equipo, nunca la contraseña.</small>
        </template>
        <p v-else-if="cloud.signedIn.value" class="estado">
          <IconCircleCheck :size="18" class="ok" />Sesión de <strong>{{ cloud.state.cloud?.session?.email }}</strong>
          <button type="button" class="enlace" @click="signOut">Cerrar sesión</button>
        </p>
        <p v-else class="nota">Primero conecta tu proyecto de Supabase.</p>
      </section>

      <section class="paso" :class="{ bloqueado: !cloud.signedIn.value }">
        <h3><span class="numero">3</span>Sincronizar</h3>
        <label class="fila-interruptor">
          <span>Sincronizar sola<small>Al abrir la app, al volver la conexión y cada 10 minutos.</small></span>
          <ToggleSwitch :model-value="cloud.state.cloud?.autoSync ?? true" :disabled="!cloud.signedIn.value" @update:model-value="cloud.setAutoSync" />
        </label>
        <p class="nota">{{ lastSync }}</p>
        <p v-if="report" class="nota">
          Último resultado: {{ formatNumber(report.pushed) }} cambios subidos, {{ formatNumber(report.pulled) }} recibidos, {{ formatNumber(report.photosUp + report.photosDown) }} fotos.
        </p>
        <p v-if="cloud.state.cloud?.lastError" class="error"><IconAlertTriangle :size="16" />{{ cloud.state.cloud.lastError }}</p>
        <Button
          :label="cloud.state.busy ? cloud.state.step || 'Sincronizando…' : 'Sincronizar ahora'"
          :disabled="!cloud.signedIn.value || cloud.state.busy || working !== null"
          class="sincronizar"
          @click="sync"
        >
          <template #icon><component :is="cloud.state.busy ? IconLoader2 : IconRefresh" :size="18" :class="{ girar: cloud.state.busy }" /></template>
        </Button>
      </section>

      <details class="guia">
        <summary>¿Cómo preparo mi proyecto de Supabase?</summary>
        <ol>
          <li>Entra a supabase.com con tu cuenta y crea un proyecto (el plan gratuito sirve para empezar).</li>
          <li>Abre <strong>SQL Editor</strong>, pega el SQL de PONTIA (botón «Copiar el SQL de PONTIA») y ejecútalo.</li>
          <li>En <strong>Project Settings → API</strong> copia la <em>Project URL</em> y la clave <em>anon public</em> y pégalas arriba.</li>
          <li>Crea tu cuenta aquí con «Crear cuenta». Si Supabase pide confirmar el correo, abre el enlace y luego usa «Entrar».</li>
          <li>Repite los pasos 3 y 4 con la misma cuenta en el otro equipo y sincroniza en ambos.</li>
        </ol>
        <p class="nota">La guía completa está en el repositorio: docs/nube/GUIA.md.</p>
      </details>

      <button v-if="cloud.connected.value" type="button" class="olvidar" @click="forget">Olvidar esta conexión en este equipo</button>
    </div>
  </Dialog>
</template>

<style scoped>
.nube {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.intro {
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}
.paso {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.paso.hecho {
  border-color: var(--accent);
  background: var(--accent-wash);
}
.paso.bloqueado {
  opacity: 0.6;
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.numero {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--navy);
  color: #fff;
  font-size: 12px;
}
.app-dark .numero {
  background: var(--accent-strong);
}
.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.estado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 14px;
}
.ok {
  color: var(--good-text);
}
.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-strong);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.app-dark .enlace {
  color: var(--accent);
}
.nota {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}
.error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--critical-text);
  font-size: 13px;
}
.error svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.sincronizar {
  align-self: flex-start;
}
.guia {
  font-size: 13px;
}
.guia summary {
  font-weight: 600;
  cursor: pointer;
}
.guia ol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0;
  padding-left: 20px;
  color: var(--ink-2);
}
.olvidar {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--critical-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
