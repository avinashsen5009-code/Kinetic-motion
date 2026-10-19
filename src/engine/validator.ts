import {
  AnimatableProperty,
  EasingName,
  SceneElementType,
  SceneNode,
  SceneSpecification,
  ValidationIssue,
  ValidationResult,
} from '../types/scene';

const VALID_ELEMENT_TYPES = new Set<SceneElementType>([
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
  'grid',
  'text',
  'counter',
]);

const VALID_ANIMATABLE_PROPS = new Set<AnimatableProperty>([
  'x',
  'y',
  'width',
  'height',
  'r',
  'rx',
  'ry',
  'x1',
  'y1',
  'x2',
  'y2',
  'scale',
  'scaleX',
  'scaleY',
  'rotation',
  'skewX',
  'skewY',
  'opacity',
  'strokeWidth',
  'drawProgress',
  'textReveal',
  'morphProgress',
  'value',
  'fill',
  'stroke',
  'extrudeDepthX',
  'extrudeDepthY',
]);

const VALID_EASING_NAMES = new Set<EasingName>([
  'linear',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeOutQuart',
  'easeInOutQuart',
  'easeOutBack',
  'easeInOutBack',
  'easeOutElastic',
  'spring',
  'step',
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'meta',
  'background',
  'transitions',
  'defs',
  'elements',
]);

const ALLOWED_META_KEYS = new Set([
  'title',
  'description',
  'author',
  'width',
  'height',
  'fps',
  'duration',
]);

const ALLOWED_BACKGROUND_KEYS = new Set(['color', 'gradient', 'grid', 'vignette']);

const ALLOWED_NODE_KEYS = new Set([
  'id',
  'name',
  'type',
  'ref',
  'overrides',
  'x',
  'y',
  'rotation',
  'scale',
  'scaleX',
  'scaleY',
  'skewX',
  'skewY',
  'anchorX',
  'anchorY',
  'originX',
  'originY',
  'opacity',
  'zIndex',
  'visibleFrom',
  'visibleUntil',
  'width',
  'height',
  'r',
  'rx',
  'ry',
  'innerRadius',
  'startAngle',
  'endAngle',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'startMarker',
  'endMarker',
  'curveOffset',
  'd',
  'morphTo',
  'morphProgress',
  'drawProgress',
  'drawOffset',
  'cellWidth',
  'cellHeight',
  'subdivisions',
  'text',
  'value',
  'decimals',
  'prefix',
  'suffix',
  'useGrouping',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textAlign',
  'verticalAlign',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'textReveal',
  'textRevealMode',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeDash',
  'strokeDashOffset',
  'lineCap',
  'lineJoin',
  'shadow',
  'extrude25D',
  'clip',
  'blendMode',
  'children',
  'animations',
]);

const ALLOWED_ANIMATION_KEYS = new Set([
  'property',
  'from',
  'to',
  'start',
  'duration',
  'easing',
]);

/**
 * Finds approximate 1-indexed line and column number for a JSON property or token in raw text.
 */
function findLineAndColumn(rawJson: string, searchToken: string): { line?: number; column?: number } {
  if (!searchToken) return {};
  const escaped = searchToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`"${escaped}"\\s*:`);
  const match = regex.exec(rawJson);
  const index = match ? match.index : rawJson.indexOf(searchToken);
  if (index === -1) return {};

  const prefix = rawJson.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function extractSyntaxErrorPosition(
  errorMsg: string,
  rawJson: string
): { line?: number; column?: number } {
  const posMatch = errorMsg.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    if (!Number.isNaN(pos) && pos >= 0 && pos <= rawJson.length) {
      const prefix = rawJson.slice(0, pos);
      const lines = prefix.split('\n');
      return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
      };
    }
  }
  const lineColMatch = errorMsg.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }
  return { line: 1, column: 1 };
}

export function validateSceneJson(rawJson: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!rawJson || !rawJson.trim()) {
    return {
      valid: false,
      scene: null,
      issues: [
        {
          severity: 'error',
          path: '$',
          message: 'JSON specification cannot be empty.',
          line: 1,
          column: 1,
          suggestion: 'Paste a scene JSON specification or click "Load Example".',
        },
      ],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Syntax error in JSON';
    const loc = extractSyntaxErrorPosition(msg, rawJson);
    return {
      valid: false,
      scene: null,
      issues: [
        {
          severity: 'error',
          path: '$',
          message: `JSON Syntax Error: ${msg}`,
          line: loc.line,
          column: loc.column,
          suggestion: 'Check for missing commas, trailing commas, or unclosed quotation marks.',
        },
      ],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      scene: null,
      issues: [
        {
          severity: 'error',
          path: '$',
          message: 'Root JSON value must be a JSON object representing a scene specification.',
          line: 1,
          column: 1,
        },
      ],
    };
  }

  const root = parsed as Record<string, unknown>;

  // Check unknown top-level keys
  for (const key of Object.keys(root)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      const loc = findLineAndColumn(rawJson, key);
      issues.push({
        severity: 'warning',
        path: `$.${key}`,
        message: `Unsupported top-level property "${key}".`,
        line: loc.line,
        column: loc.column,
        suggestion: `Supported top-level properties are: ${Array.from(ALLOWED_TOP_LEVEL_KEYS).join(', ')}.`,
      });
    }
  }

  // Validate meta
  if (!root.meta || typeof root.meta !== 'object' || Array.isArray(root.meta)) {
    const loc = findLineAndColumn(rawJson, 'meta');
    issues.push({
      severity: 'error',
      path: '$.meta',
      message: 'Missing or invalid required "meta" object.',
      line: loc.line || 1,
      column: loc.column || 1,
      suggestion: 'Include "meta": { "title": "...", "width": 1920, "height": 1080, "fps": 30, "duration": 6 }.',
    });
  } else {
    const meta = root.meta as Record<string, unknown>;
    for (const key of Object.keys(meta)) {
      if (!ALLOWED_META_KEYS.has(key)) {
        const loc = findLineAndColumn(rawJson, key);
        issues.push({
          severity: 'warning',
          path: `$.meta.${key}`,
          message: `Unsupported meta property "${key}".`,
          line: loc.line,
          column: loc.column,
          suggestion: `Supported meta properties: ${Array.from(ALLOWED_META_KEYS).join(', ')}.`,
        });
      }
    }

    if (typeof meta.title !== 'string' || !meta.title.trim()) {
      const loc = findLineAndColumn(rawJson, 'title');
      issues.push({
        severity: 'warning',
        path: '$.meta.title',
        message: 'Scene meta.title should be a non-empty string.',
        line: loc.line,
        column: loc.column,
      });
    }

    if (typeof meta.width !== 'number' || meta.width <= 0 || meta.width > 7680) {
      const loc = findLineAndColumn(rawJson, 'width');
      issues.push({
        severity: 'error',
        path: '$.meta.width',
        message: 'meta.width must be a positive number between 100 and 7680 (recommended 1920).',
        line: loc.line,
        column: loc.column,
      });
    }

    if (typeof meta.height !== 'number' || meta.height <= 0 || meta.height > 4320) {
      const loc = findLineAndColumn(rawJson, 'height');
      issues.push({
        severity: 'error',
        path: '$.meta.height',
        message: 'meta.height must be a positive number between 100 and 4320 (recommended 1080).',
        line: loc.line,
        column: loc.column,
      });
    }

    if (meta.fps !== undefined && meta.fps !== 30 && meta.fps !== 60) {
      const loc = findLineAndColumn(rawJson, 'fps');
      issues.push({
        severity: 'error',
        path: '$.meta.fps',
        message: `Unsupported frame rate "${String(meta.fps)}". meta.fps must be 30 or 60.`,
        line: loc.line,
        column: loc.column,
      });
    }

    if (typeof meta.duration !== 'number' || meta.duration <= 0 || meta.duration > 180) {
      const loc = findLineAndColumn(rawJson, 'duration');
      issues.push({
        severity: 'error',
        path: '$.meta.duration',
        message: 'meta.duration must be a positive number in seconds (0.5 to 180).',
        line: loc.line,
        column: loc.column,
      });
    }
  }

  // Validate background if present
  if (root.background !== undefined) {
    if (typeof root.background !== 'object' || root.background === null || Array.isArray(root.background)) {
      const loc = findLineAndColumn(rawJson, 'background');
      issues.push({
        severity: 'error',
        path: '$.background',
        message: '"background" must be an object specifying color, gradient, grid, or vignette.',
        line: loc.line,
        column: loc.column,
      });
    } else {
      const bg = root.background as Record<string, unknown>;
      for (const k of Object.keys(bg)) {
        if (!ALLOWED_BACKGROUND_KEYS.has(k)) {
          const loc = findLineAndColumn(rawJson, k);
          issues.push({
            severity: 'warning',
            path: `$.background.${k}`,
            message: `Unsupported background property "${k}".`,
            line: loc.line,
            column: loc.column,
          });
        }
      }
    }
  }

  // Validate defs (reusable symbols)
  const defsMap: Record<string, SceneNode> = {};
  if (root.defs !== undefined) {
    if (typeof root.defs !== 'object' || root.defs === null || Array.isArray(root.defs)) {
      const loc = findLineAndColumn(rawJson, 'defs');
      issues.push({
        severity: 'error',
        path: '$.defs',
        message: '"defs" must be a dictionary of reusable SceneNode symbol definitions.',
        line: loc.line,
        column: loc.column,
      });
    } else {
      const rawDefs = root.defs as Record<string, unknown>;
      for (const [defId, defNode] of Object.entries(rawDefs)) {
        validateNode(defNode, `$.defs.${defId}`, rawJson, issues, defsMap, true);
        if (typeof defNode === 'object' && defNode !== null) {
          defsMap[defId] = defNode as SceneNode;
        }
      }
    }
  }

  // Validate elements array
  if (!Array.isArray(root.elements)) {
    const loc = findLineAndColumn(rawJson, 'elements');
    issues.push({
      severity: 'error',
      path: '$.elements',
      message: 'Scene must include an "elements" array containing visual primitives or groups.',
      line: loc.line || 1,
      column: loc.column || 1,
    });
  } else {
    const seenIds = new Set<string>();
    root.elements.forEach((el, idx) => {
      validateNode(el, `$.elements[${idx}]`, rawJson, issues, defsMap, false, seenIds);
    });
  }

  // Detect circular symbol references in defs
  detectCircularSymbolReferences(defsMap, rawJson, issues);

  const hasErrors = issues.some((i) => i.severity === 'error');
  if (hasErrors) {
    return {
      valid: false,
      scene: null,
      issues,
    };
  }

  // Normalize defaults safely
  const metaObj = root.meta as Record<string, unknown>;
  const normalizedScene: SceneSpecification = {
    schemaVersion: typeof root.schemaVersion === 'string' ? root.schemaVersion : '1.0',
    meta: {
      title: typeof metaObj.title === 'string' ? metaObj.title : 'Untitled Scene',
      description: typeof metaObj.description === 'string' ? metaObj.description : undefined,
      author: typeof metaObj.author === 'string' ? metaObj.author : undefined,
      width: Number(metaObj.width) || 1920,
      height: Number(metaObj.height) || 1080,
      fps: metaObj.fps === 60 ? 60 : 30,
      duration: Number(metaObj.duration) || 5,
    },
    background: root.background as SceneSpecification['background'],
    transitions: root.transitions as SceneSpecification['transitions'],
    defs: Object.keys(defsMap).length > 0 ? defsMap : undefined,
    elements: root.elements as SceneNode[],
  };

  return {
    valid: true,
    scene: normalizedScene,
    issues,
  };
}

function validateNode(
  node: unknown,
  path: string,
  rawJson: string,
  issues: ValidationIssue[],
  defsMap: Record<string, SceneNode>,
  inDefs: boolean,
  seenIds?: Set<string>
): void {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    issues.push({
      severity: 'error',
      path,
      message: 'Scene element must be a valid object.',
    });
    return;
  }

  const n = node as Record<string, unknown>;
  const nodeId = typeof n.id === 'string' ? n.id : undefined;

  for (const key of Object.keys(n)) {
    if (!ALLOWED_NODE_KEYS.has(key)) {
      const loc = findLineAndColumn(rawJson, key);
      issues.push({
        severity: 'warning',
        path: `${path}.${key}`,
        message: `Unsupported element property "${key}" on node ${nodeId ? `"${nodeId}"` : path}.`,
        line: loc.line,
        column: loc.column,
        suggestion: 'Check the JSON Specification reference for valid primitive, style, and transform properties.',
      });
    }
  }

  if (!inDefs) {
    if (typeof n.id !== 'string' || !n.id.trim()) {
      issues.push({
        severity: 'warning',
        path: `${path}.id`,
        message: 'Element is missing a unique string "id" property.',
      });
    } else if (seenIds) {
      if (seenIds.has(n.id)) {
        const loc = findLineAndColumn(rawJson, n.id);
        issues.push({
          severity: 'warning',
          path: `${path}.id`,
          message: `Duplicate element id "${n.id}". Element IDs should be unique.`,
          line: loc.line,
          column: loc.column,
        });
      }
      seenIds.add(n.id);
    }
  }

  if (typeof n.type !== 'string' || !VALID_ELEMENT_TYPES.has(n.type as SceneElementType)) {
    const loc = findLineAndColumn(rawJson, String(n.type || 'type'));
    issues.push({
      severity: 'error',
      path: `${path}.type`,
      message: `Invalid or unsupported element type "${String(n.type)}".`,
      line: loc.line,
      column: loc.column,
      suggestion: `Supported types: ${Array.from(VALID_ELEMENT_TYPES).join(', ')}.`,
    });
    return;
  }

  const type = n.type as SceneElementType;

  // Type-specific validation
  if (type === 'use') {
    if (typeof n.ref !== 'string' || !n.ref.trim()) {
      const loc = findLineAndColumn(rawJson, 'ref');
      issues.push({
        severity: 'error',
        path: `${path}.ref`,
        message: '"use" element requires a string "ref" referencing an ID in "defs".',
        line: loc.line,
        column: loc.column,
      });
    }
  }

  if (type === 'path' && (typeof n.d !== 'string' || !n.d.trim())) {
    const loc = findLineAndColumn(rawJson, nodeId || 'path');
    issues.push({
      severity: 'error',
      path: `${path}.d`,
      message: 'Element of type "path" requires a non-empty SVG path string "d".',
      line: loc.line,
      column: loc.column,
    });
  }

  if ((type === 'polyline' || type === 'polygon') && (!Array.isArray(n.points) || n.points.length < 2)) {
    const loc = findLineAndColumn(rawJson, nodeId || type);
    issues.push({
      severity: 'error',
      path: `${path}.points`,
      message: `Element of type "${type}" requires a "points" array with at least 2 coordinate pairs.`,
      line: loc.line,
      column: loc.column,
    });
  }

  // Validate animations
  if (n.animations !== undefined) {
    if (!Array.isArray(n.animations)) {
      const loc = findLineAndColumn(rawJson, 'animations');
      issues.push({
        severity: 'error',
        path: `${path}.animations`,
        message: '"animations" must be an array of keyframe track objects.',
        line: loc.line,
        column: loc.column,
      });
    } else {
      n.animations.forEach((anim, aIdx) => {
        const animPath = `${path}.animations[${aIdx}]`;
        if (typeof anim !== 'object' || anim === null || Array.isArray(anim)) {
          issues.push({
            severity: 'error',
            path: animPath,
            message: 'Animation track must be an object.',
          });
          return;
        }
        const a = anim as Record<string, unknown>;
        for (const k of Object.keys(a)) {
          if (!ALLOWED_ANIMATION_KEYS.has(k)) {
            const loc = findLineAndColumn(rawJson, k);
            issues.push({
              severity: 'warning',
              path: `${animPath}.${k}`,
              message: `Unsupported animation track property "${k}".`,
              line: loc.line,
              column: loc.column,
              suggestion: `Supported properties: ${Array.from(ALLOWED_ANIMATION_KEYS).join(', ')}.`,
            });
          }
        }

        if (
          typeof a.property !== 'string' ||
          !VALID_ANIMATABLE_PROPS.has(a.property as AnimatableProperty)
        ) {
          const loc = findLineAndColumn(rawJson, String(a.property || 'property'));
          issues.push({
            severity: 'error',
            path: `${animPath}.property`,
            message: `Unsupported animatable property "${String(a.property)}".`,
            line: loc.line,
            column: loc.column,
            suggestion: `Supported animatable properties: ${Array.from(VALID_ANIMATABLE_PROPS).join(', ')}.`,
          });
        }

        if (a.to === undefined || (typeof a.to !== 'number' && typeof a.to !== 'string')) {
          issues.push({
            severity: 'error',
            path: `${animPath}.to`,
            message: 'Animation track requires a numeric or color string "to" target value.',
          });
        }

        if (typeof a.start !== 'number' || a.start < 0) {
          issues.push({
            severity: 'error',
            path: `${animPath}.start`,
            message: 'Animation track requires a non-negative "start" time in seconds.',
          });
        }

        if (typeof a.duration !== 'number' || a.duration < 0) {
          issues.push({
            severity: 'error',
            path: `${animPath}.duration`,
            message: 'Animation track requires a non-negative "duration" in seconds.',
          });
        }

        if (a.easing !== undefined) {
          const isValidNamed =
            typeof a.easing === 'string' && VALID_EASING_NAMES.has(a.easing as EasingName);
          const isValidBezier =
            Array.isArray(a.easing) &&
            a.easing.length === 4 &&
            a.easing.every((v) => typeof v === 'number');
          if (!isValidNamed && !isValidBezier) {
            const loc = findLineAndColumn(rawJson, String(a.easing));
            issues.push({
              severity: 'warning',
              path: `${animPath}.easing`,
              message: `Unknown easing value "${JSON.stringify(a.easing)}". Falling back to linear.`,
              line: loc.line,
              column: loc.column,
              suggestion: `Use a standard easing name (${Array.from(VALID_EASING_NAMES).slice(0, 6).join(', ')}...) or a [x1, y1, x2, y2] cubic-bezier array.`,
            });
          }
        }
      });
    }
  }

  // Validate children recursively
  if (n.children !== undefined) {
    if (!Array.isArray(n.children)) {
      issues.push({
        severity: 'error',
        path: `${path}.children`,
        message: '"children" must be an array of child SceneNodes.',
      });
    } else {
      n.children.forEach((child, cIdx) => {
        validateNode(child, `${path}.children[${cIdx}]`, rawJson, issues, defsMap, inDefs, seenIds);
      });
    }
  }
}

function collectUseRefs(node: SceneNode, refs: Set<string>): void {
  if (node.type === 'use' && node.ref) {
    refs.add(node.ref);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectUseRefs(child, refs);
    }
  }
}

function detectCircularSymbolReferences(
  defsMap: Record<string, SceneNode>,
  rawJson: string,
  issues: ValidationIssue[]
): void {
  const adj = new Map<string, Set<string>>();
  for (const [defId, defNode] of Object.entries(defsMap)) {
    const refs = new Set<string>();
    collectUseRefs(defNode, refs);
    adj.set(defId, refs);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (current: string, chain: string[]): boolean => {
    visiting.add(current);
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const next of neighbors) {
        if (!defsMap[next]) {
          const loc = findLineAndColumn(rawJson, next);
          issues.push({
            severity: 'error',
            path: `$.defs.${current}`,
            message: `Symbol "${current}" references undefined symbol "${next}".`,
            line: loc.line,
            column: loc.column,
          });
          continue;
        }
        if (visiting.has(next)) {
          const loc = findLineAndColumn(rawJson, current);
          issues.push({
            severity: 'error',
            path: `$.defs.${current}`,
            message: `Circular symbol reference detected: ${[...chain, next].join(' -> ')}.`,
            line: loc.line,
            column: loc.column,
            suggestion: 'Remove the recursive "use" reference inside "defs".',
          });
          return true;
        }
        if (!visited.has(next)) {
          dfs(next, [...chain, next]);
        }
      }
    }
    visiting.delete(current);
    visited.add(current);
    return false;
  };

  for (const defId of Object.keys(defsMap)) {
    if (!visited.has(defId)) {
      dfs(defId, [defId]);
    }
  }
}
