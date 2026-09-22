import { sizeClassForWidth, contentMaxWidth } from '../sizeClass';

describe('sizeClass', () => {
  test('maps phone and iPad widths', () => {
    expect(sizeClassForWidth(390)).toBe('phone');
    expect(sizeClassForWidth(768)).toBe('tablet11');
    expect(sizeClassForWidth(1024)).toBe('tablet13');
  });

  test('content max width only on tablets', () => {
    expect(contentMaxWidth('phone')).toBeUndefined();
    expect(contentMaxWidth('tablet11')).toBe(600);
    expect(contentMaxWidth('tablet13')).toBe(720);
  });
});
