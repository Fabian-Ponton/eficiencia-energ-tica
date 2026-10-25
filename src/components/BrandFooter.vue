<script setup lang="ts">
import { computed } from 'vue';
import { useOwnership } from '@/composables/useOwnership';
import { copyrightShort } from '@/domain/ownership';

/** Pie de marca: el aviso de derechos siempre a la vista, en la lista de proyectos y en el menú lateral. */
withDefaults(defineProps<{ compacto?: boolean; sobreOscuro?: boolean }>(), { compacto: false, sobreOscuro: false });

const { holder } = useOwnership();
const aviso = computed(() => copyrightShort(holder.value));
</script>

<template>
  <p class="marca-pie" :class="{ compacto, 'sobre-oscuro': sobreOscuro }">
    <span>{{ aviso }}</span>
    <span class="reservados">Todos los derechos reservados</span>
  </p>
</template>

<style scoped>
.marca-pie {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.reservados::before {
  content: '· ';
}
.compacto {
  flex-direction: column;
  gap: 0;
  font-size: 10.5px;
}
.compacto .reservados::before {
  content: '';
}
/* Sobre el azul del menú lateral */
.sobre-oscuro {
  color: var(--on-navy-3);
}
</style>
