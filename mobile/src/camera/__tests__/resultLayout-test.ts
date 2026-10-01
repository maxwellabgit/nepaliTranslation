import { photoAboveSheet, resultSheetTops } from '../resultLayout';

describe('camera result layout', () => {
  const image = { width: 1000, height: 1600 };
  const stage = { width: 390, height: 700 };

  it('shrinks the photo and lifts its center when the sheet rises', () => {
    const { expanded, collapsed } = resultSheetTops(stage.height);
    expect(expanded).toBeLessThan(collapsed);
    const lowered = photoAboveSheet(image, 0, stage, collapsed);
    const raised = photoAboveSheet(image, 0, stage, expanded);
    expect(raised.height).toBeLessThan(lowered.height);
    const loweredCenter = lowered.top + lowered.height / 2;
    const raisedCenter = raised.top + raised.height / 2;
    expect(raisedCenter).toBeLessThan(loweredCenter);
  });
});
