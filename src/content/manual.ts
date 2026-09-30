import type { StageId } from '@/domain/progress';

/**
 * Manual de uso de PONTIA. Es la única fuente del texto: lo muestra la pantalla «Manual»
 * y con el mismo contenido se arma el manual en Word.
 */

export type Need = 'obligatorio' | 'recomendado' | 'opcional';

export interface ManualInput {
  label: string;
  need: Need;
  /** De dónde sale el dato en campo y para qué sirve. */
  source: string;
}

export interface ManualStep {
  /** Mismo id que el paso del menú: de ahí salen el nombre y el ícono. */
  id: string;
  what: string;
  inputs: ManualInput[];
  result: string;
  tip?: string;
}

export interface ManualSection {
  id: StageId;
  intro: string;
  steps: ManualStep[];
}

export const MANUAL_WHAT =
  'PONTIA es una aplicación para hacer auditorías energéticas completas: el levantamiento en campo, el análisis del consumo, el dimensionamiento, los hallazgos, las medidas de ahorro, el PGEE, el plan de implementación y los documentos para el cliente.';

export const MANUAL_HIGHLIGHTS: { title: string; text: string }[] = [
  { title: 'Funciona sin internet', text: 'Solo necesitas conexión la primera vez. En la planta o en el sótano sigue registrando y calculando igual.' },
  { title: 'Todo queda en tu equipo', text: 'Los datos y las fotos se guardan en el celular o el PC donde trabajas. PONTIA no los envía a ningún lado.' },
  { title: 'Toda la auditoría en un sitio', text: 'Todas las pantallas van encadenadas: lo que registras en campo alimenta el análisis, el plan y el informe.' },
  { title: 'Entrega lista para el cliente', text: 'Informe de auditoría, PGEE y plan de implementación en Word, además de CSV, Excel y las gráficas en PNG.' },
];

export const MANUAL_START: { title: string; text: string }[] = [
  {
    title: 'Instala la app',
    text: 'En Android y PC aparece el botón «Instalar». En iPhone y iPad se instala desde Safari: toca Compartir y luego «Añadir a pantalla de inicio». Instalada, abre a pantalla completa y protege mejor tus datos.',
  },
  {
    title: 'Recorre el proyecto de ejemplo',
    text: 'En la lista de proyectos, «Proyecto de ejemplo» crea una auditoría con datos realistas. Sirve para ver todas las pantallas funcionando antes de cargar el trabajo real, y se puede borrar cuando quieras.',
  },
  {
    title: 'Anota tu perfil de auditor',
    text: 'En Ajustes → Perfil del auditor registras una sola vez quién audita: tipo, formación, experiencia certificada por un tercero y matrículas (COPNIA o CONTE). Se guarda en tu equipo, no viaja en los respaldos de los proyectos y sale como anexo del informe.',
  },
  {
    title: 'Crea tu proyecto',
    text: 'Con «Nuevo proyecto» y luego Datos generales. Lo mínimo para empezar es el nombre y la tarifa en COP/kWh.',
  },
  {
    title: 'Levanta la información en campo',
    text: 'Espacios, inventario, sistema eléctrico, mediciones y facturas. El botón «+» agrega registros y el de la cámara toma fotos y las vincula al equipo o al espacio.',
  },
  {
    title: 'Revisa el análisis',
    text: 'Comportamiento, balance e indicadores y dimensionamiento no se llenan a mano: se calculan con lo que registraste y te muestran qué falta.',
  },
  {
    title: 'Cierra con el plan',
    text: 'Diagnóstico con los hallazgos, Oportunidades con las medidas y su evaluación económica, PGEE e Implementación.',
  },
  {
    title: 'Genera los informes y guarda el respaldo',
    text: 'En Informes descargas los documentos. Descarga también el respaldo .zip del proyecto: es tu copia de seguridad y la forma de pasarlo a otro equipo.',
  },
];

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'campo',
    intro: 'Lo que se registra en la visita. Es la base de todo lo demás: si un dato falta aquí, el análisis lo va a decir.',
    steps: [
      {
        id: 'datos',
        what: 'Identifica la auditoría y fija los parámetros que usan todos los cálculos: la tarifa, el calendario de operación y los criterios económicos.',
        inputs: [
          { label: 'Nombre del proyecto', need: 'obligatorio', source: 'Como quieras reconocerlo en la lista, por ejemplo «Bloque 6 · Universidad de La Guajira».' },
          { label: 'Tarifa (COP/kWh)', need: 'obligatorio', source: 'Divide el valor total de una factura entre sus kWh. De aquí sale todo el dinero que muestra la app.' },
          { label: 'Cliente, NIT, ciudad, dirección y sector', need: 'obligatorio', source: 'Datos del contrato o de la factura. Van en la portada del informe; sin cliente, ciudad y dirección el informe sale como borrador.' },
          { label: 'Tipo de entidad, sede y código de la sede', need: 'recomendado', source: 'La UPME recibe un reporte por sede. El código exclusivo de cada sede lo elige la propia entidad: déjalo en blanco hasta tenerlo.' },
          { label: 'Tenencia del edificio: propia, arrendada, en comodato…', need: 'obligatorio', source: 'Escrituras o contrato. Si el edificio no es propio, la Res. 40412 solo permite implementar buenas prácticas de operación y el informe lo declara.' },
          { label: 'Año de construcción, pisos, actividad y entorno', need: 'obligatorio', source: 'Planos, la administración o la visita. Son parte de la caracterización que exige el art. 4(a) de la Res. 40412.' },
          { label: 'Estudiantes, personal y población flotante', need: 'recomendado', source: 'Oficina de planeación. «Usuarios» se calcula con estudiantes más personal mientras no lo cambies a mano.' },
          { label: 'Fecha del levantamiento y de la auditoría', need: 'recomendado', source: 'La ley pide repetir la auditoría cada cuatro años: PONTIA calcula la fecha límite de la siguiente y la avisa en la lista y en el inicio del proyecto desde seis meses antes.' },
          { label: 'Frontera, objetivos, limitaciones y tratamiento de las FNCER', need: 'opcional', source: 'Lo que escribas aparece en el alcance del informe. El diseño solar no forma parte del alcance: el informe muestra un potencial de referencia o declara la exclusión.' },
          { label: 'Área construida (m²) y número de usuarios', need: 'recomendado', source: 'Planos o la administración. Sin ellos no salen los indicadores kWh/m²·año y kWh/usuario·mes.' },
          { label: 'Horario de operación', need: 'obligatorio', source: 'Horario real de la institución. También lo pide el art. 4(a) de la Res. 40412.' },
          { label: 'Calendario: días por semana, festivos y vacaciones', need: 'recomendado', source: 'Horario real de la institución. Sirve para llevar a un año lo que se mide en un día.' },
          { label: 'Tasa de descuento, aumento anual de la tarifa y horizonte', need: 'recomendado', source: 'Criterio del proyecto. Sin ellos no hay VPN ni TIR en las medidas.' },
          { label: 'Factor de emisión (kgCO₂e/kWh)', need: 'opcional', source: 'El vigente para el sistema interconectado. Empieza en 0: mientras no lo cambies, la app no reporta CO₂ evitado.' },
          { label: 'Horas de sol pico (HSP)', need: 'opcional', source: 'Atlas de radiación o IDEAM para la ciudad. Hace falta para dimensionar solar fotovoltaica.' },
          { label: 'Operador de red, cuenta o NIU y nivel de tensión', need: 'opcional', source: 'Encabezado de la factura.' },
        ],
        result: 'Portada y caracterización del informe (art. 4a de la Res. 40412), criterios económicos para todas las medidas, indicadores por metro cuadrado y por usuario, y la tarjeta «Cumplimiento normativo» del tablero.',
      },
      {
        id: 'areas',
        what: 'Registra cada espacio con sus dimensiones. Es la base del dimensionamiento de climatización e iluminación.',
        inputs: [
          { label: 'Nombre del espacio', need: 'obligatorio', source: 'Usa el mismo nombre del plano o de la puerta, por ejemplo «Aula 601».' },
          { label: 'Largo y ancho (m)', need: 'obligatorio', source: 'Cinta métrica o medidor láser. Si el espacio es irregular, escribe directamente el área en m².' },
          { label: 'Tipo de espacio', need: 'recomendado', source: 'Del catálogo: aula, oficina, laboratorio de química, de física, de cómputo… Define los lux exigidos (RETILAP 2026) y la carga térmica de referencia.' },
          { label: 'Código y piso del espacio', need: 'recomendado', source: 'El código del plano o de la puerta (LQ-01) y el piso. Son las columnas «ID Área» y «Piso» del Formato 2.' },
          { label: 'Alto (m) y altura del plano de trabajo', need: 'recomendado', source: 'El plano de trabajo suele ser 0,75 m (escritorios). Con ellos se calcula el índice del local K.' },
          { label: 'Ocupantes y horas de uso al día', need: 'recomendado', source: 'Conteo en sitio u horario de clases. Entran en la carga térmica del espacio.' },
          { label: 'Lux promedio y mínimo medidos', need: 'recomendado', source: 'Luxómetro sobre el plano de trabajo, en varios puntos. Sin ellos no se puede comparar con el nivel exigido.' },
          { label: 'Ventanas: área (m²) y orientación', need: 'opcional', source: 'Medida de los vanos. Suman la ganancia solar a la carga térmica.' },
          { label: 'Techo expuesto y área de techo disponible (m²)', need: 'opcional', source: 'Para la carga térmica y para saber cuántos paneles solares caben.' },
          { label: 'Horarios de uso: actividad, días, horas, personas y si usan aire y luz', need: 'recomendado', source: 'Pestaña «Horarios y ocupación» (Formato 6): el horario de clases o de prácticas de cada espacio, por periodo académico. Sirve para comparar las horas de los equipos con el uso real.' },
        ],
        result: 'Área, volumen e índice del local de cada espacio; carga térmica requerida, luminarias necesarias, consumo por metro cuadrado y horas de uso por semana.',
        tip: 'Mide con el espacio en uso normal y anota el número del aula o de la oficina: así las fotos y los equipos quedan bien vinculados.',
      },
      {
        id: 'inventario',
        what: 'El censo de carga: qué equipos hay, cuánto consumen y cuántas horas trabajan. Es el dato que más pesa en todo el análisis.',
        inputs: [
          { label: 'Nombre del equipo', need: 'obligatorio', source: 'Por ejemplo «Aire acondicionado Aula 601». El código (AC-A601-01) ayuda a ordenar fotos e informe.' },
          { label: 'Energético del equipo', need: 'recomendado', source: 'Electricidad (por omisión), gas natural, GLP u otro. Un equipo de gas se registra con su potencia térmica y no entra en ninguna cifra eléctrica.' },
          { label: 'Categoría o uso final', need: 'obligatorio', source: 'Iluminación, climatización, motores, refrigeración, TI, cocina, equipos de laboratorio u otros. Define el color y el balance por uso final.' },
          { label: 'Régimen de uso y si el equipo se puede apagar', need: 'recomendado', source: 'Por horario, continuo 24 h (neveras, ultracongeladores), por ciclos (hornos, autoclaves) o de respaldo. Los que no se pueden apagar quedan fuera de las medidas de apagado.' },
          { label: 'Voltaje, corriente, fases y modo de uso', need: 'recomendado', source: 'De la placa (Formatos 3 y 4). Permiten comparar con las mediciones y con la capacidad del tablero.' },
          { label: 'Potencia de una unidad (kW)', need: 'obligatorio', source: 'De la placa. Si la placa da amperios: kW = V × A × FP ÷ 1.000 (monofásico) o kW = 1,73 × V × A × FP ÷ 1.000 (trifásico).' },
          { label: 'Cantidad', need: 'obligatorio', source: 'Cuántas unidades iguales hay. Treinta luminarias iguales son un solo registro con cantidad 30.' },
          { label: 'Horas de uso al día y días al mes', need: 'obligatorio', source: 'Horario real. Puedes marcar las 24 horas del día en la franja horaria y con eso la app estima la curva de carga.' },
          { label: 'Factor de uso (%)', need: 'obligatorio', source: 'Qué parte del tiempo encendido trabaja a plena carga. 100 % si no lo sabes; los aires suelen estar entre 60 y 80 %.' },
          { label: 'Estado: bueno, regular o deficiente', need: 'recomendado', source: 'Inspección visual. Alimenta los hallazgos automáticos del diagnóstico.' },
          { label: 'Espacio y tablero a los que pertenece', need: 'recomendado', source: 'Permite repartir el consumo por área y colgar el equipo del circuito correcto.' },
          { label: 'Capacidad (BTU/h) y EER o SEER, en climatización', need: 'recomendado', source: 'Placa del aire. Sin la capacidad no se puede decir si está sub o sobredimensionado.' },
          { label: 'Lúmenes y tipo de lámpara, en iluminación', need: 'recomendado', source: 'Catálogo de la luminaria. Sin lúmenes no se calcula cuántas hacen falta ni el ahorro del LED.' },
          { label: 'Tipo de aire, temperatura configurada, tipo de luminaria y control', need: 'opcional', source: 'Formatos 4 y 5. Muestran si hay sensores o temporizadores y a qué temperatura trabajan los aires.' },
          { label: 'Marca, modelo, año y foto de la placa', need: 'opcional', source: 'La foto queda como evidencia en el informe y permite verificar después sin volver al sitio. Marca las fotos que se tomaron con autorización.' },
          { label: 'Mantenimiento: último, frecuencia, fallas y condición', need: 'opcional', source: 'Pestaña «Mantenimiento» (Formato 9), con la hoja de vida o el informe del técnico como evidencia. PONTIA avisa cuáles están atrasados.' },
        ],
        result: 'Consumo estimado por equipo (kWh/mes), balance por uso final, carga instalada, estado del mantenimiento y la base de las medidas de ahorro.',
        tip: 'Si un equipo no tiene placa legible, mídelo con la pinza y regístralo en Mediciones como dato medido: así queda la trazabilidad.',
      },
      {
        id: 'electrico',
        what: 'Dibuja la instalación desde la red hasta los circuitos. Con eso se arma el unifilar y se compara la carga con la capacidad.',
        inputs: [
          { label: 'Nombre de cada elemento', need: 'obligatorio', source: 'Por ejemplo «TGD · Tablero general».' },
          { label: 'De qué elemento cuelga', need: 'recomendado', source: 'Agrega cada tablero o circuito con el botón «+» del elemento que lo alimenta: así se dibuja el unifilar.' },
          { label: 'Transformador: potencia (kVA), tensiones y año', need: 'recomendado', source: 'Placa del transformador, o la factura si es propiedad del operador. Sin los kVA no hay porcentaje de carga.' },
          { label: 'Tableros y circuitos: protección principal (A), tensión y fases', need: 'recomendado', source: 'Placa del breaker principal. Con ella se revisa el criterio del 80 % de la protección.' },
          { label: 'Acometida: conductor, capacidad de corriente (A) y longitud', need: 'opcional', source: 'Calibre del cable y su ampacidad de tabla.' },
          { label: 'Número del medidor y ubicación', need: 'opcional', source: 'Factura y sitio de instalación.' },
        ],
        result: 'Diagrama unifilar, porcentaje de carga del transformador, corriente de cada tablero frente a su protección y desbalance entre fases.',
      },
      {
        id: 'mediciones',
        what: 'Tres formas de registrar el consumo real: mediciones puntuales, lecturas del medidor y archivos de intervalos del analizador o del operador.',
        inputs: [
          { label: 'Medición puntual: fecha, hora y punto medido', need: 'obligatorio', source: 'El punto puede ser la acometida general, un tablero, un área o un equipo.' },
          { label: 'Medición puntual: al menos un valor', need: 'obligatorio', source: 'Tensión y corriente por fase, kW, kVA, kvar, factor de potencia o THD. Con V, A y FP la app completa el resto.' },
          { label: 'Lectura: medidor, fecha-hora y lectura acumulada (kWh)', need: 'obligatorio', source: 'La cifra que muestra el medidor. La app saca el consumo diario por diferencia entre lecturas.' },
          { label: 'Instrumento y tipo de dato', need: 'recomendado', source: 'Nombre del analizador o de la pinza, y si el valor es medido, calculado, estimado o ingresado. Es la trazabilidad del informe.' },
          { label: 'Archivo del analizador o del operador (CSV o Excel)', need: 'opcional', source: 'El asistente te deja elegir la columna de fecha y la de potencia o energía, el separador y las unidades, y guarda el mapeo como plantilla.' },
        ],
        result: 'Factor de potencia y desbalance reales, curva de carga diaria, demanda máxima, carga base y la comparación entre lo medido y lo estimado.',
        tip: 'Para una curva de carga representativa, deja el analizador al menos un día laborable completo y, si puedes, un fin de semana.',
      },
      {
        id: 'facturacion',
        what: 'Las facturas de energía. Son la verdad del consumo y el punto de partida del análisis mensual y anual.',
        inputs: [
          { label: 'Mes facturado', need: 'obligatorio', source: 'Una factura por mes; la app no deja repetir el periodo.' },
          { label: 'Energía activa (kWh)', need: 'obligatorio', source: 'El consumo del periodo, tal como aparece en la factura.' },
          { label: 'Valor total (COP)', need: 'obligatorio', source: 'Lo pagado en el periodo. Con él se calcula la tarifa efectiva.' },
          { label: 'Días facturados', need: 'recomendado', source: 'Diferencia entre las fechas de lectura. Permite comparar meses de distinta duración.' },
          { label: 'Reactiva (kvarh) y demanda máxima (kW)', need: 'recomendado', source: 'Aparecen cuando hay medición horaria. Sirven para el factor de potencia y el cobro por reactiva.' },
          { label: 'Personas atendidas, horas de práctica y grados-día de enfriamiento del mes', need: 'recomendado', source: 'Registros de la institución (ingresos, horarios de práctica) y datos de temperatura del IDEAM. Son las variables relevantes de la línea base de la Res. UPME 016 de 2024: con una, el modelo es de cociente (kWh por persona); con varias, una regresión.' },
          { label: 'Días hábiles, temperatura media y ocupación del periodo', need: 'opcional', source: 'Calendario, IDEAM y registros de la institución. Son las variables con las que se ajusta la regresión de la línea base (ISO 50006).' },
          { label: 'Facturas de gas natural u otros energéticos: cantidad, unidad, factor de conversión a kWh y valor', need: 'opcional', source: 'Pestaña «Gas y otros energéticos» (Formato 8). El factor de conversión se copia de la factura del proveedor. No cambian ninguna cifra eléctrica: se suman a la electricidad solo en kWh equivalentes.' },
        ],
        result: 'Comportamiento mensual y anual, tarifa efectiva, porcentaje de reactiva, línea base energética y contraste con el consumo estimado del inventario. Con gas u otros energéticos, el balance de todos los energéticos.',
        tip: 'Con 12 meses seguidos ya se ve un año completo; con 24 se puede comparar contra el año anterior.',
      },
      {
        id: 'control',
        what: 'La lista de la información que hace falta para auditar (el Formato 13): qué ya se tiene, qué falta, quién la entrega y para cuándo. También genera y lee los formatos de Excel de la recolección.',
        inputs: [
          { label: 'Responsable, fecha objetivo y fecha obtenida de cada renglón', need: 'recomendado', source: 'Quién de la entidad tiene la información y cuándo se comprometió a entregarla. Sirve para hacer seguimiento a lo pendiente.' },
          { label: 'Planos y distribución', need: 'obligatorio', source: 'PONTIA no guarda planos: marca el renglón como obtenido cuando los tengas, o como no disponible si la entidad no los tiene.' },
          { label: 'Renglones «No disponible»', need: 'opcional', source: 'Cuando la entidad no tiene un dato, decláralo. El renglón queda resuelto y el informe puede decir qué no se pudo obtener.' },
          { label: 'Formatos de Excel diligenciados', need: 'opcional', source: 'Se descargan en blanco o con lo registrado, se llenan con los técnicos y se leen de nuevo. Anota siempre las unidades (W, kW, V, A, BTU/h) y escribe N/D si el dato no está disponible.' },
        ],
        result: 'El estado de la recolección (los renglones se marcan solos con los datos registrados), la lista de lo que falta y los 13 formatos de Excel listos para llevar a campo o para cargar los datos de una vez.',
        tip: 'Un renglón sale «obtenido» solo, cuando los datos ya están en la app. Marca a mano únicamente lo que la app no puede saber, como los planos.',
      },
    ],
  },
  {
    id: 'analisis',
    intro: 'Estas tres pantallas no se llenan a mano: calculan con lo que registraste y avisan cuando falta un dato.',
    steps: [
      {
        id: 'comportamiento',
        what: 'Muestra cómo se consume la energía: la curva de un día típico, el mapa de calor por hora y la serie mensual y anual.',
        inputs: [
          { label: 'Facturas', need: 'obligatorio', source: 'Para las vistas mensual y anual.' },
          { label: 'Serie del analizador, lecturas del medidor u horarios del inventario', need: 'recomendado', source: 'Cualquiera de las tres alimenta la curva diaria; el archivo del analizador es el más preciso.' },
          { label: 'Calendario de operación', need: 'opcional', source: 'De Datos generales: separa los días laborables de los fines de semana.' },
        ],
        result: 'Curva de carga de día laborable y de fin de semana, demanda máxima, carga base, factor de carga, mapa de calor día × hora, kWh/día, suma móvil de 12 meses y variación frente al año anterior.',
      },
      {
        id: 'balance',
        what: 'Reparte el consumo entre los usos finales, señala los usos significativos de energía (USE) y calcula los indicadores y la línea base.',
        inputs: [
          { label: 'Inventario completo', need: 'obligatorio', source: 'El balance se arma con el consumo estimado de cada equipo.' },
          { label: 'Facturas', need: 'recomendado', source: 'Para contrastar lo estimado con lo facturado y ajustar la línea base.' },
          { label: 'Área construida y número de usuarios', need: 'recomendado', source: 'De Datos generales: son el denominador de los indicadores.' },
          { label: 'Variables de cada factura', need: 'opcional', source: 'Personas atendidas, horas de práctica, grados-día, días hábiles, temperatura u ocupación: con ellas la línea base puede ser un cociente o una regresión y no solo un promedio.' },
          { label: 'Tres años de facturas mensuales', need: 'recomendado', source: 'La Res. UPME 016 de 2024 recomienda 36 meses para el periodo base. Con menos, la app lo avisa y te pide la justificación.' },
          { label: 'Ajustes de la línea base', need: 'opcional', source: 'Un suceso que no se repite (remodelación, paro, aires fuera de servicio) se registra como ajuste no rutinario con su causa y sus meses; la app corrige con él los mismos meses de los demás años.' },
          { label: 'Equipos y facturas de gas', need: 'opcional', source: 'Con ellos aparece el panel «Todos los energéticos»: reparto de la energía en kWh equivalentes y conciliación del censo de gas con su factura.' },
        ],
        result:
          'Consumo por uso final y su Pareto, usos significativos, estimado frente a facturado, indicadores (kWh/m²·año, kWh/persona, kWh por hora de práctica y por laboratorio) y la línea base con el método de la UPME: modelo (valor absoluto, cociente o estadístico), banda de ±10 %, datos fuera de la banda, potencial por mejor desempeño, ajustes y la tabla que se reporta a la UPME. La regresión con R², CV(RMSE) y NMBE queda como complemento.',
        tip: 'Si lo estimado y lo facturado se separan mucho, casi siempre faltan equipos en el inventario o sobran horas de uso. Si un mes sale de la banda de ±10 %, primero busca la causa: un suceso puntual se registra como ajuste no rutinario, no se borra.',
      },
      {
        id: 'dimensionamiento',
        what: 'Compara lo instalado con lo que el espacio necesita: climatización, iluminación y capacidad eléctrica.',
        inputs: [
          { label: 'Espacios con sus dimensiones', need: 'obligatorio', source: 'Del paso Áreas y dimensiones.' },
          { label: 'Capacidad de los aires (BTU/h) y lúmenes de las luminarias', need: 'obligatorio', source: 'Del inventario. Sin esos datos la pantalla no puede comparar.' },
          { label: 'Lux medidos en el espacio', need: 'recomendado', source: 'Del paso de espacios: permiten contrastar con el nivel exigido para ese uso.' },
          { label: 'Transformador y protecciones', need: 'recomendado', source: 'Del sistema eléctrico, para el porcentaje de carga y el criterio del 80 %.' },
          { label: 'Demanda máxima medida', need: 'opcional', source: 'De las mediciones o de la factura. Si falta, se estima con el factor de demanda.' },
        ],
        result: 'Aires sub o sobredimensionados, luminarias necesarias por el método de los lúmenes, W/m², carga del transformador, corriente frente a la protección y desbalance de fases.',
        tip: 'Los valores de referencia (lux, BTU/h·m², criterio del 80 %) son editables. Los de fábrica están para validarlos con el RETILAP y con tu criterio.',
      },
    ],
  },
  {
    id: 'plan',
    intro: 'De los datos a las decisiones: qué está mal, qué se propone, con qué programa y en qué fechas.',
    steps: [
      {
        id: 'diagnostico',
        what: 'Reúne los hallazgos de la auditoría con su gravedad y su evidencia. La app propone algunos a partir de los datos y tú decides cuáles aceptar.',
        inputs: [
          { label: 'Hallazgo en pocas palabras', need: 'obligatorio', source: 'Por ejemplo «Factor de potencia de 0,78 en la acometida general».' },
          { label: 'Gravedad', need: 'recomendado', source: 'Crítico, alto, medio o bajo. Ordena el informe y la priorización.' },
          { label: 'Descripción, tema y registro relacionado', need: 'recomendado', source: 'Qué se observó y a qué equipo, espacio o tablero corresponde.' },
          { label: 'Fotos', need: 'recomendado', source: 'La evidencia va junto al hallazgo y al anexo fotográfico del informe.' },
          { label: 'Fecha, posible causa, impacto energético y acción sugerida', need: 'recomendado', source: 'Son las columnas del Formato 11 de la recolección: el técnico las anota en campo y el informe las reproduce debajo de cada hallazgo.' },
        ],
        result: 'Lista de hallazgos con evidencia, la sección de diagnóstico del informe y el vínculo con las medidas que los resuelven.',
        tip: 'Las sugerencias automáticas salen de reglas: factor de potencia bajo, equipos deficientes, iluminación fuera de rango, tableros al límite, carga base nocturna alta. Son un punto de partida, no una conclusión.',
      },
      {
        id: 'seguridad',
        what: 'Registra los riesgos de origen eléctrico que ves en la instalación y los valora con la matriz de análisis de riesgos del RETIE. Va aparte de los hallazgos energéticos: un riesgo grave se atiende aunque no ahorre nada.',
        inputs: [
          { label: 'Factor de riesgo y qué se encontró', need: 'obligatorio', source: 'De los doce factores del RETIE (art. 1.5.1.3): arcos eléctricos, contacto directo o indirecto, cortocircuito, sobrecarga, tensión de paso o de contacto y rayos, entre otros. La app muestra sus causas y sus medidas de protección.' },
          { label: 'Si el riesgo es real o potencial y dónde está', need: 'recomendado', source: 'Real es el que ya se presenta; potencial, el que puede presentarse si no se controla. La ubicación puede ser un espacio, un equipo o un tablero del proyecto.' },
          { label: 'Consecuencia (1 a 5) y frecuencia (A a E)', need: 'recomendado', source: 'Se valoran con tu criterio de campo, por clase de pérdida (personas, económicas, ambientales, imagen). Se toma la consecuencia más grave y se cruza con la frecuencia en la matriz del RETIE (art. 1.5.1.4.1).' },
          { label: 'Alto riesgo o peligro inminente', need: 'recomendado', source: 'Lo determina una persona competente en electrotecnia con los criterios del RETIE (1.5.1.4.2). Si marcas alguno, la app pide el antecedente comparable y quién evaluó, y el hallazgo pasa al inicio de la lista.' },
          { label: 'Tipo de control, acción inmediata y acción recomendada', need: 'recomendado', source: 'Eliminación, sustitución, control de ingeniería, administrativo o protección personal: es la jerarquía de controles. La acción inmediata reduce el riesgo mientras se corrige.' },
          { label: 'Responsable, fecha compromiso, estado y fotos', need: 'recomendado', source: 'Quién lo corrige y para cuándo; la evidencia va junto al hallazgo.' },
          { label: 'Referencia en el SG-SST de la entidad', need: 'opcional', source: 'Texto libre: cómo aparece ese peligro en la matriz de peligros de la entidad (por ejemplo, con la GTC 45). PONTIA no valora con esa guía.' },
        ],
        result: 'Lista de hallazgos ordenada por urgencia, la matriz de riesgos del RETIE con el código de cada hallazgo, un aviso en el inicio del proyecto cuando algo pide atención inmediata y el capítulo «Seguridad eléctrica» del informe, aparte de los ahorros.',
        tip: 'Es un apoyo para la auditoría, no un dictamen: no reemplaza la inspección de la instalación con un inspector acreditado ni el sistema de gestión de la seguridad y salud en el trabajo de la entidad. Las sugerencias de sobrecarga o desbalance salen de tus datos y se valoran aquí, no en Diagnóstico.',
      },
      {
        id: 'oportunidades',
        what: 'Las medidas de ahorro con su evaluación económica. Las calculadoras dimensionan la solución y llenan los números por ti.',
        inputs: [
          { label: 'Código y nombre de la medida', need: 'obligatorio', source: 'M1, M2… y una frase clara, por ejemplo «Cambio a iluminación LED».' },
          { label: 'Ahorro de energía (kWh/año) y ahorro en dinero (COP/año)', need: 'obligatorio', source: 'Los calcula la calculadora; también los puedes escribir a mano.' },
          { label: 'Inversión (COP)', need: 'obligatorio', source: 'Cotización o precio de referencia. Escribe 0 si la medida es operativa.' },
          { label: 'Vida útil (años) y costo anual de operación', need: 'recomendado', source: 'Entran en el VPN y la TIR.' },
          { label: 'Hallazgos que resuelve y prioridad', need: 'recomendado', source: 'Encadenan el diagnóstico con el plan y ordenan la implementación.' },
          { label: 'Clase de potencial de ahorro', need: 'recomendado', source: 'Buenas prácticas de operación, cambio tecnológico, sustitución de energético, FNCER o medida pasiva (art. 4, literal d, de la Res. 40412). Si no la eliges, se deduce del tipo de medida.' },
          { label: 'Consumo actual del sistema, evidencia, responsable, plazo e indicador', need: 'recomendado', source: 'Son las columnas del Formato 12 de la recolección. El consumo actual permite ver qué parte del sistema representa el ahorro.' },
          { label: 'Tenencia del edificio', need: 'recomendado', source: 'De Datos generales. Si el edificio es arrendado o está en comodato, solo las buenas prácticas de operación pueden entrar al plan: las demás quedan como potencial y salen del plan (nada se borra).' },
          { label: 'Alcance de las FNCER', need: 'recomendado', source: 'De Datos generales: reportar el potencial o excluirlas con una justificación. PONTIA no diseña sistemas fotovoltaicos en la auditoría: el párrafo del informe da el potencial de referencia con la cubierta disponible y las horas solares pico.' },
          { label: 'Datos de cada calculadora', need: 'opcional', source: 'Solar FV: consumo a cubrir y HSP. Condensadores: potencia y factor de potencia actual y deseado. Aires: carga térmica del espacio. LED: luminarias actuales y propuestas. Apagado y horarios: horas menos por día y cumplimiento esperado; deja fuera los equipos que no se pueden apagar, los continuos y los de respaldo.' },
        ],
        result: 'Retorno simple, VPN, TIR, CO₂ evitado, matriz de priorización con sus criterios, el potencial por clase, el párrafo de FNCER y el conjunto de medidas que se lleva al PGEE. Si dos medidas se solapan (por ejemplo LED y aires), el total avisa que la suma simple sobrestima el ahorro.',
        tip: 'Los porcentajes de ahorro de varias medidas sobre el mismo sistema no se suman sin más: la iluminación LED baja la carga de los aires. Revisa el aviso de solapamiento antes de comprometer una meta.',
      },
      {
        id: 'pgee',
        what: 'Arma el Plan de Gestión Eficiente de la Energía con las siete etapas de la guía de la UPME: decisión, diagnóstico, formulación (meta legal y ruta anual), selección de proyectos, modelo financiero y contractual, implementación y seguimiento.',
        inputs: [
          { label: 'Medidas incluidas en el plan', need: 'obligatorio', source: 'Las que marcaste en Oportunidades: son los planes de acción del programa.' },
          { label: 'Gestor energético: nombre o cargo, rol, acto de designación y fecha', need: 'obligatorio', source: 'La Res. 40412 (art. 4, par. 3) exige definir un responsable del seguimiento y la evaluación del plan. El acto es el documento con que la entidad lo designó (resolución, acta…). Sin designar, el documento lo pide y no inventa a nadie.' },
          { label: 'Ruta de cumplimiento anual: año en que entra en operación cada medida, meta y presupuesto de cada año', need: 'obligatorio', source: 'PONTIA la propone con las fechas de las tareas y la prioridad de las medidas. Confírmala o ajústala: sin confirmar, el documento la lleva marcada como propuesta para aprobación.' },
          { label: 'Meta legal: año de referencia, consumo del año anterior y porcentaje', need: 'recomendado', source: 'La ley pide al menos 15 % del consumo del año anterior en el año siguiente a la auditoría. PONTIA propone el año de la auditoría y los últimos 12 meses facturados; puedes cambiarlos. La meta no puede ser menor que el 15 %.' },
          { label: 'Política energética y alcance', need: 'recomendado', source: 'La app propone un texto base que puedes ajustar al cliente.' },
          { label: 'Equipo de gestión: rol, nombre y responsabilidades', need: 'recomendado', source: 'Quién responde por el programa dentro de la institución.' },
          { label: 'Objetivos y metas: descripción, porcentaje y fecha', need: 'recomendado', source: 'Por ejemplo «Reducir 12 % el consumo antes de diciembre de 2027».' },
          { label: 'Modelo financiero y contractual', need: 'recomendado', source: 'Los caminos que la entidad considera para pagar las medidas (gastos de funcionamiento, proyecto de inversión, leasing, renting, APP, contrato por desempeño, FENOGE…). El instrumento jurídico lo define la entidad con su oficina jurídica y de presupuesto.' },
          { label: 'Seguimiento, comunicación, formación y frecuencia de revisión', need: 'opcional', source: 'Cómo se verifica, se divulga y se revisa el programa.' },
          { label: 'Facturas posteriores a la auditoría', need: 'opcional', source: 'De Facturación. Desde el año siguiente a la auditoría, «Seguimiento del ahorro real» compara cada mes con el mismo mes del año anterior y con la línea base, y dice si el plan va en ruta hacia la meta del año. Compara el consumo facturado, sin corregir por clima ni por ocupación.' },
        ],
        result: 'Documento del PGEE en Word con el marco legal, el gestor energético, la revisión energética, la meta legal frente a lo que prevé el plan, la ruta anual con su gráfica, las medidas por tipo (A, B o C según el retorno) con su ficha técnica, el modelo financiero, el resumen del cronograma y los indicadores de seguimiento. Con facturas posteriores a la auditoría, el seguimiento del ahorro real frente a la meta del año, con su gráfica. En el inicio del proyecto, la lista «PGEE: responsable y ruta anual» dice qué falta.',
        tip: 'La ley pide al menos el 15 % el primer año. Si el plan no lo alcanza, la ruta lo avisa en rojo y dice cuántos kWh/año faltan: adelanta medidas al primer año o suma otras. La ley también habla de metas sostenibles «a más tardar en el año 2026»; PONTIA no interpreta ese plazo, consúltalo con la UPME.',
      },
      {
        id: 'implementacion',
        what: 'Convierte las medidas en tareas con fechas, responsable y presupuesto, y hace el seguimiento.',
        inputs: [
          { label: 'Nombre de la tarea', need: 'obligatorio', source: 'Por ejemplo «Diseño y contratación».' },
          { label: 'Medida a la que pertenece y fase', need: 'recomendado', source: 'Corto, mediano o largo plazo. Así el presupuesto y el ahorro se suman donde corresponde.' },
          { label: 'Fechas de inicio y fin', need: 'recomendado', source: 'Son las barras del cronograma.' },
          { label: 'Responsable en la entidad y fuente de financiación', need: 'recomendado', source: 'Recursos propios, ahorros reinvertidos (Ley 1715, art. 30), FENOGE, crédito, incentivos de la Ley 1715 de 2014…' },
          { label: 'Quién ejecuta: tipo, nombre, rol y registro profesional', need: 'recomendado', source: 'El contratista, la persona o la dependencia que hace el trabajo. En una obra eléctrica, el diseño y la construcción los firma una persona competente con su matrícula profesional (CONTE o COPNIA); el número de matrícula solo se anota si quien ejecuta lo entrega.' },
          { label: 'Obra eléctrica: tipo de intervención, inicio de la obra y cómo se prueba la fecha', need: 'recomendado', source: 'Se marca solo en las tareas que intervienen la instalación eléctrica (instalación, ampliación, remodelación o reposición); las compras y las campañas no. La fecha de inicio define el régimen: el RETIE de 2026 (obras iniciadas desde el 1 de enero de 2026) o la Res. 90708 de 2013 (iniciadas antes, con el acta de inicio o el contrato que pruebe la fecha).' },
          { label: 'Verificación del RETIE: si aplica, documentos, quién verificó y cuándo', need: 'recomendado', source: 'Decides si el RETIE aplica; si aplica, registras las declaraciones de cumplimiento, el dictamen de inspección y los certificados de los productos, y el resultado. Un recordatorio con los artículos del reglamento te acompaña; PONTIA no decide qué documento aplica.' },
          { label: 'Presupuesto (COP)', need: 'recomendado', source: 'La app sugiere lo que falta por asignar de la inversión de esa medida.' },
          { label: 'Estado y avance (%)', need: 'recomendado', source: 'Para el seguimiento del plan. Una tarea de obra eléctrica no pasa a «Implementada» sin el RETIE resuelto: en «Cumple» con su evidencia o con una justificación escrita.' },
          { label: 'Indicador y forma de verificación', need: 'opcional', source: 'Cómo se mide el resultado (M&V según el IPMVP). Es la verificación del ahorro; la del RETIE es otra.' },
        ],
        result: 'Cronograma Gantt, presupuesto por fase y por mes, flujo de caja de la inversión frente al ahorro con su punto de equilibrio, el avance del plan, la tarjeta «Cumplimiento del RETIE» y, en el Word, el capítulo con los ejecutores y la verificación de cada obra eléctrica.',
        tip: 'El botón «Generar tareas» crea la preparación y la ejecución de cada medida seleccionada, escalonadas según su prioridad; la ejecución de las medidas que tocan la instalación eléctrica sale con la obra marcada y el RETIE por definir. Después las ajustas. Lo que se implementa sin la verificación en «Cumple» queda señalado con su justificación.',
      },
    ],
  },
  {
    id: 'informes',
    intro: 'La entrega. Todo lo anterior se convierte en documentos y archivos para el cliente.',
    steps: [
      {
        id: 'informes',
        what: 'Genera los documentos para el cliente y las exportaciones de datos, y guarda el historial de lo generado.',
        inputs: [
          { label: 'Todo lo registrado en los pasos anteriores', need: 'obligatorio', source: 'Cuanto más completo el levantamiento, más completo sale el informe. La pantalla avisa qué falta.' },
          { label: 'Nombre del auditor y logo del cliente', need: 'opcional', source: 'Van en la portada del documento.' },
          { label: 'Perfil del auditor (Ajustes)', need: 'recomendado', source: 'Formación, experiencia certificada por un tercero y matrículas. Con el perfil registrado, el informe de auditoría trae el anexo «Datos del auditor» con la verificación del artículo 6 de la Res. 40412; nunca imprime la cédula ni el RUT, solo si están reunidos.' },
          { label: 'Opciones de fotos', need: 'opcional', source: 'Puedes incluirlas o no y elegir su tamaño dentro del Word.' },
        ],
        result: 'Informe de auditoría en Word (con el anexo de los datos del auditor cuando su perfil está registrado), PGEE en Word, plan de implementación en Word, CSV por tabla, Excel con una hoja por tabla, PNG de cada gráfica y respaldo .zip del proyecto.',
        tip: 'En el celular, al descargar se abre el menú de compartir: WhatsApp, correo, Drive o Archivos.',
      },
      {
        id: 'reporte-upme',
        what: 'Deja lista la información para reportar la auditoría a la UPME en el Módulo de Medidas del artículo 237 del SUU (un caso por sede) y dice qué falta. PONTIA no envía nada: el reporte lo hace la entidad con su usuario en el SUU.',
        inputs: [
          { label: 'Entidad, sede con su código único, NIT y fecha de la auditoría', need: 'obligatorio', source: 'De Datos generales. El código de la sede lo elige la propia entidad. La lista «¿Listo para reportar?» dice exactamente qué falta y lleva con «Completar» a la pantalla donde se llena.' },
          { label: 'Doce meses de facturas de electricidad', need: 'obligatorio', source: 'De Facturación. Con ellas se calcula la línea base de la Res. UPME 016 de 2024; la resolución recomienda tres años, o justificar por qué el periodo es menor.' },
          { label: 'Medidas de ahorro, PGEE con gestor y ruta anual', need: 'obligatorio', source: 'De Oportunidades y PGEE: son las oportunidades de ahorro y el plan que acompañan el reporte.' },
          { label: 'Perfil del auditor', need: 'obligatorio', source: 'De Ajustes → Perfil del auditor: el artículo 6 de la Res. 40412 pide formación, una auditoría certificada por un tercero y los documentos de identidad reunidos.' },
          { label: 'Ciclo y número de caso del SUU', need: 'recomendado', source: 'El SUU asigna el número al crear el caso. Va en el nombre de los archivos (ART237_año_caso_…) como pide la Circular UPME 089 de 2025; sin número queda «XXX».' },
          { label: 'Fechas de radicación y de concepto, resultado y observaciones de la UPME', need: 'opcional', source: 'Para tu control: lo que la UPME responde después de radicar.' },
        ],
        result: 'La lista de requisitos con lo que falta, el informe de auditoría con el nombre de la UPME, un paquete de datos en Excel (datos de edificación y hojas equivalentes a las plantillas de consumos, línea base, medidas y metas por año), un zip de anexos y la fecha de la próxima auditoría, que la ley pide cada cuatro años.',
        tip: 'Las plantillas oficiales solo están en el SUU: descárgalas con el usuario de la entidad y compara las columnas. Las hojas del paquete son equivalentes y se ajustan cuando las tengas. El plazo y los formatos los fija la UPME por circular: confírmalos antes de reportar.',
      },
    ],
  },
];

/** «Para esto, necesitas aquello»: la tabla que resuelve la mayoría de las dudas. */
export const MANUAL_MINIMUM: { goal: string; needs: string }[] = [
  { goal: 'Ver el consumo mensual y anual', needs: 'Al menos 12 facturas con mes, kWh y valor total.' },
  { goal: 'Ver la curva de carga diaria', needs: 'Un archivo del analizador o del operador; si no hay, lecturas del medidor o los horarios de los equipos del inventario.' },
  { goal: 'Repartir el consumo por uso final', needs: 'El inventario con potencia, cantidad, horas, días y factor de uso.' },
  { goal: 'Calcular kWh/m²·año y kWh/usuario·mes', needs: 'Área construida y número de usuarios en Datos generales.' },
  { goal: 'Saber si un aire está bien dimensionado', needs: 'Dimensiones del espacio y capacidad del equipo en BTU/h.' },
  { goal: 'Revisar la iluminación', needs: 'Dimensiones del espacio, lúmenes de las luminarias y, mejor aún, lux medidos.' },
  { goal: 'Ver la carga del transformador y de los tableros', needs: 'kVA del transformador, protecciones en amperios y la demanda medida o el inventario.' },
  { goal: 'Mostrar ahorros en dinero, VPN y TIR', needs: 'La tarifa en COP/kWh y, para VPN y TIR, la tasa de descuento y el horizonte.' },
  { goal: 'Reportar CO₂ evitado', needs: 'El factor de emisión en kgCO₂e/kWh, que viene en 0 hasta que lo configures.' },
  { goal: 'Dimensionar solar fotovoltaica', needs: 'Las horas de sol pico (HSP) y el área de techo disponible de los espacios.' },
  { goal: 'Reportar la auditoría a la UPME (art. 237)', needs: 'Entidad, sede con su código único, NIT y fecha de la auditoría; 12 meses de facturas; medidas; PGEE con gestor y ruta anual; y el perfil del auditor.' },
];

export const MANUAL_DATA: { title: string; text: string }[] = [
  { title: 'En tu equipo', text: 'Los datos y las fotos se guardan dentro del navegador, en el equipo donde trabajas, y la app funciona sin conexión. PONTIA no envía nada a ningún servidor.' },
  { title: 'Respaldo .zip', text: 'Desde la lista de proyectos descargas un respaldo con los datos y las fotos. Es la copia de seguridad y la forma de pasar un proyecto del celular al PC, con «Importar respaldo».' },
  { title: 'Instalar protege los datos', text: 'Con la app instalada, el navegador es mucho menos propenso a borrar la información cuando necesita liberar espacio.' },
  { title: 'Nube opcional', text: 'Si configuras tu propio proyecto de Supabase en Ajustes → Configurar la nube, los mismos proyectos se ven en el celular y en el PC, y las fotos quedan en un depósito privado.' },
  { title: 'Cuidado al borrar', text: 'Borrar los datos del navegador, o desinstalar la app sin respaldo, borra los proyectos de ese equipo.' },
];

export const MANUAL_FAQ: { q: string; a: string }[] = [
  { q: '¿Necesito internet?', a: 'Solo la primera vez, para abrir la app. Después funciona sin conexión: registra, calcula y genera los informes igual.' },
  { q: '¿Cómo la instalo?', a: 'En Android y PC aparece el botón «Instalar». En iPhone y iPad se instala desde Safari: toca Compartir y luego «Añadir a pantalla de inicio»; Apple no permite un botón de instalación dentro de la página.' },
  { q: '¿Tengo que reinstalarla cuando haya cambios?', a: 'No. Cuando hay una versión nueva, la app avisa con el botón «Actualizar» y se actualiza sola, sin perder datos.' },
  { q: '¿Puedo llevar varias auditorías a la vez?', a: 'Sí. Cada proyecto es independiente y la lista muestra el avance de cada uno.' },
  { q: '¿Cómo paso un proyecto del celular al PC?', a: 'Descarga el respaldo .zip y ábrelo en el otro equipo con «Importar respaldo». Si conectas la nube, se sincroniza solo.' },
  { q: '¿Las fotos ocupan mucho espacio?', a: 'Cada foto se reduce antes de guardarla y se guarda además una miniatura. La lista de proyectos muestra cuánto espacio llevas usado.' },
  { q: '¿Y si borro algo sin querer?', a: 'Al eliminar aparece un aviso para deshacer. Los respaldos .zip son la red de seguridad.' },
  { q: '¿Los cálculos reemplazan mi criterio?', a: 'No. Los valores de referencia son un punto de partida editable: el auditor valida, ajusta y firma.' },
];
