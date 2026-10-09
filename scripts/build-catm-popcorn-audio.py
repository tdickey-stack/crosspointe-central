#!/usr/bin/env python3
"""Build the lab clip from the user-supplied Céline Woodburn popcorn recording.

Usage: python3 scripts/build-catm-popcorn-audio.py /path/to/source.wav
Uses macOS afconvert; leaves the original recording untouched.
"""
import array
import pathlib
import subprocess
import sys
import tempfile
import wave


def main():
    source = pathlib.Path(sys.argv[1]).resolve()
    output = pathlib.Path(__file__).resolve().parents[1] / "public/catm-popcorn-pops.wav"
    with tempfile.TemporaryDirectory(prefix="catm-audio-") as directory:
        converted = pathlib.Path(directory) / "source.wav"
        subprocess.run(["afconvert", str(source), str(converted), "-f", "WAVE", "-d", "LEI16@22050"], check=True)
        with wave.open(str(converted)) as recording:
            rate = recording.getframerate()
            if recording.getnchannels() != 1:
                raise ValueError("Expected the original mono recording")
            recording.setpos(20 * rate)
            samples = array.array("h", recording.readframes(21 * rate))
        if sys.byteorder != "little":
            samples.byteswap()
        fade = round(rate * 0.01)
        for index in range(fade):
            samples[index] = round(samples[index] * index / fade)
            samples[-index - 1] = round(samples[-index - 1] * index / fade)
        if sys.byteorder != "little":
            samples.byteswap()
        with wave.open(str(output), "wb") as clip:
            clip.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            clip.writeframes(samples.tobytes())
    print(f"Wrote {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
