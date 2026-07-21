# Overnight hybrid FT plan (2026-07-20)

## Intent
Quality-first **hybrid** IndicTrans2 LoRA for next TestFlight decision.
Formality control tokens **off** tonight — meaning/fluency only; register via inference rewrite.

## Pipeline
```powershell
python training/run_overnight_pipeline.py
```
1. Wait for `it2_big` NE→EN to finish  
2. Eval `it2_base,it2_big` → `ft_it2_big_post.*`  
3. `prepare_overnight_hybrid.py` (~32k curated+filtered)  
4. EN→NE: r=16, 5 epochs, lr 5e-5  
5. NE→EN: r=16, 4 epochs + 6k roman  
6. Eval `it2_base,it2_big,it2_overnight` → `ft_overnight_post.*`

## Gates vs `it2_base` (50.8% overall)
| Gate | Threshold |
|------|-----------|
| Overall | ≥ 51.5% |
| Informal | ≥ 59.5% |
| Formal floor | ≥ 65.5% |
| NE→EN Deva | ≥ 69.5% |
| Roman | ≥ 9.0% |

## Stop doing
- 60k OPUS-heavy mixes  
- LoRA r=32 on noisy data  
- Synthetic `to_informal()` bulk expand  
- Shipping adapters that fail formal gate  

## UX / review (parallel)
- Gold Review: Correct uses edits; Share export; Premium filter; Undo; bench snapshot  
- Auto: honest offline badge; Formal/script on result label  
- Conversation: Roman small-text fix; clearer Pass copy  
