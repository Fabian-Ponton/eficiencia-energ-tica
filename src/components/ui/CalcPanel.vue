<script setup lang="ts">
defineProps<{
  title?: string;
  items: { label: string; value: string; unit?: string; strong?: boolean }[];
  note?: string;
}>();
</script>

<template>
  <div class="calculo" aria-live="polite">
    <span class="mono titulo">{{ title ?? 'Calculado' }}</span>
    <dl>
      <div v-for="item in items" :key="item.label" class="item" :class="{ fuerte: item.strong }">
        <dt>{{ item.label }}</dt>
        <dd class="num">
          {{ item.value }}<small v-if="item.unit"> {{ item.unit }}</small>
        </dd>
      </div>
    </dl>
    <p v-if="note" class="nota">{{ note }}</p>
  </div>
</template>

<style scoped>
.calculo {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-card);
  background-color: var(--navy);
  background-image: var(--blueprint);
  background-size: 18px 18px;
  color: var(--on-navy);
}
.titulo {
  color: var(--on-navy-3);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px 14px;
  margin: 0;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
dt {
  color: var(--on-navy-3);
  font-size: 11.5px;
}
dd {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}
dd small {
  margin-left: 0.3em;
  color: var(--on-navy-2);
  font-size: 11px;
  font-weight: 500;
}
.fuerte dd {
  color: #7fe0a6;
  font-size: 17px;
}
.nota {
  margin: 0;
  color: var(--on-navy-2);
  font-size: 12px;
}
</style>
