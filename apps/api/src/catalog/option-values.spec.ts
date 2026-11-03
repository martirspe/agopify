import {
  colorForOptionValue,
  isColorOptionName,
  normalizeOptionValues,
  optionValueLabels,
} from './option-values';

describe('option values', () => {
  it('accepts legacy strings and colored objects without duplicates', () => {
    expect(normalizeOptionValues([' Negro ', { value: 'Blanco', color: '#FfFfFf' }, 'negro', { value: '' }])).toEqual([
      { value: 'Negro' },
      { value: 'Blanco', color: '#ffffff' },
    ]);
    expect(optionValueLabels(normalizeOptionValues(['A', 'B']))).toEqual(['A', 'B']);
  });

  it('rejects invalid colors and looks up swatches by axis', () => {
    expect(normalizeOptionValues([{ value: 'Rojo', color: 'red' }])).toEqual([{ value: 'Rojo' }]);
    expect(
      colorForOptionValue(
        [{ name: 'Color', values: [{ value: 'Negro', color: '#111111' }] }],
        'color',
        'Negro',
      ),
    ).toBe('#111111');
    expect(isColorOptionName('Colores')).toBe(true);
    expect(isColorOptionName('Talla')).toBe(false);
  });
});
