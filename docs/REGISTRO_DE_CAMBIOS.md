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
