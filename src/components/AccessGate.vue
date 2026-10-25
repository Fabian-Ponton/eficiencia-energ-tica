<script setup lang="ts">
import { IconLock, IconShieldCheck } from '@tabler/icons-vue';
import Button from 'primevue/button';
import Password from 'primevue/password';
import { nextTick, onMounted, ref } from 'vue';
import AppLogo from '@/components/AppLogo.vue';
import { ACCESS_TERMS, copyrightLine } from '@/domain/ownership';
import { canCheckPassphrase, checkPassphrase, grantAccess, REQUIRE_PASSPHRASE } from '@/domain/access';

/**
 * Pantalla de entrada: aviso de propiedad y, si está activada, clave de acceso.
 * Lo que protege y lo que no está explicado en `domain/access.ts`.
 */
const emit = defineEmits<{ granted: [] }>();

const CAMPO_ID = 'acceso-clave';
const clave = ref('');
const error = ref('');
const comprobando = ref(false);
const pideClave = REQUIRE_PASSPHRASE && canCheckPassphrase();

onMounted(async () => {
  await nextTick();
  if (pideClave) document.getElementById(CAMPO_ID)?.focus();
});

async function entrar() {
  if (comprobando.value) return;
  error.value = '';
  if (!pideClave) {
    grantAccess();
    emit('granted');
    return;
  }
  if (!clave.value) {
    error.value = 'Escribe la clave de acceso.';
    return;
  }
  comprobando.value = true;
  try {
    if (await checkPassphrase(clave.value)) {
      grantAccess();
      emit('granted');
    } else {
      error.value = 'La clave no es correcta.';
      clave.value = '';
    }
  } finally {
    comprobando.value = false;
  }
}
</script>

<template>
  <div class="acceso">
    <section class="tarjeta" role="dialog" aria-modal="true" aria-labelledby="acceso-titulo">
      <header class="marca">
        <AppLogo :size="34" />
        <span>PONTIA</span>
      </header>

      <h1 id="acceso-titulo">Acceso restringido</h1>
      <p class="intro">Plataforma de auditoría y eficiencia energética. El acceso es personal y autorizado por el titular.</p>

      <ul class="terminos">
        <li v-for="termino in ACCESS_TERMS" :key="termino">
          <IconShieldCheck :size="17" aria-hidden="true" />
          <span>{{ termino }}</span>
        </li>
      </ul>

      <form class="formulario" @submit.prevent="entrar">
        <label v-if="pideClave" class="campo" :for="CAMPO_ID">
          <span class="etiqueta">Clave de acceso</span>
          <Password
            :input-id="CAMPO_ID"
            v-model="clave"
            :feedback="false"
            toggle-mask
            fluid
            autocomplete="current-password"
            :invalid="Boolean(error)"
            placeholder="Escribe la clave"
          />
          <small v-if="error" class="error">{{ error }}</small>
        </label>

        <Button type="submit" :loading="comprobando" :label="pideClave ? 'Entrar' : 'Acepto y entro'" class="boton">
          <template #icon><IconLock :size="17" /></template>
        </Button>

        <p class="aceptacion">Al entrar aceptas las condiciones de uso y el aviso de propiedad.</p>
      </form>

      <footer class="pie">{{ copyrightLine() }}</footer>
    </section>
  </div>
</template>

<style scoped>
.acceso {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 20px;
  overflow: auto;
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 22px 22px;
}
.tarjeta {
  width: min(460px, 100%);
  padding: 26px 26px 20px;
  border-radius: var(--radius-card);
  background: var(--surface);
  box-shadow: var(--shadow-float);
}
.marca {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
h1 {
  margin: 18px 0 6px;
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.intro {
  margin: 0 0 16px;
  color: var(--ink-2);
  font-size: 13.5px;
}
.terminos {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 0 0 20px;
  padding: 14px 15px;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.terminos li {
  display: flex;
  gap: 9px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-2);
}
.terminos svg {
  flex: none;
  margin-top: 1px;
  color: var(--accent);
}
.formulario {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.etiqueta {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink-2);
}
.error {
  color: var(--critical-text);
  font-size: 12px;
}
.boton {
  width: 100%;
}
.aceptacion {
  margin: 0;
  color: var(--muted);
  font-size: 11.5px;
  text-align: center;
}
.pie {
  margin-top: 18px;
  padding-top: 13px;
  border-top: 1px solid var(--divider);
  color: var(--muted);
  font-size: 11px;
  text-align: center;
}
@media (max-width: 480px) {
  .tarjeta {
    padding: 20px 18px 16px;
  }
}
</style>
