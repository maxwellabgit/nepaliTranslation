export type MeaningUnit = {
  meaning_id: string;
  english: string;
  ne_formal: string;
  ne_informal: string;
  roman_formal: string;
  roman_informal: string;
  surface: string;
  provenance: string;
  unit?: string;
};

export type MeaningReviewPack = {
  version: number;
  packed_at: string;
  purpose: string;
  model_family: string;
  n_items: number;
  items: MeaningUnit[];
};
