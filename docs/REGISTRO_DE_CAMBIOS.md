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
