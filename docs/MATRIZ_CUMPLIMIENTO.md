# Matriz de cumplimiento normativo de PONTIA

> **Fase 1 · Diagnóstico** · 2026-09-29 · rama `cumplimiento-normativo` (creada desde `ef282d8`) · **no se modificó código**
>
> Caso piloto: *Diseño de un Plan Integral de Gestión de Eficiencia Energética – Laboratorios de la Universidad de La Guajira – Sede Riohacha*.
> El repositorio es público: este documento no contiene datos personales del auditor.

## 0. Cómo leer este documento

| Símbolo | Significado |
|---|---|
| ✅ | PONTIA ya lo cubre |
| 🟡 | Lo cubre parcialmente |
| ❌ | No existe |
| ⚠️ | Conflicto o decisión pendiente |

- **PONTIA hoy** cita el archivo donde vive lo que ya existe. **Falta** dice qué no hay. **Cambio propuesto** es una propuesta para la Fase 2, no una decisión tomada.
- **Prioridad**: **P1** = exigencia normativa o base de otros cambios · **P2** = importante · **P3** = deseable o para después.
- **Verificado** significa que leí el texto oficial (fuente y fecha en el Anexo A). Lo que no pude verificar está marcado 🟡 y reunido en la sección 2.3.

---

## 1. Resumen ejecutivo

**Base legal verificada en texto oficial**

1. **Ley 1715 de 2014, art. 30** (modificado por el art. 237 de la Ley 2294 de 2023): auditoría energética de las instalaciones **cada 4 años**; en el **año siguiente** a la auditoría, estrategias con **ahorro mínimo del 15 % respecto del consumo del año anterior**; desde el 2.º año, metas sostenibles «a más tardar en el año 2026»; reporte anual a la UPME. Los objetivos se alcanzan con medidas de eficiencia energética **y FNCER**.
2. **Resolución MME 40412 de 2024** (Diario Oficial 52.897, 2-oct-2024): el art. 4 tiene siete literales y cuatro parágrafos (el PGEE lleva **ruta anual de ahorro** y **responsable designado**); el art. 3 limita las medidas a los edificios **propios** (en arriendo o comodato solo **buenas prácticas de operación**); el art. 6 fija los requisitos del auditor.
3. **Resolución UPME 016 de 2024**: metodología de línea base (LBEn) con tres modelos (valor absoluto, cociente, estadístico), datos normalizados a 30 días y periodo base **recomendado de 3 años**.
4. **Circular UPME 089 de 2025 y su Guía (feb-2026)**: el reporte se hace **por sede** en el SUU, módulo «Medidas Art. 237 – Ley 2294 de 2023», con cinco plantillas.
5. **Resolución UPME 563 de 2026** (5-ago-2026): certificado de incentivos tributarios para el módulo de clientes privados.

**Estado de PONTIA.** Cubre bien el levantamiento técnico y el análisis energético: inventario, dimensionamiento, facturas, usos significativos, oportunidades con VPN y TIR, PGEE, plan de implementación, informes Word/Excel/CSV, trabajo sin conexión, respaldo `.zip` y nube opcional. Cumple **parcialmente** los siete literales del art. 4.

**Nueve brechas principales**

| # | Brecha | Prioridad |
|---|---|---|
| 1 | La **línea base no sigue la UPME 016**: usa las últimas 12 facturas, solo regresión, sin p-valores, sin normalizar a 30 días, sin modelos de valor absoluto ni de cociente | P1 |
| 2 | El **PGEE no tiene ruta anual**, ni meta legal del 15 %, ni responsable designado formalmente | P1 |
| 3 | **No hay reporte a la UPME** (ni sede con código único, ni paquete de plantillas) | P1 |
| 4 | **Caracterización de la entidad incompleta**: faltan tenencia, edad de la edificación, actividad, entorno y pisos. La tenencia además limita el tipo de medidas | P1 |
| 5 | **Sin datos del auditor** (art. 6) ni matrículas | P1 |
| 6 | **Laboratorios**: no existe el tipo de laboratorio, el régimen de uso (24 h) ni el uso final «equipos de laboratorio»; los indicadores no se calculan por laboratorio | P1 |
| 7 | **Solo electricidad**: no hay otros energéticos (gas, GLP), que los laboratorios usan y la UPME pide | P1 |
| 8 | **Sin seguridad eléctrica/SST ni verificación RETIE** | P1 |
| 9 | Formatos **6, 9 y 13** del Excel sin equivalente; faltan campos en los formatos 1 a 5, 7, 8, 11 y 12 | P1–P2 |

**Lo que cambió al verificar**

- La **Resolución UPME 563 de 2026 existe** y derogó la 135 de 2025.
- **RETIE y RETILAP se modificaron el 23-jun-2026** (Res. 40284 y 40286 de 2026): todo parámetro que dependa de ellos debe revalidarse.
- El **VEEI** que usa PONTIA para aulas y laboratorios (3,5) es más estricto que el del RETILAP que leí (4,0): el informe puede marcar como «supera el límite» algo que la norma permite.
- La **guía del Excel excluye la solar FV**, pero la ley y el art. 4(d) mencionan las FNCER: hay que decidir cómo se declara.
- La UPME 016 **recomienda** 3 años de datos; no los exige. PONTIA puede trabajar con menos, pero debe advertirlo y justificarlo.

Las decisiones que necesito de ti están en la **sección 10**.

---

## 2. Verificación normativa

### 2.1 Qué verifiqué

| # | Norma | Qué verifiqué | Estado |
|---|---|---|---|
| 1 | Ley 1715/2014 art. 30, mod. art. 237 Ley 2294/2023 | Texto literal (transcrito en los considerandos de la Res. 40412 y de la UPME 016) | ✅ |
| 2 | Res. MME 40412/2024 | Texto completo, arts. 1 a 10 (Anexo B) | ✅ |
| 3 | Res. UPME 016/2024 (DO 52.641; rige 18-ene-2024) | Articulado y anexo: pasos 1 a 6, §8, §9 y §10. Los numerales 7.5.1 y 7.5.2 fueron **corregidos por el Auto 444 de 2024** | 🟡 las ecuaciones (2) a (7) son imágenes en la copia que leí; falta el ancho de la banda por desviación estándar (ecuaciones 4 y 5) |
| 4 | Circular UPME 089/2025 (1-oct-2025) | Texto completo: reporte en línea por el SUU; primer ciclo del 1-oct al 15-dic-2025; los plazos siguientes «serán definidos por circular» | ✅ |
| 5 | Guía de reporte UPME (feb-2026) | Flujo del SUU, secciones del caso, cinco plantillas y nombres de archivo | 🟡 las plantillas oficiales solo se descargan dentro del SUU |
| 6 | Circular MME 40021/2026 (8-may-2026) | Recuerda auditorías, reporte por el SUU y obligación de formular y seguir el PGEE. Dirigida a servidores de la rama ejecutiva nacional | ✅ |
| 7 | Guía UPME de PGEE (dic-2020) | Estructura: 4 módulos, 7 etapas, política energética, gestor energético | 🟡 no leí el detalle de los cuatro módulos |
| 8 | Res. UPME 563/2026 (5-ago-2026) | Arts. 1, 4, 5, 9, 10 y 15; ficha de «auditoría energética» del Anexo 2 | 🟡 no leí las listas completas de bienes y servicios |
| 9 | PAI-PROURE | Vigente 2022–2030 (Res. MME 40156/2022, citada en la 40412). La actualización **2026–2035 está en consulta** (Circulares UPME 058 y 068 de 2026) | 🟡 listado de medidas sin leer |
| 10 | RETIE | Res. 40117/2024 → 40304/2025 → **40284/2026** (DO 53.539, 1-jul-2026). Obras iniciadas **antes del 1-ene-2026** pueden demostrar conformidad con la Res. 90708/2013. Art. 1.5.1 (análisis de riesgos de origen eléctrico) | 🟡 la matriz 1.5.1.4.1 a/b es una imagen |
| 11 | RETILAP | Texto de la Res. 180540/2010: Tabla 410.1 (iluminancias) y Tabla 440.1 (VEEI). Modificado por las Res. 40150/2024 y **40286/2026** | 🟡 no verifiqué si esas modificaciones cambiaron las tablas |
| 12 | NTC 2050 | 2.ª actualización (abril de 2020, basada en el NEC 2017); el RETIE exige sus capítulos 1 a 7 | 🟡 fuentes secundarias; tiene derechos de autor: solo citar, no copiar tablas |
| 13 | Res. MinTrabajo 5018/2019 | Alcance: SST en actividades con peligro eléctrico; exige metodología de identificación de peligros y valoración de riesgos | 🟡 solo el resumen del gestor normativo |
| 14 | SG-SST | Decreto 1072/2015 y Res. 0312/2019 | 🟡 verificadas el 17-sep-2026 en otra sesión; hoy no las releí |
| 15 | GTC 45 (ICONTEC) | Edición 2012 según fuentes secundarias | 🟡 |
| 16 | CONTE y COPNIA | CONTE: matrícula técnica (Ley 19/1990, Ley 1264/2008, Decreto 991/1991; clases TE-1 a TE-6), carácter vitalicio salvo suspensión. COPNIA: el certificado de vigencia y antecedentes disciplinarios **no declara plazo de validez** en su página | ✅ |
| 17 | ISO 50002 | Edición 2025 publicada en junio de 2025 en tres partes (1 general, 2 edificios, 3 procesos); reemplaza a la de 2014. La UPME 016 cita la de 2014 | 🟡 no verifiqué la adopción por ICONTEC (NTC-ISO 50002) |
| 18 | Ley 1581/2012 (datos personales) | Citada en el diseño de protección de datos del auditor | 🟡 no releída hoy |

### 2.2 Notas de la verificación

- El plazo «metas sostenibles… **a más tardar en el año 2026**» es de la ley y ya está encima. No encontré otra fecha; conviene preguntar a la UPME cómo aplica a una auditoría nueva.
- Segundo ciclo de reporte: **no encontré** la circular de 2026 con el plazo. Solo la del primer ciclo (2025).
- La UPME pide reportar **por sede**, con un caso y un código único para cada una (Guía, feb-2026).

### 2.3 Pendientes de verificación (antes de programar)

1. Ecuaciones (3) a (5) de la UPME 016 (ancho de la banda cuando hay 10 o más datos). Fuente: Diario Oficial 52.641; el PDF de la UPME (`016_2024.pdf`) es escaneado y trae solo la resolución.
2. Las cinco plantillas Excel del SUU (solo se descargan con usuario de la entidad).
3. Circular de la UPME con el plazo del reporte 2026.
4. Matriz de riesgos del RETIE 1.5.1.4.1 (tablas a y b): son imágenes del PDF.
5. Libros 3 y 4 del RETIE (arts. 3.3.1, 3.3.2 y 4.x): qué documento de cumplimiento aplica a cada tipo de intervención.
6. Tablas 410.1 y 440.1 del RETILAP en su versión vigente.
7. Lista de acciones y medidas del PAI-PROURE vigente.
8. Adopción de ISO 50002:2025 como NTC y su contenido exigible del informe.
9. Sección exacta de la NTC 2050 detrás del criterio del 80 % de la protección.

---

## 3. Matriz de cumplimiento

### 3.1 Ley 1715 de 2014, art. 30 (mod. Ley 2294/2023, art. 237)

| ID | Requisito | PONTIA hoy | Falta | Cambio propuesto | Prio |
|---|---|---|---|---|---|
| L-01 | Auditoría energética **cada 4 años** | ❌ `Project` no guarda fecha de auditoría ni ciclo (`src/domain/types.ts`) | Fecha, periodo cubierto y próxima auditoría | `auditDate`, `nextAuditDue` (+4 años), alerta en la lista de proyectos, historial de ciclos por sede | P2 |
| L-02 | **Objetivos de ahorro** alcanzados con medidas de eficiencia **y FNCER** | 🟡 `Pgee.objectives[]` con descripción, porcentaje y plazo; calculadora FV (`src/domain/measures.ts`) | Objetivos sin vínculo a medida, energético ni año; FNCER solo como una medida FV | Objetivos anuales estructurados; etiqueta «FNCER» en la medida ⚠️ ver decisión 1 | P1 |
| L-03 | En el año siguiente a la auditoría: **ahorro ≥ 15 %** respecto del consumo del año anterior | ❌ la meta es libre (el ejemplo usa 20 % frente a la línea base, `src/db/sampleProject.ts`) | Meta legal, comparación con el año anterior, seguimiento acumulado | Bloque «Meta legal»: consumo del año anterior, meta del 15 % en kWh, avance mensual y semáforo. Mostrar también el ahorro frente a la LBEn (método UPME) | P1 |
| L-04 | Desde el 2.º año, **metas sostenibles** definidas por la auditoría, a más tardar en 2026 | ❌ | Metas por año | Ruta anual (ver R-4p3) ⚠️ ver 2.2 | P1 |
| L-05 | Recursos propios; los ahorros pueden pagar las inversiones (art. 30; Res. 40412 art. 8: FENOGE) | 🟡 `FUNDING_SOURCES` (`src/domain/implementation.ts:27`) | Faltan FENOGE y «ahorros reinvertidos» | Agregar ambas fuentes; presupuesto por año dentro de la ruta | P3 |
| L-06 | **Reporte anual a la UPME** | ❌ | Todo el módulo | Ver 3.4 | P1 |

### 3.2 Resolución MME 40412 de 2024

| ID | Requisito | PONTIA hoy | Falta | Cambio propuesto | Prio |
|---|---|---|---|---|---|
| R-03 | **Ámbito**: entidad titular del dominio; medidas solo en edificios de la entidad; en arriendo o comodato, **solo buenas prácticas** (art. 3, pars. 1 a 3) | ❌ no hay tenencia | Campo y su efecto | `tenure`: propia / arrendada / comodato / compartida / otra. Si no es propia, solo medidas operativas, con aviso; el informe lo declara | P1 |
| R-4a | **Caracterización de la entidad**: ubicación y entorno, edad de la edificación, proceso o actividad, horario, tenencia | 🟡 ciudad, dirección, sector, horario y calendario (`Project`, `GeneralDataView.vue`) | Entorno, edad, actividad, tenencia, pisos, población fija y flotante por separado | Ampliar `Project` o crear `Site`: `builtYear`, `activityDescription`, `surroundings`, `floors`, `tenure`, `population`. Obligatorios para emitir el informe | P1 |
| R-4b | **Uso de la energía**: usos significativos, históricos, costos, línea base | 🟡 usos significativos por Pareto (`src/domain/calc/balance.ts`); facturas (`Bill`); línea base (`src/domain/analysis.ts`) | Otros energéticos; LBEn según UPME 016 | Ver 3.3 y sección 5 | P1 |
| R-4c | **Sistemas y equipos** de uso final | ✅🟡 inventario (`Equipment`), dimensionamiento (`src/domain/sizing.ts`), unifilar | Voltaje, corriente, régimen y laboratorio; el Word solo trae datos agregados | Campos de equipo; anexo con el inventario por laboratorio | P1 |
| R-4d | **Potencial de ahorro**: buenas prácticas, cambio tecnológico, sustitución de energéticos, FNCER | 🟡 `Measure.kind` (operativa, baja o alta inversión) y cuatro calculadoras | La clasificación no coincide con la del art. 4(d); sin sustitución de energéticos, medidas pasivas ni «mejor desempeño» | `Measure.savingsType`: buenas prácticas / cambio tecnológico / sustitución de energético / FNCER / medida pasiva; cálculo de mejor desempeño (UPME 016 §8.1) | P1 |
| R-4e | **Evaluación** de oportunidades | ✅ retorno, VPN, TIR y CO₂ (`src/domain/calc/economics.ts`) | El informe de auditoría solo muestra el retorno; VPN y TIR van en el PGEE | Mostrar VPN y TIR en el informe | P2 |
| R-4f | **Indicadores de desempeño** y propuesta de seguimiento | 🟡 tres IDEn (`src/domain/calc/indicators.ts`: kWh/m², kWh/usuario, COP/m²) y kWh/día | Por persona atendida, por hora de práctica, por laboratorio, por energético; frecuencia y responsable | Ver sección 5 | P1 |
| R-4g | **Priorización** de medidas | 🟡 prioridad alta/media/baja por retorno y matriz de burbujas (`src/reports/pgeeFigures.ts`) | Criterios explícitos y tabla en el informe de auditoría | Tabla de priorización con criterios: ahorro, inversión, retorno, riesgo, alcance | P2 |
| R-4p1 | **NTC/ISO 50002** como referente | 🟡 estructura ISO 50002:2014 (`src/reports/docx/audit.ts:66`) | Alcance, frontera, objetivos, plan de auditoría, limitaciones y exclusiones; mapeo a ISO 50002-1 y 50002-2:2025 | Sección «Alcance, frontera y limitaciones» (declara exclusiones como la FV) | P2 |
| R-4p2 | Línea base y ahorro según **UPME 016** | ❌ | Ver 3.3 | Ver 3.3 | P1 |
| R-4p3 | **PGEE con ruta de cumplimiento anual** y **responsable designado** | 🟡 PGEE con política, alcance, `team[]`, objetivos y seguimiento. ❌ sin ruta anual. ❌ sin designación formal (la portada dice «RESPONSABLE —») | Ruta anual; gestor energético nombrado con el acto y la fecha | `Pgee.annualRoute[]` (año, meta kWh, %, medidas, presupuesto); `Pgee.energyManager` (nombre, cargo, acto de designación, fecha) | P1 |
| R-4p4 | **Guía UPME de PGEE** para política y objetivos | 🟡 estructura ISO 50001 (`src/reports/docx/pgee.ts`) | Alinear con las 7 etapas de la guía: decisión, diagnóstico, formulación con senda de cumplimiento, selección de proyectos, modelo financiero y contractual, implementación, monitoreo y verificación | Reordenar el PGEE y agregar «Modelo financiero y contractual» y «Seguimiento (MRV)» | P2 |
| R-05 | **Reporte a la UPME**: informe de auditoría y resultados de las medidas | ❌ | Todo | Ver 3.4 | P1 |
| R-06 | **Auditor**: formación o certificación, y experiencia de al menos una auditoría certificada por un tercero | ❌ solo el texto libre `Project.auditor` | Ficha, documentos y lista de verificación | Ver 6.2 | P1 |
| R-08 | Financiación (incluye FENOGE) | 🟡 | Ver L-05 | | P3 |

### 3.3 Resolución UPME 016 de 2024: línea base y ahorro

Hoy la línea base la calcula `fitBaseline` en `src/domain/analysis.ts`: regresión lineal sobre las **últimas 12 facturas**, con variables días facturados, días hábiles, temperatura y ocupación (%); R², CV(RMSE) y NMBE de ASHRAE 14.

| ID | Requisito (numeral) | PONTIA hoy | Cambio propuesto | Prio |
|---|---|---|---|---|
| U-01 | §7.1: mínimo, facturación mensual; recomendado, **3 años**. También área, fuentes, equipos, horas, ocupantes **fijos y flotantes**, actividades y envolvente | 🟡 el paso «Facturación» se marca completo con 12 facturas (`src/domain/progress.ts`) | Aviso «menos de 36 meses» con justificación obligatoria; ocupantes fijos y flotantes | P1 |
| U-02 | §7.2: periodo base sin cambios permanentes | ❌ fijo en 12 meses (`.slice(-12)`) | Elegir el periodo base y registrar eventos de cambio | P1 |
| U-03 | §7.3: variables relevantes (área, ocupantes, personas atendidas, grados-día, tiempos de trabajo) y **significancia p < 5 %** | 🟡 cuatro variables; sin p-valor | Población atendida por mes, horas de práctica, grados-día; prueba t | P1 |
| U-04 | §7.4–7.5: **valor absoluto**, **cociente** (kWh por usuario atendido) o **estadístico**; se elige según los datos disponibles | ❌ solo regresión | Implementar los tres y recomendar el que corresponda | P1 |
| U-05 | §7.5: **normalizar a 30 días**: (consumo ÷ días facturados) × 30 | ❌ | Campo derivado de consumo a 30 días | P1 |
| U-06 | §7.5.1–7.5.2: LBEn mensual = **promedio del mismo mes** (≥ 3 valores); banda ±10 % y depuración; con 10 o más datos, banda por desviación estándar | ❌ | Implementar. ⚠️ confirmar las ecuaciones 4 y 5 | P1 |
| U-07 | §7.5.3: regresión al 95 %, **descartar variables con p > 0,05**, reportar R² | 🟡 sin p-valores | Ver U-03 | P1 |
| U-08 | §7.6: **actualizar o ajustar** la LBEn (ajustes rutinarios y no rutinarios), documentados | ❌ | Bitácora de ajustes: tipo, fecha, causa, efecto en kWh | P2 |
| U-09 | §8.1: potencial por **mejor desempeño energético** | ❌ | Cálculo mensual (LBEn menos el mejor mes) y porcentaje | P2 |
| U-10 | §8.2: medidas de **buenas prácticas, pasivas y reconversión tecnológica** | 🟡 | Ver R-4d | P1 |
| U-11 | §9: información a reportar: general (área útil, fuentes de energía, equipos, ocupantes, actividades) y por modelo (periodo base, consumo mensual de la LBEn, desviación estándar, ahorro estimado por mes y %; para el estadístico, además variables, ecuación, R², máximo, mínimo, promedio y p-valores) | ❌ | Ver 3.4 | P1 |

### 3.4 Reporte a la UPME (Circular 089/2025, Guía feb-2026, Circular MME 40021/2026)

Flujo verificado: usuario activo en el **SUU** con correo oficial de la entidad → «Módulo de Medidas Art. 237 – Ley 2294 de 2023» → **un caso por sede** con código único → secciones: datos de edificación, caracterización de la energía, línea base, oportunidades de ahorro. Después: validación documental, evaluación técnica y concepto técnico de la UPME.

| ID | Requisito | PONTIA hoy | Cambio propuesto | Prio |
|---|---|---|---|---|
| C-01 | Un caso por **sede**, con código único y NIT de la entidad | ❌ | `Site.upmeCode`, `Site.entityNit`; «Paquete UPME» (Excel + Word) | P1 |
| C-02 | Datos de edificación y condiciones de operación | 🟡 | Ver R-4a | P1 |
| C-03 | Plantilla 1: consumos y costos mensuales **por energético** | 🟡 `Bill`, solo electricidad | Hoja equivalente exportable. ⚠️ la plantilla oficial está solo en el SUU | P1 |
| C-04 | Plantillas 2, 3 y 4: LBEn según el modelo (valor absoluto, valor medido, estadístico) | ❌ | Hojas equivalentes | P1 |
| C-05 | Plantilla 5: acción, equipo, marca o modelo, referencia, cantidad, unidad, valor unitario y total, fabricante, proveedor, función; metas por energético y por año; mecanismo de financiación | 🟡 `Measure` sin proveedor, fabricante ni valor unitario | Tabla de ítems de cada medida | P2 |
| C-06 | Nombres de archivo `ART237_2026_<n.º de caso>_Informe de Auditoría` y `…_Anexos Auditorías` | ❌ hoy `PONTIA_Informe-auditoria_<código>_<fecha>.docx` (`src/reports/generate.ts:26-28`) | Opción «nombre para la UPME» | P2 |
| C-07 | Ciclo de reporte (el primero fue del 1-oct al 15-dic-2025; los siguientes por circular) | ❌ | Recordatorio configurable ⚠️ sin circular 2026 | P3 |
| C-08 | Concepto técnico de la UPME | ❌ | Campo «Concepto UPME» con fecha, resultado y archivo | P3 |

PONTIA **no puede enviar** el reporte: el SUU exige usuario de la entidad y no se automatiza. Lo que sí puede es dejar todo listo para diligenciarlo.

### 3.5 Normas complementarias

| ID | Requisito | PONTIA hoy | Falta y propuesta | Prio |
|---|---|---|---|---|
| X-01 | **RETIE 1.5.1**: análisis de riesgos de origen eléctrico | ❌ | Módulo de hallazgos de seguridad (6.1) | P1 |
| X-02 | **RETIE**: cumplimiento en cada intervención (dictamen, declaración de cumplimiento, esquema constructivo, certificados de producto; régimen según la fecha de inicio de obra frente al 1-ene-2026) | ❌ | Registro de verificación por tarea (6.3) | P1 |
| X-03 | **RETILAP**: iluminancia (Tabla 410.1) y VEEI (Tabla 440.1) | 🟡 lux por tipo de espacio (`src/domain/catalogs.ts:60-75`); VEEI (`src/domain/sizing.ts:62-76`) | Catálogo por tipo de laboratorio con mínimo, medio y máximo; VEEI según la Tabla 440.1. Ver nota abajo | P2 |
| X-04 | **NTC 2050** (capítulos 1 a 7 exigidos por el RETIE) | 🟡 porcentaje de carga y criterio del 80 % (`breakerCriterion`) | Citar la sección exacta tras verificarla. Sin copiar tablas | P3 |
| X-05 | **SST**: SG-SST y riesgo eléctrico (Res. 5018/2019) | ❌ | Ver 6.1 | P1 |
| X-06 | **Datos personales** (Ley 1581/2012) | ❌ hoy no se guardan datos personales | Guardar en el equipo, excluir de la nube por defecto, no imprimir la cédula | P1 |

**Nota sobre el RETILAP.** Según el texto de 2010, que fue el que leí completo:

- **Laboratorios en centros educativos**: UGR 19; iluminancia 300 / 500 / 750 lx (mínimo / medio / máximo). El valor **medio** es el objetivo de diseño; el catálogo de PONTIA usa 500 lx (coincide).
- **Otros laboratorios**: «Cuartos de control, laboratorios» (industria): 750 / 1000 / 1500 lx. «Farmacia y laboratorios» (centros de atención médica): otra fila. El valor depende del contexto, así que un solo «laboratorio» no basta.
- **VEEI (Tabla 440.1)**: «Aulas y laboratorios» = **4,0**; «Administrativa en general» = 3,5 o 6, según el grupo. PONTIA usa 3,5 para aula, laboratorio y sala de cómputo, y 3,0 para oficina: más estrictos que la norma.
- Las columnas de la tabla salen desordenadas al extraer el PDF: **confirmar en el PDF oficial antes de codificar**.

### 3.6 Módulo para clientes privados (después de las entidades públicas)

| ID | Requisito | PONTIA hoy | Cambio propuesto | Prio |
|---|---|---|---|---|
| P-01 | **Certificado UPME de incentivos** (Ley 2099/2021 art. 43; Res. UPME 563/2026), medidas de **GEE**: (i) clasificables en el PAI-PROURE vigente con aporte cuantificable a sus metas; (ii) bienes y servicios de la lista del Anexo 2; (iii) **memoria de cálculo** con línea base y escenario posterior, en **TJ/año**; (iv) ficha técnica o catálogo; (v) ofertas o contratos; (vi) tarifa; (vii) máximo **70 ítems** por solicitud | ❌ solo la fuente de financiación «Incentivos de la Ley 1715» y una nota en el plan | Etiqueta de acción PAI-PROURE por medida, conversión kWh → TJ, memoria de cálculo exportable, verificador de la lista de bienes | P3 |
| P-02 | PAI-PROURE vigente (2022–2030; en actualización 2026–2035) | ❌ | Leer el listado de acciones antes de la Fase 3 | P3 |
| P-03 | La «auditoría energética bajo NTC/ISO 50002» es un servicio elegible (contrato y alcance) | — | El informe debe declarar alcance y método | P3 |

La Res. 563/2026 derogó las Res. UPME 135/2025, 736/2025, 468/2022 y 400/2026. Los certificados ya expedidos conservan validez y no vencen (art. 9).

---

## 4. Los 13 formatos del Excel frente a PONTIA

El Excel trae la hoja de guía y 13 formatos. **No tiene listas desplegables**: todo es texto libre. La guía (hoja `00_Guia`) dice: no inventar datos (usar **N/D**), registrar siempre las unidades, fotografiar con autorización, y que **la generación solar FV no forma parte del alcance**.

**Formato 1 · Información general** (13 campos)

| Campo del Excel | PONTIA | Comentario |
|---|---|---|
| Fecha de levantamiento | 🟡 `startDate` | Agregar `surveyDate` |
| Responsable | 🟡 `auditor` (texto) | Ver 6.2 |
| Bloque · Ubicación · Área construida · Horario · Días/semana | ✅ `name`, `code`, `city`, `address`, `areaM2`, `operatingHours`, `calendar` | |
| Sede | ❌ | Ver R-4a y C-01 |
| Número de pisos | ❌ | |
| Estudiantes y Funcionarios | 🟡 `users` único | Separar y agregar flotante |
| Responsable institucional · Observaciones | ❌ | |
| *(no están)* Edad, actividad, entorno, tenencia | ❌ | **El Formato 1 no cubre el literal (a) del art. 4**; conviene agregarlos al formato |

**Formato 2 · Áreas** (8): ID Área 🟡 (id interno, falta código legible) · Piso ❌ · Área/espacio ✅ · Tipo de uso ✅ (`spaceType`, un solo tipo «laboratorio») · Área ✅ · Ocupación ✅ (`occupants`) · Horario 🟡 (`hoursPerDay`) · Observaciones ✅. Falta: `floor`, `code`, tipo de laboratorio, agrupación por bloque, horario por semestre.

**Formato 3 · Equipos** (14): ID 🟡 · Área ✅ · Equipo ✅ · Marca ✅ · Modelo ✅ · Cantidad ✅ · Potencia ✅ (`powerKw`) · **Voltaje ❌ · Corriente ❌** · Horas/día ✅ · Días/mes ✅ · Estado ✅ (`condition`) · **Modo de uso ❌** · Observaciones ✅.

**Formato 4 · Aires** (16): Marca ✅ · Modelo ✅ · **Tipo ❌** (hoy solo `inverter`) · Capacidad BTU/h ✅ · **Voltaje ❌ · Corriente ❌** · Potencia ✅ · EER/SEER ✅ (`eer`) · **Temperatura configurada ❌** · Horas y días ✅ · Estado ✅ · **Mantenimiento reciente ❌** (ver Formato 9) · Observaciones ✅.

**Formato 5 · Iluminación** (12): Tipo de luminaria ❌ (hoy `name`) · Tecnología ✅ (`lampType`) · Cantidad ✅ · Potencia por unidad ✅ · Potencia total ✅ (derivada) · Horas y días ✅ · **Control ❌** (manual, sensor, temporizador) · Estado ✅ · Observaciones ✅. Extra en PONTIA: lúmenes.

**Formato 6 · Horarios, uso y ocupación** (11): **❌ todo** (área, actividad, día, hora de inicio y fin, horas de uso, ocupación promedio, aire usado, iluminación usada). PONTIA solo tiene `Area.hoursPerDay`, `Area.occupants` y las 24 casillas de `Equipment.activeHours`. Propuesta: tabla de ocupación por área y periodo académico.

**Formato 7 · Mediciones** (15): ID ✅ · Fecha y hora ✅ (`takenAt`) · Punto ✅ · Equipo/circuito ✅ · Instrumento ✅ · V ✅ e I ✅ (por fase) · P ✅ · FP ✅ · **Frecuencia (Hz) ❌** · Energía (kWh) 🟡 (lecturas de medidor aparte) · **Condición ❌** · **Responsable ❌** · Observaciones ✅. Extra: kVA, kvar, THD y tipo de dato.

**Formato 8 · Facturación** (10): Mes ✅ · Periodo 🟡 · Días ✅ · kWh ✅ · Demanda ✅ · FP 🟡 (se deriva de kvarh) · **Valor de la energía ❌** (PONTIA guarda el total: `costCop`) · Total ✅ · Tarifa ✅ · Observaciones ✅. Falta el **energético** (solo hay electricidad) y las variables de la UPME (personas atendidas).

**Formato 9 · Mantenimiento** (11): **❌ todo** (equipo, área, tipo, último mantenimiento, frecuencia, actividades, fallas, condición, recomendación, responsable, observaciones). PONTIA solo tiene `Equipment.condition` y `notes`. Propuesta: tabla de mantenimiento por equipo.

**Formato 10 · Evidencia fotográfica** (8): ✅ casi completo: fecha (`takenAt`), área, tipo (`kind`), descripción (`caption`), archivo y formato relacionado (`entityType`). Falta la **autorización** de fotografía (guía, punto 3) y los tipos «documento» e «instrumento».

**Formato 11 · Hallazgos** (11): Área ✅ · Sistema ✅ · Hallazgo ✅ (`title`) · Evidencia ✅ · **Fecha ❌ · Posible causa ❌ · Impacto energético observado ❌ · Acción sugerida ❌** · Prioridad 🟡 (`severity`) · Observaciones 🟡. Además, los hallazgos de seguridad deben ir aparte (6.1).

**Formato 12 · Oportunidades** (15): Código ✅ · Sistema ✅ · Medida ✅ · Ahorro kWh y COP ✅ · Inversión ✅ · Payback ✅ (derivado) · Prioridad ✅ · Problema 🟡 · Evidencia 🟡 · Responsable, plazo e indicador 🟡 (viven en `Task`) · **Consumo actual del sistema (kWh/año) ❌** (se puede derivar del balance).

**Formato 13 · Control de recolección** (7 columnas, 12 ítems): **❌ todo**. PONTIA calcula el avance solo, por paso (`computeProgress`), sin responsable, fecha objetivo, fecha obtenida ni evidencia. Propuesta: módulo «Control de recolección» que se marque solo al cumplirse los mínimos del paso. Falta también el ítem «Planos/distribución» (PONTIA no guarda planos).

**Sobre «N/D».** PONTIA hoy deja el campo vacío. Propuesta: un valor explícito «No disponible» con motivo, y el tipo de dato (`medido`, `calculado`, `estimado`, `ingresado`, que ya existe en las mediciones) en todos los datos numéricos importantes.

---

## 5. Laboratorios: brechas y modelo propuesto

| Necesidad | PONTIA hoy | Propuesta |
|---|---|---|
| Varios laboratorios en un mismo bloque, cada uno con su inventario e indicadores | 🟡 `Area` sirve como laboratorio y `Equipment.areaId` da el inventario; la gráfica de flujo por espacios existe | `Area.kind = laboratorio`, agrupación bloque → laboratorio, indicadores por área |
| **Tipo de laboratorio** | ❌ un solo tipo `laboratorio` (`catalogs.ts`) | `labType` con catálogo a definir contigo (química, física, biología o microbiología, electrónica y eléctrica, cómputo, mecánica y materiales, ambiental, otros) y su fila del RETILAP |
| **Régimen de uso de cada equipo** | ❌ | `usageRegime`: continuo 24 h · en horario de práctica · bajo demanda o por ciclos · respaldo. `nonInterruptible` y su motivo |
| **Equipos especializados de alto consumo** (hornos, estufas, muflas, autoclaves, campanas, bancos de prueba, refrigeración de muestras) | ❌ `EndUseCategory` no tiene laboratorio: caerían en «otros» o «cocina» | Nuevo uso final **«Equipos de laboratorio»** (la paleta hay que revalidarla para daltónicos al pasar de 7 a 8 colores) |
| Equipos **24 h que no pueden apagarse** | 🟡 el estimador acepta 24 casillas horarias | Excluirlos de las medidas de apagado (M4) y separar en el informe la **carga continua justificada** de la **carga base evitable** |
| **Horarios y ocupación por semestre** | ❌ | Tabla de ocupación por área y periodo (p. ej. 2026-1, 2026-2): actividad, día, horas, personas |
| Indicadores: kWh/m², kWh/persona, **kWh/hora de práctica**, **kWh por laboratorio**, % continuo frente a práctica | 🟡 solo kWh/m², kWh/usuario y COP/m² a nivel de proyecto | Calcularlos por laboratorio. El consumo por laboratorio sale del inventario (estimado) salvo que haya submedición: marcar el tipo de dato |
| **Otros energéticos** (estufas o mecheros a gas o GLP) | ❌ `Bill` solo electricidad | `Bill.carrier` (electricidad, gas natural, GLP, otro) con factor de conversión. La UPME pide consumos y costos por energético y el art. 4(d) habla de «sustitución de energéticos» |
| Niveles de iluminación por tipo de laboratorio | 🟡 | Ver X-03 |
| Campanas extractoras y aire acondicionado | 🟡 | Nota técnica a validar: la extracción afecta la carga térmica del aire acondicionado; revisar `cooling.ts` con datos reales |

**Jerarquía propuesta:** *Entidad* (NIT, tipo público o privado, orden nacional o territorial) → *Sede* (código único UPME) → *Proyecto* = auditoría de un bloque en una sede y un ciclo → *Laboratorios* (áreas con tipo) → *Equipos*. Se exportan e importan proyectos como hoy (`.zip`) y además un paquete de entidad con varios proyectos.

---

## 6. Módulos derivados del perfil del auditor

### 6.1 Hallazgos de seguridad eléctrica y SST (separados de los energéticos)

Hoy `Finding` mezcla todo (`category`: usos finales, `electrico`, `envolvente`), y los avisos de capacidad (transformador al 82 %, desbalance) salen como hallazgos energéticos. Propuesta: tabla propia `safetyFindings` y capítulo propio en el informe, **sin sumarse a los ahorros**.

Campos, tomados del RETIE (art. 1.5.1, verificado):

- **Factor de riesgo**, de los 12 que lista el RETIE: arcos eléctricos, ausencia de electricidad, campos electromagnéticos, contacto directo, contacto indirecto, cortocircuito, electricidad estática, equipo defectuoso, rayos, sobrecarga, tensión de contacto, tensión de paso.
- Riesgo **potencial o real**; **consecuencia** (1 a 5) y **frecuencia** (a a e) → nivel de riesgo por la matriz del RETIE 1.5.1.4.1 ⚠️ pendiente transcribirla.
- **Criterios de alto riesgo o peligro inminente** (1.5.1.4.2, literales a a d) y la acción inmediata del 1.5.1.4.3.
- Ubicación (área, equipo o tablero), norma de referencia (artículo del RETIE o sección de la NTC 2050, solo citada), control propuesto, responsable, fecha compromiso, estado y evidencia fotográfica.
- Equivalencia opcional con la **GTC 45** para el SG-SST de la entidad ⚠️ decisión 6.

Regla: un hallazgo de **alto riesgo o peligro inminente** debe verse en el proyecto y en el informe, sin importar el ahorro.

### 6.2 Datos del auditor (art. 6) y matrículas

Perfil reutilizable, guardado en el equipo (no en el código ni en la nube por defecto):

- **Tipo de auditor**: persona natural externa, personal propio de la entidad o persona jurídica (razón social, NIT).
- **Formación**: lista de diplomas o certificaciones en sistemas de gestión de la energía, auditorías energéticas o afines (institución, programa, horas, fecha, adjunto).
- **Experiencia**: lista de auditorías por sector de demanda (oficial, industria, residencial, transporte o servicios), con el **certificado de un tercero** (emisor, fecha, adjunto).
- **Matrícula profesional COPNIA** y **matrícula técnica CONTE**: solo los campos (número, profesión o categorías TE-1 a TE-6, fecha de expedición, estado, fecha de la última verificación y enlace de consulta). El CONTE indica que la matrícula es vitalicia salvo suspensión; el COPNIA no fija plazo al certificado: **la app no debe inventar una vigencia legal**, solo un recordatorio interno configurable.
- **Lista de verificación del art. 6**: certificación o diploma ✔ · experiencia de al menos una auditoría certificada por un tercero ✔ · documentos del parágrafo 2 (a a d) reunidos ✔.
- El informe imprime «Datos del auditor» (con opción de ocultar los números) y **nunca la cédula**.

**Ojo:** la exigencia de experiencia certificada por un tercero **no la puede cumplir la app**; solo la registra y avisa. Ver pregunta 3.

### 6.3 Ejecución y verificación RETIE en el plan de implementación

Hoy `Task` tiene `responsible` (texto libre), `kpi` y `verification` (IPMVP), y en el ejemplo hay tareas sin responsable. Propuesta de campos nuevos:

- **Responsable de ejecución**: persona, empresa o dependencia, con rol y matrícula (CONTE o COPNIA).
- **Tipo de intervención**: nueva, ampliación, remodelación, mantenimiento, reposición de productos.
- **Fecha de inicio de obra y su soporte** (acta de inicio o contrato): el RETIE y el RETILAP la usan para saber qué régimen aplica (antes o después del 1-ene-2026).
- **Documentos de cumplimiento**, según lo que aplique: esquema constructivo, declaración de cumplimiento, dictamen de inspección (organismo acreditado por ONAC: número, fecha, resultado), certificados de conformidad de producto (luminarias, tomacorrientes, conductores, condensadores…).
- Análisis de riesgos hecho (sí o no), pruebas de puesta en servicio, evidencia fotográfica antes y después.
- **Estado de verificación RETIE**: pendiente · en revisión · cumple · no cumple · no aplica, con quién verificó y cuándo.
- Regla: no marcar una tarea «Implementada» si el RETIE aplica y no hay verificación «cumple» (o pedir justificación). La verificación técnica y la verificación del ahorro (IPMVP) son dos registros distintos.

La app **registra y recuerda**; no decide jurídicamente qué documento aplica. Esa ayuda se diseñará tras leer los Libros 3 y 4 (pendiente 5, sección 2.3).

---

## 7. Evaluación de los documentos de salida de BL-06 frente al art. 4

Documentos revisados: informe de auditoría, PGEE, plan de implementación y CSV de tareas (carpeta `PONTIA-documentos`, generados del ejemplo BL-06).

### 7.1 Informe de auditoría (11 secciones, 11 figuras)

| Literal del art. 4 | Cumple | Dónde está | Qué falta |
|---|---|---|---|
| (a) Caracterización de la entidad | 🟡 | Tabla 1: cliente, ubicación, sector, área, usuarios, horario, días, operador, tarifa | Edad, actividad o proceso, tenencia, entorno, pisos. La portada dice «AUDITOR —» |
| (b) Uso de la energía | 🟡 | §4 históricos (24 facturas), §5 usos significativos, §6 IDEn y línea base | La línea base usa 12 meses y una regresión: no sigue la UPME 016 (3 años recomendados, 30 días, p-valores). Solo electricidad |
| (c) Sistemas y equipos | 🟡 | §7 climatización, iluminación y capacidad; Tabla 4 por uso final | No hay lista del inventario (498 equipos aparecen solo agregados) ni ficha por laboratorio |
| (d) Potencial de ahorro | 🟡 | §10: buenas prácticas (M4), cambio tecnológico (M1, M2, M5), FNCER (M3) | No declara «sustitución de energéticos» ni medidas pasivas ni mejor desempeño energético |
| (e) Evaluación de oportunidades | ✅🟡 | Tabla 13: ahorro, inversión, retorno | VPN y TIR solo en el PGEE |
| (f) IDEn y seguimiento | 🟡 | Tabla 5 (kWh/m²·año, kWh/usuario·año, kWh/día, COP/m²) | Sin indicadores por laboratorio, por persona atendida ni por hora de práctica; sin frecuencia ni responsable de medición |
| (g) Priorización | 🟡 | Figura 11 (matriz de burbujas) | Sin tabla con criterios; la prioridad alta/media/baja aparece solo en el PGEE |
| Par. 1: NTC-ISO 50002 | 🟡 | Referencia «ISO 50002 · ISO 50001 · ISO 50006 · IPMVP» | Sin alcance, frontera, objetivos, plan de auditoría ni limitaciones. Escribirlo como NTC-ISO cuando corresponda |
| Par. 2: UPME 016 | ❌ | — | Ver 3.3 |

**Otras observaciones**

- Los hallazgos «Crítico» de capacidad (transformador 82 %, tablero 85 %) son de **capacidad**, no de seguridad RETIE, pero se mezclan con los energéticos en el resumen ejecutivo.
- El informe dice «Aula 601 supera el valor límite de VEEI» (3,74 frente a 3,5). Con el 4,0 del RETILAP que leí, cumpliría. Ver X-03.
- La tabla de calidad del modelo marca «Meses del periodo base: 12 · Cumple». Es un criterio interno; la UPME recomienda 36.

### 7.2 PGEE

| Elemento | Cumple | Observación |
|---|---|---|
| Política, alcance, revisión energética, planes de acción con ficha técnica, recursos, comunicación, formación | ✅ | Varias secciones son «Texto propuesto por PONTIA: la dirección debe revisarlo» |
| Equipo de gestión | 🟡 | Roles con nombres de dependencias; portada «RESPONSABLE —». La guía UPME pide **nombrar** al gestor energético |
| Objetivos y metas | 🟡 | «Reducir 20 % frente a la línea base al 31-dic-2027» y «10 % solar». **Sin ruta anual, sin el 15 % legal frente al año anterior, sin metas del 2.º año** |
| Seguimiento (IPMVP) | 🟡 | Sin frecuencia ni responsable del reporte a la UPME |
| Marco legal | ❌ | No cita la Ley 1715 art. 30, la Res. 40412 ni el calendario de reporte |

### 7.3 Plan de implementación y CSV de tareas

- ✅ Cronograma, presupuesto por plazo, fuentes de financiación, flujo de caja, indicador y verificación IPMVP por tarea.
- 🟡 Responsables por dependencia («Servicios Generales», «Mantenimiento»); el propio documento avisa «2 tareas no tienen responsable».
- ❌ Sin responsable de ejecución con perfil y matrícula; sin verificación RETIE; sin FENOGE como fuente.
- La nota sobre los incentivos de la Ley 1715/2099 quedó genérica («conviene confirmar los requisitos»): ahora se puede concretar con la Res. UPME 563/2026.

---

## 8. Menciones del «Bloque 6»

**En la app (`src/`)**

| Archivo | Qué dice | Propuesta |
|---|---|---|
| `components/NewProjectDialog.vue:49,54` | Ejemplos «Bloque 6 · Aulas y laboratorios» y `BL-06` | «Laboratorios · Universidad de La Guajira» y `LAB-01` |
| `views/project/steps/GeneralDataView.vue:211` | Ejemplo de código `BL-06` | `LAB-01` |
| `views/project/steps/PgeeView.vue:255` | Ejemplo de alcance «Bloque 6 con sus aulas, laboratorios…» | Ejemplo de laboratorios |
| `views/ProjectsView.vue:92` | «Datos ilustrativos del Bloque 6…» | Texto genérico |
| `content/manual.ts:82` | Ejemplo «Bloque 6 · Universidad de La Guajira» | Ejemplo de laboratorios |
| `db/sampleProject.ts:8,122,123,356,357` | **Proyecto de ejemplo** (nombre, código, política, alcance) | ⚠️ ver decisión 4: conservarlo y agregar un ejemplo de laboratorios |
| `db/backup.ts:39`, `reports/generate.ts:25` | Comentarios de ejemplo | Actualizar con el cambio |

**En pruebas (`tests/`)**: `calc/bills.test.ts:19`, `db/backup.test.ts:77`, `db/legacyImport.test.ts:17,43`, `domain/detect.test.ts:11`, `domain/intervalCsv.test.ts:27`, `reports/docx.test.ts:42`. Dependen del ejemplo BL-06 (498 equipos, 186.400 kWh, etc.): **no tocarlas** mientras el ejemplo se conserve.

**Fuera de la app**: los prototipos de diseño en `design/prototipo/*.html` (históricos; sin cambios) y el propio Excel (títulos «BLOQUE 6» en las hojas 00, 01 y 13, y el nombre del archivo).

---

## 9. Lo que ya existe y debe conservarse

- Trabajo **sin conexión** (PWA), actualizaciones automáticas en momentos seguros, respaldo y restauración `.zip`, sincronización opcional con Supabase, importación de los datos de la versión 1.6.
- Modelo local (Dexie, versión 1 del esquema): proyectos, áreas, equipos, sistema eléctrico, mediciones, lecturas, series y días de intervalos, facturas, fotos, hallazgos, medidas, PGEE, tareas y ajustes. Todo cambio de estructura debe migrar sin perder datos.
- Cálculos y verificaciones: dimensionamiento (climatización, iluminación, capacidad), unifilar, balance por uso final y usos significativos, economía (retorno, VPN, TIR, CO₂), calculadoras (FV, condensadores, aires, LED), plan con Gantt y flujo de caja.
- Informes Word (auditoría, PGEE, plan, manual), CSV, Excel y gráficas PNG con la plantilla actual.
- Sistema de diseño, manual de uso y las **146 pruebas en 36 archivos**, incluido el ejemplo BL-06 como caso de regresión.

---

## 10. Decisiones y preguntas para la Fase 2

1. **Solar FV y FNCER.** La ley y el art. 4(d) mencionan las FNCER; la guía del Excel excluye la FV. Recomiendo **no diseñar** FV, pero incluir en el informe un párrafo de *potencial FNCER* (o una exclusión motivada) y dejar la calculadora disponible. ¿Lo hacemos así?
2. **Tenencia del bloque.** ¿El bloque de laboratorios es propiedad de la Universidad? Si estuviera en arriendo o comodato, la Res. 40412 (art. 3, par. 3) solo permite buenas prácticas de operación. ¿Cuál es su nombre y código?
3. **Experiencia del auditor (art. 6).** La norma exige el certificado de un tercero que acredite al menos una auditoría realizada. ¿Cuentas con él, o alguien lo avalaría? La app solo lo registra y avisa.
4. **Ejemplo BL-06.** Recomiendo **conservarlo** (146 pruebas dependen de sus cifras), renombrarlo como «bloque de aulas (ejemplo)» y agregar aparte un ejemplo de laboratorios (Fase 4). ¿De acuerdo?
5. **Energéticos.** ¿Los laboratorios usan gas natural o GLP (estufas, mecheros)? Si sí, el soporte multi-energético entra desde el inicio.
6. **Riesgo SST.** Recomiendo valorar los hallazgos con la **matriz del RETIE 1.5.1** (por ser de origen eléctrico) y ofrecer la equivalencia GTC 45 para el SG-SST de la Universidad. ¿Cuál usa la Universidad?
7. **El Excel.** Está en la raíz del repositorio y sin guardar en git (dijiste que estaba en `docs/`). El repositorio es **público**: si se sube, cualquiera lo ve. ¿Lo movemos a `docs/formatos/` y lo versionamos, o lo dejamos fuera de git?
8. **Nombres de los tipos de laboratorio** para el catálogo (sección 5): ¿cuáles hay en el bloque?

---

## Anexo A. Fuentes consultadas (2026-09-29)

**Ley y resoluciones de eficiencia energética**

- Resolución MME 40412 de 2024, texto completo: https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_minminas_40412_2024.htm
- Resolución UPME 016 de 2024 (Diario Oficial 52.641): https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0016_2024.htm · PDF de la UPME (solo la resolución, escaneada): https://docs.upme.gov.co/Normatividad/016_2024.pdf
- Circular UPME 089 de 2025: https://docs.upme.gov.co/Normatividad/Circular_089_2025.pdf
- Guía de reporte (feb-2026): https://docs.upme.gov.co/Normatividad/Guia_para_la_presentacion_del_reporte_VF_18_feb_26_cir_089_2025.pdf
- Circular MME 40021 de 2026: https://www.ambitojuridico.com/sites/default/files/2026-05/CIR-40021-2026.pdf
- Guía UPME de PGEE para entidades públicas (dic-2020): https://docs.upme.gov.co/DemandayEficiencia/Documents/Guia_liviana_PGEE.pdf
- Circular UPME 068 de 2026 (PAI-PROURE 2026–2035, respuesta a observaciones): https://docs.upme.gov.co/Normatividad/Circular_068_2026_y_anexo.pdf
- Resolución UPME 563 de 2026: https://docs.upme.gov.co/Normatividad/563_2026.pdf
- Ley 1715 de 2014 (Función Pública): https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=57353

**Reglamentos técnicos**

- RETIE, Resolución 40284 de 2026: https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_minminas_40284_2026.htm · Res. 40304 de 2025: https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_minminas_40304_2025.htm
- RETILAP, texto de la Res. 180540 de 2010 (copia de la SIC): https://sic.gov.co/sites/default/files/files/reglamentos%20tecnicos/RETILAP.pdf · Res. 40286 de 2026: https://www.ambitojuridico.com/sites/default/files/2026-07/Res-40286-26.pdf
- NTC 2050 (referencia secundaria, CONTE): https://www.conte.org.co/que-es-el-retie-y-que-es-la-ntc-2050/

**Matrículas, SST y normas ISO**

- CONTE, matrícula profesional: https://www.conte.org.co/tramites/matricula-profesional/
- COPNIA, certificado de vigencia: https://www.copnia.gov.co/tramites-y-servicios/certificado-de-vigencia-y-antecedentes-disciplinarios
- Resolución 5018 de 2019 (gestor normativo): https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_mtra_5018_2019.htm
- ISO 50002-1:2025: https://www.iso.org/standard/83645.html

---

## Anexo B. Texto literal de la Resolución 40412 de 2024

**Art. 4.º Alcance de la auditoría energética.** «La Auditoría Energética deberá incluir como mínimo los siguientes aspectos:

- Caracterización de la administración pública donde se incluyan parámetros tales como y no limitados a (ubicación y entorno, edad de la edificación, proceso o actividad desempeñada, horario de funcionamiento, sedes compartidas, en alquiler, comodato, otros o propia).
- Caracterización del uso de la energía donde se incluyan parámetros tales como y no limitados a (usos de la energía que ocasionan un consumo sustancial de energía, históricos de consumo, costos asociados y definición de línea base).
- Caracterización de los sistemas y equipos de consumo final de energía.
- Potencial de ahorro en el uso de la energía donde se incluyan parámetros tales como y no limitados a (derivados de buenas prácticas de operación, cambio tecnológico, sustitución de energéticos, uso de fuentes no convencionales de energía, entre otros).
- Evaluación de las oportunidades de mejora en eficiencia energética.
- Definición de indicadores de desempeño energético y propuesta de evaluación y seguimiento.
- Priorización de medidas de mejora en eficiencia energética.»

**Parágrafo 1.** «Para efectos de llevar a cabo la auditoría energética podrá tomarse como referente la Norma Técnica Colombiana NTC/ISO 50002 u otro estándar de igual o superior jerarquía nacional o internacional.»
**Parágrafo 2.** «La determinación de la línea base de consumo y el ahorro estimado se realizará considerando la metodología establecida por la […] UPME en la Resolución número 016 de 2024.»
**Parágrafo 3.** «A partir de los resultados de la Auditoría Energética, las administraciones públicas […] definirán un Plan de Gestión Eficiente de la Energía (PGEE) que incluirá una ruta de cumplimiento anual de ahorro energético. Así mismo, definirán un responsable para el seguimiento y evaluación del PGEE.»
**Parágrafo 4.** La UPME pondrá a disposición la guía para la formulación e implementación de los PGEE, que podrá usarse para establecer una política y objetivos energéticos.

**Art. 3.º, parágrafo 3.** «Las edificaciones en calidad de arrendamiento, comodato u otra figura jurídica similar en donde se desarrollen funciones propias de la Administración Pública, podrán realizar la auditoría energética […] e implementar únicamente medidas asociadas a Buenas Prácticas de Operación.»

**Art. 6.º Entidades y/o auditores energéticos.** La auditoría podrá ser realizada por personas jurídicas, personas naturales externas o personal propio de la administración pública, «que cuenten con certificación o diploma nacional o internacional, en materia de Sistemas de Gestión de Energía, Auditorías Energéticas o afines y con experiencia de al menos una (1) auditoría energética realizada en alguno de los sectores de demanda, esto es: sector oficial, industria, residencial, transporte o servicios.»
**Parágrafo 2.** La entidad debe verificar, por lo menos: a) copia de la cédula, RUT o certificado de existencia y representación legal; b) nombre o razón social; c) documento que acredite la formación, certificación o diploma; d) «certificado expedido por un tercero que acredite la experiencia de al menos una (1) auditoría energética».
