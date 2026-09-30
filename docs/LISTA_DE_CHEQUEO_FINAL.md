# Lista de chequeo final – Cumplimiento normativo

Fase 4 de la tarea «Dejar PONTIA lista para auditorías energéticas y PGEE conformes con la normativa colombiana». Rama `cumplimiento-normativo`, sin publicar en `main`.

Cada fila de la matriz de cumplimiento (`MATRIZ_CUMPLIMIENTO.md`) queda como **cumplida**, **parcial** o **pendiente**, con su evidencia: el módulo del registro de cambios (`REGISTRO_DE_CAMBIOS.md`), los archivos y las pruebas. Las filas parciales y pendientes dicen por qué. La verificación de la norma es de lo que se pudo consultar en su texto oficial: lo que no, se dice. Los identificadores F-, LAB-, MOD- y DOC- los asigna esta lista a las tablas de las secciones 4 a 7 de la matriz, que no traían uno.

## Resultado de la prueba final

| Prueba | Resultado |
|---|---|
| Pruebas automáticas (`npm test`) | **67 archivos y 469 pruebas pasan** (al empezar: 36 archivos y 146 pruebas); la suite se repitió varias veces, también con la hora del servidor de publicación (UTC), sin fallas |
| Tipos y compilación (`vue-tsc` y `npm run build`) | Sin errores |
| Ejemplo «Laboratorios · Sede Riohacha» | 5 laboratorios de tipos distintos, equipos de 24 horas, gas natural, horarios de dos periodos, cuatro hallazgos de seguridad, cinco medidas (una por clase de potencial), ruta anual con el 15 % legal superado en 2027 (16,6 %) y tareas con verificación del RETIE; probado con `sampleLab.test.ts` |
| Navegador real (PC de 1280 px y celular de 390 px) | Las 12 pantallas recorridas del ejemplo (inicio y once pasos) abren sin errores ni desbordamiento; se generan el informe de auditoría (14 figuras), el PGEE, el plan de implementación y el paquete de datos de la UPME |
| Ejemplo de aulas (BL-06) | Sin cambios en sus cifras (prueba de regresión) |

## Resumen

| Estado | Filas |
|---|---|
| ✅ Cumplido | 65 |
| 🟡 Parcial | 11 |
| ❌ Pendiente | 4 |
| Total | 80 |

Lo cumplido cubre todo lo que la aplicación puede hacer por sí sola. Lo parcial y lo pendiente dependen de fuentes que solo están fuera de la aplicación (las plantillas del SUU, una circular de 2026, normas de pago o decisiones de la Universidad) o son límites de diseño: PONTIA no envía el reporte a la UPME y no puede certificar la experiencia del auditor.

## 1. Ley 1715 de 2014, art. 30 (modificado por la Ley 2294 de 2023, art. 237)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| L-01 | Auditoría energética cada 4 años | ✅ Cumplido | M2 y M10. Fecha de la auditoría, próxima auditoría (+4 años), aviso desde seis meses antes en el inicio del proyecto y en la lista, y ciclos por sede (`upmeCycles`). `domain/compliance.ts`, `domain/upmeReport.ts` · `compliance.test.ts`, `upmeReport.test.ts`. |
| L-02 | Objetivos de ahorro con medidas de eficiencia y FNCER | 🟡 Parcial | M6 y M8. Las metas por año quedan estructuradas en la ruta anual (medidas, meta y presupuesto de cada año) y las FNCER como clase de potencial con su párrafo de referencia. Los «objetivos» del PGEE siguen siendo texto libre, sin vínculo a una medida. |
| L-03 | En el año siguiente a la auditoría, ahorro de al menos 15 % frente al año anterior | ✅ Cumplido | M8 y M10. Meta legal (15 % como mínimo, editable hacia arriba), ahorro previsto del primer año frente a ese mínimo, y seguimiento con las facturas nuevas frente al año anterior y a la línea base. `domain/route.ts`, `domain/followUp.ts` · `route.test.ts`, `followUp.test.ts`. La ley no precisa cuál es «el año anterior»: PONTIA propone el de la auditoría y se puede cambiar (consultar con la UPME). |
| L-04 | Desde el segundo año, metas sostenibles (a más tardar en 2026) | 🟡 Parcial | M8. Ruta con una meta por año. El plazo «a más tardar en el año 2026» se muestra tal cual y no se interpreta. |
| L-05 | Recursos propios; los ahorros pueden pagar las inversiones; FENOGE | ✅ Cumplido | M8 y M9. Modelos de financiación (incluye ahorros reinvertidos y FENOGE), fuentes de financiación de las tareas y presupuesto por año de la ruta. `domain/financing.ts`, `domain/implementation.ts` · `financing.test.ts`. |
| L-06 | Reporte anual a la UPME | 🟡 Parcial | M10. PONTIA deja todo listo (qué falta, caso, archivos con los nombres de la UPME, paquete de datos, seguimiento del ahorro real). **No envía nada**: el reporte lo hace la entidad en el SUU. Las plantillas oficiales solo están en el SUU. |

## 2. Resolución MME 40412 de 2024

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| R-03 | Ámbito: solo edificios de la entidad; en arriendo o comodato, solo buenas prácticas de operación (art. 3, par. 3) | ✅ Cumplido | M2 y M6. Tenencia con su efecto: las medidas no permitidas salen del plan sin borrarse y el informe lo declara. `domain/tenure.ts` · `tenure.test.ts`, `docx.test.ts`. |
| R-4a | Caracterización de la entidad: ubicación y entorno, edad, actividad, horario, tenencia | ✅ Cumplido | M2 y M11. Siete datos obligatorios con su lista de verificación, tabla de datos generales en el informe y portada en borrador si falta algo. `domain/compliance.ts` · `compliance.test.ts`, `characterization.test.ts`. |
| R-4b | Uso de la energía: usos significativos, históricos, costos y línea base | ✅ Cumplido | M4, M5 y M11. Otros energéticos, línea base de la Res. UPME 016 y las secciones 5 a 7 del informe. `carriers.test.ts`, `upmeBaseline.test.ts`, `auditSections.test.ts`. |
| R-4c | Sistemas y equipos de consumo final | ✅ Cumplido | M3 y M11. Voltaje, corriente, régimen de uso y laboratorio por equipo; sección 8 del informe y anexo con el inventario por laboratorio. `auditSections.test.ts`, `sampleLab.test.ts`. |
| R-4d | Potencial de ahorro: buenas prácticas, cambio tecnológico, sustitución de energéticos y FNCER | ✅ Cumplido | M6. Clase de potencial en cada medida (incluye medida pasiva), tabla de potencial por clase, párrafo de FNCER o exclusión motivada y el ahorro por mejor desempeño como dato aparte. `domain/measures.ts`, `domain/fncePotential.ts` · `measures.test.ts`, `fncePotential.test.ts`. El mejor desempeño todavía no se convierte en una medida del plan. |
| R-4e | Evaluación de las oportunidades de mejora | ✅ Cumplido | M6 y M11. Retorno, VPN y TIR de cada medida en el informe de auditoría. `docx.test.ts`. |
| R-4f | Indicadores de desempeño energético y propuesta de seguimiento | ✅ Cumplido | M5, M10 y M11. Indicadores por área, por usuario, por persona atendida, por hora de práctica y por laboratorio; tabla de qué se evalúa, cómo y cada cuánto, con el gestor del PGEE. `indicators.test.ts`, `auditSections.test.ts`. |
| R-4g | Priorización de medidas | ✅ Cumplido | M6. Tabla de priorización con el criterio (retorno), responsable y plazo; el auditor ajusta la prioridad. `docx.test.ts`. |
| R-4p1 | NTC-ISO 50002 como referente | 🟡 Parcial | M11. Sección «Alcance, frontera y limitaciones» (con limitaciones calculadas de los datos), metodología y verificación del artículo 4. **No hay mapeo cláusula por cláusula**: la norma es de pago y no se pudo consultar; el informe la cita solo como referente. |
| R-4p2 | Línea base y ahorro según la Res. UPME 016 de 2024 | ✅ Cumplido | M5 y complemento posterior. Tres modelos, normalización a 30 días, banda de ±10 % o de dos desviaciones estándar, regresión con p-valores, ajustes y mejor desempeño (ver sección 3). |
| R-4p3 | PGEE con ruta de cumplimiento anual y responsable designado | ✅ Cumplido | M8. Gestor energético con acto y fecha de designación, meta legal y ruta anual propuesta o confirmada. `route.test.ts`, `compliance.test.ts`, `pgee.test.ts`. |
| R-4p4 | Guía UPME de PGEE (siete etapas) | ✅ Cumplido | M8. El documento del PGEE sigue las siete etapas de la guía. `reports/docx/pgee.ts` · `pgee.test.ts`. |
| R-05 | Reporte a la UPME: informe de auditoría y resultados de las medidas | 🟡 Parcial | M10. Igual que L-06: todo listo para diligenciar; no se envía. |
| R-06 | Auditor: formación o certificación y experiencia certificada por un tercero | ✅ Cumplido | M10. Perfil del auditor con lista de verificación del artículo 6, guardado solo en el equipo y anexo del informe. **La experiencia certificada por un tercero no la puede cumplir la aplicación**: solo la registra y avisa. `auditor.test.ts`, `upme.test.ts`. |
| R-08 | Financiación (incluye FENOGE) | ✅ Cumplido | M8 y M9. Ver L-05. |

## 3. Resolución UPME 016 de 2024: línea base y ahorro

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| U-01 | §7.1: facturación mensual (mínimo) y tres años (recomendado); ocupantes fijos y flotantes | ✅ Cumplido | M2 y M5. Aviso de menos de 36 meses con su justificación; población fija y flotante. `upmeBaseline.test.ts`. |
| U-02 | §7.2: periodo base sin cambios permanentes | ✅ Cumplido | M5. El periodo base se elige (desde y hasta) y se documentan los eventos. `upmeBaseline.test.ts`. |
| U-03 | §7.3: variables relevantes y significancia p < 5 % | ✅ Cumplido | M1 y M5. Personas atendidas, horas de práctica, grados-día, días hábiles, temperatura y ocupación, con p-valores. `lben.test.ts`. |
| U-04 | §7.4–7.5: valor absoluto, cociente o estadístico, según los datos | ✅ Cumplido | M5. Los tres modelos y la recomendación automática. Reproducen los Anexos 1 a 4 de la resolución. `lben.test.ts`. |
| U-05 | §7.5: normalizar a 30 días | ✅ Cumplido | M5. `(kWh ÷ días facturados) × 30`. `lben.test.ts`. |
| U-06 | §7.5.1–7.5.2: promedio del mismo mes, banda de ±10 % y depuración; con 10 o más datos, dos desviaciones estándar | ✅ Cumplido | M5 y complemento posterior. Las ecuaciones 4 y 5 se leyeron en las imágenes del texto oficial (banda de dos desviaciones estándar de la población). Se aplican mes por mes, porque la resolución no dice si los diez datos son del mes o de toda la serie. `lben.test.ts`. |
| U-07 | §7.5.3: regresión al 95 %, descartar variables con p > 0,05, reportar R² | ✅ Cumplido | M5. `lben.test.ts` (Anexo 3: potencial de 3,44 %, R² 0,2493). |
| U-08 | §7.6: ajustes rutinarios, no rutinarios y actualizaciones, documentados | ✅ Cumplido | M5. Bitácora de ajustes y ajuste no rutinario aplicado a la línea base. `lben.test.ts` (Anexo 4). |
| U-09 | §8.1: potencial por mejor desempeño energético | ✅ Cumplido | M5. Cálculo mensual y porcentaje. `upmeBaseline.test.ts`. |
| U-10 | §8.2: buenas prácticas, medidas pasivas y reconversión tecnológica | ✅ Cumplido | M6. Ver R-4d. |
| U-11 | §9: información a reportar por modelo | ✅ Cumplido | M5 y M10. Tabla «Información de la línea base para reportar a la UPME» y hojas del paquete de datos. `docx.test.ts`, `upme.test.ts`. |

## 4. Reporte a la UPME (Circular 089 de 2025, guía de febrero de 2026, Circular MME 40021 de 2026)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| C-01 | Un caso por sede, con código único y NIT de la entidad | ✅ Cumplido | M2 y M10. `Site.upmeCode` y NIT; la lista «¿listo para reportar?» los pide. `upmeReport.test.ts`. |
| C-02 | Datos de edificación y condiciones de operación | ✅ Cumplido | M2 y M10. Hoja «Datos de edificación» del paquete. `upme.test.ts`. |
| C-03 | Plantilla 1: consumos y costos mensuales por energético | 🟡 Parcial | M10. Hoja equivalente (con normalización a 30 días). **La plantilla oficial solo está en el SUU**: las columnas exactas se ajustan cuando se descargue. |
| C-04 | Plantillas 2, 3 y 4: línea base según el modelo | 🟡 Parcial | M10. Hojas equivalentes según el modelo. Mismo pendiente que C-03. |
| C-05 | Plantilla 5: acciones, equipos, valores, metas y financiación | 🟡 Parcial | M6 y M10. Ítems por medida, metas por año y mecanismo de financiación. Mismo pendiente que C-03. |
| C-06 | Nombres de archivo `ART237_2026_<caso>_…` | ✅ Cumplido | M10. Informe, anexos y paquete con los nombres de la circular. `upmeReport.test.ts`. |
| C-07 | Ciclo de reporte (plazos por circular) | ❌ Pendiente | El ciclo y el número de caso se guardan, pero no hay recordatorio de la ventana de reporte: no se halló una circular de la UPME para 2026. |
| C-08 | Concepto técnico de la UPME | 🟡 Parcial | M10. Fecha de radicación, fecha, resultado y observaciones del concepto. No se adjunta el archivo del concepto. |

## 5. Normas complementarias

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| X-01 | RETIE 1.5.1: análisis de riesgos de origen eléctrico | ✅ Cumplido | M7. Doce factores de riesgo, matriz de consecuencia y frecuencia, alto riesgo y peligro inminente, capítulo aparte del informe. `safety.test.ts`, `docx.test.ts`. La matriz y la tabla de decisiones se cotejaron celda por celda con las imágenes del texto de 2026 (Tablas 1.5.1.4.1.a y b): son iguales a las de 2013. |
| X-02 | RETIE: cumplimiento en cada intervención según la fecha de inicio de obra | ✅ Cumplido | M9. Régimen por fecha de inicio, documentos, estado de la verificación y regla para marcar «Implementada». La app registra y recuerda; no decide qué documento aplica. `retie.test.ts`. |
| X-03 | RETILAP: iluminancia y VEEI | ✅ Cumplido | M0 y M3. VEEI de aulas y laboratorios corregido a 4,0 (Res. 40286 de 2026) y catálogo de ocho laboratorios con su fila del RETILAP 2026 para centros educativos. No cubre laboratorios de industria ni de salud. `catalogs.test.ts`, `sizing.test.ts`. |
| X-04 | NTC 2050 (criterio del 80 % de la protección) | 🟡 Parcial | El criterio es un parámetro editable (`breakerCriterion`); la sección exacta de la NTC 2050 no se pudo verificar y no se cita. |
| X-05 | SST: riesgo eléctrico y SG-SST | ✅ Cumplido | M7. Hallazgos aparte de los ahorros y referencia libre al SG-SST de la entidad (la GTC 45 solo como texto). |
| X-06 | Datos personales (Ley 1581 de 2012) | ✅ Cumplido | M10. El perfil del auditor se guarda solo en el equipo, no va a la nube ni a los respaldos, y nunca se imprime la cédula. Los ejemplos no traen datos personales. `auditor.test.ts`, `upme.test.ts`, `sampleLab.test.ts`. |

## 6. Módulo para clientes privados (después de las entidades públicas)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| P-01 | Certificado UPME de incentivos (Res. UPME 563 de 2026): memoria de cálculo, fichas, ofertas y límite de 70 ítems | ❌ Pendiente | Fuera del alcance de esta tarea: se hace después de las entidades públicas. |
| P-02 | PAI-PROURE vigente | ❌ Pendiente | Igual que P-01. |
| P-03 | La auditoría NTC-ISO 50002 declara alcance y método | ✅ Cumplido | M11. Sección «Alcance, frontera y limitaciones» y metodología en el informe. |

## 7. Los 13 formatos de recolección (Excel)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| F-01 | Información general | ✅ Cumplido | M2 y M12. Datos generales ampliados (entidad, sede, edificio, población, responsable) y hoja `01_General` con las columnas del formato. |
| F-02 | Áreas | ✅ Cumplido | M1 y M3. Código, piso y tipo de laboratorio (ocho tipos). |
| F-03 | Equipos | ✅ Cumplido | M3. Voltaje, corriente, fases, modo de uso y régimen de uso; «no se puede apagar» con su motivo. |
| F-04 | Aires acondicionados | ✅ Cumplido | M3. Tipo, temperatura configurada y mantenimiento (Formato 9). |
| F-05 | Iluminación | ✅ Cumplido | M3. Tipo de luminaria y control. |
| F-06 | Horarios, uso y ocupación | ✅ Cumplido | M3. Bloques por periodo académico, con horas y personas. `occupancy.test.ts`. |
| F-07 | Mediciones | ✅ Cumplido | M3. Frecuencia, energía, condición y responsable. |
| F-08 | Facturación | ✅ Cumplido | M4. Energético, cantidad, factor de conversión, valor de la energía y variables de la UPME. `carriers.test.ts`. |
| F-09 | Mantenimiento | ✅ Cumplido | M3. Tipo, último mantenimiento, frecuencia, fallas y recomendación. `maintenance.test.ts`. |
| F-10 | Evidencia fotográfica | ✅ Cumplido | M3. Autorización de la foto y los tipos «documento» e «instrumento». |
| F-11 | Hallazgos | ✅ Cumplido | M6. Fecha, posible causa, impacto energético y acción sugerida; los de seguridad van aparte (M7). |
| F-12 | Oportunidades | ✅ Cumplido | M6. Consumo actual del sistema, evidencia, responsable, plazo e indicador. |
| F-13 | Control de recolección | ✅ Cumplido | M12. Doce renglones con estado automático y manual. `collection.test.ts`. |
| F-14 | Descarga y carga de los formatos de Excel | ✅ Cumplido | M12. Libro en blanco y con datos, y carga con vista previa, sin borrar datos con celdas vacías o «N/D». `formats.test.ts`, `formatsImport.test.ts`. Falta abrir el .xlsx en Excel y en LibreOffice para confirmar las listas desplegables. |

## 8. Laboratorios: brechas de la sección 5 de la matriz

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| LAB-01 | Varios laboratorios en un bloque, cada uno con su inventario e indicadores | ✅ Cumplido | M3, M5 y M11. Tabla, consumo, indicadores e inventario por laboratorio. `auditSections.test.ts`, `sampleLab.test.ts`. |
| LAB-02 | Tipo de laboratorio | ✅ Cumplido | M3. Catálogo de ocho tipos (se puede ajustar con la lista real de la Universidad). |
| LAB-03 | Régimen de uso de cada equipo | ✅ Cumplido | M3. Por horario, continuo 24 h, por ciclos y de respaldo. |
| LAB-04 | Uso final «Equipos de laboratorio» | ✅ Cumplido | M3. Con su ícono y su color validado para daltónicos. |
| LAB-05 | Equipos de 24 horas que no se pueden apagar | ✅ Cumplido | M3, M6 y M11. Quedan fuera del apagado; el informe separa la carga continua (8.4). |
| LAB-06 | Horarios y ocupación por semestre | ✅ Cumplido | M3. Ver F-06. |
| LAB-07 | Indicadores por laboratorio, por persona y por hora de práctica | ✅ Cumplido | M5 y M11. |
| LAB-08 | Otros energéticos (gas natural, GLP) | 🟡 Parcial | M4. Facturas y equipos por energético, en kWh equivalentes. No se calcula el CO₂ del gas: el factor de emisión de los combustibles no está verificado. |
| LAB-09 | Niveles de iluminación por tipo de laboratorio | ✅ Cumplido | M3. Ver X-03. |
| LAB-10 | Campanas extractoras y aire acondicionado | ❌ Pendiente | Nota técnica sin hacer: revisar el cálculo de carga térmica con datos reales de campanas de extracción. |

## 9. Módulos derivados del perfil del auditor

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| MOD-6.1 | Hallazgos de seguridad eléctrica y SST, aparte de los energéticos | ✅ Cumplido | M7. El vínculo del hallazgo con la tarea que lo corrige (`SafetyFinding.taskId`) está en los datos, sin pantalla todavía. |
| MOD-6.2 | Datos del auditor (art. 6) y matrículas | ✅ Cumplido | M10. Sin vigencia legal inventada: solo la fecha de la última consulta y un recordatorio interno. |
| MOD-6.3 | Ejecución y verificación RETIE en el plan de implementación | ✅ Cumplido | M9. Ejecutor con registro profesional, obra eléctrica, documentos, estado y regla de «Implementada». |

## 10. Documentos de salida frente al artículo 4 (sección 7 de la matriz)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| DOC-7.1 | Informe de auditoría: aspectos (a) a (g), parágrafos 1 y 2 | ✅ Cumplido | M11. Trece secciones y tres anexos, con la verificación del artículo 4 dentro del informe. `auditSections.test.ts`, `art4.test.ts`. |
| DOC-7.2 | PGEE: equipo, objetivos, ruta, seguimiento y marco legal | ✅ Cumplido | M8. Siete etapas de la guía, gestor designado, meta legal y marco legal. `pgee.test.ts`. |
| DOC-7.3 | Plan de implementación: ejecutor, RETIE y FENOGE | ✅ Cumplido | M9. Capítulo «Ejecución y cumplimiento del RETIE». `implementation.test.ts`. |
| DOC-8 | Menciones del «Bloque 6» en la app | ✅ Cumplido | M13. Los ejemplos de captura hablan de laboratorios; BL-06 se conserva como «ejemplo: bloque de aulas» porque sus pruebas dependen de sus cifras. |

## 11. Lo que queda y quién lo hace

| Pendiente | Quién | Qué falta |
|---|---|---|
| Plantillas 1 a 5 del SUU | Fabián | Descargarlas con el usuario de la Universidad y compararlas con las hojas del paquete de datos (C-03 a C-05). |
| Circular de la UPME para el ciclo 2026 | Fabián y la UPME | No se halló una circular de 2026. Con ella se agrega el recordatorio de la ventana de reporte (C-07). |
| Certificado de experiencia del auditor (art. 6) | Fabián | Un tercero debe certificar al menos una auditoría realizada. La aplicación solo la registra y avisa (R-06). |
| Año de referencia del 15 % y plazo de las metas sostenibles | Fabián y la UPME | La ley no precisa cuál es «el año anterior» ni interpreta «a más tardar en 2026». PONTIA propone el año de la auditoría y lo deja editable (L-03, L-04). |
| Mapeo cláusula por cláusula de la NTC-ISO 50002 | Fabián | La norma es de pago; el informe la cita como referente (R-4p1). |
| Factura reciente de gas natural | Fabián | Para confirmar los campos y el factor de conversión; el CO₂ del gas no se calcula sin un factor verificado (LAB-08). |
| Lista real de laboratorios de la Universidad | Fabián | Para ajustar el catálogo de tipos y reemplazar el ejemplo por el proyecto real. |
| Abrir los .xlsx en Excel y en LibreOffice | Fabián | Confirmar las listas desplegables de los formatos (F-14). |
| Revisión técnica de campanas de extracción | Auditor | Validar el cálculo de la carga térmica con datos reales (LAB-10). |
| Publicación en `main` y en GitHub Pages | Fabián | Nada de esta tarea está publicado. Se publica solo con su autorización expresa. |
| Módulo para clientes privados | Después | Certificado de incentivos y PAI-PROURE (P-01, P-02). |

## 12. Decisiones de la Fase 2 y cómo quedaron

| Decisión | Cómo quedó |
|---|---|
| 1. FNCER | Se conserva la calculadora solar; el informe trae el párrafo de potencial (o la exclusión motivada) y no diseña sistemas fotovoltaicos. |
| 2. Tenencia del bloque | El bloque de laboratorios es propiedad de la Universidad; la tenencia es un campo con su efecto sobre las medidas. |
| 3. Experiencia del auditor | La aplicación la registra y avisa; el certificado del tercero lo reúne el auditor. |
| 4. Ejemplo BL-06 | Se conserva como «ejemplo: bloque de aulas» y se agregó el ejemplo de laboratorios. |
| 5. Energéticos | Se usa gas natural: soporte multi-energético desde la primera entrega. |
| 6. Riesgo SST | Matriz del RETIE 1.5.1; la GTC 45 solo como referencia de texto libre. |
| 7. El Excel de los formatos | Sigue fuera de git (el repositorio es público). |
| 8. Tipos de laboratorio | Catálogo por defecto de ocho tipos, ajustable con la lista real. |
