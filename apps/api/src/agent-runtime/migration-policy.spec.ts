import { describeModeChange } from './migration-policy';

describe('describeModeChange', () => {
  it('flags live AI Core and legacy flips as medium risk', () => {
    expect(describeModeChange('shadow', 'ai_core').risk).toBe('medium');
    expect(describeModeChange('ai_core', 'legacy').risk).toBe('medium');
    expect(describeModeChange('inherit', 'shadow').risk).toBe('low');
  });
});
