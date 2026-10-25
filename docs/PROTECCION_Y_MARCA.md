# Protección de la obra, marca y acceso

Qué hace PONTIA para proteger el trabajo de su autor, qué no puede hacer y cómo se cambia la clave.
Rama `marca-y-acceso`, sin publicar.

## 1. Lo que se protege y lo que no

| | |
|---|---|
| **Sí se protege** | La expresión concreta: el código, los textos, el diseño, los formatos de recolección y las plantillas de informe. Nace con la creación, sin registrar nada (Ley 23 de 1982, Decisión Andina 351 de 1993, Convenio de Berna). |
| **No se protege** | La idea. Que alguien haga su propia aplicación de auditoría energética es legal; copiar este código o estos documentos, no. |
| **Lo que más vale** | El criterio del auditor y la investigación normativa de `MATRIZ_CUMPLIMIENTO.md`. Eso está en el repositorio: **si el repositorio es público, está a la vista.** |

## 2. Bloquear la copia no funciona: no se intentó

Desactivar el clic derecho o el `Ctrl+C` no protege nada. Todo lo que se muestra en la pantalla de otra
persona ya está en su equipo: se copia con tres teclas, con «ver código fuente» o con una fotografía a la
pantalla. A quien estorba es al auditor y a sus colegas, cuando quieren copiar un dato de una tabla.

Por eso PONTIA **no** bloquea la copia. Lo que hace es lo que sí sirve: controlar quién entra, dejar
constancia del aviso y marcar todo lo que sale.

## 3. Lo que está hecho

### Pantalla de entrada (`domain/access.ts`, `components/AccessGate.vue`)

Antes de ver nada, aparece una pantalla con el aviso de propiedad y la clave. Al entrar, la aceptación
queda guardada en ese equipo y no se vuelve a pedir. En Ajustes está «Olvidar el acceso en este equipo».

**Qué protege.** Es una barrera de entrada y, sobre todo, la constancia de que quien entró fue advertido.

**Qué no protege.** La aplicación se publica en internet, así que su programa llega al navegador de quien
abra la dirección. La clave no se guarda en texto: se guarda el resultado de pasarla 200.000 veces por
PBKDF2-SHA256 con una sal, de modo que probar claves sale caro. Aun así, alguien con conocimientos puede
saltarse la comprobación. **Mientras el repositorio sea público, además, la sal y el resultado están a la
vista en el código.**

**La protección de verdad** llega con el repositorio privado y el sitio detrás de un control del servidor
(Cloudflare Access o similar): ahí el visitante no recibe ni una línea del programa sin autorización.

### Marca y aviso en todo lo que sale (`domain/ownership.ts`)

| Dónde | Qué lleva |
|---|---|
| Pie de la lista de proyectos y del menú lateral | `© 2026 Fabián Pontón · PONTIA · Todos los derechos reservados` |
| Portada del informe de auditoría, del PGEE, del plan de implementación y del manual | La línea de autoría y el aviso legal completo |
| Pie de página de cada página de esos documentos | El aviso corto, junto al número de página |
| Guía de los formatos de Excel (`00_Guia`) | El aviso legal completo |
| Pie de impresión de cada hoja de Excel | El aviso corto |
| Gráficas descargadas en PNG (sueltas o en el .zip) | Marca de agua en la esquina |
| Respaldo `.zip` del proyecto | Archivo `AVISO.txt` |
| Anexos del reporte a la UPME | El aviso dentro de `LEEME.txt` |

Las figuras que van **dentro** de un documento no llevan marca de agua: el documento ya la lleva en la
portada y en el pie, y repetirla en cada figura ensucia el informe.

### Titular configurable

En **Ajustes → Propiedad y acceso** se escribe el titular de los derechos. Mientras no se cambie, se usa
«Fabián Pontón». Si mañana la obra pertenece a una empresa, se cambia ahí y todos los documentos nuevos
salen con el nombre nuevo.

### Licencia

`LICENCIA.md` deja por escrito que son todos los derechos reservados, qué no está permitido y qué sí
(que el cliente use los documentos de su auditoría). Que el código esté visible en un repositorio público
**no** otorga licencia de uso: sin licencia abierta, todos los derechos quedan reservados.

## 4. Cómo cambiar la clave

La clave de ejemplo es `PONTIA-2026` y **hay que cambiarla antes de publicar**.

1. En la carpeta del proyecto:

   ```
   npm run clave -- "la frase que quieras usar"
   ```

2. El comando imprime dos líneas. Pegarlas en `src/domain/access.ts`, reemplazando las que están.
3. Volver a publicar.

La clave en sí no queda escrita en ninguna parte: conviene guardarla en un gestor de contraseñas. Si se
pierde, se genera otra con el mismo comando.

Para quitar la clave y dejar solo el aviso, poner `REQUIRE_PASSPHRASE = false` en ese mismo archivo.

## 5. Lo que falta, y no lo hace la aplicación

- **Repositorio privado.** Es lo que protege `docs/`, que es la investigación normativa. Hoy está público.
- **Control de acceso en el servidor** (Cloudflare Access), que es la protección real del sitio publicado.
- **Registro ante la Dirección Nacional de Derecho de Autor.** No crea el derecho, pero da una prueba
  oficial de autoría con fecha, que es lo que sirve ante un reclamo.
- **Registro de la marca «PONTIA»** ante la Superintendencia de Industria y Comercio, si se comercializa.
- **Cláusulas de confidencialidad y de propiedad** en los contratos con los clientes.

*Este documento explica decisiones técnicas, no es un concepto jurídico. Antes de comercializar la obra
conviene que un abogado revise la licencia y los contratos.*
