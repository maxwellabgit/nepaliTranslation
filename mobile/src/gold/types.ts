export type GoldProvenance = {
  dataset_id: string;
  trust: string;
  tier?: string;
  note?: string | null;
  seed_parents?: string[];
};

export type GoldClassMeta = {
  id: string;
  direction: string;
  register: string;
  script: string;
  source_lang: string;
  target_lang: string;
  source_label: string;
  target_label: string;
};

export type GoldItem = {
  id: string;
  class_id: string;
  direction: string;
  register: string;
  script: string;
  source_lang: string;
  target_lang: string;
  source_label: string;
  target_label: string;
  source: string;
  reference: string;
  deva?: string | null;
  pack_status: string;
  provenance: GoldProvenance;
  multi_sentence?: boolean;
};

export type DatasetCatalogEntry = {
  id: string;
  trust: string;
  license: string;
  use: string;
  seed_parents?: string[];
};

export type GoldReviewPack = {
  version: number;
  packed_at: string;
  model_family: string;
  purpose: string;
  classes: GoldClassMeta[];
  dataset_catalog: DatasetCatalogEntry[];
  n_items: number;
  items: GoldItem[];
};
