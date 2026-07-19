"""Shared types for the ambient translation core (mirrors Swift AppState models)."""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from time import time
from typing import Optional


class DetectedLanguage(str, Enum):
    ENGLISH = "en"
    NEPALI = "ne"
    HINDI = "hi"
    UNKNOWN = "unknown"


class NepaliScript(str, Enum):
    """Manual toggle for Nepali display / English→Nepali output script."""

    DEVANAGARI = "devanagari"
    ROMAN = "roman"


class Formality(str, Enum):
    """EN→NE register: formal (तपाईं) vs informal (तिमी/तँ). NE→EN ignores this."""

    FORMAL = "formal"
    INFORMAL = "informal"


class PipelineStatus(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    TRANSCRIBING = "transcribing"
    TRANSLATING = "translating"
    READY = "ready"
    ERROR = "error"


@dataclass
class TranscriptEntry:
    """One finalized ambient utterance — mirrors Swift TranscriptEntry."""

    speaker: str
    source_text: str
    translated_text: str
    source_lang: DetectedLanguage
    target_lang: DetectedLanguage
    timestamp: float = field(default_factory=time)
    provider: str = "indictrans2"
    latency_ms: float = 0.0


@dataclass
class TranslationResult:
    text: str
    source_lang: DetectedLanguage
    target_lang: DetectedLanguage
    provider: str
    latency_ms: float
    script: Optional[NepaliScript] = None
