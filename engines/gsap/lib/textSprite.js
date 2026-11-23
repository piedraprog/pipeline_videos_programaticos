// Text for the canvas renderer: laid out and painted once on a 2D canvas, then drawn as a texture.
// Sizes are stage pixels; the bitmap is rendered larger so the camera can zoom without softening it.
const BITMAP_SCALE = 2;
const FONT_FAMILY = 'Demo';

function wrap(widths, spaceWidth, maxWidth) {
  const lines = [[]];
  let lineWidth = 0;
  widths.forEach((width, index) => {
    const needed = lines.at(-1).length ? lineWidth + spaceWidth + width : width;
    if (lines.at(-1).length && needed > maxWidth) {
      lines.push([index]);
      lineWidth = width;
    } else {
      lines.at(-1).push(index);
      lineWidth = needed;
    }
  });
  return lines;
}

// Same number of lines, but as even as they can be: no orphan word on the last one.
function balance(widths, spaceWidth, maxWidth) {
  const target = wrap(widths, spaceWidth, maxWidth).length;
  let low = Math.max(...widths);
  let high = maxWidth;
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    if (wrap(widths, spaceWidth, middle).length <= target) high = middle;
    else low = middle;
  }
  return wrap(widths, spaceWidth, high);
}

export function layoutText(context, text, { size, weight = 400, tracking = 0, lineHeight = 1.2, maxWidth = Infinity, align = 'left', balanced = false, uppercase = false }) {
  const words = (uppercase ? text.toUpperCase() : text).trim().split(/\s+/);
  context.font = `${weight} ${size}px ${FONT_FAMILY}`;
  context.letterSpacing = `${tracking * size}px`;
  const widths = words.map((word) => context.measureText(word).width);
  const spaceWidth = context.measureText(' ').width;
  const lines = balanced ? balance(widths, spaceWidth, maxWidth) : wrap(widths, spaceWidth, maxWidth);
  const lineWidths = lines.map((line) => line.reduce((sum, index) => sum + widths[index], 0) + spaceWidth * (line.length - 1));
  const width = Math.max(...lineWidths);
  const lineSize = size * lineHeight;
  const placed = [];
  lines.forEach((line, lineIndex) => {
    let x = align === 'center' ? (width - lineWidths[lineIndex]) / 2 : 0;
    for (const index of line) {
      placed[index] = { text: words[index], x, y: lineIndex * lineSize, width: widths[index], height: lineSize };
      x += widths[index] + spaceWidth;
    }
  });
  return { words: placed, width, height: lines.length * lineSize, lineSize, overflows: Math.max(...widths) > maxWidth };
}

// `painter.texture` uploads the bitmap. The returned sprite keeps the layout so words can be drawn one by one.
export function createTextSprite(painter, text, style) {
  const margin = Math.ceil(style.size * 0.4);
  const measure = new OffscreenCanvas(8, 8).getContext('2d');
  const layout = layoutText(measure, text, style);
  const canvas = new OffscreenCanvas(Math.ceil((layout.width + margin * 2) * BITMAP_SCALE), Math.ceil((layout.height + margin * 2) * BITMAP_SCALE));
  const context = canvas.getContext('2d');
  context.scale(BITMAP_SCALE, BITMAP_SCALE);
  context.font = `${style.weight ?? 400} ${style.size}px ${FONT_FAMILY}`;
  context.letterSpacing = `${(style.tracking ?? 0) * style.size}px`;
  context.fillStyle = style.color;
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText('Hg');
  const baseline = (layout.lineSize + metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
  for (const word of layout.words) context.fillText(word.text, margin + word.x, margin + word.y + baseline);
  return { ...layout, margin, size: style.size, texture: painter.texture(canvas), bitmapWidth: canvas.width / BITMAP_SCALE, bitmapHeight: canvas.height / BITMAP_SCALE };
}

// The whole block, with its top-left text corner at (x, y).
export function drawText(painter, matrix, sprite, x, y, alpha = 1) {
  if (alpha <= 0) return;
  painter.draw(matrix, { x: x - sprite.margin, y: y - sprite.margin, width: sprite.bitmapWidth, height: sprite.bitmapHeight }, { kind: 'image', texture: sprite.texture, alpha });
}

// Each word rises from behind a mask on its own line; `offsets` are percentages of the line height.
export function drawWords(painter, matrix, sprite, x, y, offsets, alpha = 1) {
  if (alpha <= 0) return;
  const side = sprite.size * 0.08;
  const above = sprite.size * 0.14;
  const below = sprite.size * 0.2;
  sprite.words.forEach((word, index) => {
    const offset = (offsets[index] / 100) * word.height;
    if (Math.abs(offset) >= word.height + above + below) return;
    const rect = { x: x + word.x - side, y: y + word.y - above + offset, width: word.width + side * 2, height: word.height + above + below };
    const uv = [(sprite.margin + word.x - side) / sprite.bitmapWidth, (sprite.margin + word.y - above) / sprite.bitmapHeight, rect.width / sprite.bitmapWidth, rect.height / sprite.bitmapHeight];
    const clip = { x: rect.x, y: y + word.y - above, width: rect.width, height: rect.height, radius: 0 };
    painter.draw(matrix, rect, { kind: 'image', texture: sprite.texture, uv, alpha, clip });
  });
}
