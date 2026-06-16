import type { StylePatch } from './types.js';

export interface PatchResult<T> {
  result: T;
  applied: number;
}

export function applyPatches<T extends Record<string, unknown>>(target: T, patches: StylePatch[]): T {
  const result = structuredClone(target);
  for (const patch of patches) {
    const path = parsePointer(patch.path);
    switch (patch.op) {
      case 'replace':
        setPath(result, path, patch.value);
        break;
      case 'add':
        addAtPath(result, path, patch.value);
        break;
      case 'remove':
        removeAtPath(result, path);
        break;
      default:
        throw new Error(`Unsupported patch operation: ${(patch as StylePatch).op}`);
    }
  }
  return result;
}

export function parsePointer(path: string): string[] {
  if (path === '') return [];
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  if (trimmed === '') return [];
  return trimmed.split('/');
}

function setPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function addAtPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) {
    throw new Error('Add patch requires a non-empty path');
  }
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  let parent: Record<string, unknown> = obj;

  for (let i = 0; i < parentPath.length; i++) {
    const key = parentPath[i];
    const nextKey = i < parentPath.length - 1 ? parentPath[i + 1] : last;
    const shouldBeArray = nextKey === '-' || /^[0-9]+$/.test(nextKey);
    if (!(key in parent) || parent[key] === null || typeof parent[key] !== 'object') {
      parent[key] = shouldBeArray ? [] : {};
    }
    parent = parent[key] as Record<string, unknown>;
  }

  if (last === '-') {
    if (!Array.isArray(parent)) {
      throw new Error(`Cannot add with '-' to non-array at path /${path.join('/')}`);
    }
    (parent as unknown as unknown[]).push(value);
  } else if (/^[0-9]+$/.test(last)) {
    if (!Array.isArray(parent)) {
      parent[last] = value;
    } else {
      const idx = parseInt(last, 10);
      (parent as unknown as unknown[]).splice(idx, 0, value);
    }
  } else {
    parent[last] = value;
  }
}

function removeAtPath(obj: Record<string, unknown>, path: string[]): void {
  if (path.length === 0) {
    throw new Error('Remove patch requires a non-empty path');
  }
  const parentPath = path.slice(0, -1);
  const last = path[path.length - 1];
  let parent: Record<string, unknown> = obj;
  for (const key of parentPath) {
    if (!(key in parent) || parent[key] === null || typeof parent[key] !== 'object') {
      return;
    }
    parent = parent[key] as Record<string, unknown>;
  }

  if (/^[0-9]+$/.test(last) && Array.isArray(parent)) {
    const idx = parseInt(last, 10);
    if (idx >= 0 && idx < (parent as unknown as unknown[]).length) {
      (parent as unknown as unknown[]).splice(idx, 1);
    }
  } else {
    delete parent[last];
  }
}
