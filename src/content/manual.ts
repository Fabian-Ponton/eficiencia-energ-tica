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
  { title: 'Toda la auditoría en un sitio', text: 'Catorce pantallas encadenadas: lo que registras en campo alimenta el análisis, el plan y el informe.' },
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
          { label: 'Cliente, NIT, ciudad, dirección y sector', need: 'recomendado', source: 'Datos del contrato o de la factura. Van en la portada del informe.' },
          { label: 'Área construida (m²) y número de usuarios', need: 'recomendado', source: 'Planos o la administración. Sin ellos no salen los indicadores kWh/m²·año y kWh/usuario·mes.' },
          { label: 'Calendario: días por semana, festivos y vacaciones', need: 'recomendado', source: 'Horario real de la institución. Sirve para llevar a un año lo que se mide en un día.' },
          { label: 'Tasa de descuento, aumento anual de la tarifa y horizonte', need: 'recomendado', source: 'Criterio del proyecto. Sin ellos no hay VPN ni TIR en las medidas.' },
          { label: 'Factor de emisión (kgCO₂e/kWh)', need: 'opcional', source: 'El vigente para el sistema interconectado. Empieza en 0: mientras no lo cambies, la app no reporta CO₂ evitado.' },
          { label: 'Horas de sol pico (HSP)', need: 'opcional', source: 'Atlas de radiación o IDEAM para la ciudad. Hace falta para dimensionar solar fotovoltaica.' },
          { label: 'Operador de red, cuenta o NIU y nivel de tensión', need: 'opcional', source: 'Encabezado de la factura.' },
        ],
        result: 'Portada del informe, criterios económicos para todas las medidas e indicadores por metro cuadrado y por usuario.',
      },
      {
        id: 'areas',
        what: 'Registra cada espacio con sus dimensiones. Es la base del dimensionamiento de climatización e iluminación.',
        inputs: [
          { label: 'Nombre del espacio', need: 'obligatorio', source: 'Usa el mismo nombre del plano o de la puerta, por ejemplo «Aula 601».' },
          { label: 'Largo y ancho (m)', need: 'obligatorio', source: 'Cinta métrica o medidor láser. Si el espacio es irregular, escribe directamente el área en m².' },
          { label: 'Tipo de espacio', need: 'recomendado', source: 'Del catálogo: aula, oficina, laboratorio… Define los lux exigidos y la carga térmica de referencia.' },
          { label: 'Alto (m) y altura del plano de trabajo', need: 'recomendado', source: 'El plano de trabajo suele ser 0,75 m (escritorios). Con ellos se calcula el índice del local K.' },
          { label: 'Ocupantes y horas de uso al día', need: 'recomendado', source: 'Conteo en sitio u horario de clases. Entran en la carga térmica del espacio.' },
          { label: 'Lux promedio y mínimo medidos', need: 'recomendado', source: 'Luxómetro sobre el plano de trabajo, en varios puntos. Sin ellos no se puede comparar con el nivel exigido.' },
          { label: 'Ventanas: área (m²) y orientación', need: 'opcional', source: 'Medida de los vanos. Suman la ganancia solar a la carga térmica.' },
          { label: 'Techo expuesto y área de techo disponible (m²)', need: 'opcional', source: 'Para la carga térmica y para saber cuántos paneles solares caben.' },
        ],
        result: 'Área, volumen e índice del local de cada espacio; carga térmica requerida, luminarias necesarias y consumo por metro cuadrado.',
        tip: 'Mide con el espacio en uso normal y anota el número del aula o de la oficina: así las fotos y los equipos quedan bien vinculados.',
      },
      {
        id: 'inventario',
        what: 'El censo de carga: qué equipos hay, cuánto consumen y cuántas horas trabajan. Es el dato que más pesa en todo el análisis.',
        inputs: [
          { label: 'Nombre del equipo', need: 'obligatorio', source: 'Por ejemplo «Aire acondicionado Aula 601». El código (AC-A601-01) ayuda a ordenar fotos e informe.' },
          { label: 'Categoría o uso final', need: 'obligatorio', source: 'Iluminación, climatización, motores, refrigeración, TI, cocina u otros. Define el color y el balance por uso final.' },
          { label: 'Potencia de una unidad (kW)', need: 'obligatorio', source: 'De la placa. Si la placa da amperios: kW = V × A × FP ÷ 1.000 (monofásico) o kW = 1,73 × V × A × FP ÷ 1.000 (trifásico).' },
          { label: 'Cantidad', need: 'obligatorio', source: 'Cuántas unidades iguales hay. Treinta luminarias iguales son un solo registro con cantidad 30.' },
          { label: 'Horas de uso al día y días al mes', need: 'obligatorio', source: 'Horario real. Puedes marcar las 24 horas del día en la franja horaria y con eso la app estima la curva de carga.' },
          { label: 'Factor de uso (%)', need: 'obligatorio', source: 'Qué parte del tiempo encendido trabaja a plena carga. 100 % si no lo sabes; los aires suelen estar entre 60 y 80 %.' },
          { label: 'Estado: bueno, regular o deficiente', need: 'recomendado', source: 'Inspección visual. Alimenta los hallazgos automáticos del diagnóstico.' },
          { label: 'Espacio y tablero a los que pertenece', need: 'recomendado', source: 'Permite repartir el consumo por área y colgar el equipo del circuito correcto.' },
          { label: 'Capacidad (BTU/h) y EER o SEER, en climatización', need: 'recomendado', source: 'Placa del aire. Sin la capacidad no se puede decir si está sub o sobredimensionado.' },
          { label: 'Lúmenes y tipo de lámpara, en iluminación', need: 'recomendado', source: 'Catálogo de la luminaria. Sin lúmenes no se calcula cuántas hacen falta ni el ahorro del LED.' },
          { label: 'Marca, modelo, año y foto de la placa', need: 'opcional', source: 'La foto queda como evidencia en el informe y permite verificar después sin volver al sitio.' },
        ],
        result: 'Consumo estimado por equipo (kWh/mes), balance por uso final, carga instalada y la base de las medidas de ahorro.',
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
          { label: 'Días hábiles, temperatura media y ocupación del periodo', need: 'opcional', source: 'Calendario, IDEAM y registros de la institución. Son las variables con las que se ajusta la línea base (ISO 50006).' },
        ],
        result: 'Comportamiento mensual y anual, tarifa efectiva, porcentaje de reactiva, línea base energética y contraste con el consumo estimado del inventario.',
        tip: 'Con 12 meses seguidos ya se ve un año completo; con 24 se puede comparar contra el año anterior.',
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
          { label: 'Variables de cada factura', need: 'opcional', source: 'Días hábiles, temperatura u ocupación: con ellas la línea base es una regresión y no un promedio.' },
        ],
        result: 'Consumo por uso final y su Pareto, usos significativos, estimado frente a facturado, indicadores (kWh/m²·año, kWh/usuario·mes) y línea base con R², CV(RMSE) y NMBE.',
        tip: 'Si lo estimado y lo facturado se separan mucho, casi siempre faltan equipos en el inventario o sobran horas de uso.',
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
        ],
        result: 'Lista de hallazgos con evidencia, la sección de diagnóstico del informe y el vínculo con las medidas que los resuelven.',
        tip: 'Las sugerencias automáticas salen de reglas: factor de potencia bajo, equipos deficientes, iluminación fuera de rango, tableros al límite, carga base nocturna alta. Son un punto de partida, no una conclusión.',
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
          { label: 'Datos de cada calculadora', need: 'opcional', source: 'Solar FV: consumo a cubrir y HSP. Condensadores: potencia y factor de potencia actual y deseado. Aires: carga térmica del espacio. LED: luminarias actuales y propuestas.' },
        ],
        result: 'Retorno simple, VPN, TIR, CO₂ evitado, matriz de priorización (ahorro frente a inversión) y el conjunto de medidas que se lleva al PGEE.',
      },
      {
        id: 'pgee',
        what: 'Arma el Programa de Gestión de Eficiencia Energética con la estructura de la ISO 50001.',
        inputs: [
          { label: 'Medidas incluidas en el plan', need: 'obligatorio', source: 'Las que marcaste en Oportunidades: son los planes de acción del programa.' },
          { label: 'Política energética y alcance', need: 'recomendado', source: 'La app propone un texto base que puedes ajustar al cliente.' },
          { label: 'Equipo de gestión: rol, nombre y responsabilidades', need: 'recomendado', source: 'Quién responde por el programa dentro de la institución.' },
          { label: 'Objetivos y metas: descripción, porcentaje y fecha', need: 'recomendado', source: 'Por ejemplo «Reducir 12 % el consumo antes de diciembre de 2027».' },
          { label: 'Seguimiento, comunicación, formación y frecuencia de revisión', need: 'opcional', source: 'Cómo se verifica, se divulga y se revisa el programa.' },
        ],
        result: 'Documento del PGEE en Word con la revisión energética, los usos significativos, la línea base, los indicadores, las metas y los planes de acción con su ficha técnica.',
      },
      {
        id: 'implementacion',
        what: 'Convierte las medidas en tareas con fechas, responsable y presupuesto, y hace el seguimiento.',
        inputs: [
          { label: 'Nombre de la tarea', need: 'obligatorio', source: 'Por ejemplo «Diseño y contratación».' },
          { label: 'Medida a la que pertenece y fase', need: 'recomendado', source: 'Corto, mediano o largo plazo. Así el presupuesto y el ahorro se suman donde corresponde.' },
          { label: 'Fechas de inicio y fin', need: 'recomendado', source: 'Son las barras del cronograma.' },
          { label: 'Responsable y fuente de financiación', need: 'recomendado', source: 'Recursos propios, crédito, incentivos de la Ley 1715 de 2014…' },
          { label: 'Presupuesto (COP)', need: 'recomendado', source: 'La app sugiere lo que falta por asignar de la inversión de esa medida.' },
          { label: 'Estado y avance (%)', need: 'recomendado', source: 'Para el seguimiento del plan.' },
          { label: 'Indicador y forma de verificación', need: 'opcional', source: 'Cómo se mide el resultado (M&V según el IPMVP).' },
        ],
        result: 'Cronograma Gantt, presupuesto por fase y por mes, flujo de caja de la inversión frente al ahorro con su punto de equilibrio, y el avance del plan.',
        tip: 'El botón «Generar tareas» crea la preparación y la ejecución de cada medida seleccionada, escalonadas según su prioridad; después las ajustas.',
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
          { label: 'Opciones de fotos', need: 'opcional', source: 'Puedes incluirlas o no y elegir su tamaño dentro del Word.' },
        ],
        result: 'Informe de auditoría en Word, PGEE en Word, plan de implementación en Word, CSV por tabla, Excel con una hoja por tabla, PNG de cada gráfica y respaldo .zip del proyecto.',
        tip: 'En el celular, al descargar se abre el menú de compartir: WhatsApp, correo, Drive o Archivos.',
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
