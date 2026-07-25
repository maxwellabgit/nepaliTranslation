# synthetic/ — student then teacher

```
synthetic/
  english_pool/        # EN queue ready to translate (may equal gold seeds + expansions)
  student_raw/         # on-device student (dist-200M) formal + informal hypotheses
  teacher_reviewed/    # IndicTrans2 1B accept/rewrite/reject
  manifests/
```

Pipeline:

```powershell
python datasets/scripts/seed_english_domains.py
python datasets/scripts/generate_synthetic_student.py --limit 500
python datasets/scripts/review_synthetic_teacher.py --limit 500
```

Student = what the phone roughly produces.  
Teacher = smartest same-family model we run overnight on this GPU.
