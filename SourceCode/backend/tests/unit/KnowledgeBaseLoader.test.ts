import { describe, it, expect } from 'vitest';
import { KnowledgeBaseLoader } from '../../src/knowledge/KnowledgeBaseLoader';

describe('KnowledgeBaseLoader', () => {
  it('loads default domain', async () => {
    const loader = new KnowledgeBaseLoader();
    const kb = await loader.load('./knowledge', 'default');
    expect(kb.activeDomain).toBe('default');
    expect(kb.domains.length).toBeGreaterThan(0);
    expect(kb.constraints.length).toBeGreaterThan(0);
  });

  it('merges transport domain over default', async () => {
    const loader = new KnowledgeBaseLoader();
    const kb = await loader.load('./knowledge', 'transport');
    expect(kb.activeDomain).toBe('transport');
    // constraints should be transport first, then default
    expect(kb.constraints[0]).toContain('高速公路');
  });
});
