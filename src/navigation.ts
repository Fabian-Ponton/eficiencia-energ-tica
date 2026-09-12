import {
  IconBolt,
  IconBuilding,
  IconCalendarStats,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconClipboardCheck,
  IconClipboardList,
  IconFileText,
  IconGauge,
  IconPlug,
  IconReceipt,
  IconRuler2,
  IconRulerMeasure,
  IconTarget,
  IconZoomCheck,
} from '@tabler/icons-vue';
import type { Component } from 'vue';
import type { StageId } from '@/domain/progress';

export interface NavStep {
  id: string;
  label: string;
  icon: Component;
  /** Fase del plan en la que se construye la pantalla. */
  phase: number;
  description: string;
}

export interface NavStage {
  id: StageId;
  label: string;
  shortLabel: string;
  icon: Component;
  steps: NavStep[];
}

/** Etapas y pasos de la auditoría: alimentan el menú lateral, la barra inferior y el avance. */
export const STAGES: NavStage[] = [
  {
    id: 'campo',
    label: 'Levantamiento',
    shortLabel: 'Campo',
    icon: IconClipboardCheck,
    steps: [
      { id: 'datos', label: 'Datos generales', icon: IconBuilding, phase: 1, description: 'Cliente, ubicación, área, horarios y parámetros económicos.' },
      { id: 'areas', label: 'Áreas y dimensiones', icon: IconRuler2, phase: 1, description: 'Espacios con largo, ancho, alto, ocupación y ventanas.' },
      { id: 'inventario', label: 'Inventario', icon: IconPlug, phase: 1, description: 'Censo de carga con fotos, horarios y estado de cada equipo.' },
      { id: 'electrico', label: 'Sistema eléctrico', icon: IconBolt, phase: 1, description: 'Transformador, acometida, tableros y circuitos.' },
      { id: 'mediciones', label: 'Mediciones', icon: IconGauge, phase: 1, description: 'Mediciones puntuales, lecturas del medidor y archivos del analizador.' },
      { id: 'facturacion', label: 'Facturación', icon: IconReceipt, phase: 1, description: 'Facturas mensuales: kWh, reactiva, demanda y costo.' },
    ],
  },
  {
    id: 'analisis',
    label: 'Análisis',
    shortLabel: 'Análisis',
    icon: IconChartBar,
    steps: [
      { id: 'comportamiento', label: 'Comportamiento', icon: IconChartLine, phase: 2, description: 'Consumo diario, mensual y anual, curva de carga y mapa de calor.' },
      { id: 'balance', label: 'Balance e indicadores', icon: IconChartPie, phase: 2, description: 'Usos finales, usos significativos, indicadores y línea base.' },
      { id: 'dimensionamiento', label: 'Dimensionamiento', icon: IconRulerMeasure, phase: 3, description: 'Carga térmica, iluminación y carga instalada frente a la capacidad.' },
    ],
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: 'Plan',
    icon: IconTarget,
    steps: [
      { id: 'diagnostico', label: 'Diagnóstico', icon: IconZoomCheck, phase: 5, description: 'Hallazgos con evidencia fotográfica.' },
      { id: 'oportunidades', label: 'Oportunidades', icon: IconTarget, phase: 5, description: 'Medidas de ahorro con evaluación económica y priorización.' },
      { id: 'pgee', label: 'PGEE', icon: IconClipboardList, phase: 5, description: 'Política energética, metas, planes de acción y seguimiento.' },
      { id: 'implementacion', label: 'Implementación', icon: IconCalendarStats, phase: 6, description: 'Cronograma, presupuesto y avance de las medidas.' },
    ],
  },
  {
    id: 'informes',
    label: 'Informes',
    shortLabel: 'Informes',
    icon: IconFileText,
    steps: [
      { id: 'informes', label: 'Informes y exportación', icon: IconFileText, phase: 4, description: 'Informe Word, PGEE, plan de implementación, CSV, Excel y respaldo.' },
    ],
  },
];

export const ALL_STEPS = STAGES.flatMap((stage) => stage.steps.map((step) => ({ ...step, stage: stage.id })));

export const findStep = (id: string) => ALL_STEPS.find((step) => step.id === id);
