import { useOnline } from '@vueuse/core';
import { computed, reactive, readonly, watch } from 'vue';
import { getDb } from '@/db/schema';
import { getSettings, saveCloudSettings } from '@/db/settings';
import type { CloudSettings } from '@/domain/types';
import { relativeTime } from '@/utils/time';
import { createCloudClient } from './client';
import { synchronize, type SyncReport } from './engine';

/**
 * Estado de la nube, compartido por toda la app: la conexión con el proyecto de Supabase del usuario,
 * su sesión, la última sincronización y la sincronización automática.
 */

const state = reactive({
  loaded: false,
  cloud: null as CloudSettings | null,
  busy: false,
  step: '',
  lastReport: null as SyncReport | null,
});

const TEN_MINUTES = 10 * 60 * 1000;
let loading: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function load(): Promise<void> {
  loading ??= getSettings(getDb()).then((settings) => {
    state.cloud = settings.cloud ?? null;
    state.loaded = true;
  });
  return loading;
}

async function persist(cloud: CloudSettings | null): Promise<void> {
  await saveCloudSettings(getDb(), cloud);
  state.cloud = cloud ? (JSON.parse(JSON.stringify(cloud)) as CloudSettings) : null;
}

const clientFor = (cloud: CloudSettings) => createCloudClient(cloud.url, cloud.anonKey);
const normalizeUrl = (url: string) => url.trim().replace(/\/+$/, '');

/** Guarda la URL y la clave anon después de comprobar que responden. */
async function connect(url: string, anonKey: string): Promise<void> {
  await load();
  const clean = { url: normalizeUrl(url), anonKey: anonKey.trim() };
  if (!/^https:\/\//.test(clean.url)) throw new Error('La URL debe empezar por https://, por ejemplo https://abcd.supabase.co');
  if (!clean.anonKey) throw new Error('Pega la clave pública (anon) del proyecto.');
  await createCloudClient(clean.url, clean.anonKey).ping();
  const same = state.cloud?.url === clean.url;
  // Otro proyecto de Supabase empieza de cero: se sube todo y se baja todo
  await persist({ ...clean, autoSync: state.cloud?.autoSync ?? true, session: same ? state.cloud?.session : undefined, lastSeq: same ? state.cloud?.lastSeq : 0, lastPushedAt: same ? state.cloud?.lastPushedAt : 0 });
}

async function startSession(kind: 'entrar' | 'crear', email: string, password: string): Promise<'lista' | 'confirmar'> {
  await load();
  const cloud = state.cloud;
  if (!cloud) throw new Error('Primero conecta tu proyecto de Supabase.');
  const client = clientFor(cloud);
  const session = kind === 'entrar' ? await client.signIn(email.trim(), password) : await client.signUp(email.trim(), password);
  if (!session) return 'confirmar';
  const sameUser = cloud.session?.userId === session.userId;
  await persist({ ...cloud, session, lastSeq: sameUser ? cloud.lastSeq : 0, lastPushedAt: sameUser ? cloud.lastPushedAt : 0, lastError: undefined });
  return 'lista';
}

async function signOut(): Promise<void> {
  const cloud = state.cloud;
  if (!cloud?.session) return;
  await clientFor(cloud).signOut(cloud.session);
  await persist({ ...cloud, session: undefined });
}

async function forget(): Promise<void> {
  if (state.cloud?.session) await clientFor(state.cloud).signOut(state.cloud.session);
  await persist(null);
}

async function setAutoSync(autoSync: boolean): Promise<void> {
  if (state.cloud) await persist({ ...state.cloud, autoSync });
}

/** Sincroniza ahora; renueva la sesión si está por vencer y guarda hasta dónde llegó aunque falle. */
async function syncNow(): Promise<SyncReport | null> {
  await load();
  const cloud = state.cloud;
  if (!cloud?.session || state.busy) return null;
  state.busy = true;
  const progress = { lastSeq: cloud.lastSeq ?? 0, lastPushedAt: cloud.lastPushedAt ?? 0 };
  let session = cloud.session;
  try {
    if (session.expiresAt - Date.now() < 60_000) session = await clientFor(cloud).refresh(session);
    const report = await synchronize(getDb(), clientFor(cloud), session, progress, (step) => {
      state.step = step;
    });
    state.lastReport = report;
    await persist({ ...cloud, session, ...progress, lastSyncAt: Date.now(), lastError: undefined });
    return report;
  } catch (error) {
    await persist({ ...cloud, session, ...progress, lastError: error instanceof Error ? error.message : String(error) });
    throw error;
  } finally {
    state.busy = false;
    state.step = '';
  }
}

/** Arranca la sincronización automática; se llama una vez desde App.vue. */
export function startCloudSync(): void {
  const online = useOnline();
  const run = () => {
    if (online.value && state.cloud?.session && state.cloud.autoSync) void syncNow().catch(() => undefined);
  };
  void load().then(() => setTimeout(run, 3000));
  timer ??= setInterval(run, TEN_MINUTES);
  watch(online, (isOnline) => {
    if (isOnline) run();
  });
}

export function useCloudSync() {
  void load();
  const connected = computed(() => Boolean(state.cloud));
  const signedIn = computed(() => Boolean(state.cloud?.session));
  /** Texto largo del estado para la barra lateral; `null` si la nube no está en uso. */
  const label = computed(() => {
    const cloud = state.cloud;
    if (!cloud?.session) return null;
    if (state.busy) return 'Sincronizando con la nube…';
    if (cloud.lastError) return 'La nube no respondió · se reintenta';
    return cloud.lastSyncAt ? `Sincronizado ${relativeTime(cloud.lastSyncAt)}` : 'Nube conectada · sin sincronizar';
  });
  /** Texto corto para la barra del celular. */
  const short = computed(() => {
    const cloud = state.cloud;
    if (!cloud?.session) return null;
    if (state.busy) return 'Sincronizando';
    return cloud.lastError ? 'Sin sincronizar' : 'Sincronizado';
  });
  return {
    state: readonly(state),
    connected,
    signedIn,
    label,
    short,
    connect,
    signIn: (email: string, password: string) => startSession('entrar', email, password),
    signUp: (email: string, password: string) => startSession('crear', email, password),
    signOut,
    forget,
    setAutoSync,
    syncNow,
  };
}
