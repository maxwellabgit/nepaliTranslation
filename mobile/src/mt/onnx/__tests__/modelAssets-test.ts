import {
  hfResolveUrl,
  IT2_RELEASE_MANIFEST,
  IT2_REQUIRED_FILES,
} from '../modelAssets';

describe('IT2 release manifest pins', () => {
  test('both bundles pin an immutable revision (not main)', () => {
    for (const kind of ['en-indic', 'indic-en'] as const) {
      const bundle = IT2_RELEASE_MANIFEST.bundles[kind];
      expect(bundle.revision).toMatch(/^[0-9a-f]{40}$/i);
      expect(bundle.revision).not.toBe('main');
      expect(hfResolveUrl(bundle.repo, bundle.revision, 'encoder_model.onnx')).toContain(
        `/resolve/${bundle.revision}/`,
      );
      expect(hfResolveUrl(bundle.repo, bundle.revision, 'encoder_model.onnx')).not.toContain(
        '/resolve/main/',
      );
    }
  });

  test('every required file has a non-empty SHA-256 and size', () => {
    for (const kind of ['en-indic', 'indic-en'] as const) {
      const files = IT2_RELEASE_MANIFEST.bundles[kind].files;
      for (const name of IT2_REQUIRED_FILES) {
        const pin = files.find((f) => f.filename === name);
        expect(pin).toBeDefined();
        expect(pin!.sha256).toMatch(/^[0-9a-f]{64}$/i);
        expect(pin!.size).toBeGreaterThan(0);
      }
    }
  });
});
