# Biblioteca IA — Documentación Técnica

**Arquitectura, API, Base de datos e Infraestructura**
Versión 1.0 | 2026

---

## Índice

1. [Visión general del sistema](#1-visión-general-del-sistema)
   - 1.1 [Stack tecnológico](#11-stack-tecnológico)
   - 1.2 [Estructura del proyecto](#12-estructura-del-proyecto)
2. [Base de datos](#2-base-de-datos)
   - 2.1 [Tabla: usuarios](#21-tabla-usuarios)
   - 2.2 [Tabla: libros](#22-tabla-libros)
   - 2.3 [Tabla: reservas](#23-tabla-reservas)
   - 2.4 [Tabla: resenas](#24-tabla-resenas)
   - 2.5 [Tabla: chat_historial](#25-tabla-chat_historial)
   - 2.6 [Tabla: metricas](#26-tabla-metricas)
3. [API REST — Endpoints](#3-api-rest--endpoints)
   - 3.1 [Autenticación](#31-autenticación)
   - 3.2 [Libros](#32-libros)
   - 3.3 [Reservas](#33-reservas)
   - 3.4 [Reseñas](#34-reseñas)
   - 3.5 [Chat e IA](#35-chat-e-ia)
   - 3.6 [Métricas y otros](#36-métricas-y-otros)
4. [Motor de Inteligencia Artificial](#4-motor-de-inteligencia-artificial)
   - 4.1 [Arquitectura del motor](#41-arquitectura-del-motor)
   - 4.2 [Integración con Groq](#42-integración-con-groq)
   - 4.3 [Variables de entorno requeridas](#43-variables-de-entorno-requeridas)
5. [Frontend](#5-frontend)
   - 5.1 [Sistema de variables CSS](#51-sistema-de-variables-css)
   - 5.2 [auth.js — Gestión de sesión](#52-authjs--gestión-de-sesión)
   - 5.3 [chat.js — Lógica del chat](#53-chatjs--lógica-del-chat)
   - 5.4 [modal.js — Sistema de modales](#54-modaljs--sistema-de-modales)
6. [Progressive Web App (PWA)](#6-progressive-web-app-pwa)
   - 6.1 [Componentes PWA](#61-componentes-pwa)
   - 6.2 [Estrategia de cache](#62-estrategia-de-cache)
7. [Despliegue e infraestructura](#7-despliegue-e-infraestructura)
   - 7.1 [Render](#71-render)
   - 7.2 [Supabase](#72-supabase)
   - 7.3 [Google OAuth](#73-google-oauth)
   - 7.4 [Groq API](#74-groq-api)
8. [Consideraciones de seguridad](#8-consideraciones-de-seguridad)
   - 8.1 [Autenticación y sesiones](#81-autenticación-y-sesiones)
   - 8.2 [Control de acceso por rol](#82-control-de-acceso-por-rol)
   - 8.3 [Validaciones](#83-validaciones)
9. [Mantenimiento y operaciones](#9-mantenimiento-y-operaciones)
   - 9.1 [Agregar libros](#91-agregar-libros)
   - 9.2 [Ver logs del sistema](#92-ver-logs-del-sistema)
   - 9.3 [Monitoreo](#93-monitoreo)
   - 9.4 [Deploy](#94-deploy)

---

## 1. Visión general del sistema

Biblioteca IA es una aplicación web full-stack que combina gestión de biblioteca escolar con un asistente de inteligencia artificial. Está construida con Flask (Python) en el backend, PostgreSQL como base de datos, y HTML/CSS/JavaScript vanilla en el frontend.

### 1.1 Stack tecnológico

| Componente | Tecnología |
|------------|------------|
| Backend | Python 3.11 + Flask 3.x |
| Base de datos | PostgreSQL (Supabase) |
| IA | Groq API — llama-3.1-8b-instant |
| Autenticación | Sesiones Flask + Google OAuth 2.0 |
| Frontend | HTML5 + CSS3 + JavaScript vanilla |
| Hosting | Render (plan gratuito) |
| PWA | Service Worker + manifest.json |

### 1.2 Estructura del proyecto

```
pruebas-biblio-ia-main/
├── app.py                  # Aplicación principal Flask, todas las rutas
├── ai_engine.py            # Motor de IA: búsqueda y conexión con Groq
├── database.py             # Conexión y creación de tablas PostgreSQL
├── auth.py                 # Decoradores de autorización por rol
├── requirements.txt        # Dependencias Python
├── Procfile                # Comando de inicio para Render
├── templates/              # HTML de cada página
│   ├── index.html
│   ├── checkin.html
│   ├── catalogo.html
│   ├── resenas.html
│   ├── dashboard.html
│   ├── libros.html
│   ├── registro.html
│   ├── mis_prestamos.html
│   ├── landing.html
│   ├── 404.html
│   ├── logs.html
│   └── admin_logs.html
└── static/
    ├── css/style.css       # Estilos globales con variables CSS
    ├── js/
    │   ├── auth.js         # Sesión, avatar, dropdown, historial chats
    │   ├── chat.js         # Lógica del chat con la IA
    │   ├── libros.js       # Gestión de libros (bibliotecario)
    │   ├── modal.js        # Sistema de modales personalizados
    │   └── main.js         # Welcome modal y quickSearch
    ├── manifest.json       # PWA manifest
    └── sw.js               # Service Worker para cache offline
```

---

## 2. Base de datos

El sistema usa PostgreSQL hosteado en Supabase. La conexión se realiza mediante la variable de entorno `DATABASE_URL` con el formato de connection string de PostgreSQL.

### 2.1 Tabla: usuarios

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único autoincremental |
| username | TEXT | UNIQUE NOT NULL | Nombre de usuario para login |
| password_hash | TEXT | | Hash bcrypt de la contraseña |
| nombre | TEXT | NOT NULL | Nombre completo del usuario |
| email | TEXT | UNIQUE | Email del usuario |
| rol | TEXT | NOT NULL | Valores: `alumno`, `bibliotecario`, `admin` |
| picture | TEXT | | URL de foto de perfil (Google OAuth) |
| google_id | TEXT | UNIQUE | ID de Google para OAuth |
| avatar_id | INTEGER | DEFAULT 0 | Índice del avatar seleccionado (1-8) |

### 2.2 Tabla: libros

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único |
| titulo | TEXT | NOT NULL | Título del libro |
| autor | TEXT | | Autor o autores del libro |
| editorial | TEXT | | Editorial que publicó el libro |
| categoria | TEXT | | Categoría o materia del libro |
| disponible | INTEGER | DEFAULT 1 | Cantidad de ejemplares disponibles |
| capitulos | TEXT | | JSON array con capítulos (opcional) |

### 2.3 Tabla: reservas

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único |
| usuario_id | INTEGER | NOT NULL | FK a usuarios.id |
| nombre | TEXT | NOT NULL | Nombre del alumno |
| email | TEXT | NOT NULL | Email del alumno |
| libro_id | INTEGER | | FK a libros.id (NULL = reserva general) |
| libro_titulo | TEXT | | Título del libro al momento de reservar |
| estado | TEXT | DEFAULT `pendiente` | Valores: `pendiente`, `prestado`, `devuelto` |
| fecha_reserva | TIMESTAMP | DEFAULT NOW() | Fecha y hora de la reserva |

### 2.4 Tabla: resenas

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único |
| usuario_id | INTEGER | NOT NULL | FK a usuarios.id |
| email | TEXT | NOT NULL | Email del usuario |
| nombre | TEXT | NOT NULL | Nombre del usuario |
| picture | TEXT | DEFAULT `''` | URL de foto de perfil |
| estrellas | INTEGER | CHECK (1-5) | Calificación de 1 a 5 estrellas |
| comentario | TEXT | NOT NULL | Texto de la reseña |
| fecha | TIMESTAMP | DEFAULT NOW() | Fecha de publicación |

### 2.5 Tabla: chat_historial

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único |
| usuario_id | INTEGER | NOT NULL | FK a usuarios.id |
| sesion_id | TEXT | NOT NULL | ID único de sesión de chat |
| rol | TEXT | NOT NULL | Valores: `user`, `assistant` |
| mensaje | TEXT | NOT NULL | Contenido del mensaje |
| nombre_chat | TEXT | DEFAULT NULL | Nombre personalizado del chat |
| fecha | TIMESTAMP | DEFAULT NOW() | Fecha del mensaje |

### 2.6 Tabla: metricas

| Columna | Tipo | Restricción | Descripción |
|---------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Identificador único |
| consulta | TEXT | NOT NULL | Texto de la consulta del usuario |
| resultados | TEXT | | Respuesta sintética de la IA |
| timestamp | TEXT | | Fecha y hora en formato string |

---

## 3. API REST — Endpoints

Todos los endpoints de la API retornan JSON. Los que requieren autenticación devuelven HTTP 401 si no hay sesión activa.

**Referencias de Auth:**
- `No` — endpoint público
- `Si` — requiere cualquier sesión activa
- `Biblio` — requiere rol `bibliotecario`
- `Admin` — requiere rol `admin`

### 3.1 Autenticación

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/login` | POST | No | Login con usuario y contraseña. Body: `{username, password}` |
| `/api/logout` | POST | Si | Cierra la sesión activa |
| `/api/session` | GET | No | Retorna estado de sesión y datos del usuario |
| `/api/registro` | POST | Biblio | Registra un nuevo alumno. Body: `{nombre, email, username, password}` |
| `/auth/google` | GET | No | Inicia flujo OAuth 2.0 con Google |
| `/auth/google/callback` | GET | No | Callback de Google OAuth, crea sesión |

### 3.2 Libros

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/libros` | GET | No | Lista libros con paginación. Params: `page`, `per_page`, `busqueda` |
| `/api/libros` | POST | Biblio | Agrega un libro. Body: `{titulo, autor, editorial, categoria, disponible}` |
| `/api/libros/:id` | DELETE | Biblio | Elimina un libro por ID |
| `/api/libros/:id/stock` | PUT | Biblio | Actualiza disponibilidad. Body: `{disponible}` |

### 3.3 Reservas

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/reservas` | POST | Si | Crea una reserva. Body: `{nombre, email, libro_id?}` |
| `/api/reservas` | GET | Biblio | Lista todas las reservas |
| `/api/reservas` | DELETE | Biblio | Elimina todo el historial de reservas |
| `/api/reservas/:id/prestar` | PUT | Biblio | Marca la reserva como prestado |
| `/api/reservas/:id/devolver` | PUT | Biblio | Marca la reserva como devuelto |
| `/api/mis-prestamos` | GET | Si | Lista préstamos del usuario logueado |

### 3.4 Reseñas

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/resenas` | GET | No | Lista todas las reseñas públicas |
| `/api/resenas` | POST | Si | Crea o actualiza la reseña del usuario. Body: `{estrellas, comentario}` |
| `/api/resenas/mia` | DELETE | Si | Elimina la reseña del usuario logueado |
| `/api/resenas/:id` | DELETE | Biblio | Elimina cualquier reseña por ID (solo bibliotecario) |

### 3.5 Chat e IA

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/chat` | POST | Si | Envía mensaje a la IA. Body: `{consulta}`. Retorna `{respuesta}` |
| `/api/chat/historial` | GET | Si | Lista sesiones de chat del usuario |
| `/api/chat/historial/:sesion_id` | GET | Si | Mensajes de una sesión específica |
| `/api/chat/guardar` | POST | Si | Guarda un mensaje en el historial |
| `/api/chat/renombrar` | PUT | Si | Renombra un chat. Body: `{sesion_id, nombre}` |
| `/api/chat/eliminar/:sesion_id` | DELETE | Si | Elimina todos los mensajes de una sesión |

### 3.6 Métricas y otros

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/api/metricas` | GET | Biblio | Retorna métricas del sistema y consultas recientes |
| `/api/metricas` | DELETE | Biblio | Borra el historial de consultas |
| `/api/avatar` | PUT | Si | Cambia el avatar. Body: `{avatar_id}` |
| `/api/usuarios` | GET | Biblio | Lista todos los usuarios registrados |
| `/api/admin/logs` | GET | Admin | Retorna logs de actividad del sistema |

---

## 4. Motor de Inteligencia Artificial

### 4.1 Arquitectura del motor

El motor de IA (`ai_engine.py`) procesa las consultas de los usuarios siguiendo este flujo:

1. **Normalización del texto:** se eliminan tildes y se convierte a minúsculas.
2. **Corrección ortográfica:** se usa `difflib` para encontrar palabras similares en el vocabulario de la base de datos.
3. **Detección de intención:** se clasifica la consulta en saludo, consulta genérica, búsqueda por categoría o búsqueda general.
4. **Búsqueda en DB:** se ejecuta la query correspondiente en PostgreSQL.
5. **Generación de respuesta:** se envía el contexto a Groq API para generar una respuesta natural.
6. **Fallback:** si Groq no está disponible, se retorna una respuesta generada localmente.

### 4.2 Integración con Groq

Se usa la API de Groq con el modelo `llama-3.1-8b-instant` para generar respuestas en lenguaje natural. El system prompt instruye al modelo a:

- Responder solo sobre temas de biblioteca y libros.
- Usar el contexto de libros encontrados en la DB para dar respuestas precisas.
- Agrupar los resultados por categoría.
- Entender consultas con errores ortográficos.

> **Nota:** La variable de entorno `GROQ_API_KEY` es requerida. Sin ella el sistema funciona con respuestas locales básicas.

### 4.3 Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de PostgreSQL (Supabase) |
| `SECRET_KEY` | Clave secreta para las sesiones Flask |
| `GROQ_API_KEY` | Clave de API de Groq para el modelo de IA |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth 2.0 |

---

## 5. Frontend

### 5.1 Sistema de variables CSS

Todos los colores y medidas del sistema están definidos como variables CSS en `:root` dentro de `style.css`:

```css
:root {
    --bg-body:      #0b1120;   /* Fondo principal */
    --bg-card:      #151e32;   /* Fondo de tarjetas */
    --bg-input:     #0f172a;   /* Fondo de inputs */
    --border:       #1e293b;   /* Color de bordes */
    --azul-claro:   #3b82f6;   /* Acento principal */
    --azul-marino:  #1e3a5f;   /* Acento secundario */
    --text-heading: #f1f5f9;   /* Color de títulos */
    --text-muted:   #64748b;   /* Texto secundario */
    --rojo:         #ef4444;   /* Alertas y peligro */
    --verde:        #22c55e;   /* Estados positivos */
    --radius:       14px;      /* Radio de bordes */
}
```

### 5.2 auth.js — Gestión de sesión

Este archivo maneja toda la lógica de sesión del lado del cliente:

| Función | Descripción |
|---------|-------------|
| `buildUserMenu(usuario)` | Construye el menú de perfil según el rol del usuario |
| `buildGuestMenu()` | Construye el menú para usuarios no autenticados |
| `updateNav(usuario)` | Muestra/oculta links del nav según el rol |
| `loadHistorial()` | Carga y renderiza el historial de chats en el dropdown |
| `renombrarChat(sesionId)` | Permite renombrar un chat con prompt del navegador |
| `eliminarChat(sesionId)` | Elimina un chat con confirmación |
| `updateChatLockBanner(loggedIn)` | Habilita o deshabilita el input del chat |

### 5.3 chat.js — Lógica del chat

Maneja el envío de mensajes al backend y el renderizado de respuestas:

- `sendMessage()`: envía la consulta a `POST /api/chat` y renderiza la respuesta.
- Muestra un indicador de escritura (typing indicator) mientras espera la respuesta.
- Guarda cada mensaje en el historial llamando a `window.guardarMensajeChat()`.
- Si el usuario no está logueado, abre el modal de login en lugar de enviar.

### 5.4 modal.js — Sistema de modales

Reemplaza los `confirm()` y `alert()` nativos del navegador con modales personalizados:

| Función | Descripción |
|---------|-------------|
| `window.modalConfirm(opciones)` | Modal de confirmación con dos botones. Retorna `Promise<boolean>` |
| `window.modalAlert(opciones)` | Modal informativo con un botón. Retorna `Promise<void>` |

**Opciones disponibles:**

```javascript
{
    titulo:  "Título del modal",
    mensaje: "Texto descriptivo",
    icono:   "🗑️",           // emoji
    peligro: true,            // botón confirmar en rojo
    btnOk:   "Confirmar",
    btnNo:   "Cancelar",
    tipo:    "success"        // success | error | info | warning (para modalAlert)
}
```

---

## 6. Progressive Web App (PWA)

El sistema está configurado como PWA para que los usuarios puedan instalarlo como aplicación nativa.

### 6.1 Componentes PWA

- **`manifest.json`:** define nombre, colores, orientación e ícono de la app.
- **`sw.js` (Service Worker):** cachea los archivos estáticos principales para funcionamiento offline.
- Los templates incluyen los meta tags necesarios para iOS y Android.

### 6.2 Estrategia de cache

El Service Worker usa una estrategia **Cache First con actualización en red**:

- Al instalar, cachea: `/`, `style.css`, `auth.js`, `chat.js`, `main.js`.
- Al recibir un request GET (que no sea de la API), retorna el cache si existe.
- En paralelo actualiza el cache con la versión de red.
- Los requests a `/api/` **nunca se cachean** para garantizar datos frescos.

---

## 7. Despliegue e infraestructura

### 7.1 Render

La aplicación está desplegada en Render en plan gratuito. El servicio se define con un `Procfile`:

```
web: gunicorn app:app
```

**Limitaciones del plan gratuito:**
- El servicio se duerme después de 15 minutos de inactividad.
- No tiene disco persistente (los archivos subidos se pierden en cada deploy).
- 750 horas de uso mensual incluidas.

### 7.2 Supabase

La base de datos PostgreSQL está hosteada en Supabase en plan gratuito:

- Hasta 500 MB de almacenamiento.
- Hasta 2 GB de transferencia mensual.
- Backups automáticos disponibles desde el panel.

> **Nota:** Los datos persisten independientemente de los deploys de Render porque la DB es externa.

### 7.3 Google OAuth

La autenticación con Google requiere credenciales configuradas en Google Cloud Console:

- **Tipo:** Aplicación web
- **Origen autorizado:** `https://biblioteca-ia-y3d4.onrender.com`
- **URI de redireccionamiento:** `https://biblioteca-ia-y3d4.onrender.com/auth/google/callback`
- Las credenciales se configuran como variables de entorno en Render.

### 7.4 Groq API

El modelo de IA usa Groq API de forma gratuita:

- **Modelo:** `llama-3.1-8b-instant`
- **Límite gratuito:** 6.000 tokens por minuto, 500.000 tokens por día.
- **Latencia:** típicamente menor a 1 segundo gracias a la inferencia en hardware especializado.

---

## 8. Consideraciones de seguridad

### 8.1 Autenticación y sesiones

- Las sesiones se manejan con Flask-Session firmadas con `SECRET_KEY`.
- Las contraseñas se hashean con bcrypt antes de almacenarse.
- El Google OAuth usa el flujo Authorization Code con PKCE via `google-auth-oauthlib`.
- Cada endpoint sensible usa el decorador `@login_required` o `@bibliotecario_required`.

### 8.2 Control de acceso por rol

| Rol | Acceso |
|-----|--------|
| Alumno | Chat, catálogo, checkin, reseñas, mis-préstamos |
| Bibliotecario | Todo lo anterior + dashboard, libros, registro, gestión de reservas |
| Admin | Acceso exclusivo a logs de actividad |

Los endpoints verifican el rol en `session['usuario']['rol']` antes de ejecutar.

### 8.3 Validaciones

- Las estrellas de reseñas se validan con `CHECK (estrellas BETWEEN 1 AND 5)` en la DB.
- El borrado de reseña propia verifica `usuario_id` O `email` para mayor seguridad.
- El borrado de reseña por ID verifica que el rol sea `bibliotecario` antes de ejecutar.

---

## 9. Mantenimiento y operaciones

### 9.1 Agregar libros

Para cargar libros masivamente desde Excel:

1. Preparar el Excel con columnas: `titulo`, `autor`, `editorial`, `categoria`, `disponible`.
2. Convertir a CSV (UTF-8).
3. En Supabase, ir a **Table Editor > libros > Import data from CSV**.
4. Verificar que las columnas coincidan antes de confirmar la importación.

> **Importante:** Antes de importar nuevos libros, borrar los registros existentes para evitar duplicados.

### 9.2 Ver logs del sistema

Los logs de actividad están disponibles para el rol `admin` en la sección `/logs`. Incluyen:

- Fecha y hora de cada acción
- Tipo de acción: login, registro, reserva, préstamo, devolución, etc.
- Usuario que realizó la acción

### 9.3 Monitoreo

Render provee logs en tiempo real desde el panel de control del servicio:

1. Ir a `render.com` → tu servicio → **Logs**.
2. Los prints del servidor aparecen ahí en tiempo real.

### 9.4 Deploy

Para desplegar una nueva versión:

1. Hacer push de los cambios a la rama `main` del repositorio de GitHub.
2. Render detecta el push automáticamente y ejecuta un nuevo deploy.
3. El deploy tarda entre 2 y 5 minutos en completarse.
4. Si hay errores, se pueden ver en los logs de Render.
