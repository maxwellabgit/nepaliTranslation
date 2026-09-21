import type { RefObject } from 'react';
import type {
  TranslateModeId,
  ViewportPreset,
  ViewportPresetId,
} from '../bridge/types';
import { VIEWPORT_PRESETS } from '../bridge/types';
import { TRANSLATE_MODE_LABELS } from '../bridge/config';

type Props = {
  viewport: ViewportPreset;
  viewportId: ViewportPresetId;
  onViewportChange: (id: ViewportPresetId) => void;
  iframeKey: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  translateMode: TranslateModeId;
  onTranslateMode: (mode: TranslateModeId) => void;
  modeHonesty: string;
};

const HOSTED_APP_SRC = '/hosted-app/index.html';

export function PhoneStage({
  viewport,
  viewportId,
  onViewportChange,
  iframeKey,
  iframeRef,
  translateMode,
  onTranslateMode,
  modeHonesty,
}: Props) {
  return (
    <section className="tg-phone-col">
      <div className="tg-controls-row">
        <div className="tg-field">
          <label htmlFor="tg-viewport">Viewport preset</label>
          <select
            id="tg-viewport"
            value={viewportId}
            onChange={(e) => onViewportChange(e.target.value as ViewportPresetId)}
          >
            {VIEWPORT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.width}×{p.height} — {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="tg-field">
          <label htmlFor="tg-mode">Translation mode</label>
          <select
            id="tg-mode"
            value={translateMode}
            onChange={(e) => onTranslateMode(e.target.value as TranslateModeId)}
          >
            {(Object.keys(TRANSLATE_MODE_LABELS) as TranslateModeId[]).map((id) => (
              <option key={id} value={id}>
                {TRANSLATE_MODE_LABELS[id].label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="tg-honesty">{modeHonesty}</p>
      <div
        className="tg-phone-frame"
        style={{ width: viewport.width + 22 }}
      >
        <div className="tg-phone-chrome">
          <span>Expo web shell</span>
          <span>
            {viewport.width}×{viewport.height}
          </span>
        </div>
        <div
          className="tg-phone-stage"
          style={{ width: viewport.width, height: viewport.height }}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            title="NepTranslate Expo web export"
            src={HOSTED_APP_SRC}
            width={viewport.width}
            height={viewport.height}
          />
        </div>
      </div>
    </section>
  );
}
