# Cómo crear tus videos

## 1\. Entiende las cuatro piezas

| Pieza                            | Para qué sirve                                                     |
| -------------------------------- | ------------------------------------------------------------------ |
| **Web o pantallas del producto** | Proporcionan el contenido que verá el espectador.                  |
| **Plan JSON**                    | Define acciones del navegador, capturas y duración de las escenas. |
| **Guion y storyboard**           | Definen qué comunicar y en qué orden.                              |
| **Composición animada**          | Controla teléfono, textos, fondos, formas y transiciones.          |

**La página NO es el video: es una fuente de contenido.**

Por ejemplo, puedes usar las mismas pantallas de una app para producir un lanzamiento, una explicación de una función y una pieza comercial. Cambian el mensaje y la composición; no necesariamente la web.

### ¿Cuándo necesitas una página?

- **El producto ya existe como web:** usamos su URL.
- **Todavía no existe:** podemos crear pantallas de demostración en HTML.
- **Quieres una interfaz simplificada para publicidad:** podemos reconstruir solamente las pantallas necesarias, dejando claro que son una demo.

No necesitas poner la animación publicitaria dentro del HTML. **La captura toma imágenes de estados concretos; Remotion añade el movimiento después.** No está grabando continuamente la interacción.

## 2\. Define el mensaje antes del movimiento

Un brief profesional empieza con:

> **Para quién es, qué debe entender y qué debe hacer al terminar.**

Ejemplo:

> Presentar una app de organización a profesionales independientes. Mostrar que permite convertir pendientes en un plan claro. Terminar invitando a probarla.

Eso decide qué pantallas necesitamos. “Que se vea moderno” no decide nada todavía.

Para un lanzamiento corto, una estructura útil es:

**Gancho → presentación → beneficio demostrado → cierre.**

## 3\. Pasa referencias, pero indica QUÉ tomar

Sí, puedes pasar enlaces, videos adjuntos o capturas. Lo importante es acompañarlos con anotaciones.

**Poco útil:**

> Hazlo como Apple, elegante y dinámico.

**Útil:**

> De esta referencia quiero la entrada del dispositivo entre 00:03 y 00:05. De la segunda, la tipografía grande y el espacio vacío. No quiero copiar los colores ni las ilustraciones. El producto debe quedar quieto mientras se lee.

Con dos o tres referencias bien explicadas suele ser suficiente. Para cada una indica:

- **Fragmento:** timestamp o imagen.
- **Qué tomar:** composición, tipografía, entrada, ritmo o transición.
- **Qué evitar:** elementos que no encajan con tu marca.

### Referencias para estudiar

| Referencia                                                                                                        | Para qué utilizarla                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [Webflow — A New Era of No-Code, Ordinary Folk](https://www.ordinaryfolk.co/project/webflow-a-new-era-of-no-code) | Estudiar cómo presentar software combinando identidad visual, formas y beneficios.                                                        |
| [Introducing Spline, Ordinary Folk](https://www.ordinaryfolk.co/project/introducing-spline)                       | Referencia de lanzamiento con una dirección visual basada en profundidad y 3D. **Su ejecución supera las capacidades actuales del JSON.** |
| [Procreate Dreams, Ordinary Folk](https://www.ordinaryfolk.co/project/procreate-dreams)                           | Entender que un lanzamiento puede comunicar una idea creativa, no solamente recorrer pantallas.                                           |

Las páginas incluyen información del proyecto y material de proceso; no estoy atribuyéndoles timings que no haya comprobado.

## 4\. Convierte la idea en un storyboard

Antes de programar, escribe una tabla como esta. Es una **propuesta creativa**, no un plan ejecutable:

| Tiempo  | Qué aparece                   | Qué comunica              | Movimiento                               |
| ------- | ----------------------------- | ------------------------- | ---------------------------------------- |
| 0–1 s   | Marca sola                    | Presentación              | Aparición breve y pausa                  |
| 1–3 s   | Teléfono con pantalla inicial | Introducción del producto | Entrada desde profundidad y asentamiento |
| 3–6 s   | Pantalla principal + titular  | Beneficio central         | Titular entra después; teléfono quieto   |
| 6–10 s  | Segundo estado del producto   | Demostración              | Transición entre capturas                |
| 10–13 s | Producto + CTA                | Siguiente acción          | Cierre estable para leer                 |

**No todo debe moverse a la vez.** Fondo, dispositivo y textos pueden tener entradas independientes.

Después conviene aprobar tres o cuatro **styleframes**: imágenes estáticas que muestran cómo deberían verse los momentos principales. Así validamos composición y legibilidad antes de invertir en animación. Esa separación entre mensaje, diseño y animación también aparece en el [proceso de Ordinary Folk](https://www.ordinaryfolk.co/process).

## 5\. Describe el movimiento de forma concreta

Para cada elemento, explica:

> **Desde dónde entra → cuánto tarda → cómo se detiene → cuánto permanece → cómo sale.**

Ejemplo:

> El logo permanece solo durante 0,8 segundos. El teléfono entra desde profundidad durante 0,6 segundos y se detiene suavemente. El titular aparece 0,2 segundos después. Ambos permanecen quietos durante 2,5 segundos. El fondo tiene movimiento independiente y sutil.

Esto es mucho más preciso que “ponle animaciones fluidas”.

En Remotion, la animación debe depender del fotograma para producir renders reproducibles; su documentación explica [cómo animar propiedades](https://www.remotion.dev/docs/animating-properties).

## 6\. Distingue configuración de desarrollo nuevo

**Con el proyecto actual puedes configurar:**

- Videos verticales de **1080 × 1920**, hasta 60 fps.
- Capturas de una web dentro de un teléfono.
- Textos, marca escrita, fondos y formas sencillas.
- Capas independientes con posición, escala, opacidad y rotación.
- Profundidad visual **2\.5D**, no 3D real.

**Necesita ampliar el código:**

- Videos solamente de tipografía o gráficos, sin teléfono.
- Logos SVG o imágenes como capas.
- Varios dispositivos.
- Animación independiente de componentes dentro de una captura.
- Personajes, morphing complejo o 3D real.
- Grabación continua de una app o captura nativa móvil.

La diferencia importa: **una referencia puede orientar el diseño, pero no convierte automáticamente sus efectos en capacidades disponibles.**

## 7\. Producción y revisión

El ejemplo actual para empezar es `plans/studio-store.json`.

Una vez creado un plan válido:

```
bun run capture -- plans/my-demo.json
bun run render -- my-demo
```

El resultado se genera en:

```
projects/my-demo/
├── plan.json
├── manifest.json
├── assets/
└── output.mp4
```

Primero hay que revisar las capturas: contenido correcto, datos cargados y estados esperados. Después revisar el video: entrada, escenas asentadas, transiciones y cierre.

Los cambios únicamente visuales pueden iterarse sin recapturar. Si cambian acciones, pantallas, fps o duración de escenas, hay que volver a capturar.

# Brief que puedes pasarme

Completa esto en lenguaje natural; **no necesitas escribir JSON**:

> **Producto:**  
> **Público:**  
> **Objetivo y mensaje principal:**  
> **Duración:**  
> **URL o pantallas disponibles:**  
> **Marca:** colores, tipografías y logo.  
> **Idioma de los textos:**  
> **Historia:** qué aparece al inicio, qué demostramos y cómo cerramos.  
> **Referencias:** enlace + fragmento + qué tomar de cada una.  
> **Movimiento:** entradas, pausas y salidas deseadas.  
> **Evitar:**  
> **CTA final:**

**Tu punto de partida es ese brief y las referencias, no construir páginas.** Luego se determina qué puede resolverse con el plan actual y qué necesita una composición nueva.
