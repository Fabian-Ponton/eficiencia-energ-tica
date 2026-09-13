# PONTIA en la nube · guía de Supabase

PONTIA guarda todo en el equipo y funciona sin internet. La nube es opcional: con **tu propio proyecto de Supabase**, PONTIA guarda además una copia de tus proyectos (datos y fotos) para trabajar los mismos proyectos en el celular y en el PC.

Cada cuenta ve solo sus datos, y las fotos quedan en un depósito privado.

## Qué necesitas

- Una cuenta en [supabase.com](https://supabase.com) (la creas tú; PONTIA no crea cuentas de Supabase).
- Unos 10 minutos.

## 1. Crear el proyecto

1. Entra a supabase.com y pulsa **New project**.
2. Elige un nombre (por ejemplo «pontia»), una contraseña para la base de datos (guárdala: PONTIA no la usa) y la región más cercana (por ejemplo, São Paulo).
3. Espera a que el proyecto quede listo.

El plan gratuito alcanza para empezar. Revisa sus límites de espacio en supabase.com/pricing. Los proyectos gratuitos se pausan si pasan varios días sin uso, y se reactivan desde el panel de Supabase.

## 2. Preparar la base de datos

1. En el menú de la izquierda abre **SQL Editor** y pulsa **New query**.
2. Pega el SQL de PONTIA. Tienes dos formas de copiarlo:
   - en la app, con el botón **Copiar el SQL de PONTIA** (en **Ajustes → Configurar la nube**);
   - desde el repositorio, en el archivo `src/sync/esquema.sql`.
3. Pulsa **Run**. Debe terminar sin errores, y se puede volver a ejecutar sin perder datos.

El SQL crea tres cosas:

- **La tabla `pontia_records`**: una fila por registro de la app (proyecto, espacio, equipo, factura, medición, hallazgo, medida, PGEE, tarea, foto…).
- **Las reglas de seguridad por fila (RLS)**: cada usuario ve y cambia solo lo suyo. Si un registro cambió en dos equipos, la base conserva el cambio más reciente.
- **El depósito privado `pontia-fotos`**: guarda las fotos, en una carpeta por usuario.

## 3. Copiar la URL y la clave pública

1. Abre **Project Settings → API** (en algunas versiones del panel se llama **Data API**).
2. Copia la **Project URL**, que termina en `.supabase.co`.
3. Copia la clave **anon public**.

> **Importante:** nunca uses en PONTIA la clave **service_role**. Esa clave se salta las reglas de seguridad y da acceso a todos los datos. La clave *anon* sí puede ir en la app porque las reglas RLS la limitan.

## 4. Conectar PONTIA

1. En PONTIA, en la pantalla de proyectos, toca el botón de **Ajustes** y luego **Configurar la nube**.
2. Pega la URL y la clave anon, y pulsa **Probar y guardar**.
3. Escribe tu correo y una contraseña:
   - la primera vez, pulsa **Crear cuenta**;
   - las siguientes, pulsa **Entrar**.
4. Pulsa **Sincronizar ahora**.

Si Supabase pide confirmar el correo, abre el enlace que te llega y después usa **Entrar**. Para no depender del correo, en Supabase ve a **Authentication → Providers → Email** y desactiva «Confirm email».

## 5. Sincronizar el otro equipo

Repite el paso 4 en el celular (o en el PC), con la **misma cuenta**, y sincroniza. Los proyectos aparecen en la lista con sus fotos.

## Cómo funciona

- **Primero el equipo.** Siempre trabajas sobre los datos del equipo; la nube se actualiza al sincronizar.
- **Sincronización automática.** Con «Sincronizar sola», PONTIA sincroniza al abrir la app, al volver la conexión y cada 10 minutos. La barra lateral muestra cuándo fue la última vez.
- **Conflictos.** Si un mismo registro cambió en dos equipos, gana el cambio más reciente.
- **Borrados.** Lo que eliminas queda marcado como eliminado y desaparece también en los demás equipos.
- **Fotos.** Se suben una sola vez, con su miniatura.
- **Contraseña.** PONTIA no guarda tu contraseña en el equipo, solo la sesión. Con **Cerrar sesión** o **Olvidar esta conexión** la sesión se borra.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| La clave anon no corresponde a esa URL | Copia de nuevo la URL y la clave anon, las dos del mismo proyecto. |
| Falta preparar la base | Ejecuta el SQL completo (paso 2). |
| Las políticas de seguridad no permiten la operación | Ejecuta el SQL completo otra vez; crea las reglas que falten. |
| Correo o contraseña incorrectos | Revisa el correo. Si aún no tienes cuenta, usa «Crear cuenta». |
| Falta confirmar el correo | Abre el enlace del correo de Supabase o desactiva la confirmación (paso 4). |
| No hay conexión con la nube | Revisa internet. Los datos siguen seguros en el equipo y se sincronizan después. |

## Respaldos

La nube no reemplaza los respaldos `.zip`. Descárgalos de vez en cuando desde cada proyecto, sobre todo antes de cambiar de celular.

## Asistente con IA (más adelante)

Un asistente con IA real necesita internet y un servidor intermedio que guarde la clave del servicio de IA. Esa clave nunca debe ir dentro de la app. Queda como mejora futura.
