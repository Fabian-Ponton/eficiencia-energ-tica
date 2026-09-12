import {
  IconAirConditioning,
  IconAirConditioningDisabled,
  IconAlertOctagon,
  IconAlertTriangle,
  IconBulb,
  IconCircleCheck,
  IconDeviceDesktop,
  IconEngine,
  IconFridge,
  IconPlug,
  IconToolsKitchen2,
} from '@tabler/icons-vue';
import { h, type Component, type FunctionalComponent } from 'vue';
import ElectricalIcon from '@/components/icons/ElectricalIcon.vue';
import type { LoadingLevel } from '@/domain/calc/sizing/capacity';
import type { LightingStatus } from '@/domain/calc/sizing/lighting';
import type { CoolingStatus } from '@/domain/sizing';
import type { ImbalanceLevel } from '@/domain/measurements';
import type { Condition, ElectricalKind, EndUseCategory } from '@/domain/types';

/** Ícono de cada uso final; se repite en listas, formularios, gráficos e informes. */
export const END_USE_ICONS: Record<EndUseCategory, Component> = {
  climatizacion: IconAirConditioning,
  motores: IconEngine,
  refrigeracion: IconFridge,
  iluminacion: IconBulb,
  cocina: IconToolsKitchen2,
  ti: IconDeviceDesktop,
  otros: IconPlug,
};

const electricalIcon =
  (kind: ElectricalKind): FunctionalComponent<{ size?: number | string }> =>
  (props) =>
    h(ElectricalIcon, { kind, size: Number(props.size ?? 24) });

/** Íconos propios del sistema eléctrico, usables donde se espera un ícono de Tabler. */
export const ELECTRICAL_ICONS: Record<ElectricalKind, Component> = {
  red: electricalIcon('red'),
  transformador: electricalIcon('transformador'),
  medidor: electricalIcon('medidor'),
  acometida: electricalIcon('acometida'),
  tablero: electricalIcon('tablero'),
  circuito: electricalIcon('circuito'),
};

/** Tonos de estado: siempre acompañados de ícono y texto, nunca solo color. */
export type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'info' | 'neutral';

interface StatusStyle {
  tone: Tone;
  icon: Component;
  label: string;
}

export const CONDITION_STATUS: Record<Condition, StatusStyle> = {
  bueno: { tone: 'good', icon: IconCircleCheck, label: 'Bueno' },
  regular: { tone: 'warning', icon: IconAlertTriangle, label: 'Regular' },
  deficiente: { tone: 'critical', icon: IconAlertOctagon, label: 'Deficiente' },
};

export const LIGHTING_STATUS: Record<LightingStatus, StatusStyle> = {
  insuficiente: { tone: 'serious', icon: IconAlertTriangle, label: 'Iluminación baja' },
  adecuada: { tone: 'good', icon: IconCircleCheck, label: 'Iluminación adecuada' },
  excesiva: { tone: 'warning', icon: IconAlertTriangle, label: 'Iluminación excesiva' },
};

export const COOLING_STATUS: Record<CoolingStatus, StatusStyle> = {
  subdimensionado: { tone: 'serious', icon: IconAlertTriangle, label: 'Capacidad insuficiente' },
  adecuado: { tone: 'good', icon: IconCircleCheck, label: 'Capacidad adecuada' },
  sobredimensionado: { tone: 'warning', icon: IconAlertTriangle, label: 'Sobredimensionado' },
  'sin-aire': { tone: 'neutral', icon: IconAirConditioningDisabled, label: 'Sin aire asignado' },
};

export const LOADING_STATUS: Record<LoadingLevel, StatusStyle> = {
  normal: { tone: 'good', icon: IconCircleCheck, label: 'Carga normal' },
  alta: { tone: 'warning', icon: IconAlertTriangle, label: 'Carga alta' },
  critica: { tone: 'critical', icon: IconAlertOctagon, label: 'Carga crítica' },
};

export const IMBALANCE_STATUS: Record<ImbalanceLevel, StatusStyle> = {
  normal: { tone: 'good', icon: IconCircleCheck, label: 'Fases balanceadas' },
  alto: { tone: 'warning', icon: IconAlertTriangle, label: 'Desbalance alto' },
  critico: { tone: 'critical', icon: IconAlertOctagon, label: 'Desbalance crítico' },
};
