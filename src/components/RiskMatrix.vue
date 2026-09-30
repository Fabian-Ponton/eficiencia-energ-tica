<script setup lang="ts">
import { computed } from 'vue';
import { FREQUENCIES, RISK_LEVELS, RISK_MATRIX, type Frequency, type RiskLevel } from '@/domain/safety';
import type { RiskLevelNumber, SafetyFinding } from '@/domain/types';

/**
 * Matriz de análisis de riesgos del RETIE (1.5.1.4.1): consecuencia de 5 a 1 en las filas y frecuencia de E a A en las columnas.
 * Cada celda dice su nivel y los hallazgos abiertos que caen en ella (S1, S2…).
 */
const props = defineProps<{ cells: ReadonlyMap<string, readonly SafetyFinding[]>; codes: ReadonlyMap<string, string> }>();

const ROWS: RiskLevelNumber[] = [5, 4, 3, 2, 1];
// La tabla del RETIE pone la frecuencia menor a la izquierda: E, D, C, B, A
const COLUMNS: Frequency[] = ['e', 'd', 'c', 'b', 'a'];
const CONSEQUENCE_HINT: Record<RiskLevelNumber, string> = { 5: 'Muertes', 4: 'Incapacidad permanente', 3: 'Incapacidad temporal', 2: 'Lesión menor', 1: 'Molestia' };
// En el celular las celdas son angostas: el nivel va abreviado, para que el color nunca sea lo único que lo dice
const SHORT: Record<RiskLevel, string> = { 'muy-alto': 'M. alto', alto: 'Alto', medio: 'Medio', bajo: 'Bajo', 'muy-bajo': 'M. bajo' };

const cell = (row: RiskLevelNumber, column: Frequency) => {
  const level: RiskLevel = RISK_MATRIX[row][column];
  const found = props.cells.get(`${row}${column}`) ?? [];
  const list = found.map((f) => props.codes.get(f.id) ?? '');
  const text = `Consecuencia ${row}, frecuencia ${column.toUpperCase()}: riesgo ${RISK_LEVELS[level].label.toLowerCase()}${found.length ? `. ${found.length} ${found.length === 1 ? 'hallazgo' : 'hallazgos'}: ${list.join(', ')}` : ''}`;
  return { level, list, text };
};
const frequencyOf = (id: Frequency) => FREQUENCIES.find((f) => f.id === id);
const filled = computed(() => [...props.cells.values()].reduce((total, list) => total + list.length, 0));
</script>

<template>
  <div class="matriz" role="table" :aria-label="`Matriz de riesgos con ${filled} hallazgos`">
    <div class="eje-x" role="row">
      <span class="esquina" role="columnheader">Consecuencia ↓ · Frecuencia →</span>
      <span v-for="column in COLUMNS" :key="column" class="cabeza" role="columnheader" :title="frequencyOf(column)?.label">
        <strong>{{ column.toUpperCase() }}</strong>
        <small>{{ frequencyOf(column)?.label }}</small>
      </span>
    </div>
    <div v-for="row in ROWS" :key="row" class="fila" role="row">
      <span class="cabeza-fila" role="rowheader">
        <strong>{{ row }}</strong>
        <small>{{ CONSEQUENCE_HINT[row] }}</small>
      </span>
      <span v-for="column in COLUMNS" :key="column" class="celda" :class="cell(row, column).level" role="cell" :aria-label="cell(row, column).text" :title="cell(row, column).text">
        <span class="nivel">
          <span class="largo">{{ RISK_LEVELS[cell(row, column).level].label }}</span>
          <span class="corto" aria-hidden="true">{{ SHORT[cell(row, column).level] }}</span>
        </span>
        <span v-if="cell(row, column).list.length" class="codigos">
          <b v-for="code in cell(row, column).list" :key="code">{{ code }}</b>
        </span>
      </span>
    </div>
    <!-- En el celular los ejes van sin descripción: aquí queda lo que significa cada letra y cada número -->
    <dl class="claves">
      <div>
        <dt>Frecuencia</dt>
        <dd>{{ COLUMNS.map((c) => `${c.toUpperCase()} ${frequencyOf(c)?.label.toLowerCase()}`).join(' · ') }}</dd>
      </div>
      <div>
        <dt>Consecuencia</dt>
        <dd>{{ ROWS.map((r) => `${r} ${CONSEQUENCE_HINT[r].toLowerCase()}`).join(' · ') }}</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.matriz {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.eje-x,
.fila {
  display: grid;
  grid-template-columns: 74px repeat(5, minmax(0, 1fr));
  gap: 3px;
}
.esquina {
  display: flex;
  align-items: flex-end;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1.2;
}
.cabeza,
.cabeza-fila {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  color: var(--ink-2);
}
.cabeza {
  align-items: center;
  text-align: center;
}
.cabeza strong,
.cabeza-fila strong {
  font-family: var(--font-mono);
  font-size: 13px;
}
.cabeza small,
.cabeza-fila small {
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.2;
}
.cabeza-fila small {
  display: block;
}
.celda {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 54px;
  padding: 4px 2px;
  border-radius: 6px;
  font-size: 10.5px;
  font-weight: 600;
  text-align: center;
}
.celda.muy-alto {
  background: var(--critical-text);
  color: #fff;
}
.celda.alto {
  background: var(--serious-wash);
  color: var(--serious-text);
  box-shadow: inset 0 0 0 1.5px var(--serious-text);
}
.celda.medio {
  background: var(--warning-wash);
  color: var(--warning-text);
}
.celda.bajo {
  background: var(--good-wash);
  color: var(--good-text);
}
.celda.muy-bajo {
  background: var(--good-wash);
  color: var(--good-text);
  opacity: 0.75;
}
.nivel {
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.corto {
  display: none;
}
.claves {
  display: none;
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.45;
}
.claves div {
  margin-top: 4px;
}
.claves dt {
  display: inline;
  color: var(--ink-2);
  font-weight: 600;
}
.claves dt::after {
  content: ': ';
}
.claves dd {
  display: inline;
  margin: 0;
}
.codigos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}
.codigos b {
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 10.5px;
  box-shadow: 0 0 0 1px var(--border);
}
@media (max-width: 639px) {
  .eje-x,
  .fila {
    grid-template-columns: 44px repeat(5, minmax(0, 1fr));
  }
  .cabeza small,
  .cabeza-fila small {
    display: none;
  }
  /* La esquina sigue ocupando su columna (sin texto) para que las letras de la frecuencia queden sobre sus celdas */
  .esquina {
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }
  .largo {
    display: none;
  }
  .corto {
    display: inline;
    font-size: 9.5px;
  }
  .celda {
    min-height: 44px;
  }
  .claves {
    display: block;
  }
}
</style>
