# Research fleet findings (2026-07-20 overnight)

## Competitor UX (must adopt)
1. One primary action per mode (Speak / Pass) — no feature grid  
2. Formal register as first-class (Papago honorific pattern)  
3. Honest offline badge — never Microsoft-style offline removal  
4. Conversation: big translation, small original, clear handoff  
5. Unified Your activity for Saved + History  

## Anti-patterns
Feature grids · language pickers for 2-lang product · premium-gating conversation/offline · cluttered chrome  

## Overnight FT (quality hybrid)
- ~32k curated-upsampled + filtered OPUS (opus_share ≤50%)  
- LoRA r=16, lr 5e-5, no formality prefixes tonight  
- EN→NE 5ep then NE→EN 4ep + roman  
- Gates: overall ≥51.5%, informal ≥59.5%, formal ≥65.5%  

## Open research (next week)
1. Does trained `<informal>` beat inference `applyInformal()` on gold?  
2. Rank sweep r=8/16/32 on curated set  
3. ILCI/TDIL 70k commercial license?  
4. Need third “neutral/service” register?  
5. whisper.rn vs Apple STT latency on device  

## Data gap to pull next
Full **BPCC-H-Daily** eng_Latn–npi_Deva (currently under-pulled at ~73 rows)
