# Plan de cambios de PONTIA · Fase 2

> **Fase 2 · Plan de cambios** · 2026-09-29 · rama `cumplimiento-normativo` · **no se modificó código**
> Se apoya en la [matriz de cumplimiento](MATRIZ_CUMPLIMIENTO.md) (Fase 1). Los IDs entre paréntesis (L-03, R-4p3, U-05…) son los de esa matriz.
> El repositorio es público: este documento no contiene datos personales.

## 1. Resumen

- **14 bloques de trabajo**: M0 (verificaciones previas, sin código) y M1 a M13, agrupados en **4 entregas**. Están ordenados para que puedas **usar la app en campo cuanto antes**: la Entrega A cubre todo el levantamiento (los 13 formatos).
- **Ningún dato existente se modifica.** Los cambios son aditivos: campos opcionales y seis tablas nuevas (esquema local versión 2). Un proyecto actual abre igual y un respaldo `.zip` actual se sigue importando.
- **Lo que hoy es solo electricidad seguirá igual**: el gas natural se modela aparte y no toca los cálculos eléctricos ya probados (el ejemplo BL-06 debe dar exactamente las mismas cifras).
- **La línea base de la UPME 016 se probará con sus propios ejemplos.** Ya reproduje con código propio el ejemplo estadístico oficial: ahorro potencial **3,44 %** (oficial 3,44 %), R² **0,2493** (0,2492), p de personas **0,001936** (0,001938), error promedio **3,21 %** (3,2 %). Dos diferencias menores quedan anotadas en la sección 7.
- Al final habrá **≈ 250 a 300 pruebas** (hoy 146) y un ejemplo de laboratorios con 3 o más laboratorios.
- Necesito tu visto bueno para empezar la Fase 3 y tres datos que **no bloquean** el arranque (sección 13).

---

## 2. Tus respuestas y decisiones de diseño

### 2.1 Lo que decidiste

| Pregunta | Tu respuesta | Qué implica en el diseño |
|---|---|---|
| Solar y FNCER | «Hazlo así»: no diseñar FV, pero incluir un párrafo de potencial (o una exclusión motivada) y dejar la calculadora | Decisión D-1 |
| Tenencia y código | El bloque es propiedad de la Universidad; se llama «Laboratorios»; no sabes si tiene código | Decisión D-2. Todas las medidas están permitidas (art. 3 de la Res. 40412) |
| Energéticos | «Creo que usan gas natural» | Decisión D-3. El soporte de gas entra desde la Entrega A |

### 2.2 Decisiones de diseño

**D-1 · FNCER.** `Project.scope.fnce` toma dos valores: `potencial` (por defecto) o `excluida`, con una nota. Con `potencial`, el informe incluye un párrafo **«Potencial de FNCER (referencia)»** calculado con la calculadora que ya existe, a partir del área de cubierta disponible (`Area.roofAvailableM2`) y las horas de sol pico: kWp, área, kWh/año y porcentaje del consumo. Siempre dice que **el diseño de generación fotovoltaica no forma parte del alcance**. Con `excluida`, declara la exclusión con tu nota. La medida FV sigue existiendo y se etiqueta `savingsType: 'fncer'`.

**D-2 · Tenencia y códigos.** El piloto queda con `tenure: 'propia'`, nombre «Laboratorios» y un **código interno** propuesto `LAB-01` (lo cambias cuando quieras). El *código único* que pide la UPME es de la **sede**, no del bloque, y lo define la propia Universidad (la Guía de la UPME dice: «use un código exclusivo para distinguir cada sede de la entidad»). Va en `site.upmeCode`, sin valor por defecto. Si la tenencia **no** fuera propia, solo se permitirían medidas operativas.

**D-3 · Otros energéticos, con aislamiento.** Hoy el consumo por equipo se calcula en 8 lugares (`annualEnergyKwh` y `monthlyEnergyKwh`) y las facturas se leen en más de una docena; todos suponen electricidad. Para no romper nada, **los datos se filtran a electricidad en la entrada** (`electricBills`, `electricEquipment`) y el gas se calcula en un módulo aparte (`domain/carriers.ts`). El balance «todos los energéticos» y la línea base por energético son vistas **nuevas**. Un registro sin `carrier` significa electricidad.

**D-4 · Entidad y sede dentro del proyecto.** Los datos de entidad, sede y edificio viven en `Project` (campos opcionales), sin tablas nuevas. La lista de proyectos los agrupa y el reporte a la UPME de una sede reúne los proyectos con el mismo `site.upmeCode`. Así no cambia el respaldo ni la sincronización. Si más adelante hace falta renombrar una entidad en bloque, se normaliza.

**D-5 · Pasos nuevos en el avance.** Se agregan tres pasos al menú y al anillo de avance: `control` (Levantamiento, al final, como en tu Excel), `seguridad` (Plan, después de Diagnóstico) y `reporte-upme` (Informes). Los proyectos existentes verán su porcentaje bajar porque hay más pasos (ver sección 10). «Datos generales» **no** cambia su regla; lo exigido por el art. 4(a) se controla aparte.

**D-6 · Línea base.** La **oficial del informe será la de la UPME 016**. La regresión actual (ASHRAE 14: R², CV(RMSE), NMBE) **se conserva** como verificación complementaria. La banda de verificación por defecto es **±10 %**, porque es la que usa el ejemplo oficial de 36 datos; la banda por desviación estándar (ecuaciones 4 y 5, ilegibles en la copia consultada) queda opcional hasta confirmarla.

**D-7 · Perfil del auditor.** Se guarda **solo en el equipo** (tabla `settings`): no entra en el respaldo `.zip` ni en la nube, y no hay adjuntos de documentos. Los números de matrícula no se imprimen en el informe salvo que lo marques.

**D-8 · Numeración de secciones.** Hoy las secciones 1 a 7 del informe tienen el número escrito a mano en `audit.ts` (las opcionales ya usan un contador). Pasan a un contador, para poder agregar secciones sin renumerar a mano.

**D-9 · Regímenes de uso.** Un equipo sin `regime` se trata como `horario` (comportamiento actual). El régimen `continuo` fuerza 24 h.

**D-10 · Normas con fuente y fecha.** Todo valor tomado de RETIE, RETILAP o la UPME se escribe en `catalogs.ts` con un comentario de fuente y fecha de verificación, y se revalida antes de cada entrega (RETIE y RETILAP cambiaron el 23-jun-2026).

**D-11 · Publicación.** Nada se publica sin tu autorización. Como los equipos con la app instalada se actualizan solos, cada entrega llega a todos tus dispositivos cuando se fusiona a `main`: por eso la migración se prueba también en un navegador real.

### 2.3 Supuestos que aplico si no dices lo contrario

- Catálogo inicial de tipos de laboratorio (editable): química, física, biología y microbiología, electrónica y eléctrica, cómputo, mecánica y materiales, ambiental y suelos, otro.
- Riesgo de seguridad valorado con la **matriz del RETIE 1.5.1** (por ser de origen eléctrico), con equivalencia opcional a GTC 45.
- El ejemplo BL-06 **se conserva tal cual** (146 pruebas dependen de sus cifras) y se agrega aparte un ejemplo de laboratorios.
- Tu Excel se queda **fuera de git** (el repositorio es público). PONTIA podrá generar los formatos en blanco por su cuenta.

---

## 3. Lista priorizada de trabajo

| # | Bloque | Qué cierra de la matriz | Tamaño | Depende de | Entrega |
|---|---|---|---|---|---|
| 1 | **M0** Verificaciones previas (sin código) | Pendientes 2.3 de la matriz | S | — | antes de cada módulo |
| 2 | **M1** Datos: tipos, esquema v2, respaldo y sincronización | Base de todo | M | — | A |
| 3 | **M2** Entidad, sede y edificio | L-01, R-03, R-4a, C-01, C-02, Formato 1 | M | M1 | A |
| 4 | **M3** Laboratorios y equipos | R-4c, X-03, Formatos 2 a 7, 9 y 10 | L | M1 | A |
| 5 | **M4** Varios energéticos (gas natural) | R-4b, C-03, Formato 8 | L | M1, M3 | A |
| 6 | **M12** Control de recolección y formatos Excel | Formato 13, importar y exportar los 13 formatos | L | M2, M3, M4 | A |
| 7 | **M5** Línea base UPME 016 e indicadores | U-01 a U-10, R-4f, R-4p2 | XL | M3, M4 | B |
| 8 | **M6** Oportunidades, FNCER y tenencia | R-4d, R-4e, R-4g, L-02, Formatos 11 y 12 | M | M2, M5 | B |
| 9 | **M7** Seguridad eléctrica y SST | X-01, X-05 | L | M1 | C |
| 10 | **M8** PGEE: meta legal y ruta anual | L-02 a L-04, R-4p3, R-4p4 | M | M5, M6 | C |
| 11 | **M9** Plan: ejecutor y verificación RETIE | X-02, L-05, R-08 | M | M7, M8 | C |
| 12 | **M10** Auditor, reporte UPME y seguimiento | R-05, R-06, L-01, L-06, C-*, U-11, X-06 | L | M2, M5, M8 | D |
| 13 | **M11** Informe final (ISO 50002 y art. 4) | R-4p1 y cierre del art. 4 | L | todos | D |
| 14 | **M13** Ejemplo de laboratorios, manual y prueba final | Fase 4 | M | todos | D |

Tamaños relativos: S pequeño · M mediano · L grande · XL el más grande (la línea base).

**Por qué este orden.** Estás en la etapa de recolección (tu Excel tiene la hoja «Control de recolección – Etapa 5»). Lo primero que necesitas es **capturar** bien: entidad y edificio, laboratorios, equipos con régimen y gas, y los formatos. El análisis, el PGEE y el reporte vienen después, con datos ya reales.

---

## 4. Modelo de datos propuesto

### 4.1 Compatibilidad

- **Solo se agregan** campos opcionales y tablas. No se renombra ni se elimina nada.
- Esquema local: `db.version(2)` (la versión 1 no se edita, como pide `schema.ts`). No hace falta `upgrade()`: no hay datos que transformar.
- Respaldo `.zip`: `BACKUP_VERSION` pasa de 1 a 2. La versión 2 **no abre** en una app que solo conozca la 1 (pide actualizar, que ya ocurre solo); la versión 1 **sí abre** en la 2.
- Sincronización: el SQL de la nube guarda cualquier `table_name`, así que **no cambia**; solo se agregan las tablas a `SYNC_TABLES`.

### 4.2 Tipos y campos nuevos (`src/domain/types.ts`)

```ts
export type Tenure = 'propia' | 'arrendada' | 'comodato' | 'compartida' | 'otra';
export type EnergyCarrier = 'electricidad' | 'gas-natural' | 'glp' | 'otro';
export type UsageRegime = 'continuo' | 'horario' | 'ciclos' | 'respaldo';
export type SavingsType = 'bpo' | 'cambio-tecnologico' | 'sustitucion-energetico' | 'fncer' | 'pasiva';
export type EndUseCategory = /* los 7 actuales */ | 'laboratorio';       // «Equipos de laboratorio»
export type EntityType = /* los actuales */ | 'seguridad' | 'mantenimiento';   // vínculo de fotos
export type ReportKind = /* los actuales */ | 'upme';
```

```ts
interface Project {
  /* …los campos actuales no cambian… */
  entity?: { name: string; nit?: string; kind: 'publica' | 'privada'; order?: 'nacional' | 'territorial' };
  site?: { name: string; upmeCode?: string };            // código único de la sede: lo define la entidad
  building?: { builtYear?: number; floors?: number; activity?: string; surroundings?: string; tenure: Tenure };
  population?: { students?: number; staff?: number; floating?: number };   // «users» se conserva
  institutionalContact?: { name?: string; role?: string };
  surveyDate?: string;
  audit?: { date?: string; periodStart?: string; periodEnd?: string };      // ciclo de 4 años
  scope?: { boundary?: string; objectives?: string; limitations?: string; fnce: 'potencial' | 'excluida'; fnceNote?: string };
  safetyReviewed?: boolean;                                                 // «revisé y no hay hallazgos»
}

interface Area {        /* + */ code?: string; floor?: string }           // «spaceType» suma tipos de laboratorio

interface Equipment {   /* + */
  carrier?: EnergyCarrier;                                               // ausente = electricidad
  regime?: UsageRegime;                                                  // ausente = 'horario'
  nonInterruptible?: boolean; nonInterruptibleReason?: string;
  voltageV?: number; currentA?: number; phases?: 1 | 2 | 3;
  usageMode?: string;                                                    // «Modo de uso» (Formato 3)
  acType?: string; setpointC?: number;                                   // Formato 4
  fixtureType?: string; lightControl?: 'manual' | 'sensor' | 'temporizador' | 'automatico' | 'otro';  // Formato 5
}

interface Bill {        /* + */
  carrier?: EnergyCarrier;                                               // ausente = electricidad
  quantity?: number; unit?: 'kWh' | 'm3' | 'kg' | 'gal'; kwhPerUnit?: number;   // no eléctricos: kwh = quantity × kwhPerUnit
  energyCostCop?: number;                                                // «Valor energía» (Formato 8); costCop sigue siendo el total
  populationServed?: number; practiceHours?: number; coolingDegreeDays?: number;   // variables de la UPME 016
}

interface Finding {     /* + */ foundAt?: string; cause?: string; energyImpact?: string; suggestedAction?: string }   // Formato 11

interface Measure {     /* + */
  savingsType?: SavingsType;                                             // si falta, se infiere de «kind»
  carrier?: EnergyCarrier; currentConsumptionKwhYear?: number;           // consumo del sistema afectado (Formato 12)
  items?: { action: string; element?: string; brandModel?: string; reference?: string; quantity?: number;
            unit?: string; unitCostCop?: number; manufacturer?: string; supplier?: string; role?: string }[];   // plantilla 5 de la UPME
}

interface Pgee {        /* + */
  energyManager?: { name: string; role?: string; appointmentDoc?: string; appointmentDate?: string };
  legalGoal?: { baseYear: number; previousYearKwh?: number; pct: number };          // pct = 15 (ley)
  annualRoute?: { year: number; targetKwh?: number; targetPct?: number; measureCodes: string[]; budgetCop?: number; note?: string }[];
}

interface Task {        /* + */
  executor?: { kind: 'persona' | 'empresa' | 'dependencia'; name: string; role?: string;
               registry?: { body: 'CONTE' | 'COPNIA' | 'otra'; category?: string; number?: string } };
  works?: { interventionType: 'nueva' | 'ampliacion' | 'remodelacion' | 'mantenimiento' | 'reposicion'; startDate?: string; startProof?: 'acta' | 'contrato' | 'otro' };
  retie?: {
    applies: 'si' | 'no' | 'por-definir';
    documents: { kind: 'esquema-constructivo' | 'declaracion-cumplimiento' | 'dictamen-inspeccion' | 'certificado-producto' | 'otro';
                 reference?: string; issuer?: string; date?: string; result?: 'cumple' | 'no-cumple' }[];
    riskAnalysisDone?: boolean; commissioningNotes?: string;
    status: 'pendiente' | 'en-revision' | 'cumple' | 'no-cumple' | 'no-aplica'; verifiedBy?: string; verifiedAt?: string;
  };
}
```

`Settings.auditor?: AuditorProfile` (solo local): tipo de auditor, razón social y NIT si es persona jurídica, formación (institución, programa, horas, fecha, diploma o certificación), experiencia (entidad, sector de demanda, año, si tiene certificado de un tercero, emisor y fecha), COPNIA (profesión, número, expedición, última verificación), CONTE (clases TE-1 a TE-6, número, expedición, estado, última verificación) y la lista de documentos que reúne la entidad (art. 6, parágrafo 2, literales a a d).

### 4.3 Tablas nuevas (Dexie versión 2)

```ts
db.version(2).stores({
  occupancy:           'id, projectId, areaId, term',      // Formato 6: horarios y ocupación por semestre
  maintenance:         'id, projectId, equipmentId',       // Formato 9
  collection:          'id, projectId, key',               // Formato 13: control de recolección
  safetyFindings:      'id, projectId, entityId',          // hallazgos de seguridad eléctrica y SST
  baselineAdjustments: 'id, projectId, carrier',           // bitácora de ajustes de la LBEn (UPME 016 §7.6)
  upmeCycles:          'id, projectId, year',              // ciclo de reporte: n.º de caso, fecha, concepto de la UPME
});
```

| Tabla | Campos principales |
|---|---|
| `occupancy` | `areaId`, `term` (p. ej. `2026-1`), `activity`, `day` (L a D o L-V), `start`, `end`, `hours`, `avgOccupants`, `usesAc`, `usesLighting`, `notes` |
| `maintenance` | `equipmentId`, `type` (preventivo, correctivo, predictivo, ninguno), `lastAt`, `frequency`, `activities`, `failures`, `condition`, `recommendation`, `responsible`, `notes` |
| `collection` | `key` (general, planos, areas, equipos, aires, iluminacion, uso, mediciones, facturas, mantenimiento, fotos, hallazgos), `label`, `responsible`, `targetDate`, `obtainedDate`, `status` (pendiente, en curso, obtenido, no disponible), `evidence`, `notes` |
| `safetyFindings` | `foundAt`, `entityType`/`entityId`, `riskFactor` (uno de los 12 del RETIE 1.5.1.3), `real`, `consequence` (1 a 5), `frequency` (a a e), `highRisk`, `imminent`, `description`, `immediateAction`, `recommendedAction`, `control`, `responsible`, `dueDate`, `status`, `normRef`, `taskId`, `auto`, `ruleId` |
| `baselineAdjustments` | `carrier`, `kind` (rutinario, no rutinario, actualización), `date`, `cause`, `months`, `kwhEffect`, `notes` |
| `upmeCycles` | `year`, `caseNumber`, `filedAt`, `concept` (fecha, resultado, nota) |

### 4.4 Lo que se toca en la capa de datos

- `src/db/records.ts`: agregar las tablas a `RecordTables` y `PHOTO_ENTITY` (`seguridad`, `mantenimiento`). Con eso funcionan solos `useProjectRecords`, `useRecordEditor`, `saveRecord`, ocultar y deshacer.
- `src/db/backup.ts`: agregar las tablas a `TABLES`, subir `BACKUP_VERSION` a 2 y sumar **`equipmentId`** a `REFERENCE_FIELDS` (hoy no está y la restauración «como copia» perdería el vínculo del mantenimiento con su equipo).
- `src/sync/engine.ts`: agregar las tablas a `SYNC_TABLES`.
- `src/db/projects.ts` y `src/domain/progress.ts`: contar las tablas nuevas y agregar los tres pasos.
- `src/reports/data.ts` y `src/reports/model.ts`: `ReportData` carga las tablas nuevas; `AuditModel` se amplía por módulo.

---

## 5. Detalle por bloque

Cada bloque se cierra con: pruebas nuevas y las existentes en verde, `npm run typecheck` y `npm run build` sin errores, capturas de pantalla en PC y celular (claro y oscuro) cuando hay pantalla nueva, el manual actualizado, una entrada en `docs/REGISTRO_DE_CAMBIOS.md` y un commit propio en la rama.

### M0 · Verificaciones previas (sin código)

| Qué | Cómo | Cuándo |
|---|---|---|
| Matriz de riesgos del RETIE 1.5.1.4.1 a/b (imágenes) | Convertir las páginas del PDF de la Res. 40284/2026 a imagen y transcribirla | Antes de M7 |
| Tablas 410.1 y 440.1 del RETILAP vigentes | Leerlas en la Res. 40286/2026 y sus anexos; confirmar laboratorios 300/500/750 lx y VEEI 4,0 | Antes de M3 |
| Gas natural: factor de conversión y poder calorífico | De **tu factura de gas**; y el factor de emisión oficial de la UPME | Antes de M4 |
| Libros 3 y 4 del RETIE | Cuándo basta esquema constructivo o declaración y cuándo hace falta dictamen | Antes de M9 |
| Plantillas 1 a 5 del SUU y circular del ciclo 2026 | **Tú** las descargas con el usuario de la Universidad; yo busco la circular | Antes de M10 |
| Ecuaciones 4 y 5 de la UPME 016 | Opcional; el ±10 % basta para arrancar | Opcional |

Salida: notas en `docs/` y constantes con fuente y fecha.

### M1 · Datos: tipos, esquema v2, respaldo y sincronización

- **Nuevos**: `tests/db/migration.test.ts` (una base v1 con datos se abre en v2 sin perder nada).
- **Cambian**: `src/domain/types.ts`, `src/db/schema.ts`, `src/db/records.ts`, `src/db/backup.ts`, `src/sync/engine.ts`, `src/db/projects.ts`, `src/domain/progress.ts`, `src/navigation.ts`, `src/router.ts` (los pasos nuevos apuntan a `ComingSoon` hasta su módulo), `src/reports/data.ts`.
- **Pruebas**: `records`, `backup` (incluida la restauración como copia con `equipmentId`) y `sync/engine` se amplían a las tablas nuevas.
- **Aceptación**: proyecto v1 abre y se exporta; respaldo v1 se importa; respaldo v2 se restaura con vínculos correctos. **QA en navegador real**: compilar la versión actual, crear el ejemplo, cambiar a la versión nueva con el mismo perfil y comprobar que abre.

### M2 · Entidad, sede y edificio (art. 4a, L-01, R-03)

- **Nuevos**: `src/domain/tenure.ts` (qué tipos de medida permite cada tenencia), `src/domain/compliance.ts` (empieza con el art. 4a; crece con cada módulo), sus pruebas.
- **Cambian**: `GeneralDataView.vue` (secciones «Entidad y sede», «Edificio», «Población», «Responsable institucional», «Ciclo de auditoría» y «Alcance y FNCER»), `NewProjectDialog.vue` (reutiliza entidad y sede de proyectos anteriores), `ProjectsView.vue` y `ProjectCard.vue` (agrupar por entidad y sede), `ProjectHome.vue` (tarjeta «Cumplimiento del art. 4»), `db/projects.ts`, `catalogs.ts`, `reports/docx/audit.ts` (Tabla 1 y portada), `content/manual.ts`.
- **Aceptación**: los datos del art. 4(a) se piden y se marcan como obligatorios para el informe. Un proyecto viejo aparece con «faltan datos», nunca bloqueado. Se puede generar un informe borrador con la nota «faltan: …»; el paquete de la UPME sí se bloquea hasta completarlos.

### M3 · Laboratorios y equipos (Formatos 2 a 7, 9 y 10)

- **Catálogos** (`catalogs.ts`): tipos de laboratorio con su fila del RETILAP (iluminancia mínima, media y máxima, UGR) y su VEEI; uso final `laboratorio`; regímenes; tipos de aire; controles de iluminación. La paleta de gráficas pasa de 7 a **8 colores**: se valida para daltónicos con el validador de la skill `dataviz` antes de fijarla (`charts/palette.ts`, `EndUseBar.vue`, `CategoryPicker.vue`).
- **Nuevos**: `domain/occupancy.ts` (horas y personas por laboratorio y semestre), `domain/maintenance.ts` (último mantenimiento, atrasos), `views/project/steps/OccupancyTab.vue` y `MaintenanceTab.vue` (pestañas dentro de Áreas e Inventario), pruebas.
- **Cambian**: `AreaForm.vue`/`AreasView.vue` (piso, código, tipo de laboratorio, agrupar por laboratorio), `EquipmentForm.vue`/`InventoryView.vue` (régimen, no interrumpible y motivo, V, A, modo de uso; tipo y temperatura de aire; control de iluminación; filtros por laboratorio y régimen), `MeasurementForm.vue` (frecuencia, condición, responsable), `photos` (autorización y tipos «documento» e «instrumento»), `domain/calc/equipment.ts` y `domain/estimate.ts` (el régimen `continuo` fuerza 24 h), `domain/sizing.ts` (lux y VEEI por tipo), `db/legacyImport.ts` (`guessCategory` reconoce horno, mufla, autoclave, incubadora, campana, centrífuga, balanza…), `catalogs.ts` (`EQUIPMENT_SUGGESTIONS`).
- **Cuidado con el VEEI**: hoy aula y laboratorio usan 3,5 y el RETILAP que leí dice 4,0 («aulas y laboratorios»). **Solo se cambia si M0 lo confirma en la versión vigente**; cambiaría `sizing.test.ts` (líneas 59 y 117-118) y el aviso «Iluminación con baja eficiencia (VEEI)» de BL-06.
- **Aceptación**: cada laboratorio tiene su inventario y sus equipos 24 h marcados; ningún cálculo actual cambia (BL-06 da las mismas cifras).

### M4 · Varios energéticos: gas natural (Formato 8, C-03)

- **Nuevos**: `src/domain/carriers.ts` (conversión a kWh equivalentes, separación por energético, totales), pruebas.
- **Cambian**: `BillForm.vue`/`BillingView.vue` (pestañas Electricidad · Gas natural · Otro; para gas: cantidad en m³, factor de conversión que copias de la factura, costo), `EquipmentForm.vue` (energético del equipo; para gas, potencia térmica), `db/projects.ts`, `reports/data.ts` (`electricBills`, `electricEquipment`), `BalanceView.vue` y `BehaviorView.vue` (vista nueva «Todos los energéticos»), `reports/tables.ts` (facturas por energético), `reports/docx/audit.ts` (consumo por energético).
- **Cuidado**: los filtros a electricidad van **en la entrada de datos**, no dentro de cada función. La conciliación «censo frente a facturado» se hace **por energético**.
- **Aceptación**: cargar una factura de gas no altera ninguna cifra eléctrica; el balance total suma electricidad y gas en kWh equivalentes; el factor de conversión queda visible y editable.

### M12 · Control de recolección y formatos Excel (Formato 13 y los 13 formatos)

- **Control**: `domain/collection.ts` (los 12 ítems de tu Formato 13 con su estado automático: por ejemplo «Facturas» se marca obtenido con 12 o más), `views/project/steps/CollectionView.vue`. Cada ítem admite responsable, fecha objetivo, fecha obtenida, evidencia y observaciones. «Planos/distribución» es manual (PONTIA no guarda planos).
- **Formatos**: `reports/formats.ts` genera el libro de **13 hojas con los mismos nombres y columnas de tu Excel** (`01_General` … `13_Control`), en blanco o con lo ya registrado, **con listas desplegables** (tu Excel no las tiene), unidades en los encabezados y «N/D» para dato no disponible. `db/formatsImport.ts` lee un libro diligenciado: vista previa por hoja, avisos por fila, y aplica los registros con el tipo de dato correcto. Los botones van en el paso de control.
- **Reglas de importación**: los encabezados se reconocen sin distinguir tildes ni mayúsculas; las columnas desconocidas se ignoran; una potencia sin unidad («1500») genera aviso porque tu guía exige registrar siempre la unidad; «N/D» queda vacío y cuenta como «no disponible» en el control.
- **Pruebas**: ida y vuelta (exportar, importar, comparar); tolerancia de encabezados; «N/D»; una fila con error no detiene las demás.

### M5 · Línea base UPME 016 e indicadores (U-01 a U-10, R-4f)

- **Nuevos**: `domain/calc/lben.ts` y `domain/calc/distributions.ts` (distribución t de Student para los p-valores), `views/project/steps/BaselineUpmePanel.vue`, `BaselineAdjustmentForm.vue`, pruebas.
- **Funciones** (todas puras):
  - `normalizeTo30Days(kwh, days)` = (kwh ÷ días) × 30.
  - `absoluteBaseline(series)`: promedio del mismo mes (con al menos 3 valores), banda ±10 %, depuración, cantidad de datos iniciales y finales.
  - `ratioBaseline(series, variable)`: lo mismo con el cociente (kWh por persona atendida).
  - `statisticalBaseline(y, variables)`: regresión al 95 %, p-valores, descarta variables con p > 0,05 y repite, R², máximo, mínimo y promedio.
  - `bestPerformance(...)`: potencial por mejor desempeño (mínimo mensual, o línea meta con los meses que consumieron menos que la línea base) y porcentaje.
  - `recommendModel(datos)`: valor absoluto si solo hay consumo; cociente si hay una variable; estadístico si hay varias.
  - `routineAdjustment` y `nonRoutineAdjustment`: procedimiento del Anexo 4.
  - `upmeReportAttributes(...)`: la tabla «Paso 7» del anexo (uso, área útil, energéticos, modelo, periodo base, datos iniciales y finales, LBEn, ahorro estimado).
- **Cambian**: `domain/calc/baseline.ts` (`fitLinearModel` agrega errores estándar y p-valores **sin cambiar** lo que ya devuelve), `domain/calc/indicators.ts` (kWh por persona, por hora de práctica, por laboratorio, por energético), `BalanceView.vue` (panel «Línea base UPME 016», con la regresión actual como complemento), `charts/builders.ts` y `reports/figures.ts` (figura «LBEn con banda»), `docx/audit.ts` (línea base y IDEn).
- **Avisos**: menos de 36 meses de datos (con justificación obligatoria); cambios permanentes en el periodo base; variable con p > 0,05.
- **Pruebas con los ejemplos oficiales**: Anexo 1 (valor absoluto: promedios, bandas 110 %/90 %, mínimos, ahorro 4,1 % y 468 kWh), Anexo 3 (estadístico: los 36 datos y los resultados ya reproducidos), Anexo 4 (ajustes: 9,35 % sin ajuste y 4,2 % ajustado) y Anexo 2 (cociente, solo con los índices publicados).
- **Cuidado**: el Anexo 5 suma los porcentajes de las medidas (50,22 %); eso sobreestima cuando las medidas interactúan (LED y aire acondicionado). PONTIA muestra el total al estilo UPME **y** una advertencia de interacción.

### M6 · Oportunidades, FNCER y tenencia (R-4d, R-4e, R-4g, Formatos 11 y 12)

- **Nuevos**: `domain/fncePotential.ts` (potencial de referencia a partir de la cubierta disponible y las horas de sol), calculadora de **apagado y horarios (BPO)** en `domain/measures.ts` (usa el inventario y **excluye** los equipos no interrumpibles).
- **Cambian**: `OpportunitiesView.vue` y `MeasureForm.vue` (tipo de potencial; consumo actual del sistema; ítems de la plantilla 5; el bloqueo por tenencia), `FindingForm.vue` y `DiagnosisView.vue` (fecha, causa, impacto y acción sugerida del Formato 11), `domain/measures.ts`, `domain/tenure.ts`, `docx/audit.ts` (VPN y TIR en el informe, tabla de priorización con criterios, párrafo de FNCER), `reports/tables.ts`, `catalogs.ts`.
- **Cuidado**: `savingsType` se infiere de `kind` cuando falta (operativa = buenas prácticas), sin reescribir datos. La regla de carga base nocturna (`reports/model.ts`) descuenta la carga continua justificada para no marcar como «evitable» lo que un laboratorio no puede apagar.

### M7 · Seguridad eléctrica y SST (X-01, X-05)

- **Nuevos**: `domain/safety.ts` (los 12 factores de riesgo del RETIE, matriz consecuencia × frecuencia, criterios de alto riesgo o peligro inminente, sugerencias), `views/project/steps/SafetyView.vue` y `SafetyForm.vue`, `components/RiskChip.vue`, pruebas.
- **Cambian**: `navigation.ts`/`router.ts` (paso `seguridad`), `db/records.ts` (fotos), `reports/docx/audit.ts` (capítulo propio, **sin sumarse a los ahorros**), `reports/tables.ts` (tabla de exportación), `content/manual.ts`.
- **Reglas**: un hallazgo de alto riesgo o peligro inminente se ve en el proyecto y en el informe sin importar el ahorro. Las sugerencias automáticas (sobrecarga, desbalance, equipos en estado deficiente) las adopta el auditor; no se crean solas. La matriz se codifica **solo después de transcribirla** en M0.
- **Aceptación**: los totales de ahorro no cambian al agregar hallazgos de seguridad; el informe los muestra aparte.

### M8 · PGEE: meta legal y ruta anual (L-02 a L-04, R-4p3, R-4p4)

- **Nuevos**: `domain/route.ts` (meta legal = 15 % del consumo del año anterior, propuesta de ruta anual desde las medidas y tareas, avance frente a la ruta), `views/project/steps/AnnualRoutePanel.vue`, pruebas.
- **Cambian**: `PgeeView.vue` (secciones «Gestor energético», «Meta legal» y «Ruta anual»), `domain/types.ts` (`Pgee`), `docx/pgee.ts` (reordenado según las 7 etapas de la guía de la UPME, con «Modelo financiero y contractual», «Seguimiento (MRV)» y el marco legal), `db/sampleProject.ts`.
- **Reglas**: el año 1 debe alcanzar al menos el 15 % (aviso si no); del año 2 en adelante son las «metas sostenibles»; el gestor energético se nombra con acto y fecha.
- **Aviso**: el plazo «a más tardar en 2026» de la ley no lo interpreto; se muestra tal cual y se te recomienda consultarlo con la UPME.

### M9 · Plan de implementación: ejecutor y verificación RETIE (X-02, L-05)

- **Nuevos**: `domain/retie.ts` (régimen según la fecha de inicio de obra frente al **1-ene-2026**, y la regla que impide marcar «Implementada» sin verificación), pruebas.
- **Cambian**: `TaskForm.vue` (secciones «Ejecución» y «Cumplimiento RETIE»), `ImplementationView.vue` (insignia de estado RETIE), `domain/implementation.ts` (`FUNDING_SOURCES` suma FENOGE y ahorros reinvertidos), `docx/implementation.ts` (tabla de ejecutores y sección «Verificación RETIE»), CSV de tareas (columnas nuevas), `db/sampleProject.ts`.
- **Reglas**: si el RETIE aplica y no hay verificación «cumple», la tarea no pasa a «Implementada» sin una justificación. La verificación técnica y la verificación del ahorro (IPMVP) son dos registros distintos. La app **registra y recuerda**; no decide jurídicamente qué documento aplica.

### M10 · Auditor, reporte a la UPME y seguimiento (R-05, R-06, L-01, L-06, C-*, U-11, X-06)

- **Auditor**: `views/AuditorView.vue` (ruta `#/auditor`, enlazada desde Ajustes y desde Datos generales), `domain/auditor.ts` (lista de verificación del art. 6), `Settings.auditor` solo local. El informe imprime «Datos del auditor» y nunca la cédula.
- **Reporte UPME**: `views/project/steps/UpmeReportView.vue` (paso `reporte-upme`), `reports/upme/package.ts` y `naming.ts`. Lista «¿listo para reportar?» (sale de `computeCompliance`); **Excel** con hojas equivalentes a las plantillas 1 a 5 y a «datos de edificación», **Word** con el nombre `ART237_2026_<n.º de caso>_Informe de Auditoría.docx` y el zip de anexos. **Las columnas exactas se ajustan cuando tengas las plantillas oficiales.** PONTIA no envía nada al SUU.
- **Seguimiento anual**: `domain/followUp.ts` (ahorro real frente a la LBEn y frente al año anterior, acumulado mensual, frente a la ruta y a la meta del 15 %), panel en el PGEE, tabla `upmeCycles` (ciclo, caso, fecha, concepto de la UPME) y alerta de la próxima auditoría a 4 años.
- **Aceptación**: el paquete de un proyecto completo sale sin advertencias; el de uno incompleto dice exactamente qué falta.

### M11 · Informe final (ISO 50002 y art. 4)

Nuevo orden de secciones del informe de auditoría (con contador):

| # | Sección | Nuevo o cambia |
|---|---|---|
| 1 | Resumen ejecutivo (con la tabla de cumplimiento del art. 4; seguridad en tarjetas aparte) | Cambia |
| 2 | Alcance, frontera y limitaciones (incluye la decisión sobre FNCER y la tenencia) | **Nueva** |
| 3 | Caracterización de la entidad y del edificio (Tabla 1 ampliada y tabla de laboratorios) | Cambia |
| 4 | Metodología (NTC-ISO 50002 y Res. UPME 016) | Cambia |
| 5 | Uso de la energía: históricos por energético y comportamiento | Cambia |
| 6 | Usos significativos y balance (por energético, uso final y laboratorio) | Cambia |
| 7 | Línea base (UPME 016) e indicadores (por laboratorio) | Cambia |
| 8 | Sistemas y equipos: dimensionamiento, regímenes 24 h, inventario por laboratorio | Cambia |
| 9 | Mediciones | Igual |
| 10 | Diagnóstico energético | Cambia |
| 11 | Seguridad eléctrica y SST | **Nueva** |
| 12 | Potencial de ahorro y oportunidades (tipos, FNCER, mejor desempeño, VPN, TIR, priorización) | Cambia |
| 13 | Conclusiones y recomendaciones | Igual |
| — | Anexos: datos del auditor, inventario por laboratorio, verificación del art. 4, fotografías | **Nuevos** |

Cambian `reports/model.ts` (`AuditModel`), `reports/figures.ts` (figuras nuevas), `reports/docx/audit.ts` (contador de secciones), y las pruebas de informes.

### M13 · Ejemplo de laboratorios, manual y prueba final (Fase 4)

- **Nuevo**: `db/sampleLab.ts`: «Laboratorios (ejemplo)» con **al menos 3 laboratorios de tipos distintos**, equipos 24 h, gas natural, ocupación por semestre, hallazgos de seguridad, medidas (incluida una de apagado), ruta anual con la meta del 15 % y tareas con verificación RETIE. Todos los datos son ficticios pero realistas.
- **Cambian**: `ProjectsView.vue` (dos botones de ejemplo), `content/manual.ts` (todos los pasos nuevos), `docs/LISTA_DE_CHEQUEO_FINAL.md` (entregable de la Fase 4).
- **Aceptación**: las 146 pruebas actuales y las nuevas pasan; `npm run build` sin errores; la lista de chequeo marca cada ID de la matriz como cumplido, parcial o pendiente, con la evidencia.

---

## 6. Entregas y orden

| Entrega | Bloques | Qué podrás hacer al terminar |
|---|---|---|
| **A · Levantamiento** | M1, M2, M3, M4, M12 | Capturar en campo todo lo de tus 13 formatos, con laboratorios, régimen 24 h y gas; importar y exportar tus Excel; ver qué te falta recolectar |
| **B · Análisis** | M5, M6 | Línea base con el método de la UPME, indicadores por laboratorio, oportunidades con tipo de potencial, mejor desempeño y párrafo de FNCER |
| **C · Plan y seguridad** | M7, M8, M9 | Hallazgos de seguridad eléctrica y SST, PGEE con meta legal y ruta anual, plan con ejecutor y verificación RETIE |
| **D · Cumplimiento y cierre** | M10, M11, M13 | Perfil del auditor, paquete de reporte a la UPME, seguimiento anual, informe final, ejemplo de laboratorios y lista de chequeo |

Propongo **avisarte al terminar cada entrega** para que la pruebes. La Entrega A es la que más te sirve en el campo: si quieres usarla ya en el iPhone y en el Android, me autorizas a fusionarla a `main` y se publica (los equipos instalados se actualizan solos). Si no me dices nada, sigo trabajando solo en la rama.

---

## 7. Pruebas

**Estrategia.** Cálculos como funciones puras con pruebas numéricas; migración y respaldo con `fake-indexeddb`; informes leyendo el `.docx` generado; y para cada pantalla nueva, capturas en el navegador de pruebas (PC y celular, claro y oscuro).

**Casos oficiales de la UPME 016** (ya extraídos del texto oficial, con sus resultados):

| Anexo | Datos | Resultado que debe reproducir |
|---|---|---|
| 1 · Valor absoluto | 36 consumos mensuales de una alcaldía | Promedios por mes (enero 11.034 kWh…), bandas 110 %/90 % (enero 12.138 y 9.931), mínimos y ahorro por mejor desempeño (enero 830 kWh, 7,5 %; total 468 kWh, 4,1 %) |
| 2 · Cociente | Índices mensuales kWh/persona de 3 años | Promedio por mes (enero 11,5 … diciembre 11,7), mínimos y promedio 11,72 |
| 3 · Estadístico | 36 filas: personas, grados-día, consumo | R² 0,2492; p de personas 0,001938; p de grados-día 0,13016 (no significativa); potencial 3,44 % |
| 4 · Ajustes | Meses anómalos del año 2 | Potencial 9,35 % sin ajustar y 4,2 % ajustado (valor absoluto) |

**Diferencias con lo publicado** (las dejo anotadas y no se usan como criterio de aceptación estricto): mi p de grados-día es 0,1313 frente a 0,13016; y el ejemplo dice que solo 4 datos superan el 5 % de error, mientras que mi cálculo da 8 con el mismo error promedio (3,2 %). Antes de fijar cualquier criterio con «error > 5 %» se confirma la fórmula con la UPME.

**Pruebas existentes que cambian a propósito** (se actualizan y se registran):

| Prueba | Por qué cambia |
|---|---|
| `tests/domain/progress.test.ts` | Hay un paso más en Levantamiento: la razón 5/6 pasa a 5/7 |
| `tests/content/manual.test.ts` | Exige una ficha por cada paso del menú: se agregan los nuevos |
| `tests/reports/docx.test.ts`, `model.test.ts`, `pgee.test.ts`, `implementation.test.ts` | Secciones y figuras nuevas y numeración por contador |
| `tests/reports/tables.test.ts` | Suben las tablas de exportación |
| `tests/sync/engine.test.ts`, `tests/db/backup.test.ts`, `tests/db/records.test.ts` | Tablas nuevas y respaldo versión 2 |
| `tests/domain/sizing.test.ts` | Solo si M0 confirma el VEEI de 4,0 |

**Compuertas** después de cada bloque: `npm test` en verde, `npm run typecheck` y `npm run build` sin errores, y revisión visual.

---

## 8. Trazabilidad: de la matriz al bloque que la cierra

| IDs de la matriz | Bloque |
|---|---|
| L-01 | M2 (datos) y M10 (alerta) |
| L-02, L-03, L-04 | M8 (con M6 para FNCER) |
| L-05, R-08 | M9 |
| L-06, R-05, C-01, C-04 a C-08, U-11 | M10 |
| R-03 | M2 y M6 (bloqueo de medidas) |
| R-4a, C-02, Formato 1 | M2 |
| R-4b, C-03, Formato 8 | M4 |
| R-4c, X-03, Formatos 2 a 7, 9 y 10 | M3 |
| R-4d, R-4e, R-4g, Formatos 11 y 12 | M6 |
| R-4f, R-4p2, U-01 a U-10 | M5 |
| R-4p1 | M11 |
| R-4p3, R-4p4 | M8 |
| R-06, X-06 | M10 |
| X-01, X-05 | M7 |
| X-02 | M9 |
| X-04 (referencia de la NTC 2050) | Solo se cita cuando se verifique la sección exacta (P3) |
| Formato 13 y los 13 formatos | M12 |
| P-01 a P-03 (clientes privados) | **Después de las entidades públicas** (fuera de esta ronda) |

---

## 9. Lo que se conserva

- Trabajo **sin conexión**, actualización automática en momentos seguros, respaldo `.zip`, nube opcional y la importación de los datos de la versión 1.6.
- Todas las tablas actuales y sus datos; ningún campo se renombra ni se elimina.
- Los cálculos actuales: dimensionamiento, unifilar, balance por uso final, economía, calculadoras (FV, condensadores, aires, LED), plan con Gantt y flujo de caja. La regresión ASHRAE 14 sigue como verificación complementaria.
- Informes Word, CSV, Excel y PNG con la plantilla actual; el manual.
- El ejemplo BL-06 sin cambios, y las **146 pruebas actuales**, salvo las listadas en la sección 7.

---

## 10. Cambios que verás

1. **Tres pasos nuevos** en el menú (Control de recolección, Seguridad eléctrica y SST, Reporte UPME). El porcentaje de avance de un proyecto existente puede **bajar**, porque hay más pasos por completar.
2. **El VEEI de aulas y laboratorios pasaría de 3,5 a 4,0** si M0 lo confirma: algunos avisos de «baja eficiencia» desaparecerían.
3. **El informe de auditoría cambia de estructura** (sección 5, M11). Los informes ya generados no se tocan.
4. **La línea base del informe será la de la UPME 016**; la regresión actual queda como complemento.
5. **El PGEE mostrará la meta legal del 15 %** y avisará si la ruta no la alcanza.
6. **Un equipo marcado como no interrumpible** deja de contar como «evitable» en la carga base y no entra en las medidas de apagado.

---

## 11. Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Alcance grande | Entregas con avisos; cada bloque es entregable y probado por separado |
| Romper los cálculos eléctricos al agregar gas | Filtros en la entrada de datos; el ejemplo BL-06 debe dar las mismas cifras |
| Migrar datos reales en tus equipos | Cambios solo aditivos; pruebas de migración y prueba en navegador real con el mismo perfil |
| Normas que siguen cambiando (RETIE y RETILAP de junio de 2026) | Constantes con fuente y fecha; revalidar antes de cada entrega |
| Plantillas del SUU que no tengo | Paquete «equivalente» primero y ajuste al recibirlas |
| Datos personales del auditor | Solo en el equipo, sin nube, sin adjuntos y sin números en el informe por defecto |
| Repositorio público | Nada personal ni el Excel en git sin tu decisión |
| Paleta de 8 colores | Validación de daltonismo antes de fijarla |
| Toques que no responden en Safari (lo que pasó con «Abrir») | No usar capas invisibles; enlaces y botones reales en las pantallas nuevas |

---

## 12. Fuera de alcance de esta ronda

- Enviar el reporte al SUU de forma automática (requiere el usuario de la entidad).
- Diseño detallado de generación fotovoltaica (decisión D-1).
- El **módulo para clientes privados** (certificado de incentivos de la Res. UPME 563/2026, PAI-PROURE): queda después de las entidades públicas.
- Adjuntar los documentos del auditor dentro de la app (D-7).
- El «modelo de ingeniería o simulación» de la UPME 016 §7.4.4: el informe declarará qué modelo se usó de los otros tres.

---

## 13. Lo que necesito de ti

**Para empezar la Fase 3:** tu visto bueno a este plan, o los cambios que quieras.

**Datos que no bloquean el arranque** (los pediré cuando toque el bloque):

1. **Una factura reciente de gas natural** (o una foto): para el formato de la factura, el factor de conversión y el poder calorífico. Antes de M4.
2. **Las plantillas 1 a 5 del SUU**, descargadas con el usuario de la Universidad. Antes de M10.
3. **La lista de laboratorios del bloque** (nombre, tipo, piso y área aproximada), si ya la tienes: sirve para el catálogo y para el ejemplo. Antes de M3.

Si prefieres que **no** te avise entre entregas y siga de corrido hasta el final, dímelo.
