// ============================================================================
// Module 2: JSON Parser, Schema Validator & Circular Reference Detector
// ============================================================================

import {
  ElementType,
  SceneElement,
  SceneSpec,
  ValidationIssue,
  ValidationResult,
} from './schema';

const TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'id',
  'title',
  'description',
  'width',
  'height',
  'fps',
  'duration',
  'fonts',
  'camera',
  'background',
  'defs',
  'layers',
  'elements',
]);

const BACKGROUND_KEYS = new Set([
  'color',
  'gradient',
  'grid',
  'vignette',
  'shapes',
]);

const CAMERA_KEYS = new Set([
  'x',
  'y',
  'zoom',
  'rotation',
  'perspective',
  'tiltX',
  'tiltY',
  'keyframes',
]);

const LAYER_KEYS = new Set([
  'id',
  'name',
  'visible',
  'opacity',
  'blendMode',
  'zIndex',
  'clip',
  'elements',
]);

const ELEMENT_TYPES = new Set<ElementType>([
  'group',
  'use',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'arc',
  'connector',
  'arrow',
  'text',
  'callout',
  'chart',
  'grid',
]);

const ELEMENT_KEYS = new Set([
  'id',
  'name',
  'type',
  'visible',
  'startTime',
  'endTime',
  'zIndex',
  'blendMode',
  'x',
  'y',
  'z',
  'pivotX',
  'pivotY',
  'scale',
  'scaleX',
  'scaleY',
  'rotation',
  'skewX',
  'skewY',
  'opacity',
  'fill',
  'fillGradient',
  'stroke',
  'strokeGradient',
  'strokeWidth',
  'strokeCap',
  'strokeJoin',
  'strokeDash',
  'strokeDashOffset',
  'trimStart',
  'trimEnd',
  'shadow',
  'glow',
  'outline',
  'depth25d',
  'clip',
  'children',
  'ref',
  'overrides',
  'width',
  'height',
  'cornerRadius',
  'anchorX',
  'anchorY',
  'radius',
  'innerRadius',
  'rx',
  'ry',
  'startAngle',
  'endAngle',
  'anticlockwise',
  'sides',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'closed',
  'smooth',
  'tension',
  'd',
  'commands',
  'morphTo',
  'morphProgress',
  'from',
  'to',
  'routing',
  'curvature',
  'controlPoints',
  'startHead',
  'endHead',
  'headSize',
  'label',
  'labelBg',
  'labelColor',
  'labelOffset',
  'flowParticles',
  'text',
  'subtext',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'align',
  'verticalAlign',
  'maxWidth',
  'backgroundBox',
  'reveal',
  'textProgress',
  'counter',
  'tailTarget',
  'tailBaseWidth',
  'badgeText',
  'badgeColor',
  'chartType',
  'data',
  'series',
  'minValue',
  'maxValue',
  'showGrid',
  'showAxes',
  'showValues',
  'showLegend',
  'valuePrefix',
  'valueSuffix',
  'dataProgress',
  'barRadius',
  'gridSpacing',
  'majorEvery',
  'isometric',
  'keyframes',
  'tracks',
  'entrance',
  'exit',
]);

const KEYFRAME_KEYS = new Set([
  'time',
  'easing',
  'x',
  'y',
  'z',
  'scale',
  'scaleX',
  'scaleY',
  'rotation',
  'skewX',
  'skewY',
  'opacity',
  'width',
  'height',
  'radius',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeDashOffset',
  'trimStart',
  'trimEnd',
  'textProgress',
  'dataProgress',
  'morphProgress',
  'extrudeX',
  'extrudeY',
  'tiltX',
  'tiltY',
  'counterValue',
]);

const ENTRANCE_TYPES = new Set([
  'fade',
  'scaleUp',
  'pop',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'drawStroke',
  'typewriter',
  'wipeRight',
]);

const EXIT_TYPES = new Set([
  'fade',
  'scaleDown',
  'slideLeft',
  'slideRight',
  'slideUp',
  'slideDown',
  'eraseStroke',
]);

const VALID_EASINGS = new Set([
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInQuart',
  'easeOutQuart',
  'easeInOutQuart',
  'easeInBack',
  'easeOutBack',
  'easeInOutBack',
  'easeOutElastic',
  'easeOutBounce',
  'spring',
  'stepStart',
  'stepEnd',
]);

/**
 * Maps character offset in a string to 1-based { line, column }.
 */
export function offsetToLineCol(
  text: string,
  offset: number
): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < safeOffset; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: safeOffset - lastNewline };
}

/**
 * Attempts to find the approximate 1-based line and column of a key or path in raw JSON text.
 */
export function findKeyLocation(
  rawJson: string,
  keyName: string,
  fallbackId?: string
): { line?: number; column?: number } {
  const escapedKey = keyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`"${escapedKey}"\\s*:`);
  let searchSpace = rawJson;
  let baseOffset = 0;

  if (fallbackId) {
    const escapedId = fallbackId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idMatch = new RegExp(`"id"\\s*:\\s*"${escapedId}"`).exec(rawJson);
    if (idMatch && idMatch.index !== undefined) {
      baseOffset = Math.max(0, idMatch.index - 80);
      searchSpace = rawJson.slice(baseOffset);
    }
  }

  const match = regex.exec(searchSpace);
  if (match && match.index !== undefined) {
    return offsetToLineCol(rawJson, baseOffset + match.index);
  }
  const globalMatch = regex.exec(rawJson);
  if (globalMatch && globalMatch.index !== undefined) {
    return offsetToLineCol(rawJson, globalMatch.index);
  }
  return {};
}

/**
 * Extracts exact syntax error line/column from JSON.parse failure.
 */
function parseJsonWithLineInfo(rawJson: string): {
  data: any;
  error?: ValidationIssue;
} {
  if (!rawJson || !rawJson.trim()) {
    return {
      data: null,
      error: {
        severity: 'error',
        code: 'EMPTY_JSON',
        path: '$',
        message: 'JSON input is empty. Provide a valid JSON scene object.',
        line: 1,
        column: 1,
      },
    };
  }

  try {
    const parsed = JSON.parse(rawJson);
    return { data: parsed };
  } catch (err: any) {
    const msg = String(err?.message || 'Invalid JSON syntax');
    // Match V8 "at position N" or Firefox "at line L column C"
    const posMatch = /position\s+(\d+)/i.exec(msg);
    const lineColMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(msg);

    let line = 1;
    let column = 1;
    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      column = parseInt(lineColMatch[2], 10);
    } else if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const loc = offsetToLineCol(rawJson, pos);
      line = loc.line;
      column = loc.column;
    } else {
      // Heuristic scan for common syntax errors (trailing comma, unclosed quote/brace)
      const loc = locateSyntaxErrorHeuristically(rawJson);
      line = loc.line;
      column = loc.column;
    }

    const lines = rawJson.split('\n');
    const offendingLine = lines[line - 1] || '';
    const snippet = offendingLine.trim().slice(0, 60);

    return {
      data: null,
      error: {
        severity: 'error',
        code: 'JSON_SYNTAX_ERROR',
        path: '$',
        message: `Syntax error at line ${line}, column ${column}: ${msg}${snippet ? ` (near \`${snippet}\`)` : ''}`,
        line,
        column,
        suggestion:
          'Check for missing commas, trailing commas, or unclosed quotes/brackets.',
      },
    };
  }
}

function locateSyntaxErrorHeuristically(rawJson: string): {
  line: number;
  column: number;
} {
  // Check trailing comma before } or ]
  const trailingComma = /,\s*([}\]])/g.exec(rawJson);
  if (trailingComma && trailingComma.index !== undefined) {
    return offsetToLineCol(rawJson, trailingComma.index);
  }
  return offsetToLineCol(rawJson, rawJson.length);
}

/**
 * Validates easing specification.
 */
function validateEasing(
  easing: any,
  path: string,
  rawJson: string,
  errors: ValidationIssue[],
  contextId?: string
): void {
  if (easing === undefined) return;
  if (typeof easing === 'string') {
    if (!VALID_EASINGS.has(easing)) {
      const loc = findKeyLocation(rawJson, 'easing', contextId);
      errors.push({
        severity: 'error',
        code: 'INVALID_EASING',
        path,
        message: `Unsupported easing "${easing}". Supported easings: ${Array.from(VALID_EASINGS).join(', ')}, or ["cubic-bezier", x1, y1, x2, y2].`,
        ...loc,
      });
    }
    return;
  }
  if (Array.isArray(easing)) {
    if (easing[0] === 'cubic-bezier' && easing.length === 5) {
      const nums = easing.slice(1);
      if (nums.some((n) => typeof n !== 'number' || Number.isNaN(n))) {
        errors.push({
          severity: 'error',
          code: 'INVALID_BEZIER_EASING',
          path,
          message:
            'cubic-bezier easing requires 4 numbers: ["cubic-bezier", x1, y1, x2, y2].',
        });
      }
      return;
    }
    if (easing[0] === 'steps' && easing.length === 2 && typeof easing[1] === 'number' && easing[1] >= 1) {
      return;
    }
  }
  errors.push({
    severity: 'error',
    code: 'INVALID_EASING_FORMAT',
    path,
    message:
      'Invalid easing format. Expected an easing name string or ["cubic-bezier", x1, y1, x2, y2].',
  });
}

/**
 * Validates and parses a JSON scene string into a strongly-typed SceneSpec.
 */
export function validateSceneJson(rawJson: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  let elementCount = 0;
  let layerCount = 0;
  let defCount = 0;
  let keyframeCount = 0;

  const parsed = parseJsonWithLineInfo(rawJson);
  if (parsed.error) {
    return {
      valid: false,
      scene: null,
      errors: [parsed.error],
      warnings: [],
      stats: {
        elementCount: 0,
        layerCount: 0,
        defCount: 0,
        keyframeCount: 0,
        duration: 0,
        fps: 30,
      },
    };
  }

  const root = parsed.data;
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return {
      valid: false,
      scene: null,
      errors: [
        {
          severity: 'error',
          code: 'INVALID_ROOT',
          path: '$',
          message: 'Root JSON value must be a scene specification object.',
          line: 1,
          column: 1,
        },
      ],
      warnings: [],
      stats: {
        elementCount: 0,
        layerCount: 0,
        defCount: 0,
        keyframeCount: 0,
        duration: 0,
        fps: 30,
      },
    };
  }

  // Check unknown top-level keys
  for (const key of Object.keys(root)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      const loc = findKeyLocation(rawJson, key);
      warnings.push({
        severity: 'warning',
        code: 'UNKNOWN_SCENE_PROPERTY',
        path: `$.${key}`,
        message: `Unknown top-level scene property "${key}". Supported properties: ${Array.from(TOP_LEVEL_KEYS).join(', ')}.`,
        ...loc,
      });
    }
  }

  // Validate required scene fields
  if (typeof root.id !== 'string' || !root.id.trim()) {
    warnings.push({
      severity: 'warning',
      code: 'MISSING_SCENE_ID',
      path: '$.id',
      message: 'Scene "id" was missing or empty; defaulting to "scene-1".',
      line: 1,
      column: 1,
    });
  }

  if (typeof root.title !== 'string' || !root.title.trim()) {
    warnings.push({
      severity: 'warning',
      code: 'MISSING_SCENE_TITLE',
      path: '$.title',
      message: 'Scene "title" was missing; defaulting to "Untitled Scene".',
      line: 1,
      column: 1,
    });
  }

  const width = root.width !== undefined ? Number(root.width) : 1920;
  const height = root.height !== undefined ? Number(root.height) : 1080;
  if (!Number.isFinite(width) || width <= 0 || width > 15360) {
    const loc = findKeyLocation(rawJson, 'width');
    errors.push({
      severity: 'error',
      code: 'INVALID_WIDTH',
      path: '$.width',
      message: `Invalid scene width "${root.width}". Must be a positive number between 1 and 15360.`,
      ...loc,
    });
  }
  if (!Number.isFinite(height) || height <= 0 || height > 8640) {
    const loc = findKeyLocation(rawJson, 'height');
    errors.push({
      severity: 'error',
      code: 'INVALID_HEIGHT',
      path: '$.height',
      message: `Invalid scene height "${root.height}". Must be a positive number between 1 and 8640.`,
      ...loc,
    });
  }

  const duration = Number(root.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 300) {
    const loc = findKeyLocation(rawJson, 'duration');
    errors.push({
      severity: 'error',
      code: 'INVALID_DURATION',
      path: '$.duration',
      message: `Invalid or missing scene "duration" (${root.duration}). Must be a number > 0 and <= 300 seconds.`,
      ...loc,
    });
  }

  const fps = root.fps !== undefined ? Number(root.fps) : 30;
  if (!Number.isFinite(fps) || fps < 1 || fps > 120) {
    const loc = findKeyLocation(rawJson, 'fps');
    errors.push({
      severity: 'error',
      code: 'INVALID_FPS',
      path: '$.fps',
      message: `Invalid "fps" (${root.fps}). Recommended values are 30 or 60.`,
      ...loc,
    });
  }

  // Validate background
  if (root.background !== undefined) {
    if (typeof root.background !== 'object' || Array.isArray(root.background)) {
      const loc = findKeyLocation(rawJson, 'background');
      errors.push({
        severity: 'error',
        code: 'INVALID_BACKGROUND',
        path: '$.background',
        message: '"background" must be an object.',
        ...loc,
      });
    } else {
      for (const k of Object.keys(root.background)) {
        if (!BACKGROUND_KEYS.has(k)) {
          const loc = findKeyLocation(rawJson, k);
          warnings.push({
            severity: 'warning',
            code: 'UNKNOWN_BACKGROUND_PROPERTY',
            path: `$.background.${k}`,
            message: `Unknown background property "${k}". Supported: ${Array.from(BACKGROUND_KEYS).join(', ')}.`,
            ...loc,
          });
        }
      }
      if (Array.isArray(root.background.shapes)) {
        root.background.shapes.forEach((el: any, idx: number) => {
          validateElement(
            el,
            `$.background.shapes[${idx}]`,
            rawJson,
            duration,
            errors,
            warnings,
            () => elementCount++,
            (n) => (keyframeCount += n)
          );
        });
      }
    }
  }

  // Validate camera
  if (root.camera !== undefined && typeof root.camera === 'object') {
    for (const k of Object.keys(root.camera)) {
      if (!CAMERA_KEYS.has(k)) {
        const loc = findKeyLocation(rawJson, k);
        warnings.push({
          severity: 'warning',
          code: 'UNKNOWN_CAMERA_PROPERTY',
          path: `$.camera.${k}`,
          message: `Unknown camera property "${k}". Supported: ${Array.from(CAMERA_KEYS).join(', ')}.`,
          ...loc,
        });
      }
    }
  }

  // Validate defs (reusable symbols/groups)
  const defsMap: Record<string, SceneElement> = {};
  if (root.defs !== undefined) {
    if (typeof root.defs !== 'object' || Array.isArray(root.defs)) {
      const loc = findKeyLocation(rawJson, 'defs');
      errors.push({
        severity: 'error',
        code: 'INVALID_DEFS',
        path: '$.defs',
        message: '"defs" must be an object mapping symbol IDs to element specifications.',
        ...loc,
      });
    } else {
      for (const [defId, defEl] of Object.entries(root.defs)) {
        defCount++;
        if (defEl && typeof defEl === 'object' && !(defEl as any).id) {
          (defEl as any).id = defId;
        }
        validateElement(
          defEl,
          `$.defs.${defId}`,
          rawJson,
          duration,
          errors,
          warnings,
          () => elementCount++,
          (n) => (keyframeCount += n)
        );
        defsMap[defId] = defEl as SceneElement;
      }
    }
  }

  // Validate layers and elements
  const hasLayers = Array.isArray(root.layers) && root.layers.length > 0;
  const hasElements = Array.isArray(root.elements) && root.elements.length > 0;

  if (!hasLayers && !hasElements) {
    errors.push({
      severity: 'error',
      code: 'EMPTY_SCENE_ELEMENTS',
      path: '$',
      message:
        'Scene must define at least one layer in "layers" or one element in "elements".',
      line: 1,
      column: 1,
    });
  }

  if (root.layers !== undefined) {
    if (!Array.isArray(root.layers)) {
      const loc = findKeyLocation(rawJson, 'layers');
      errors.push({
        severity: 'error',
        code: 'INVALID_LAYERS',
        path: '$.layers',
        message: '"layers" must be an array of layer objects.',
        ...loc,
      });
    } else {
      root.layers.forEach((layer: any, lIdx: number) => {
        layerCount++;
        const lPath = `$.layers[${lIdx}]`;
        if (!layer || typeof layer !== 'object') {
          errors.push({
            severity: 'error',
            code: 'INVALID_LAYER_ITEM',
            path: lPath,
            message: 'Layer entry must be an object.',
          });
          return;
        }
        for (const k of Object.keys(layer)) {
          if (!LAYER_KEYS.has(k)) {
            const loc = findKeyLocation(rawJson, k, layer.id);
            warnings.push({
              severity: 'warning',
              code: 'UNKNOWN_LAYER_PROPERTY',
              path: `${lPath}.${k}`,
              message: `Unknown layer property "${k}". Supported: ${Array.from(LAYER_KEYS).join(', ')}.`,
              ...loc,
            });
          }
        }
        if (!Array.isArray(layer.elements)) {
          errors.push({
            severity: 'error',
            code: 'MISSING_LAYER_ELEMENTS',
            path: `${lPath}.elements`,
            message: `Layer "${layer.id || lIdx}" must contain an "elements" array.`,
          });
        } else {
          layer.elements.forEach((el: any, eIdx: number) => {
            validateElement(
              el,
              `${lPath}.elements[${eIdx}]`,
              rawJson,
              duration,
              errors,
              warnings,
              () => elementCount++,
              (n) => (keyframeCount += n)
            );
          });
        }
      });
    }
  }

  if (root.elements !== undefined) {
    if (!Array.isArray(root.elements)) {
      const loc = findKeyLocation(rawJson, 'elements');
      errors.push({
        severity: 'error',
        code: 'INVALID_ELEMENTS',
        path: '$.elements',
        message: '"elements" must be an array of scene elements.',
        ...loc,
      });
    } else {
      layerCount++;
      root.elements.forEach((el: any, eIdx: number) => {
        validateElement(
          el,
          `$.elements[${eIdx}]`,
          rawJson,
          duration,
          errors,
          warnings,
          () => elementCount++,
          (n) => (keyframeCount += n)
        );
      });
    }
  }

  // Circular reference & unresolved ref detection across defs and use elements
  detectCircularAndMissingRefs(root, defsMap, rawJson, errors);

  const normalizedScene: SceneSpec | null =
    errors.length === 0
      ? {
          schemaVersion: root.schemaVersion || '1.0',
          id: root.id || 'scene-1',
          title: root.title || 'Untitled Scene',
          description: root.description || '',
          width: Number.isFinite(width) && width > 0 ? width : 1920,
          height: Number.isFinite(height) && height > 0 ? height : 1080,
          fps: Number.isFinite(fps) && fps > 0 ? fps : 30,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 5,
          fonts: Array.isArray(root.fonts) ? root.fonts : [],
          camera: root.camera,
          background: root.background || { color: '#0f172a' },
          defs: defsMap,
          layers: Array.isArray(root.layers) ? root.layers : [],
          elements: Array.isArray(root.elements) ? root.elements : [],
        }
      : null;

  return {
    valid: errors.length === 0,
    scene: normalizedScene,
    errors,
    warnings,
    stats: {
      elementCount,
      layerCount,
      defCount,
      keyframeCount,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      fps: Number.isFinite(fps) && fps > 0 ? fps : 30,
    },
  };
}

function validateElement(
  el: any,
  path: string,
  rawJson: string,
  sceneDuration: number,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  onElement: () => void,
  onKeyframes: (count: number) => void
): void {
  if (!el || typeof el !== 'object' || Array.isArray(el)) {
    errors.push({
      severity: 'error',
      code: 'INVALID_ELEMENT',
      path,
      message: 'Scene element must be a JSON object.',
    });
    return;
  }

  onElement();
  const elId = typeof el.id === 'string' ? el.id : undefined;

  // Check unknown properties on element
  for (const key of Object.keys(el)) {
    if (!ELEMENT_KEYS.has(key)) {
      const loc = findKeyLocation(rawJson, key, elId);
      warnings.push({
        severity: 'warning',
        code: 'UNKNOWN_ELEMENT_PROPERTY',
        path: `${path}.${key}`,
        message: `Unknown property "${key}" on element "${elId || path}" (type "${el.type || 'unknown'}").`,
        ...loc,
        suggestion:
          'Verify property spelling against the JSON Scene Specification.',
      });
    }
  }

  // Check type
  if (!el.type || typeof el.type !== 'string') {
    const loc = findKeyLocation(rawJson, 'id', elId);
    errors.push({
      severity: 'error',
      code: 'MISSING_ELEMENT_TYPE',
      path: `${path}.type`,
      message: `Element "${elId || path}" is missing required "type" property. Supported types: ${Array.from(ELEMENT_TYPES).join(', ')}.`,
      ...loc,
    });
    return;
  }

  if (!ELEMENT_TYPES.has(el.type as ElementType)) {
    const loc = findKeyLocation(rawJson, 'type', elId);
    errors.push({
      severity: 'error',
      code: 'UNSUPPORTED_ELEMENT_TYPE',
      path: `${path}.type`,
      message: `Unsupported element type "${el.type}" on "${elId || path}". Supported types: ${Array.from(ELEMENT_TYPES).join(', ')}.`,
      ...loc,
    });
    return;
  }

  // Type-specific validation
  switch (el.type as ElementType) {
    case 'rect':
    case 'callout':
      if (typeof el.width !== 'number' || el.width < 0 || typeof el.height !== 'number' || el.height < 0) {
        const loc = findKeyLocation(rawJson, 'width', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_RECT_DIMENSIONS',
          path,
          message: `Element "${elId || path}" of type "${el.type}" requires numeric "width" and "height" >= 0.`,
          ...loc,
        });
      }
      break;
    case 'circle':
    case 'arc':
      if (typeof el.radius !== 'number' || el.radius < 0) {
        const loc = findKeyLocation(rawJson, 'radius', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_CIRCLE_RADIUS',
          path: `${path}.radius`,
          message: `Element "${elId || path}" of type "${el.type}" requires numeric "radius" >= 0.`,
          ...loc,
        });
      }
      break;
    case 'ellipse':
      if (typeof el.rx !== 'number' || el.rx < 0 || typeof el.ry !== 'number' || el.ry < 0) {
        const loc = findKeyLocation(rawJson, 'rx', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_ELLIPSE_RADII',
          path,
          message: `Element "${elId || path}" of type "ellipse" requires numeric "rx" and "ry" >= 0.`,
          ...loc,
        });
      }
      break;
    case 'polyline':
      if (!Array.isArray(el.points) || el.points.length < 2) {
        const loc = findKeyLocation(rawJson, 'points', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_POLYLINE_POINTS',
          path: `${path}.points`,
          message: `Element "${elId || path}" of type "polyline" requires a "points" array with at least 2 [x, y] pairs.`,
          ...loc,
        });
      }
      break;
    case 'polygon':
      if (
        (!Array.isArray(el.points) || el.points.length < 3) &&
        (typeof el.sides !== 'number' || el.sides < 3 || typeof el.radius !== 'number')
      ) {
        const loc = findKeyLocation(rawJson, 'type', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_POLYGON_SPEC',
          path,
          message: `Element "${elId || path}" of type "polygon" requires either "points" (at least 3 [x,y] pairs) or regular polygon "sides" (>=3) and "radius".`,
          ...loc,
        });
      }
      break;
    case 'path':
      if (
        (typeof el.d !== 'string' || !el.d.trim()) &&
        (!Array.isArray(el.commands) || el.commands.length === 0)
      ) {
        const loc = findKeyLocation(rawJson, 'd', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_PATH_DATA',
          path,
          message: `Element "${elId || path}" of type "path" requires a non-empty SVG path string "d" or "commands" array.`,
          ...loc,
        });
      }
      break;
    case 'connector':
    case 'arrow':
      if (
        !Array.isArray(el.from) ||
        el.from.length !== 2 ||
        !Array.isArray(el.to) ||
        el.to.length !== 2
      ) {
        const loc = findKeyLocation(rawJson, 'from', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_CONNECTOR_ENDPOINTS',
          path,
          message: `Element "${elId || path}" of type "${el.type}" requires "from": [x1, y1] and "to": [x2, y2].`,
          ...loc,
        });
      }
      break;
    case 'text':
      if (typeof el.text !== 'string' && !el.counter) {
        const loc = findKeyLocation(rawJson, 'text', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_TEXT_CONTENT',
          path: `${path}.text`,
          message: `Element "${elId || path}" of type "text" requires a string "text" property or "counter" specification.`,
          ...loc,
        });
      }
      break;
    case 'use':
      if (typeof el.ref !== 'string' || !el.ref.trim()) {
        const loc = findKeyLocation(rawJson, 'ref', elId);
        errors.push({
          severity: 'error',
          code: 'MISSING_USE_REF',
          path: `${path}.ref`,
          message: `Element "${elId || path}" of type "use" requires a non-empty "ref" string referencing an entry in "defs".`,
          ...loc,
        });
      }
      break;
    case 'chart':
      if (typeof el.width !== 'number' || typeof el.height !== 'number') {
        const loc = findKeyLocation(rawJson, 'width', elId);
        errors.push({
          severity: 'error',
          code: 'INVALID_CHART_DIMENSIONS',
          path,
          message: `Chart element "${elId || path}" requires numeric "width" and "height".`,
          ...loc,
        });
      }
      break;
    default:
      break;
  }

  // Validate keyframes
  if (el.keyframes !== undefined) {
    if (!Array.isArray(el.keyframes)) {
      const loc = findKeyLocation(rawJson, 'keyframes', elId);
      errors.push({
        severity: 'error',
        code: 'INVALID_KEYFRAMES',
        path: `${path}.keyframes`,
        message: `"keyframes" on "${elId || path}" must be an array.`,
        ...loc,
      });
    } else {
      onKeyframes(el.keyframes.length);
      el.keyframes.forEach((kf: any, kIdx: number) => {
        const kPath = `${path}.keyframes[${kIdx}]`;
        if (!kf || typeof kf !== 'object') {
          errors.push({
            severity: 'error',
            code: 'INVALID_KEYFRAME_ITEM',
            path: kPath,
            message: 'Keyframe must be an object.',
          });
          return;
        }
        for (const k of Object.keys(kf)) {
          if (!KEYFRAME_KEYS.has(k)) {
            const loc = findKeyLocation(rawJson, k, elId);
            warnings.push({
              severity: 'warning',
              code: 'UNKNOWN_KEYFRAME_PROPERTY',
              path: `${kPath}.${k}`,
              message: `Unknown keyframe property "${k}" on "${elId || path}". Supported: ${Array.from(KEYFRAME_KEYS).join(', ')}.`,
              ...loc,
            });
          }
        }
        if (typeof kf.time !== 'number' || Number.isNaN(kf.time) || kf.time < 0) {
          const loc = findKeyLocation(rawJson, 'time', elId);
          errors.push({
            severity: 'error',
            code: 'INVALID_KEYFRAME_TIME',
            path: `${kPath}.time`,
            message: `Keyframe on "${elId || path}" requires numeric "time" >= 0.`,
            ...loc,
          });
        } else if (Number.isFinite(sceneDuration) && kf.time > sceneDuration + 0.001) {
          const loc = findKeyLocation(rawJson, 'time', elId);
          warnings.push({
            severity: 'warning',
            code: 'KEYFRAME_AFTER_DURATION',
            path: `${kPath}.time`,
            message: `Keyframe time (${kf.time}s) on "${elId || path}" exceeds scene duration (${sceneDuration}s).`,
            ...loc,
          });
        }
        validateEasing(kf.easing, `${kPath}.easing`, rawJson, errors, elId);
      });
    }
  }

  // Validate tracks
  if (el.tracks !== undefined && typeof el.tracks === 'object') {
    for (const [propName, pts] of Object.entries(el.tracks)) {
      if (!KEYFRAME_KEYS.has(propName)) {
        const loc = findKeyLocation(rawJson, propName, elId);
        warnings.push({
          severity: 'warning',
          code: 'UNKNOWN_TRACK_PROPERTY',
          path: `${path}.tracks.${propName}`,
          message: `Unknown animated track property "${propName}" on "${elId || path}".`,
          ...loc,
        });
      }
      if (Array.isArray(pts)) {
        onKeyframes(pts.length);
        pts.forEach((pt: any, pIdx: number) => {
          validateEasing(
            pt?.easing,
            `${path}.tracks.${propName}[${pIdx}].easing`,
            rawJson,
            errors,
            elId
          );
        });
      }
    }
  }

  // Validate entrance / exit
  if (el.entrance !== undefined && typeof el.entrance === 'object') {
    if (!ENTRANCE_TYPES.has(el.entrance.type)) {
      const loc = findKeyLocation(rawJson, 'entrance', elId);
      errors.push({
        severity: 'error',
        code: 'INVALID_ENTRANCE_TYPE',
        path: `${path}.entrance.type`,
        message: `Unsupported entrance type "${el.entrance.type}". Supported: ${Array.from(ENTRANCE_TYPES).join(', ')}.`,
        ...loc,
      });
    }
    validateEasing(el.entrance.easing, `${path}.entrance.easing`, rawJson, errors, elId);
  }

  if (el.exit !== undefined && typeof el.exit === 'object') {
    if (!EXIT_TYPES.has(el.exit.type)) {
      const loc = findKeyLocation(rawJson, 'exit', elId);
      errors.push({
        severity: 'error',
        code: 'INVALID_EXIT_TYPE',
        path: `${path}.exit.type`,
        message: `Unsupported exit type "${el.exit.type}". Supported: ${Array.from(EXIT_TYPES).join(', ')}.`,
        ...loc,
      });
    }
    validateEasing(el.exit.easing, `${path}.exit.easing`, rawJson, errors, elId);
  }

  // Validate children recursively
  if (Array.isArray(el.children)) {
    el.children.forEach((child: any, cIdx: number) => {
      validateElement(
        child,
        `${path}.children[${cIdx}]`,
        rawJson,
        sceneDuration,
        errors,
        warnings,
        onElement,
        onKeyframes
      );
    });
  }
}

/**
 * Collects all `use` references inside a definition and detects cycles or missing defs.
 */
function detectCircularAndMissingRefs(
  root: any,
  defsMap: Record<string, SceneElement>,
  rawJson: string,
  errors: ValidationIssue[]
): void {
  const collectRefsInElement = (el: any, out: string[] = []): string[] => {
    if (!el || typeof el !== 'object') return out;
    if (el.type === 'use' && typeof el.ref === 'string') {
      out.push(el.ref);
    }
    if (Array.isArray(el.children)) {
      for (const child of el.children) {
        collectRefsInElement(child, out);
      }
    }
    return out;
  };

  // Build adjacency graph for defs
  const adj: Record<string, string[]> = {};
  for (const [defId, defEl] of Object.entries(defsMap)) {
    adj[defId] = collectRefsInElement(defEl);
    for (const targetRef of adj[defId]) {
      if (!defsMap[targetRef]) {
        const loc = findKeyLocation(rawJson, 'ref', defId);
        errors.push({
          severity: 'error',
          code: 'UNRESOLVED_DEF_REF',
          path: `$.defs.${defId}`,
          message: `Symbol definition "${defId}" references "${targetRef}", which does not exist in "defs".`,
          ...loc,
        });
      }
    }
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  const dfs = (node: string, chain: string[]): boolean => {
    visited.add(node);
    inStack.add(node);
    const neighbors = adj[node] || [];
    for (const next of neighbors) {
      if (!defsMap[next]) continue;
      if (inStack.has(next)) {
        const cycleStart = chain.indexOf(next);
        const cyclePath = [...chain.slice(cycleStart >= 0 ? cycleStart : 0), next].join(' -> ');
        const loc = findKeyLocation(rawJson, 'ref', node);
        errors.push({
          severity: 'error',
          code: 'CIRCULAR_DEF_REFERENCE',
          path: `$.defs.${node}`,
          message: `Circular reference detected in "defs": ${cyclePath}. Reusable groups/symbols cannot reference themselves directly or indirectly.`,
          ...loc,
        });
        return true;
      }
      if (!visited.has(next)) {
        if (dfs(next, [...chain, next])) return true;
      }
    }
    inStack.delete(node);
    return false;
  };

  for (const defId of Object.keys(defsMap)) {
    if (!visited.has(defId)) {
      dfs(defId, [defId]);
    }
  }

  // Also check all `use` elements in layers/elements/background for missing defs
  const checkTreeRefs = (el: any, path: string) => {
    if (!el || typeof el !== 'object') return;
    if (el.type === 'use' && typeof el.ref === 'string' && el.ref.trim()) {
      if (!defsMap[el.ref]) {
        const loc = findKeyLocation(rawJson, 'ref', el.id);
        errors.push({
          severity: 'error',
          code: 'UNRESOLVED_USE_REF',
          path: `${path}.ref`,
          message: `Element "${el.id || path}" references symbol "${el.ref}", which is not defined in "defs". Available defs: ${Object.keys(defsMap).join(', ') || 'none'}.`,
          ...loc,
        });
      }
    }
    if (Array.isArray(el.children)) {
      el.children.forEach((c: any, idx: number) =>
        checkTreeRefs(c, `${path}.children[${idx}]`)
      );
    }
  };

  if (Array.isArray(root.layers)) {
    root.layers.forEach((layer: any, lIdx: number) => {
      if (Array.isArray(layer?.elements)) {
        layer.elements.forEach((el: any, eIdx: number) =>
          checkTreeRefs(el, `$.layers[${lIdx}].elements[${eIdx}]`)
        );
      }
    });
  }
  if (Array.isArray(root.elements)) {
    root.elements.forEach((el: any, eIdx: number) =>
      checkTreeRefs(el, `$.elements[${eIdx}]`)
    );
  }
}
