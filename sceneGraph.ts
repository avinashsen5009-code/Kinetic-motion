// ============================================================================
// Module 4: Scene Graph Builder & Reusable Symbol (`defs`/`use`) Resolver
// ============================================================================

import { LayerSpec, SceneElement, SceneSpec } from './schema';

export interface SceneGraphNode {
  id: string;
  name: string;
  type: SceneElement['type'];
  layerId: string;
  depth: number;
  element: SceneElement;
  children: SceneGraphNode[];
}

export interface BuiltSceneGraph {
  scene: SceneSpec;
  layers: LayerSpec[];
  flatNodes: SceneGraphNode[];
  rootNodes: SceneGraphNode[];
}

/**
 * Deeply clones a SceneElement and resolves `type: "use"` symbol references from `defs`,
 * applying instance transforms, style overrides, and child overrides while preventing circular recursion.
 */
export function resolveElementTree(
  el: SceneElement,
  defs: Record<string, SceneElement>,
  visitedRefs: Set<string> = new Set()
): SceneElement {
  if (el.type === 'use' && el.ref && defs[el.ref]) {
    if (visitedRefs.has(el.ref)) {
      // Safety guard against circular reference
      return {
        ...el,
        type: 'group',
        children: [],
      };
    }

    const nextVisited = new Set(visitedRefs);
    nextVisited.add(el.ref);
    const template = defs[el.ref];

    // Clone and merge template into a resolved group so instance transforms apply cleanly around the symbol
    const resolvedTemplate = resolveElementTree(
      deepCloneWithOverrides(template, el.id, el.overrides),
      defs,
      nextVisited
    );

    return {
      ...el,
      type: 'group',
      name: el.name || `${template.name || el.ref} (instance)`,
      children: [resolvedTemplate],
    };
  }

  const cloned: SceneElement = {
    ...el,
  };

  if (Array.isArray(el.children) && el.children.length > 0) {
    cloned.children = el.children
      .slice()
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map((child) => resolveElementTree(child, defs, visitedRefs));
  }

  return cloned;
}

function deepCloneWithOverrides(
  template: SceneElement,
  instanceId: string,
  overrides?: Record<string, any>
): SceneElement {
  const directOverrides: Record<string, any> = {};
  const childOverridesMap: Record<string, any> = {};

  if (overrides && typeof overrides === 'object') {
    for (const [k, v] of Object.entries(overrides)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'shadow' && k !== 'glow' && k !== 'depth25d' && k !== 'fillGradient') {
        childOverridesMap[k] = v;
      } else {
        directOverrides[k] = v;
      }
    }
  }

  const cloneNode = (node: SceneElement, suffixPath: string): SceneElement => {
    const specificChildOverride =
      (node.id && childOverridesMap[node.id]) || {};
    const merged: SceneElement = {
      ...node,
      ...(suffixPath === 'root' ? directOverrides : {}),
      ...specificChildOverride,
      id: `${instanceId}__${node.id || suffixPath}`,
    };
    if (Array.isArray(node.children)) {
      merged.children = node.children.map((c, idx) =>
        cloneNode(c, `${suffixPath}_${idx}`)
      );
    }
    return merged;
  };

  return cloneNode(template, 'root');
}

/**
 * Builds the normalized, layer-sorted scene graph ready for deterministic frame rendering and UI inspection.
 */
export function buildSceneGraph(scene: SceneSpec): BuiltSceneGraph {
  const defs = scene.defs || {};
  const rawLayers: LayerSpec[] = [];

  if (Array.isArray(scene.layers) && scene.layers.length > 0) {
    for (const l of scene.layers) {
      rawLayers.push({
        id: l.id || 'layer',
        name: l.name || l.id || 'Layer',
        visible: l.visible !== false,
        opacity: l.opacity ?? 1,
        blendMode: l.blendMode ?? 'source-over',
        zIndex: l.zIndex ?? 0,
        clip: l.clip,
        elements: (l.elements || [])
          .slice()
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
          .map((el) => resolveElementTree(el, defs)),
      });
    }
  }

  if (Array.isArray(scene.elements) && scene.elements.length > 0) {
    rawLayers.push({
      id: 'main-layer',
      name: 'Main Scene Layer',
      visible: true,
      opacity: 1,
      blendMode: 'source-over',
      zIndex: rawLayers.length,
      elements: scene.elements
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
        .map((el) => resolveElementTree(el, defs)),
    });
  }

  const sortedLayers = rawLayers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const flatNodes: SceneGraphNode[] = [];
  const rootNodes: SceneGraphNode[] = [];

  const buildNode = (
    el: SceneElement,
    layerId: string,
    depth: number
  ): SceneGraphNode => {
    const node: SceneGraphNode = {
      id: el.id,
      name: el.name || el.id,
      type: el.type,
      layerId,
      depth,
      element: el,
      children: [],
    };
    flatNodes.push(node);
    if (Array.isArray(el.children)) {
      node.children = el.children.map((c) => buildNode(c, layerId, depth + 1));
    }
    return node;
  };

  for (const layer of sortedLayers) {
    for (const el of layer.elements) {
      rootNodes.push(buildNode(el, layer.id, 0));
    }
  }

  return {
    scene,
    layers: sortedLayers,
    flatNodes,
    rootNodes,
  };
}
