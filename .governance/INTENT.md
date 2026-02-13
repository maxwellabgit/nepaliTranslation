# INTENT
Last updated: 2026-02-11

## North Star
Real-time bidirectional Nepali-English translation running entirely on a single iPhone 17 Pro acting as edge compute for two pairs of open-source smart glasses. Two modes: Conversation (two glasses, two clean audio streams, no diarization) and Ambient (one glasses, single audio stream, automatic diarization). Zero internet required. Text output only. All inference on the iPhone.

## V1 Vision
Two pairs of smart glasses connect to one iPhone 17 Pro over Bluetooth audio. The iPhone is the shared brain -- it receives audio from the glasses, runs STT + translation, and sends translated text back to each pair's display. Conversation Mode uses two streams (one per glasses wearer, no diarization). Ambient Mode uses one stream from a single pair and diarizes to separate speakers.

## MVP Scope
Smart glasses hardware is not yet available. Two iPhones stand in for two pairs of glasses to validate both modes. Phone A simulates the remote glasses (captures close-talk audio, streams to hub). Phone B is the hub (edge compute + simulates the second pair of glasses). The two-phone setup exists solely to test Conversation Mode and Ambient Mode before glasses arrive. The iPhone's role as edge compute is identical in MVP and V1 -- only the input/output peripherals change.

## Goals (this iteration -- MVP)
- [ ] Milestone 1: Audio capture pipeline with AVAudioEngine + VAD (energy-based, voice-processing mode)
- [ ] Milestone 2: On-device STT via whisper.cpp (Whisper small, GGML quantized, CoreML accelerated)
- [ ] Milestone 3: On-device translation via OPUS-MT CoreML models (ne->en, en->ne formal, en->ne informal)
- [ ] Milestone 4: Conversation Mode with Multipeer Connectivity (hub processes both streams, remote streams mic audio, no diarization)
- [ ] Milestone 5: Ambient Mode with ECAPA-TDNN diarization + online cosine-similarity clustering (single phone captures all audio)
- [ ] Milestone 6: Integration polish -- mode selection, all toggles wired, latency optimization, error handling, end-to-end testing on physical iPhone 17 Pro

## Constraints
- Must: run fully offline with zero internet
- Must: use Swift/SwiftUI as the only application language
- Must: bundle all models in-app (~560MB total: Whisper small ~200MB, OPUS-MT ne->en ~150MB, OPUS-MT en->ne ~150MB, ECAPA-TDNN ~60MB)
- Must: perform all inference on the hub phone (edge compute) only
- Must: use Multipeer Connectivity for phone-to-phone communication in MVP
- Must: support manual formal/informal Nepali style toggle
- Must: design audio input abstraction so swapping phones for Bluetooth glasses requires no pipeline changes
- Must not: require an Apple Developer account for dev builds (free Apple ID signing via USB)
- Must not: depend on any server infrastructure
- Must not: transcribe ambient noise in Conversation Mode (close-talk + beamforming + VAD threshold)

## Not Doing
- Server-side or cloud inference
- Voice enrollment / personalized voiceprint calibration (post-MVP)
- WebRTC networking
- App Store or TestFlight submission (for now)
- Audio output / TTS (text output only)
- Fine-tuned model training (MVP uses base OPUS-MT; interface ready for drop-in fine-tuned models)
- Smart glasses integration (deferred until hardware arrives; MVP uses phones as stand-ins)

## Definition of Done (MVP)
- Conversation Mode: Person A speaks Nepali on remote phone (glasses stand-in), English text appears on hub; Person B speaks English on hub, Nepali text appears on remote. Speaker labels deterministic. No diarization needed.
- Ambient Mode: Hub phone captures surrounding audio, segments by speaker via diarization, transcribes, translates, displays labeled text with manual N->E / E->N direction toggle.
- Both modes working end-to-end on a physical iPhone 17 Pro with acceptable latency (target 1-2s per segment).
- Formal/informal toggle functional in UI (wired to same model for MVP, ready for fine-tuned swap).
- Audio input layer abstracted so Bluetooth glasses can replace phone mic with no pipeline changes.

## Sensitive areas (avoid unless explicitly requested)
- Resources/Models/
- .env
- Multipeer session encryption keys
- Any credential or signing configuration
