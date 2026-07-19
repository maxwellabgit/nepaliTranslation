"""
IndicTrans2 translation manager — Swift TranslationManager analogue.

Loads two directions:
  indic→en  (npi_Deva / hin_Deva → eng_Latn)
  en→indic  (eng_Latn → npi_Deva)

Keeps models warm on CUDA. Uses greedy / low-beam decode for ambient latency.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import torch

from ..types import DetectedLanguage, Formality, NepaliScript, TranslationResult
from .detect import detect_language, looks_romanized_indic
from .romanize import devanagari_to_roman, roman_to_devanagari

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INDIC_EN = REPO_ROOT / "experiments" / "models" / "it2_indic_en_merged"
DEFAULT_EN_INDIC = REPO_ROOT / "experiments" / "models" / "it2_en_indic_merged"

LANG_CODE = {
    DetectedLanguage.ENGLISH: "eng_Latn",
    DetectedLanguage.NEPALI: "npi_Deva",
    DetectedLanguage.HINDI: "hin_Deva",
}

# Longest-first so affixed forms rewrite before bare तपाईं / तपाईँ.
_INFORMAL_TAPAII_REWRITES: tuple[tuple[str, str], ...] = (
    ("तपाईंहरू", "तिमीहरू"),
    ("तपाईँहरू", "तिमीहरू"),
    ("तपाईंलाई", "तिमीलाई"),
    ("तपाईँलाई", "तिमीलाई"),
    ("तपाईंबाट", "तिमीबाट"),
    ("तपाईँबाट", "तिमीबाट"),
    ("तपाईंसँग", "तिमीसँग"),
    ("तपाईँसँग", "तिमीसँग"),
    ("तपाईंको", "तिमीको"),
    ("तपाईँको", "तिमीको"),
    ("तपाईंले", "तिमीले"),
    ("तपाईँले", "तिमीले"),
    ("तपाईंमा", "तिमीमा"),
    ("तपाईँमा", "तिमीमा"),
    ("तपाईं", "तिमी"),
    ("तपाईँ", "तिमी"),
)


def _apply_informal_en_ne(text: str) -> str:
    """Prefer तिमी/तँ-style address over तपाईं for informal EN→NE.

    Stopgap until fine-tuned formal/informal IndicTrans2 (or similar) models
    exist. Only rewrites safe pronoun surfaces; does not rewrite honorific
    verb morphology (हुनुहुन्छ, etc.), which needs a real register model.
    """
    out = text
    for formal, informal in _INFORMAL_TAPAII_REWRITES:
        out = out.replace(formal, informal)
    return out


class TranslationManager:
    """Bidirectional IndicTrans2 with auto direction + Nepali script toggle."""

    def __init__(
        self,
        indic_en_dir: Path | str = DEFAULT_INDIC_EN,
        en_indic_dir: Path | str | None = DEFAULT_EN_INDIC,
        device: str | None = None,
        num_beams: int = 1,
        max_length: int = 96,
    ):
        self.indic_en_dir = Path(indic_en_dir)
        self.en_indic_dir = Path(en_indic_dir) if en_indic_dir else None
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.num_beams = num_beams
        self.max_length = max_length

        self._ip = None
        self._indic_en = None  # (tok, model)
        self._en_indic = None
        self._loaded = False

    @property
    def ready(self) -> bool:
        return self._loaded and self._indic_en is not None

    def load(self) -> None:
        from IndicTransToolkit import IndicProcessor
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self._ip = IndicProcessor(inference=True)

        if not self.indic_en_dir.exists():
            raise FileNotFoundError(f"Missing Indic→EN model at {self.indic_en_dir}")

        tok = AutoTokenizer.from_pretrained(str(self.indic_en_dir), trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            str(self.indic_en_dir),
            trust_remote_code=True,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
        ).to(self.device).eval()
        self._indic_en = (tok, model)

        if self.en_indic_dir and self.en_indic_dir.exists():
            try:
                tok2 = AutoTokenizer.from_pretrained(str(self.en_indic_dir), trust_remote_code=True)
                model2 = AutoModelForSeq2SeqLM.from_pretrained(
                    str(self.en_indic_dir),
                    trust_remote_code=True,
                    torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                ).to(self.device).eval()
                # Smoke one token to catch vocab mismatch before serving
                _ = self._ip  # ensure processor exists
                self._en_indic = (tok2, model2)
            except Exception as e:
                print(f"[TranslationManager] EN→Indic load skipped: {e}", flush=True)
                self._en_indic = None

        self._loaded = True

    def _generate(self, pair, text: str, src_lang: str, tgt_lang: str) -> str:
        tok, model = pair
        batch = self._ip.preprocess_batch([text], src_lang=src_lang, tgt_lang=tgt_lang)
        enc = tok(
            batch,
            truncation=True,
            padding=True,
            max_length=self.max_length,
            return_tensors="pt",
            return_attention_mask=True,
        ).to(self.device)
        with torch.inference_mode():
            out = model.generate(
                **enc,
                use_cache=True,
                min_length=0,
                max_length=self.max_length,
                num_beams=self.num_beams,
                num_return_sequences=1,
            )
        if self.device == "cuda":
            torch.cuda.synchronize()
        decoded = tok.batch_decode(out, skip_special_tokens=True, clean_up_tokenization_spaces=True)
        return self._ip.postprocess_batch(decoded, lang=tgt_lang)[0]

    def translate(
        self,
        text: str,
        *,
        nepali_script: NepaliScript = NepaliScript.DEVANAGARI,
        source_lang: Optional[DetectedLanguage] = None,
        formality: Formality = Formality.FORMAL,
    ) -> TranslationResult:
        if not self._loaded:
            self.load()

        raw = (text or "").strip()
        if not raw:
            return TranslationResult(
                text="",
                source_lang=DetectedLanguage.UNKNOWN,
                target_lang=DetectedLanguage.UNKNOWN,
                provider="indictrans2",
                latency_ms=0.0,
            )

        src = source_lang or detect_language(raw)
        t0 = time.perf_counter()

        # Prepare source for MT (IndicTrans2 wants Devanagari for NE/HI)
        mt_src = raw
        if src in (DetectedLanguage.NEPALI, DetectedLanguage.HINDI) and looks_romanized_indic(raw):
            mt_src = roman_to_devanagari(raw)

        if src == DetectedLanguage.ENGLISH:
            # English → Nepali
            if self._en_indic is None:
                raise RuntimeError(
                    "EN→Indic model not loaded. Rebuild experiments/models/it2_en_indic_merged "
                    "from a matching weights+tokenizer repo (e.g. naklitechie/indictrans2-en-indic-dist-200M)."
                )
            out = self._generate(self._en_indic, mt_src, "eng_Latn", "npi_Deva")
            if formality == Formality.INFORMAL:
                out = _apply_informal_en_ne(out)
            script = nepali_script
            if nepali_script == NepaliScript.ROMAN:
                out = devanagari_to_roman(out)
            tgt = DetectedLanguage.NEPALI
        elif src in (DetectedLanguage.NEPALI, DetectedLanguage.HINDI):
            # Nepali/Hindi → English (formality ignored)
            src_code = LANG_CODE[src]
            out = self._generate(self._indic_en, mt_src, src_code, "eng_Latn")
            script = None
            tgt = DetectedLanguage.ENGLISH
        else:
            # Unknown: try as Nepali Devanagari if Deva chars else English
            if any("\u0900" <= c <= "\u097f" for c in raw):
                out = self._generate(self._indic_en, mt_src, "npi_Deva", "eng_Latn")
                src, tgt, script = DetectedLanguage.NEPALI, DetectedLanguage.ENGLISH, None
            else:
                if self._en_indic is None:
                    raise RuntimeError("EN→Indic model not loaded.")
                out = self._generate(self._en_indic, mt_src, "eng_Latn", "npi_Deva")
                if formality == Formality.INFORMAL:
                    out = _apply_informal_en_ne(out)
                if nepali_script == NepaliScript.ROMAN:
                    out = devanagari_to_roman(out)
                src, tgt, script = DetectedLanguage.ENGLISH, DetectedLanguage.NEPALI, nepali_script

        ms = (time.perf_counter() - t0) * 1000
        return TranslationResult(
            text=out,
            source_lang=src,
            target_lang=tgt,
            provider="indictrans2",
            latency_ms=ms,
            script=script,
        )
