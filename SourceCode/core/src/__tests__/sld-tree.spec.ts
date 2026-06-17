import { describe, it, expect } from 'vitest';
import { SLDTree, TreePath } from '../index.js';

describe('SLDTree', () => {
  describe('constructor', () => {
    it('creates default tree with NamedLayer > UserStyle > FeatureTypeStyle > Rule > Mark Symbolizer', () => {
      const tree = new SLDTree();
      const root = tree.root;

      expect(root.version).toBe('1.0.0');
      expect(root.namedLayer.type).toBe('NamedLayer');
      expect(root.namedLayer.data.name).toBe('default_layer');
      expect(root.namedLayer.children).toHaveLength(1);

      const userStyle = root.namedLayer.children[0];
      expect(userStyle.type).toBe('UserStyle');
      expect(userStyle.data.name).toBe('default_style');
      expect(userStyle.children).toHaveLength(1);

      const fts = userStyle.children[0];
      expect(fts.type).toBe('FeatureTypeStyle');
      expect(fts.children).toHaveLength(1);

      const rule = fts.children[0];
      expect(rule.type).toBe('Rule');
      expect(rule.data.name).toBe('default_rule');
      expect(rule.children).toHaveLength(1);

      const sym = rule.children[0];
      expect(sym.type).toBe('Symbolizer');
      expect(sym.kind).toBe('Mark');
      expect(sym.data.markWellKnownName).toBe('circle');
    });
  });

  describe('addNode', () => {
    it('adds a FeatureTypeStyle under UserStyle', () => {
      const tree = new SLDTree();
      const userStylePath = new TreePath([0, 0]);
      const newTree = tree.addNode(userStylePath, 'FeatureTypeStyle');

      expect(newTree.root.namedLayer.children[0].children).toHaveLength(2);
      const newFts = newTree.root.namedLayer.children[0].children[1];
      expect(newFts.type).toBe('FeatureTypeStyle');
      expect(newFts.children).toHaveLength(1); // default rule
    });

    it('adds a Rule under FeatureTypeStyle', () => {
      const tree = new SLDTree();
      const ftsPath = new TreePath([0, 0, 0]);
      const newTree = tree.addNode(ftsPath, 'Rule');

      expect(newTree.root.namedLayer.children[0].children[0].children).toHaveLength(2);
    });

    it('adds a Symbolizer under Rule with specified kind', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      const newTree = tree.addNode(rulePath, 'Symbolizer', 'Line');

      const rule = newTree.root.namedLayer.children[0].children[0].children[0];
      expect(rule.children).toHaveLength(2);
      expect(rule.children[1].kind).toBe('Line');
    });

    it('throws when adding UserStyle to NamedLayer that already has one (MVP constraint)', () => {
      const tree = new SLDTree();
      const namedLayerPath = new TreePath([0]);
      expect(() => tree.addNode(namedLayerPath, 'UserStyle')).toThrow(
        'MVP only supports one UserStyle per NamedLayer'
      );
    });

    it('throws when adding NamedLayer', () => {
      const tree = new SLDTree();
      const rootPath = new TreePath([]);
      expect(() => tree.addNode(rootPath, 'NamedLayer')).toThrow(
        'NamedLayer can only exist at root level'
      );
    });
  });

  describe('removeNode', () => {
    it('removes a FeatureTypeStyle', () => {
      const tree = new SLDTree();
      const userStylePath = new TreePath([0, 0]);
      const treeWithTwo = tree.addNode(userStylePath, 'FeatureTypeStyle');
      const ftsPath = new TreePath([0, 0, 1]);
      const newTree = treeWithTwo.removeNode(ftsPath);

      expect(newTree.root.namedLayer.children[0].children).toHaveLength(1);
    });

    it('throws when removing the last UserStyle', () => {
      const tree = new SLDTree();
      const userStylePath = new TreePath([0, 0]);
      expect(() => tree.removeNode(userStylePath)).toThrow('Cannot remove the last UserStyle');
    });

    it('throws when removing the last FeatureTypeStyle', () => {
      const tree = new SLDTree();
      const ftsPath = new TreePath([0, 0, 0]);
      expect(() => tree.removeNode(ftsPath)).toThrow('Cannot remove the last FeatureTypeStyle');
    });

    it('throws when removing the last Rule', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      expect(() => tree.removeNode(rulePath)).toThrow('Cannot remove the last Rule');
    });

    it('throws when removing the last Symbolizer', () => {
      const tree = new SLDTree();
      const symPath = new TreePath([0, 0, 0, 0, 0]);
      expect(() => tree.removeNode(symPath)).toThrow('Cannot remove the last Symbolizer');
    });

    it('throws when removing root NamedLayer', () => {
      const tree = new SLDTree();
      const rootPath = new TreePath([0]);
      expect(() => tree.removeNode(rootPath)).toThrow('Cannot remove root NamedLayer');
    });
  });

  describe('updateNode', () => {
    it('updates node data fields', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      const newTree = tree.updateNode(rulePath, { name: 'my_rule', title: 'My Rule' });

      const rule = newTree.root.namedLayer.children[0].children[0].children[0];
      expect(rule.data.name).toBe('my_rule');
      expect(rule.data.title).toBe('My Rule');
    });

    it('preserves unmodified fields', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      const originalName = tree.root.namedLayer.children[0].children[0].children[0].data.name;
      const newTree = tree.updateNode(rulePath, { title: 'Updated' });

      const rule = newTree.root.namedLayer.children[0].children[0].children[0];
      expect(rule.data.name).toBe(originalName);
      expect(rule.data.title).toBe('Updated');
    });

    it('does not mutate original tree', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      const newTree = tree.updateNode(rulePath, { name: 'changed' });

      const originalRule = tree.root.namedLayer.children[0].children[0].children[0];
      expect(originalRule.data.name).toBe('default_rule');

      const newRule = newTree.root.namedLayer.children[0].children[0].children[0];
      expect(newRule.data.name).toBe('changed');
    });
  });

  describe('moveNode', () => {
    it('moves a node within the same parent', () => {
      const tree = new SLDTree();
      const userStylePath = new TreePath([0, 0]);
      const treeWithTwo = tree.addNode(userStylePath, 'FeatureTypeStyle');

      const sourcePath = new TreePath([0, 0, 1]);
      const targetPath = new TreePath([0, 0, 0]);
      const newTree = treeWithTwo.moveNode(sourcePath, targetPath);

      const ftsList = newTree.root.namedLayer.children[0].children;
      expect(ftsList).toHaveLength(2);
    });

    it('throws when moving across different levels', () => {
      const tree = new SLDTree();
      const sourcePath = new TreePath([0, 0, 0]);
      const targetPath = new TreePath([0, 0, 0, 0]);
      expect(() => tree.moveNode(sourcePath, targetPath)).toThrow(
        'Move only supported within the same level'
      );
    });
  });

  describe('toGeoStyler', () => {
    it('converts default tree to GeoStyler style', () => {
      const tree = new SLDTree();
      const style = tree.toGeoStyler();

      expect(style.name).toBe('default_style');
      expect(style.rules).toHaveLength(1);
      expect(style.rules[0].name).toBe('default_rule');
      expect(style.rules[0].symbolizers).toHaveLength(1);
      expect(style.rules[0].symbolizers![0].kind).toBe('Mark');
    });
  });

  describe('validate', () => {
    it('returns empty issues for valid default tree', () => {
      const tree = new SLDTree();
      const issues = tree.validate();
      expect(issues).toHaveLength(0);
    });
  });

  describe('getNodeAt', () => {
    it('returns node at given path', () => {
      const tree = new SLDTree();
      const rulePath = new TreePath([0, 0, 0, 0]);
      const node = tree.getNodeAt(rulePath);
      expect(node).not.toBeNull();
      expect(node!.type).toBe('Rule');
    });

    it('returns null for invalid path', () => {
      const tree = new SLDTree();
      const invalidPath = new TreePath([99, 99, 99]);
      const node = tree.getNodeAt(invalidPath);
      expect(node).toBeNull();
    });
  });
});
