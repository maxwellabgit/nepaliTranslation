Nepali Whisper ggml (not stock Whisper small) belongs here:

  ggml-ne-small-q5_1.bin   (~190 MB, gitignored)

Copy with:

  WHISPER_GGML=/path/to/ggml-ne-small-q5_1.bin node ../scripts/fetch_whisper_nepali.mjs

Check:

  node ../scripts/fetch_whisper_nepali.mjs --check

The app probes this filename from `src/stt/nepaliAsr.ts`. whisper.rn is not
linked in this install — typed Nepali fallback stays until a later EAS build.
