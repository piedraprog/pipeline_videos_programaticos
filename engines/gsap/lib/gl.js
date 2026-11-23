// Minimal WebGL2 painter for the canvas renderer: textured or flat rounded rectangles placed by a matrix,
// in premultiplied alpha, plus sample accumulation for motion blur. Stage units are CSS pixels of a
// 1920x1080 frame whatever the output size.

const VERTEX_SHADER = `#version 300 es
in vec2 aCorner;
uniform mat4 uMatrix;
uniform vec2 uOrigin, uSize;
out vec2 vLocal;
out vec2 vSpace;
void main() {
  vLocal = aCorner * uSize;
  vSpace = uOrigin + vLocal;
  gl_Position = uMatrix * vec4(vSpace, 0., 1.);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vSpace;
out vec4 outColor;
uniform int uKind;
uniform vec2 uSize;
uniform float uRadius, uAlpha, uSoft, uInset, uStroke;
uniform vec4 uColor, uColor2, uUv, uClip, uHole;
uniform float uClipRadius, uHoleRadius;
uniform vec4 uGlowColor[3];
uniform vec3 uGlow[3];
uniform sampler2D uTexture;

float roundedBox(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - radius;
}
float inside(float distance) { return 1. - smoothstep(-.75, .75, distance); }
// Fixed per-pixel noise: breaks the bands a smooth gradient shows in 8 bits and under video compression.
float grain(vec2 point) { return fract(sin(dot(floor(point * 2.), vec2(12.9898, 78.233))) * 43758.5453) - .5; }

void main() {
  vec2 inner = uSize - 2. * uInset;
  float distance = roundedBox(vLocal - uSize * .5, abs(inner) * .5, uRadius);
  float clip = uClip.z > 0. ? inside(roundedBox(vSpace - uClip.xy - uClip.zw * .5, uClip.zw * .5, uClipRadius)) : 1.;
  vec4 color;
  if (uKind == 0) {
    vec3 base = uColor.rgb;
    for (int i = 0; i < 3; i++) {
      float glow = (1. - clamp(length(vSpace - uGlow[i].xy) / uGlow[i].z, 0., 1.)) * uGlowColor[i].a;
      base = mix(base, uGlowColor[i].rgb, glow);
    }
    vec2 fromCenter = (vSpace - uSize * vec2(.5, .45)) / (uSize * vec2(.72, .78));
    float vignette = smoothstep(.52, 1., length(fromCenter)) * uColor2.a;
    color = vec4(mix(base, uColor2.rgb, vignette) + grain(vSpace) * (1.6 / 255.), 1.);
  } else if (uKind == 1) {
    vec2 uv = uUv.xy + ((vLocal - uInset) / inner) * uUv.zw;
    color = texture(uTexture, uv) * inside(distance);
  } else if (uKind == 2) {
    float shape = uStroke > 0. ? 1. - smoothstep(-.75, .75, abs(distance + uStroke * .5) - uStroke * .5) : (uSoft > 0. ? 1. - smoothstep(-uSoft, uSoft, distance) : inside(distance));
    color = vec4(uColor.rgb, 1.) * uColor.a * shape;
  } else {
    float hole = roundedBox(vSpace - uHole.xy - uHole.zw * .5, uHole.zw * .5, uHoleRadius);
    float dim = smoothstep(-.75, .75, hole) * uColor.a;
    float ring = 1. - smoothstep(-.75, .75, abs(hole - uStroke * .5) - uStroke * .5);
    color = mix(vec4(uColor.rgb, 1.) * dim, vec4(uColor2.rgb, 1.), ring) * inside(distance);
  }
  outColor = color * uAlpha * clip;
}`;

const KINDS = { backdrop: 0, image: 1, shape: 2, spotlight: 3 };

export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}
export const translate = (x, y) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, 0, 1]);
export const scale = (factor) => new Float32Array([factor, 0, 0, 0, 0, factor, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function rotateX(degrees) {
  const c = Math.cos((degrees * Math.PI) / 180);
  const s = Math.sin((degrees * Math.PI) / 180);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
export function rotateY(degrees) {
  const c = Math.cos((degrees * Math.PI) / 180);
  const s = Math.sin((degrees * Math.PI) / 180);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
export const compose = (...matrices) => matrices.reduce(multiply);

function compileProgram(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'aCorner');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

export function createPainter(canvas, { width, height, perspective }) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available in this browser');
  const program = compileProgram(gl);
  gl.useProgram(program);
  const uniform = (name) => gl.getUniformLocation(program, name);
  const names = ['uMatrix', 'uOrigin', 'uSize', 'uKind', 'uRadius', 'uAlpha', 'uSoft', 'uInset', 'uStroke', 'uColor', 'uColor2', 'uUv', 'uClip', 'uClipRadius', 'uHole', 'uHoleRadius', 'uGlowColor', 'uGlow'];
  const at = Object.fromEntries(names.map((name) => [name, uniform(name)]));
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');

  // Stage pixels to clip space, with CSS-style perspective around the frame center.
  const toClip = new Float32Array([2 / width, 0, 0, 0, 0, -2 / height, 0, 0, 0, 0, -1 / 8000, 0, -1, 1, 0, 1]);
  const lens = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / perspective, 0, 0, 0, 1]);
  const screen = toClip;

  // Accumulation target: blurred frames are the average of several samples of the scene.
  const sampleTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sampleTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const sampleTarget = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTarget);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sampleTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let placeholder = null;

  function draw(matrix, rect, material) {
    gl.uniformMatrix4fv(at.uMatrix, false, matrix);
    gl.uniform2f(at.uOrigin, rect.x, rect.y);
    gl.uniform2f(at.uSize, rect.width, rect.height);
    gl.uniform1i(at.uKind, KINDS[material.kind]);
    gl.uniform1f(at.uRadius, material.radius ?? 0);
    gl.uniform1f(at.uAlpha, material.alpha ?? 1);
    gl.uniform1f(at.uSoft, material.soft ?? 0);
    gl.uniform1f(at.uInset, material.inset ?? 0);
    gl.uniform1f(at.uStroke, material.stroke ?? 0);
    gl.uniform4fv(at.uColor, material.color ?? [0, 0, 0, 1]);
    gl.uniform4fv(at.uColor2, material.color2 ?? [0, 0, 0, 0]);
    gl.uniform4fv(at.uUv, material.uv ?? [0, 0, 1, 1]);
    const clip = material.clip;
    gl.uniform4f(at.uClip, clip?.x ?? 0, clip?.y ?? 0, clip?.width ?? 0, clip?.height ?? 0);
    gl.uniform1f(at.uClipRadius, clip?.radius ?? 0);
    const hole = material.hole;
    gl.uniform4f(at.uHole, hole?.x ?? 0, hole?.y ?? 0, hole?.width ?? 0, hole?.height ?? 0);
    gl.uniform1f(at.uHoleRadius, hole?.radius ?? 0);
    if (material.glows) {
      gl.uniform4fv(at.uGlowColor, material.glows.flatMap((glow) => glow.color));
      gl.uniform3fv(at.uGlow, material.glows.flatMap((glow) => [glow.x, glow.y, glow.radius]));
    }
    // A texture must always be bound, and never the one being rendered into.
    gl.bindTexture(gl.TEXTURE_2D, material.texture ?? placeholder);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function texture(source, { mipmap = true } = {}) {
    const created = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, created);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return created;
  }
  placeholder = texture(new ImageData(1, 1), { mipmap: false });

  return {
    screen,
    draw,
    texture,
    // World matrix for a camera pose: what CSS does with perspective + rotate + scale + translate.
    camera(pose) {
      return compose(toClip, translate(width / 2, height / 2), lens, rotateX(pose.tiltX), rotateY(pose.tiltY), scale(pose.zoom), translate(-pose.x, -pose.y));
    },
    // Where a world point lands on the frame, to place things that keep their screen size.
    project(matrix, x, y) {
      const w = matrix[3] * x + matrix[7] * y + matrix[15];
      return { x: ((matrix[0] * x + matrix[4] * y + matrix[12]) / w + 1) * (width / 2), y: (1 - (matrix[1] * x + matrix[5] * y + matrix[13]) / w) * (height / 2) };
    },
    blend(enabled) {
      if (enabled) gl.enable(gl.BLEND);
      else gl.disable(gl.BLEND);
    },
    // Draws one frame as the average of `times.length` samples of `drawScene`.
    frame(times, drawScene) {
      if (times.length === 1) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        drawScene(times[0]);
        return;
      }
      times.forEach((time, index) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, sampleTarget);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        drawScene(time);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (index === 0) {
          gl.disable(gl.BLEND);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.enable(gl.BLEND);
        gl.blendColor(0, 0, 0, 1 / times.length);
        gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE);
        // The sample was rendered upside down relative to the canvas: a negative height flips it back.
        draw(screen, { x: 0, y: height, width, height: -height }, { kind: 'image', texture: sampleTexture });
      });
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    },
    finish: () => gl.finish(),
  };
}
