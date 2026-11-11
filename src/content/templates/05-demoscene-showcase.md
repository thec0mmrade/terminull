---
title: "Demoscene Showcase: Terminal Aesthetics"
author: "Maya Nakamura"
handle: "gl1tch_"
date: 2025-06-15
volume: 1
order: 5
category: ascii-art
tags: [demoscene, art, audio, video, media]
description: "A multimedia showcase of terminal art, chiptune audio, and demo captures."
draft: true
---

# Demoscene Showcase: Terminal Aesthetics

The demoscene has always pushed hardware to its limits. In this showcase we collect some of our favorite terminal-adjacent works -- visuals, sounds, and captures from the underground.

## The Visual

A still from **dither.exe**, a real-time ASCII raymarcher by collective VORC:

![ASCII raymarcher output showing a rotating torus rendered in box-drawing characters](/media/vol1/dither-torus.png)

The technique maps luminance values to a density-sorted character ramp: ` .:-=+*#%@`. At 60fps in a 120x40 terminal, the effect is hypnotic.

> [!HACK] You can run dither.exe yourself -- it's a single static binary. Grab it from the VORC repo.

## The Sound

Chiptune artist **n0pulse** composed this track entirely using terminal bell sequences and PCM synthesis piped through `/dev/dsp`:

<audio controls>
  <source src="/media/vol1/n0pulse-bellcode.opus" type="audio/opus">
  <source src="/media/vol1/n0pulse-bellcode.mp3" type="audio/mpeg">
  Your terminal does not support audio playback.
</audio>

The track layers square waves at specific frequencies to emulate the SID chip, all generated from a 200-line shell script.

> [!INFO] The full source of the audio generator is available in the supplemental materials.

## The Demo

Captured from the 2025 Revision party, this 4K intro runs entirely inside a VT100-compatible terminal emulator:

<video controls width="640" poster="/media/vol1/revision-poster.png">
  <source src="/media/vol1/revision-4k-intro.webm" type="video/webm">
  <source src="/media/vol1/revision-4k-intro.mp4" type="video/mp4">
  Your terminal does not support video playback.
</video>

The intro packs a full 3-minute journey -- plasma effects, starfields, scrollers, and a vector cube -- into exactly 4096 bytes of x86 assembly.

## Why It Matters

The demoscene reminds us that constraints breed creativity. A 80x24 grid of characters is not a limitation -- it's a canvas.

```
  ╔══════════════════════════════════╗
  ║  "Art is not what you see,      ║
  ║   but what you make others see" ║
  ║                   -- E. Degas   ║
  ╚══════════════════════════════════╝
```

> [!WARN] Some demos use aggressive terminal escape sequences. Run unfamiliar binaries in a sandboxed environment.
