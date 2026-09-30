# Registro de cambios – Cumplimiento normativo

Rama de trabajo: `cumplimiento-normativo`. Aquí se anota, módulo por módulo, qué se cambió, qué archivos tocó, cómo se probó y qué queda pendiente. El plan completo está en `PLAN_DE_CAMBIOS.md` y las normas verificadas en `MATRIZ_CUMPLIMIENTO.md`.

Reglas que se respetan en todos los módulos: la app sigue 100 % sin conexión; no se borra ninguna función ni dato sin avisar; no se escriben datos personales reales en el código ni en los datos de prueba; nada se publica en `main` sin autorización.

## Entrega A – Base y datos de la sede

### M0 – Verificaciones previas (hecho)

- **RETILAP 2026** (Res. 40286 de 2026, Libro 3, art. 3.2.5, Tabla 3.2.5.a): VEEI de «Aulas y laboratorios» = **4,0** y de «Administrativa en general» = **3,0**. PONTIA usaba 3,5 para aulas, laboratorios y salas de cómputo: era más estricto que la norma. Se corrige en M3.
- Sigue pendiente confirmar las iluminancias (300 / 500 / 750 lx para laboratorios de centros educativos) en las tablas de 2026 y transcribir la matriz de riesgos del RETIE 1.5.1.4.1, que viene como imagen.

### M1 – Capa de datos (hecho)

**Qué cambia.** Solo se agregan campos opcionales y seis tablas nuevas. Ningún campo ni tabla existente se borra o se renombra, así que los proyectos que ya están en el equipo se abren igual.

| Tabla nueva | Sirve para |
|---|---|
| `occupancy` | Horarios y ocupación por semestre (Formato 6) |
| `maintenance` | Mantenimiento de los equipos (Formato 9) |
| `collection` | Control de recolección de información (Formato 13) |
| `safetyFindings` | Hallazgos de seguridad eléctrica, separados de los energéticos |
| `baselineAdjustments` | Ajustes de la línea base (rutinarios y no rutinarios) |
| `upmeCycles` | Ciclo de reporte a la UPME por sede |

**Campos opcionales nuevos** (todos en `src/domain/types.ts`): entidad, sede, edificio con tenencia, población, contacto institucional, fecha de levantamiento, datos de la auditoría y alcance FNCER en el proyecto; código y piso en el espacio; energético, régimen de uso, carga no interrumpible, tensión, corriente, fases, modo de uso, tipo de aire y de luminaria en el equipo; frecuencia, condición y responsable en la medición; energético, cantidad, unidad y demás datos en la factura; autorización en la foto; fecha, causa, impacto y acción sugerida en el hallazgo; tipo de ahorro, energético y partidas en la medida; responsable del PGEE, meta legal y ruta anual; ejecutor, obras y verificación RETIE en la tarea.

**Archivos.** `src/domain/types.ts`, `src/db/schema.ts` (Dexie versión 2, sin función de migración porque solo agrega tablas), `src/db/records.ts`, `src/db/backup.ts` (respaldo versión 2; el respaldo versión 1 se sigue abriendo), `src/sync/engine.ts` (las seis tablas también viajan a la nube).

**Pruebas.** Nuevas: `tests/db/migration.test.ts` (una base de la versión 1 se reabre en la 2 sin perder datos), casos nuevos en `records`, `backup` y `sync`. Resultado: 37 archivos y 153 pruebas pasan; tipos sin errores.

**Verificación en navegador real** (Edge sin interfaz, misma base de datos): con la versión anterior se creó el proyecto de ejemplo; con la versión nueva la base pasó de la versión 10 a la 20 de IndexedDB, de 15 a 21 tablas, y se conservaron 1 proyecto, 34 equipos, 24 facturas y 7 espacios. La app se actualizó sola y abrió el proyecto.

**Pendiente de este módulo:** ninguno.

### M2 – Entidad, sede y edificio (hecho)

**Qué cambia para el auditor.** «Datos generales» pide ahora lo que el art. 4(a) de la Res. 40412 de 2024 exige para caracterizar la entidad: ubicación, entorno, edad de la edificación, proceso o actividad, horario de funcionamiento y tenencia. Además tiene secciones nuevas: *Entidad y sede* (tipo de entidad, orden, nombre y código de la sede, responsable institucional), *Edificio* (año, pisos, tenencia, actividad y entorno), *Población y operación* (estudiantes, personal, flotante), *Ciclo de auditoría* (fecha y límite de la siguiente, a cuatro años) y *Alcance y FNCER* (frontera, objetivos, limitaciones y tratamiento del potencial solar). Nada de esto bloquea el trabajo: un proyecto viejo aparece con «faltan datos».

- **Tenencia.** Arrendada, en comodato u «otra figura jurídica» → solo buenas prácticas de operación (texto literal del art. 3, par. 3). Sede compartida y tenencia sin registrar → «por confirmar», sin bloquear. Una entidad privada no queda limitada por esta resolución, que rige a las públicas. El informe declara la consecuencia.
- **Tablero del proyecto.** Tarjeta «Cumplimiento normativo» con el avance del art. 4(a) (segmentos, lista de lo que falta y enlace para completarlo). Crecerá con cada módulo.
- **Lista de proyectos.** Agrupa por entidad y sede cuando hay más de una; cada tarjeta muestra la sede y cuántos datos de la entidad faltan. El diálogo «Nuevo proyecto» ofrece las entidades y sedes que ya están en el equipo, para no volver a escribirlas.
- **Informe de auditoría.** La Tabla 1 trae la caracterización completa; si falta algo, la portada dice «Borrador» y la sección 2 lista lo que falta. Se agregan la frase de tenencia y la frontera, los objetivos y las limitaciones que escribió el auditor. Los subtítulos del PGEE y del plan de implementación incluyen la sede.
- **Manual.** Los datos de entrada nuevos quedaron descritos, con la norma que los pide.

**Decisiones de detalle respecto al plan.** El nombre y el NIT de la entidad siguen siendo «Cliente» y «NIT» (no se duplican dentro de `entity`); `entity` solo guarda el tipo y el orden. `site.name`, `building.tenure` y `audit` quedan opcionales o mínimos (`audit` solo guarda la fecha) para permitir guardar a medias.

**Archivos.** Nuevos: `src/domain/tenure.ts`, `src/domain/compliance.ts`, `src/domain/entities.ts`, `src/reports/characterization.ts`. Cambian: `src/domain/types.ts`, `src/domain/catalogs.ts`, `src/db/projects.ts`, `src/views/project/steps/GeneralDataView.vue`, `src/components/NewProjectDialog.vue`, `src/views/ProjectsView.vue`, `src/components/ProjectCard.vue`, `src/views/project/ProjectHome.vue`, `src/reports/docx/audit.ts`, `pgee.ts`, `implementation.ts`, `src/content/manual.ts`.

**Pruebas.** Nuevas: tenencia, cumplimiento del art. 4(a) y ciclo de cuatro años, entidades y agrupación, caracterización del informe, creación de proyectos y el Word completo frente a incompleto. Resultado: 41 archivos y 178 pruebas pasan; tipos y compilación sin errores.

**Verificación en navegador real** (Edge sin interfaz, PC 1280 px y celular 390 px): el ejemplo aparece con «Faltan 5 datos»; el proyecto nuevo reutiliza la entidad registrada; el tablero muestra «2 de 7» y pasa a «7 de 7» al escribir los datos como lo haría el usuario; «Usuarios» sigue la suma de estudiantes y personal (800 + 120 = 920); la fecha de la próxima auditoría sale a cuatro años; los datos quedan guardados en IndexedDB; la lista se separa en dos grupos. Sin errores en la consola ni desbordamiento horizontal.

**Pendiente de este módulo.** El bloqueo del paquete para la UPME hasta completar estos datos se hace en M10; el párrafo del potencial de FNCER en el informe, en M6.

### M3 – Laboratorios y equipos (hecho)

**Qué cambia para el auditor.**

- **Laboratorios.** El catálogo de tipos de espacio trae ocho laboratorios (química, física, biología y microbiología, electrónica y eléctrica, cómputo, mecánica y materiales, ambiental y suelos, otro) además del laboratorio general, en un grupo aparte del selector. Cada uno lleva su fila del RETILAP 2026 (Libro 3, tabla 36): 500 lx, uniformidad ≥ 0,60, Ra ≥ 80 y UGR ≤ 19; el de cómputo usa 300 lx («solo trabajos con computadoras», ref. 36,11) y el taller de mecánica la fila 36,16. Los espacios tienen ahora código y piso.
- **VEEI corregido a 4,0** para aulas, laboratorios y salas de cómputo (tabla 3.2.5.a del RETILAP 2026, verificada en el texto oficial). Antes se comparaba contra 3,5, más exigente que la norma. Efecto en el ejemplo: el «Aula 601» (VEEI 3,74) deja de aparecer como «supera el límite». La oficina sigue en 3,0, que coincide con «Administrativa en general».
- **Nuevo uso final «Equipos de laboratorio»** con su ícono y su color (violeta), el octavo de la paleta. El orden completo de los ocho colores se validó, en modo claro y oscuro, con el validador de daltonismo; el único aviso es el del gris neutro de «Otros», que es neutro a propósito. El auto-reconocimiento de nombres detecta mufla, autoclave, incubadora, centrífuga, balanza analítica, estufa de secado, etc., y no los confunde con la cocina.
- **Equipos.** Régimen de uso (por horario, continuo 24 h, por ciclos, de respaldo): al elegir «continuo» se llenan 24 h y 30 días. Interruptor «no se puede apagar» con motivo (esos equipos quedarán fuera de las medidas de apagado). Voltaje, corriente y fases; modo de uso; tipo de aire y temperatura configurada; tipo de luminaria y control. El inventario se filtra por régimen y marca los equipos continuos y los que no se apagan.
- **Horarios y ocupación (Formato 6).** Pestaña dentro de Espacios: bloques por periodo académico con día o grupo de días (L-V, L,X…), horas de inicio y fin (las horas se calculan solas, también si cruzan la medianoche), personas, y si se usan aire y luz. Resume horas por semana, ocupación ponderada y espacios sin horario.
- **Mantenimiento (Formato 9).** Pestaña dentro del Inventario: tipo, último mantenimiento, frecuencia, actividades, fallas, condición, recomendación, responsable y evidencia fotográfica. Calcula el próximo y marca atrasado, próximo (30 días), al día, sin frecuencia o sin registro.
- **Mediciones:** frecuencia, energía registrada, condición y responsable (Formato 7). **Fotos:** marca «Con autorización» y dos tipos nuevos (documento o plano; instrumento y medición).

**Fallo corregido que ya estaba en la versión publicada.** Un equipo con el «Horario típico» de 24 horas marcado no se guardaba: la app mostraba «No se pudo guardar» por un error de clonado (`DataCloneError`), porque el formulario entrega objetos reactivos de Vue y la base local no puede copiarlos. Se reprodujo en la versión publicada y se corrigió en `saveRecord` y `updateProject` con una copia profunda (`plain`), con una prueba de regresión que falla sin la corrección.

**Decisiones de detalle.** Los datos de ocupación y mantenimiento se guardan en las tablas nuevas de M1. La sala de cómputo genérica (500 lx) no cambia para no alterar las cifras del ejemplo; el laboratorio de cómputo usa los 300 lx de la norma. Los VEEI de otros tipos de espacio (biblioteca, auditorio, cafetería…) no se pudieron confirmar porque las columnas de la tabla salen desordenadas al extraer el PDF: quedan como estaban y se marcan como orientativos en el informe.

**Archivos.** Nuevos: `src/domain/occupancy.ts`, `src/domain/maintenance.ts`, `OccupancyTab.vue`, `OccupancyForm.vue`, `MaintenanceTab.vue`, `MaintenanceForm.vue`. Cambian: `types.ts`, `catalogs.ts`, `sizing.ts`, `charts/palette.ts`, `ui/icons.ts`, `db/legacyImport.ts`, `db/records.ts`, `db/projects.ts`, `AreaForm.vue`, `AreasView.vue`, `EquipmentForm.vue`, `InventoryView.vue`, `MeasurementForm.vue`, `PhotoViewer.vue`, `content/manual.ts`, `reports/docx/audit.ts`.

**Pruebas.** Nuevas: catálogos de laboratorio y VEEI, ocupación, mantenimiento, y la regresión del guardado con arrays. Resultado: 44 archivos y 195 pruebas pasan; tipos y compilación sin errores. Verificado además en navegador real (PC y celular) con un laboratorio completo: espacio, horario, equipo continuo y mantenimiento escritos como los escribiría el usuario.
