import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';
import {
  contributionKeyFor,
  type ContributionDraft,
  type OutboxSurface,
} from './contributionOutbox';

export type CorrectionInput = {
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  formality: Formality;
  script: NepaliScript;
  surface: OutboxSurface;
};

/** Builds outbox fields for Mark incorrect / To training. No network. */
export function buildCorrectionDraftFields(
  input: CorrectionInput,
): Omit<ContributionDraft, 'id' | 'created_at' | 'updated_at' | 'status' | 'consent_version'> | null {
  const source_text = input.source.trim();
  const model_output = input.translation.trim();
  if (!source_text || !model_output) return null;
  return {
    idempotency_key: contributionKeyFor({
      source_text,
      model_output,
      source_lang: input.sourceLang,
      formality: input.formality,
      script: input.script,
    }),
    surface: input.surface,
    source_text,
    model_output,
    correction_text: null,
    source_lang: input.sourceLang,
    formality: input.formality,
    script: input.script,
  };
}
