# Tutorial: videos de producto con este repositorio

Esta guía explica cómo funciona el pipeline, cómo trabaja un agente de IA dentro del repositorio, cómo se configura y cómo se hace un video de principio a fin, incluida la narración con ElevenLabs. Las reglas detalladas para agentes están en [AGENTS.md](AGENTS.md); aquí está el recorrido para una persona.

Los ejemplos usan FORM, una tienda ficticia que viene en el repositorio, así que todo lo que aparece aquí se puede ejecutar tal cual.

## 1. Cómo funciona

Un video sale de un archivo JSON, el **plan**, y de capturas reales de tu aplicación. Nadie edita en una línea de tiempo.

```text
tu app web ──captura──▶ pantallas PNG + posiciones de sus elementos (boxes)
                                   │
plan JSON (escenas, cámara, cursor, textos, narración) ──┐
kit de marca (logo, colores, fuente) ────────────────────┤
                                                         ▼
                 renderizador canvas: dibuja con WebGL y codifica H.264 en el navegador
                                   │   un clip por escena, guardado en caché
                                   ▼
                    <nombre>.mp4  (imagen + música)
                                   │
            narración por escena (ElevenLabs u OpenAI) + música atenuada
                                   ▼
                    <nombre>-voz-<proveedor>.mp4
```

Tres ideas sostienen todo lo demás:

- **Las pantallas son imágenes.** La captura fotografía estados concretos de la app y anota dónde está cada elemento. El movimiento (cámara, cursor, foco) se agrega después.
- **Cada escena es un clip independiente.** El video final se arma pegando clips sin recodificar. Si cambias una escena, se rehace esa escena.
- **El audio va aparte.** Cambiar la narración, la música o el volumen nunca vuelve a renderizar la imagen.

## 2. Instalación

Necesitas Bun 1.3 o superior, Node.js 24 o superior, Python 3.10 o superior y Google Chrome.

```bash
git clone https://github.com/piedraprog/pipeline_videos_programaticos.git
cd pipeline_videos_programaticos
bun run setup
```

`bun run setup` instala las dependencias, Chromium para la captura, comprueba ffmpeg, instala los paquetes de Python y activa los hooks de privacidad. Si algo falta, lo dice con la palabra `FAIL`.

Comprueba que funciona con el ejemplo:

```bash
bun run render -- plans/form-product-demo.json
```

El resultado queda en `projects/form-product-demo/form-product-demo.mp4`.

Una tarjeta gráfica no es obligatoria, pero cambia la velocidad: con codificador de video por hardware, un video de 86 segundos en 1080p se renderizó en unos 28 segundos en una laptop con una NVIDIA RTX 3050 Ti. Sin GPU el pipeline funciona con un codificador por software; esa ruta solo se midió en un prototipo.

## 3. Cómo trabaja un agente de IA en el repositorio

El agente no se "conecta" a un servicio: trabaja sobre la copia local del repositorio, lee sus instrucciones y ejecuta los mismos comandos que ejecutarías tú.

### Qué lee al empezar

- **`CLAUDE.md`**: Claude Code lo carga solo al abrir el repositorio. Importa `AGENTS.md`, así que hay una sola fuente de reglas.
- **`AGENTS.md`**: lo leen los agentes que siguen esa convención. Empieza con "Working format", los nueve pasos para hacer un video, y sigue con el detalle de cada herramienta.

### Cómo abrirlo

- **Dentro del repositorio:** abre una sesión del agente en la carpeta del repositorio y pídele el video.
- **Desde otro proyecto:** si estás trabajando en el repositorio de tu aplicación y quieres un video de ella, dale al agente la ruta de este repositorio. En Claude Code puedes sumarlo como carpeta de trabajo adicional con `claude --add-dir <ruta>` o con `/add-dir` dentro de la sesión.

### Qué pedirle

Un buen encargo dice para quién es el video, qué debe entender esa persona y de dónde salen las pantallas. Por ejemplo:

> Haz un video de avance de 60 a 90 segundos de la aplicación que corre en `http://localhost:3000`. Muestra usuarios, cargas y reglas. Que ninguna pantalla salga vacía. Narración en español con la voz que ya está en el plan.

### Qué puede y qué no puede hacer

- **Sí:** capturar pantallas, escribir el plan, renderizar, generar la narración, revisar fotogramas y medir duraciones y niveles de audio.
- **No:** ver el video en movimiento ni escuchar el audio. El ritmo, el tono de la voz y la pronunciación los tienes que juzgar tú.
- **Con tu permiso:** levantar tu aplicación, crear datos de prueba o tocar una base de datos. No lo hace por su cuenta.

### Qué no debes darle por el chat

Las claves de API. Se guardan en el archivo `.env` (sección 4) y el agente las usa desde ahí sin verlas en la conversación.

## 4. Configuración

### Claves de API

Solo hacen falta para la narración.

```bash
cp .env.example .env
```

Abre `.env` y pega la clave del proveedor que uses:

```
ELEVENLABS_API_KEY=
OPENAI_API_KEY=
```

Git ignora `.env`, y el control de privacidad rechaza un commit que contenga claves con formato conocido.

### Trabajo privado

Este repositorio es público. Todo lo de un cliente o de un producto sin publicar va en la carpeta `private/`, que git ignora y que tiene la misma estructura que la parte pública:

```
private/brands/<cliente>/brand.json     kit de marca, logo, fuente, capturas
private/plans/<nombre>.json             el plan del video
private/projects/<nombre>/              los videos y la caché de clips
private/music/                          pistas de música
```

Para que el control de privacidad también bloquee nombres concretos, lista los que nunca deben aparecer en el repositorio:

```bash
cp .private-terms.example .private-terms
```

Escribe un término por línea (nombre del cliente, nombre interno del proyecto, dominios). Ese archivo tampoco se sube.

El control corre en cada commit y en cada push. Rechaza marcas que no estén declaradas como públicas, imágenes fuera de las carpetas públicas, teléfonos y correos reales, rutas con tu usuario y cualquier término de tu lista.

## 5. Hacer un video, paso a paso

### Paso 1: el kit de marca

Un archivo `brand.json` con el logo, la paleta y la fuente. El ejemplo es `brands/form/brand.json`:

```json
{
  "name": "FORM",
  "logo": { "text": "FORM" },
  "palette": { "forest": "#1c3b33", "paper": "#f5f0e6", "lime": "#d6fb54" },
  "fonts": { "ui": { "family": "Manrope", "src": "demos/studio-store/fonts/manrope.ttf" } },
  "demoColors": { "bg": "@paper", "glows": ["@lime"], "text": "@forest", "accent": "@forest" },
  "messaging": { "forbidden": [] }
}
```

- `logo` puede ser texto, o imágenes con `"full": { "onLight": "...", "onDark": "..." }`.
- `demoColors` viste el estilo con los colores de la marca; `"@forest"` lee `palette.forest`. Si la marca usa más de un estilo, se agrupa por nombre de estilo.
- `messaging.forbidden` lista palabras que el video no puede decir ni mostrar; el render falla si aparecen.

### Paso 2: capturar las pantallas

La captura abre tu app en un navegador real, ejecuta acciones y toma una foto por escena. El modelo es `plans/form-desktop-capture.json`:

```json
{
  "projectName": "form-desktop-capture",
  "baseUrl": "../demos/studio-store/index.html",
  "viewport": { "width": 1440, "height": 900 },
  "scenes": [
    { "id": "catalog", "durationFrames": 60, "actions": [
      { "type": "waitFor", "selector": "#catalog", "text": "Arc headphones" },
      { "type": "screenshot", "boxes": { "product": "[data-product=\"arc-headphones\"]" } } ] }
  ]
}
```

```bash
bun run capture -- plans/form-desktop-capture.json
```

- `boxes` le pone nombre a los elementos que el video va a señalar. La captura guarda su posición en un archivo `*.boxes.json` junto a cada PNG.
- Usa `waitFor` con el texto real que debe aparecer. Una pantalla capturada a medio cargar sale vacía o con contadores a mitad de camino.
- Las acciones disponibles son `navigate`, `click`, `waitFor`, `scroll`, `scrollTo`, `fill`, `press`, `hover`, `css` y `screenshot`. La lista exacta está en `src/schema.ts`.
- El resultado queda en `projects/<projectName>/assets/`. Copia los PNG y los `*.boxes.json` a la carpeta `shots/` de tu kit de marca.

### Paso 3: escribir el plan

El plan describe el video escena por escena. Este es el esqueleto de `plans/form-product-demo.json`:

```json
{
  "engine": "gsap",
  "template": "demo",
  "renderer": "canvas",
  "brand": "brands/form/brand.json",
  "style": "soft-depth",
  "format": "16x9",
  "fps": 240, "outFps": 30, "shutter": 180,
  "audio": "music",
  "output": "projects/form-product-demo",
  "story": {
    "intro": { "kicker": "Fictional demo store", "title": "Everyday objects, considered.", "duration": 3.4 },
    "screens": [
      { "id": "catalog", "image": "brands/form/shots/catalog.png", "boxes": "brands/form/shots/catalog.boxes.json", "url": "form.example/" }
    ],
    "beats": [
      { "screen": "catalog", "duration": 5.2, "title": "A catalog that stays in stock",
        "camera": [ { "at": 0.2, "focus": "full" }, { "at": 2.3, "focus": "product", "fill": 0.72, "tilt": [3, -5] } ],
        "cursor": [ { "at": 3.9, "to": "product", "click": true } ] }
    ],
    "outro": { "title": "Less, but better.", "duration": 3.6 }
  }
}
```

Lo esencial de cada escena (`beat`), con tiempos en segundos desde que empieza:

| Campo | Qué hace |
|---|---|
| `screen`, `duration` | Qué pantalla se ve y cuánto dura la escena |
| `title` | El rótulo. Con narración, que sea corto |
| `camera` | A qué elemento mira la cámara (`focus`), cuánto del cuadro ocupa (`fill`) y con qué inclinación (`tilt`) |
| `cursor` | Hacia qué elemento va el cursor y si hace clic |
| `highlight` | Qué elemento se ilumina mientras el resto se atenúa, con etiqueta opcional |
| `say` | La frase de narración de esa escena |

Reglas que evitan los problemas más comunes:

- Primero se mueve la cámara, después entra el rótulo, después el cursor. No todo a la vez.
- Como máximo dos movimientos de cámara por escena, con al menos 1,2 segundos de pausa después de cada uno.
- Termina una escena con un clic y cambia de pantalla en la siguiente, para que el cambio tenga una causa.
- `"style": "soft-depth"` es el fondo claro y `"deep-brand"` el oscuro, que da más contraste a una interfaz clara.

### Paso 4: revisar antes de renderizar

```bash
bun run render -- plans/form-product-demo.json --qa-only
```

Genera una imagen por escena y una hoja de contactos en `projects/<nombre>/contact-sheet.png`. Ábrela: ahí se ve si el encuadre es el esperado, si un texto no cabe o si una pantalla salió vacía. Tarda un par de segundos.

### Paso 5: renderizar

```bash
bun run render -- plans/form-product-demo.json
```

Escribe `<nombre>.mp4` con imagen y música. Si el plan no dice `"renderer": "canvas"`, agrégalo o pasa `--renderer=canvas`.

Mientras se escribe, el archivo se llama `.partial.mp4` y cambia de nombre al terminar. Un `.mp4` con el nombre final siempre está completo.

## 6. Narración con ElevenLabs

La voz sintética sirve como borrador para revisar internamente. La narración de una pieza que se entrega la graba una persona.

### Preparar la cuenta

1. Crea una cuenta en ElevenLabs y una clave en `elevenlabs.io/app/api/api-keys`.
2. Pégala en `.env` como `ELEVENLABS_API_KEY`.
3. Elige una voz. En el plan gratuito la API solo permite las voces predeterminadas, que son de hablantes de inglés; leen español, pero con acento. Las voces en español de la biblioteca (`elevenlabs.io/app/voice-library`) requieren un plan de pago.
4. Agrega la voz que elijas a "My Voices" y copia su identificador desde el menú de la voz ("Copy voice ID").

Para ver las voces disponibles en tu cuenta con su identificador:

```bash
bun run voice -- --list-voices
```

### Agregar la narración al plan

Una frase `say` por escena y un bloque `voice`:

```json
"story": {
  "intro": { "title": "...", "duration": 4.3, "say": "Así se verifica una quincena." },
  "beats": [ { "screen": "catalog", "duration": 6.6, "say": "El catálogo muestra qué hay disponible ahora." } ],
  "outro": { "title": "...", "duration": 9, "say": "Hasta aquí el recorrido.", "sayAt": 1.2 }
},
"voice": {
  "provider": "elevenlabs",
  "elevenlabs": { "voiceId": "<identificador>", "model": "eleven_multilingual_v2", "settings": { "speed": 1.1 } },
  "pronounce": { "SAP": "sap" },
  "musicVolume": 0.9
}
```

- `say` empieza 0,4 segundos después del inicio de su escena. Una frase puede seguir sonando sobre las escenas siguientes si estas no tienen `say`.
- `sayAt` retrasa la frase dentro de su escena. En el cierre conviene que la voz entre cuando el título ya apareció.
- `pronounce` cambia cómo se dice una palabra sin cambiar cómo se escribe en pantalla. Sirve para que una sigla se lea como palabra en vez de deletrearse.
- `settings.speed` acelera o frena una voz que habla más lento o más rápido que el ritmo del video.
- `musicVolume` es el nivel de la música bajo la voz (0,75 si no lo indicas).

### Comprobar que cabe, y generar

```bash
bun run render -- <plan>.json --qa-only     # calcula los tiempos de las escenas
bun run voice -- <plan>.json --check        # sintetiza las frases y dice si cada una cabe
bun run render -- <plan>.json               # la imagen
bun run voice -- <plan>.json                # la voz sobre la imagen
```

`--check` falla si una frase sigue sonando cuando empieza la siguiente escena narrada, o si la última frase termina a menos de 2,5 segundos del final. Te dice qué escena y por cuánto: acorta la frase o alarga la escena.

El resultado es `<nombre>-voz-elevenlabs.mp4`, más un archivo `marcas-de-tiempo.txt` con el inicio y el fin de cada frase, útil si después grabas la voz tú.

Cada frase se guarda en caché. Volver a ejecutar el comando solo consume créditos de las frases cuyo texto o voz cambiaron.

### OpenAI como alternativa

Con `OPENAI_API_KEY` en `.env` y `--provider=openai`, el mismo guion se genera con OpenAI. El bloque es `"openai": { "voiceId": "cedar", "instructions": "Español latinoamericano neutro, tono sereno." }`. La API de OpenAI se factura aparte de una suscripción de ChatGPT, y su política pide avisar a quien escucha que la voz es de IA. Esta ruta está implementada pero no se probó con una clave real.

## 7. Música

- **Pista propia:** `"musicFile": "private/music/<archivo>.mp3"` en el plan. Si la pista es más corta que el video, se repite con un fundido; al final se apaga en 2,5 segundos. Comprueba la licencia de la pista antes de mostrar el video fuera de tu equipo.
- **Música sintetizada:** sin `musicFile`, el pipeline genera una base según `"music"`: `executive` (sobria, sin acentos en los cambios de escena), `corporate`, `minimal`, `cinematic`, `punchy` o `playful`.
- **Sin música:** `"audio": "none"`.

## 8. Cambiar algo sin empezar de cero

| Cambias | Qué se vuelve a ejecutar | Comando |
|---|---|---|
| Texto de la narración, voz, pronunciación, música o volumen | Solo el audio | `bun run voice` |
| Texto, cámara, cursor o foco de una escena | El clip de esa escena | `bun run render` y luego `bun run voice` |
| La duración de una escena | Ese clip y los siguientes | `bun run render` y luego `bun run voice` |
| Colores de la marca, estilo o una captura | Todos los clips | `bun run render` y luego `bun run voice` |

Los clips viven en `<salida>/clip-cache/`. `--fresh` los ignora y renderiza todo de nuevo.

Como referencia, medido en una laptop con GPU: un video de 86 segundos en 1080p tardó 28 segundos completo con narración, y cambiar el subtítulo del cierre rehízo 1 de 13 clips en 2,6 segundos.

## 9. Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| El video no se reproduce | Lo abriste mientras se escribía. Espera a que desaparezca el `.partial.mp4` |
| "Screen X has no box Y" | El plan nombra un elemento que la captura no registró. Agrégalo a `boxes` y vuelve a capturar |
| Una pantalla sale vacía o con números a medias | La captura no esperó al contenido. Agrega un `waitFor` con el texto final |
| "These lines run into the next narrated scene" | La frase es más larga que su escena. Acórtala, sube `speed` o alarga la escena |
| "ELEVENLABS_API_KEY is not set" | Falta el archivo `.env` o la clave está vacía |
| La voz deletrea una sigla | Agrégala a `voice.pronounce` |
| La voz suena con acento extranjero | Es una voz predeterminada en inglés. Usa una voz en español de la biblioteca |
| La ventana se ve pequeña o hacia un lado | El elemento enfocado es muy alto o está en un borde. Enfoca un rectángulo más ancho, en píxeles de la página capturada: `"focus": { "x": ..., "y": ..., "width": ..., "height": ... }` |
| `privacy-check` bloquea el commit | Hay material privado en una carpeta pública. Muévelo a `private/` o usa un valor de ejemplo |

## 10. Referencia rápida

```bash
bun run setup                                   # instala todo y activa los hooks
bun run capture -- <plan-de-captura>.json       # pantallas PNG + boxes
bun run render -- <plan>.json --qa-only         # hoja de contactos, sin video
bun run render -- <plan>.json                   # <nombre>.mp4
bun run render -- <plan>.json --fresh           # ignora la caché de clips
bun run voice -- --list-voices                  # voces de tu cuenta de ElevenLabs
bun run voice -- <plan>.json --check            # ¿cabe la narración?
bun run voice -- <plan>.json                    # <nombre>-voz-<proveedor>.mp4
bun run voice -- <plan>.json --provider=openai  # misma narración con OpenAI
bun run privacy-check -- --all                  # revisa todo lo que está en git
bun test                                        # pruebas del pipeline
```

Opciones del plan que afectan el archivo final:

| Campo | Efecto |
|---|---|
| `"outputHeight": 720` | Renderiza en 1280×720 en vez de 1920×1080 |
| `"videoQuantizer": 22` | Calidad con codificador por hardware. Más bajo es más nítido y más pesado |
| `"videoBitrate"` | Bitrate cuando no hay codificador por hardware |
| `"shutter": 180` con `"fps": 240` | Motion blur en los fotogramas con movimiento. Sin `shutter` no hay blur |
