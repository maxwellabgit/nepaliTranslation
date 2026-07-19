"""
IndicTrans2 translate API for serve.py — phone/PC same-origin /translate.

Warm-loads TranslationManager from core/ on first use (GPU if available).
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

_lock = threading.Lock()
_manager = None
_load_error: str | None = None
_warm_started = False


def _get_manager():
    global _manager, _load_error
    with _lock:
        if _manager is not None:
            return _manager
        if _load_error:
            raise RuntimeError(_load_error)
        try:
            from core.translation import TranslationManager
            from core.types import NepaliScript

            mgr = TranslationManager(num_beams=1, max_length=96)
            mgr.load()
            _manager = mgr
            # stash enum for handlers
            mgr._NepaliScript = NepaliScript  # type: ignore[attr-defined]
            return _manager
        except Exception as e:
            _load_error = f'{type(e).__name__}: {e}'
            raise


def warm() -> None:
    global _warm_started
    if _warm_started:
        return
    _warm_started = True
    try:
        _get_manager()
        print('[translate] IndicTrans2 ready', flush=True)
    except Exception as e:
        print(f'[translate] warm failed: {e}', flush=True)


def health() -> dict[str, Any]:
    if _load_error:
        return {'ok': False, 'status': 'error', 'error': _load_error}
    if _manager is None:
        return {'ok': False, 'status': 'loading' if _warm_started else 'cold'}
    return {
        'ok': True,
        'status': 'ready',
        'device': _manager.device,
        'en_indic': _manager._en_indic is not None,
        'indic_en': _manager._indic_en is not None,
        'provider': 'indictrans2',
    }


def translate(payload: dict[str, Any]) -> dict[str, Any]:
    """
    JSON body:
      text: str (required)
      script: 'devanagari' | 'roman' (Nepali output script when EN→NE)
      source_lang: optional 'en'|'ne'|'hi' (else auto-detect)
      formality: optional 'formal'|'informal' (EN→NE register; default formal)
    """
    text = (payload.get('text') or payload.get('q') or '').strip()
    if not text:
        return {'ok': False, 'error': 'empty text'}

    script_raw = (payload.get('script') or 'devanagari').lower()
    formality_raw = (payload.get('formality') or 'formal').lower()
    try:
        mgr = _get_manager()
    except Exception as e:
        return {'ok': False, 'error': str(e), 'status': 'unavailable'}

    NepaliScript = mgr._NepaliScript  # type: ignore[attr-defined]
    script = NepaliScript.ROMAN if script_raw == 'roman' else NepaliScript.DEVANAGARI

    from core.types import Formality

    formality = Formality.INFORMAL if formality_raw == 'informal' else Formality.FORMAL

    source_lang = None
    raw_src = payload.get('source_lang')
    if raw_src in ('en', 'ne', 'hi'):
        from core.types import DetectedLanguage

        source_lang = {
            'en': DetectedLanguage.ENGLISH,
            'ne': DetectedLanguage.NEPALI,
            'hi': DetectedLanguage.HINDI,
        }[raw_src]

    try:
        result = mgr.translate(
            text,
            nepali_script=script,
            source_lang=source_lang,
            formality=formality,
        )
    except Exception as e:
        return {'ok': False, 'error': f'{type(e).__name__}: {e}'}

    return {
        'ok': True,
        'text': result.text,
        'source_lang': result.source_lang.value,
        'target_lang': result.target_lang.value,
        'provider': result.provider,
        'latency_ms': round(result.latency_ms, 1),
        'script': result.script.value if result.script else None,
        'formality': formality.value,
        'cached': False,
    }
