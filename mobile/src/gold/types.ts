export type GoldClassId =
  | 'en_ne_formal'
  | 'en_ne_informal'
  | 'ne_en_deva'
  | 'ne_en_roman';

export type GoldReviewItem = {
  id: string;
  class_id: GoldClassId | string;
  direction: string;
  register: string;
  script: string;
  source_label: string;
  target_label: string;
  source: string;
  reference: string;
  deva?: string | null;
};

export type GoldReviewPack = {
  version: number;
  packed_at: string;
  purpose: string;
  n_items: number;
  classes: Array<{
    id: string;
    direction: string;
    register: string;
    script: string;
    source_label: string;
    target_label: string;
  }>;
  items: GoldReviewItem[];
};
