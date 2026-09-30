import type { Art4Input } from '@/domain/art4';
import { auditorChecklist } from '@/domain/auditor';
import { activityIndicators, laboratoryIndicators, operatingWeeksPerYear, type ActivityIndicators, type LabIndicator } from '@/domain/calc/indicators';
import { annualEnergyKwh, installedPowerKw } from '@/domain/calc/equipment';
import { sum } from '@/domain/calc/stats';
import { isLabType, regimeOf, spaceTypeOf, USAGE_REGIMES } from '@/domain/catalogs';
import { characterization, pgeeChecklist } from '@/domain/compliance';
import { fncePotential } from '@/domain/fncePotential';
import type { RoutePlan } from '@/domain/route';
import type { Area, Equipment, UsageRegime } from '@/domain/types';
import { floorAreaOf } from '@/domain/areas';
import { formatPercent } from '@/utils/format';
import type { AuditModel } from './model';

/**
 * Datos que el informe de auditoría arma a partir del modelo, sin dibujar nada: los laboratorios, los regímenes de uso, las limitaciones
 * de los datos, el seguimiento que se propone y la entrada de la verificación del art. 4. Van aparte para poder probarlos.
 */

// ——— Laboratorios ———

export interface LabRow {
  area: Area;
  typeLabel: string;
  areaM2: number | null;
  /** Equipos eléctricos del laboratorio. */
  equipment: Equipment[];
  units: number;
  installedKw: number;
  /** Unidades que funcionan las 24 horas. */
  continuousUnits: number;
  annualKwh: number;
  kwhPerM2Year: number | null;
}

/** Los laboratorios y talleres del proyecto (espacios de tipo laboratorio), en el orden en que se registraron. */
export function labRows(m: AuditModel): LabRow[] {
  return m.data.areas
    .filter((a) => isLabType(a.spaceType))
    .map((area): LabRow => {
      const equipment = m.data.equipment.filter((e) => e.areaId === area.id);
      const annualKwh = sum(equipment.map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));
      const areaM2 = floorAreaOf(area);
      return {
        area,
        typeLabel: spaceTypeOf(area.spaceType)?.label ?? 'Laboratorio',
        areaM2,
        equipment,
        units: sum(equipment.map((e) => e.quantity)),
        installedKw: sum(equipment.map(installedPowerKw)),
        continuousUnits: sum(equipment.filter((e) => e.regime === 'continuo').map((e) => e.quantity)),
        annualKwh,
        kwhPerM2Year: areaM2 && annualKwh ? annualKwh / areaM2 : null,
      };
    });
}

/** Laboratorios con equipos registrados —eléctricos o de otros energéticos—: los que entran al anexo del inventario. */
export const labInventory = (m: AuditModel): (LabRow & { all: Equipment[] })[] =>
  labRows(m)
    .map((l) => ({ ...l, all: [...l.equipment, ...m.data.otherEquipment.filter((e) => e.areaId === l.area.id)] }))
    .filter((l) => l.all.length);

/** Indicadores por laboratorio (Res. UPME 016, §7.3): los que tienen equipos, los más intensivos primero. */
export function labIndicatorRows(m: AuditModel): LabIndicator[] {
  return laboratoryIndicators(m.data.areas, m.data.equipment, m.data.occupancy, { weeksPerYear: operatingWeeksPerYear(m.data.project.calendar) });
}

/** kWh por persona atendida y por hora de práctica, con las facturas que traen esas variables. */
export const activityRows = (m: AuditModel): ActivityIndicators => activityIndicators(m.data.bills);

// ——— Regímenes de uso ———

export interface RegimeRow {
  regime: UsageRegime;
  label: string;
  units: number;
  kw: number;
  kwh: number;
  /** Parte del consumo estimado del censo (0 a 1). */
  share: number;
}

export interface RegimeSummary {
  rows: RegimeRow[];
  /** Unidades que no se pueden apagar (conservación de muestras, servidores…). */
  nonInterruptibleUnits: number;
  totalKwh: number;
}

/** El censo eléctrico agrupado por régimen de uso: por horario, continuo 24 h, por ciclos y de respaldo. */
export function regimeSummary(equipment: readonly Equipment[]): RegimeSummary {
  const totalKwh = sum(equipment.map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));
  const rows = USAGE_REGIMES.map((r): RegimeRow => {
    const own = equipment.filter((e) => regimeOf(e.regime).id === r.id);
    const kwh = sum(own.map((e) => annualEnergyKwh(e, e.operatingDaysPerMonth)));
    return { regime: r.id, label: r.label, units: sum(own.map((e) => e.quantity)), kw: sum(own.map(installedPowerKw)), kwh, share: totalKwh ? kwh / totalKwh : 0 };
  }).filter((r) => r.units > 0);
  return { rows, nonInterruptibleUnits: sum(equipment.filter((e) => e.nonInterruptible).map((e) => e.quantity)), totalKwh };
}

// ——— Limitaciones de los datos ———

/** Lo que faltó o quedó estimado en esta auditoría, con lo registrado: entra al alcance del informe como limitaciones. */
export function dataLimits(m: AuditModel): string[] {
  const out: string[] = [];
  const months = m.data.bills.length;
  if (!months) out.push('No hay facturas de electricidad: el comportamiento mensual, la línea base y el costo anual quedan pendientes.');
  else if (months < 12) out.push(`Hay ${months} ${months === 1 ? 'factura' : 'facturas'} de electricidad: el consumo anual es una estimación y la línea base necesita 12 meses.`);
  else if (m.upme && m.upme.months < 36 && !m.data.project.baseline?.note?.trim()) out.push(`El periodo base de la línea base tiene ${m.upme.months} meses; la Res. UPME 016 de 2024 recomienda tres años o justificar el periodo.`);
  if (!m.data.areas.length) out.push('No hay espacios registrados: la verificación de la climatización y la iluminación por espacio queda pendiente.');
  if (!m.data.equipment.length) out.push('No hay equipos en el censo de carga: el balance por uso final, el dimensionamiento y las medidas por equipo quedan pendientes.');
  if (!m.daily) out.push('No se cargó un registro de analizador o del operador de red: la curva de carga diaria se estima con los horarios del censo.');
  if (!m.data.measurements.length) out.push('No hay mediciones puntuales de tensión, corriente ni potencia.');
  if (m.deviation !== null && Number.isFinite(m.deviation) && Math.abs(m.deviation) > 0.1) {
    out.push(`El censo de carga difiere ${formatPercent(Math.abs(m.deviation), 1)} del consumo facturado: el balance por uso final es una estimación.`);
  }
  if (m.data.otherBills.length || m.data.otherEquipment.length) {
    out.push('El balance por uso final, los indicadores y la línea base son eléctricos; los demás energéticos se reportan solo en kWh equivalentes, con el factor de conversión de cada factura.');
  }
  const labs = labRows(m);
  if (labs.length && !m.data.occupancy.some((o) => !o.deletedAt && labs.some((l) => l.area.id === o.areaId))) {
    out.push('No se registraron los horarios de uso de los laboratorios: no se calculan los indicadores por hora de uso ni por persona.');
  }
  return out;
}

// ——— Seguimiento propuesto ———

export interface FollowRow {
  indicator: string;
  how: string;
  frequency: string;
}

/** Indicadores que se proponen para evaluar y dar seguimiento (art. 4, aspecto f), según los datos que hay. */
export function followProposal(m: AuditModel): FollowRow[] {
  const rows: FollowRow[] = [];
  if (m.upme) rows.push({ indicator: 'Consumo frente a la línea base', how: 'kWh facturados del mes, normalizados a 30 días, frente a la línea base del mes (Res. UPME 016 de 2024).', frequency: 'Mensual' });
  rows.push({ indicator: 'Ahorro frente al año anterior', how: 'kWh del mes frente al mismo mes del año anterior, acumulado en el año; la meta legal es de al menos 15 % el año siguiente a la auditoría.', frequency: 'Mensual' });
  if (m.indicators.kwhPerM2Year !== null) rows.push({ indicator: 'Intensidad energética (kWh/m²·año)', how: 'Consumo de los últimos 12 meses entre el área construida.', frequency: 'Anual' });
  if (m.indicators.kwhPerUserYear !== null) rows.push({ indicator: 'Consumo por usuario (kWh/usuario·año)', how: 'Consumo de los últimos 12 meses entre los usuarios de la edificación.', frequency: 'Anual' });
  const activity = activityRows(m);
  if (activity.kwhPerPerson !== null) rows.push({ indicator: 'Consumo por persona atendida', how: 'kWh facturados entre las personas atendidas del mismo mes.', frequency: 'Mensual' });
  if (activity.kwhPerPracticeHour !== null) rows.push({ indicator: 'Consumo por hora de práctica', how: 'kWh facturados entre las horas de práctica del mismo mes.', frequency: 'Mensual' });
  if (labRows(m).some((l) => l.kwhPerM2Year !== null)) rows.push({ indicator: 'Consumo por laboratorio (kWh/m²·año)', how: 'Consumo estimado con el censo de cada laboratorio entre su área; se actualiza cuando cambian los equipos o los horarios.', frequency: 'Semestral' });
  return rows;
}

// ——— Verificación del art. 4 ———

/** La entrada de la verificación del art. 4 con lo que hay en el proyecto. `route` es la ruta anual calculada con el mismo modelo. */
export function art4Input(m: AuditModel, route: RoutePlan): Art4Input {
  const { project } = m.data;
  const measures = m.data.measures;
  const potential = fncePotential({ areas: m.data.areas, peakSunHours: project.peakSunHours, annualKwh: m.billedAnnualKwh ?? (m.estimatedAnnualKwh || null), tariffCopPerKwh: project.economics.tariffCopPerKwh });
  const finite = (value: number | null) => value !== null && Number.isFinite(value);
  return {
    characterization: characterization(project),
    significantUses: m.significant.length,
    billMonths: m.data.bills.length,
    billsWithCost: m.data.bills.filter((b) => b.costCop > 0).length,
    baselineMonths: m.upme?.months ?? null,
    equipmentCount: sum([...m.data.equipment, ...m.data.otherEquipment].map((e) => e.quantity)),
    censusDeviation: m.deviation !== null && Number.isFinite(m.deviation) ? m.deviation : null,
    measures: {
      total: measures.length,
      evaluated: measures.filter((x) => (x.savingsKwhYear > 0 || x.savingsCopYear > 0) && x.investmentCop >= 0).length,
      prioritized: measures.filter((x) => Boolean(x.priority)).length,
    },
    fnce: { excluded: project.scope?.fnce === 'excluida', quantified: potential !== null },
    indicators: finite(m.indicators.kwhPerM2Year) || finite(m.indicators.kwhPerUserYear),
    hasManager: Boolean(m.data.pgee?.energyManager?.name?.trim()),
    pgee: pgeeChecklist({ pgee: m.data.pgee, firstYear: route.firstYear }),
    auditor: auditorChecklist(m.data.auditor),
  };
}
