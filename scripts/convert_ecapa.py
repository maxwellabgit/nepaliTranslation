#!/usr/bin/env python3
"""
Convert ECAPA-TDNN speaker embedding model to CoreML format.

Usage (run on macOS with Python 3.10+):
    pip install speechbrain coremltools torch torchaudio
    python scripts/convert_ecapa.py --output models/ecapa_tdnn.mlpackage

The ECAPA-TDNN model (~14M params) takes a mel spectrogram as input and
outputs a 192-dimensional speaker embedding vector.

After conversion, copy ecapa_tdnn.mlpackage into:
    NepTranslate/NepTranslate/Resources/Models/

Then add it to the Xcode project target.
"""

import argparse


def convert(output_path: str):
    import torch
    import coremltools as ct

    print("Loading ECAPA-TDNN from SpeechBrain ...")
    from speechbrain.pretrained import EncoderClassifier

    model = EncoderClassifier.from_hparams(
        source="speechbrain/spkrec-ecapa-voxceleb",
        savedir="tmp_ecapa",
    )

    # Extract the embedding model
    embedding_model = model.mods.embedding_model
    embedding_model.eval()

    # ECAPA-TDNN expects input shape: (batch, n_mels, time_steps)
    # Standard: 80 mel bands, variable time
    dummy_input = torch.randn(1, 80, 300)  # ~3 seconds of audio

    print("Tracing model ...")
    traced = torch.jit.trace(embedding_model, dummy_input)

    print("Converting to CoreML ...")
    mlmodel = ct.convert(
        traced,
        inputs=[
            ct.TensorType(name="mel_spectrogram", shape=(1, 80, ct.RangeDim(50, 1000))),
        ],
        compute_units=ct.ComputeUnit.CPU_AND_NE,
    )

    mlmodel.save(output_path)
    print(f"Saved → {output_path}")

    # Cleanup
    import shutil
    shutil.rmtree("tmp_ecapa", ignore_errors=True)

    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert ECAPA-TDNN to CoreML")
    parser.add_argument("--output", default="ecapa_tdnn.mlpackage",
                        help="Output .mlpackage path")
    args = parser.parse_args()
    convert(args.output)
