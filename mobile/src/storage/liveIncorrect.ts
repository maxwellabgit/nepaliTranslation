import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';
import {
  contributionFingerprintFor,
  MODEL_VERSION,
  type ContributionDraft,
  type OutboxSurface,
} from './contributionOutbox';

export type CorrectionInput = {
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  formality: Formality | null | undefined;
  script: NepaliScript | null | undefined;
  surface: OutboxSurface;
  translationMethod?: string | null;
  modelVersion?: string | null;
};

/** Builds outbox fields for Mark incorrect / To training. No network. */
export function buildCorrectionDraftFields(
  input: CorrectionInput,
): Omit<
  ContributionDraft,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'status'
  | 'consent_version'
  | 'idempotency_key'
  | 'attemptCount'
  | 'lastAttemptAt'
  | 'nextAttemptAt'
  | 'lastErrorCode'
> | null {
  const source_text = input.source.trim();
  const model_output = input.translation.trim();
  if (!source_text || !model_output) return null;
  const formality = input.formality ?? null;
  const script = input.script ?? null;
  return {
    local_fingerprint: contributionFingerprintFor({
      source_text,
      model_output,
      source_lang: input.sourceLang,
      formality,
      script,
    }),
    surface: input.surface,
    source_text,
    model_output,
    correction_text: null,
    source_lang: input.sourceLang,
    formality,
    script,
    translation_method: input.translationMethod ?? null,
    model_version: input.modelVersion ?? MODEL_VERSION,
  };
}
