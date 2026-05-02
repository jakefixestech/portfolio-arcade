// arcade-sound.js
// =====================================================================
// Jake's Arcade — shared sound engine
// =====================================================================
// Uses ZzFX (1KB chiptune synth) for retro 8-bit sound effects.
// All sounds are synthesized live — no audio files to download.
//
// USAGE in a page:
//   <script src="/arcade-sound.js"></script>
//   <script>
//     ArcadeSound.play('coin');
//     ArcadeSound.toggleMute();
//     ArcadeSound.isMuted(); // -> bool
//     ArcadeSound.injectToggleButton(); // adds the speaker icon to the page
//   </script>
//
// Mute state persists in sessionStorage so user unmutes once per tab session.
// =====================================================================

(function (window) {
  'use strict';

  // ---------------------------------------------------------------
  // ZzFX — Zuper Zmall Zound Zynth
  // by Frank Force — MIT License
  // https://github.com/KilledByAPixel/ZzFX
  // (Inlined here so the arcade has zero external deps)
  // ---------------------------------------------------------------
  let zzfxV = 0.3; // master volume
  let zzfxR = 44100; // sample rate
  let zzfxX = null; // AudioContext (lazy init on first user gesture)

  function getCtx() {
    if (!zzfxX) {
      try {
        zzfxX = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    // Resume if suspended (autoplay policy)
    if (zzfxX.state === 'suspended') {
      zzfxX.resume().catch(() => {});
    }
    return zzfxX;
  }

  function zzfx(
    volume, randomness, frequency, attack, sustain, release, shape, shapeCurve,
    slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation,
    bitCrush, delay, sustainVolume, decay, tremolo
  ) {
    volume = volume === undefined ? 1 : volume;
    randomness = randomness === undefined ? 0.05 : randomness;
    frequency = frequency === undefined ? 220 : frequency;
    attack = attack === undefined ? 0 : attack;
    sustain = sustain === undefined ? 0 : sustain;
    release = release === undefined ? 0.1 : release;
    shape = shape === undefined ? 0 : shape;
    shapeCurve = shapeCurve === undefined ? 1 : shapeCurve;
    slide = slide === undefined ? 0 : slide;
    deltaSlide = deltaSlide === undefined ? 0 : deltaSlide;
    pitchJump = pitchJump === undefined ? 0 : pitchJump;
    pitchJumpTime = pitchJumpTime === undefined ? 0 : pitchJumpTime;
    repeatTime = repeatTime === undefined ? 0 : repeatTime;
    noise = noise === undefined ? 0 : noise;
    modulation = modulation === undefined ? 0 : modulation;
    bitCrush = bitCrush === undefined ? 0 : bitCrush;
    delay = delay === undefined ? 0 : delay;
    sustainVolume = sustainVolume === undefined ? 1 : sustainVolume;
    decay = decay === undefined ? 0 : decay;
    tremolo = tremolo === undefined ? 0 : tremolo;

    let PI2 = Math.PI * 2;
    let sampleRate = zzfxR;
    let sign = (v) => v > 0 ? 1 : -1;
    let startSlide = slide *= 500 * PI2 / sampleRate / sampleRate;
    let startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / sampleRate;
    let b = [];
    let t = 0;
    let tm = 0;
    let i = 0;
    let j = 1;
    let r = 0;
    let c = 0;
    let s = 0;
    let f;
    let length;

    attack = attack * sampleRate + 9;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    deltaSlide *= 500 * PI2 / sampleRate ** 3;
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = repeatTime * sampleRate | 0;

    length = attack + decay + sustain + release + delay | 0;
    for (; i < length; b[i++] = s * volume) {
      if (!(++c % (bitCrush * 100 | 0))) {
        s = shape ? shape > 1 ? shape > 2 ? shape > 3 ?
          Math.sin((t % PI2) ** 3) :
          Math.max(Math.min(Math.tan(t), 1), -1) :
          1 - (2 * t / PI2 % 2 + 2) % 2 :
          1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) :
          Math.sin(t);
        s = (repeatTime ? 1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) : 1) *
          sign(s) * (Math.abs(s) ** shapeCurve) *
          (i < attack ? i / attack :
           i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume) :
           i < attack + decay + sustain ? sustainVolume :
           i < length - delay ? (length - i - delay) / release * sustainVolume :
           0);
        s = delay ? s / 2 + (delay > i ? 0 : (i < length - delay ? 1 : (length - i) / delay) * b[i - delay | 0] / 2) : s;
      }
      f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
      t += f - f * noise * (1 - (Math.sin(i) + 1) * 1e9 % 2);
      if (j && ++j > pitchJumpTime) {
        frequency += pitchJump;
        startFrequency += pitchJump;
        j = 0;
      }
      if (repeatTime && !(++r % repeatTime)) {
        frequency = startFrequency;
        slide = startSlide;
        j = j || 1;
      }
    }
    return b;
  }

  function zzfxP(...samples) {
    const ctx = getCtx();
    if (!ctx) return null;
    const buffer = ctx.createBuffer(samples.length, samples[0].length, zzfxR);
    const source = ctx.createBufferSource();
    samples.forEach((d, i) => buffer.getChannelData(i).set(d));
    source.buffer = buffer;

    // Master volume node respects mute
    const gain = ctx.createGain();
    gain.gain.value = zzfxV * (state.muted ? 0 : 1);

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    return source;
  }

  function zzfxPlay(...args) {
    return zzfxP(zzfx(...args));
  }

  // ---------------------------------------------------------------
  // Sound library — named effects with ZzFX parameter arrays
  // Each one is hand-tuned for a specific in-game event.
  // ---------------------------------------------------------------
  const SOUNDS = {
    // UI / page sounds
    coin:        [,,1675,,.06,.24,1,1.82,,,837,.06],
    button_click: [.5,,400,.01,,.04,1,1.6,,,,,,,,,,.5],
    button_hover: [.2,,1500,,,.02,1,2,,,,,,,,,,.4],

    // Generic positive / negative
    success:     [1.2,,523,.02,.16,.42,1,2.3,,,392,.06,,,,,,.66,.05],
    fail:        [,,200,.05,.05,.4,3,2,-3,,,,,2,,,,.7,.1],
    error_buzz:  [,,90,.02,.08,.2,4,2.4,,,,,,2,,,,.5,.05],

    // Universal events
    score_up:    [.5,,800,.01,.04,.08,1,2,,,200,.05,,,,,,.6],
    level_up:    [1.5,,440,.04,.18,.36,2,1.5,,,587,.04,,,,,,.7,.1,,494],
    game_over:   [1.8,,200,.04,.4,.7,3,2,,-2,,,,1.5,,.1,,.4,.2],
    insert_coin: [.8,,440,.02,.05,.1,2,1.5,,,830,.03,,,,,,.5,.05],

    // Whack-a-Virus
    whack_hit:   [.6,,260,.02,.04,.15,4,1.5,,,,,,2,,,,.6,.06],
    whack_miss:  [.4,,150,.02,.06,.2,3,1.5,,,,,,1,,,,.5,.1],

    // System Response
    response_tap:[.4,,1200,.01,.02,.05,1,2,,,,,,,,,,.3],
    response_late:[.4,,180,.02,.05,.15,3,1.5,,,,,,,,,,.5],

    // Component Match
    match_pair:  [.5,,800,.02,.06,.18,1,1.7,,,1100,.05,,,,,,.6],
    match_wrong: [.4,,200,.02,.06,.18,3,1.5,,,,,,2,,,,.5],
    card_flip:   [.3,,500,.005,.02,.04,1,1.5,,,,,,,,,,.4],

    // Error Override
    error_keystroke:[.3,,1100,,,.02,1,2,,,,,,,,,,.3],
    error_word:  [.5,,700,.01,.05,.12,1,1.6,,,900,.03,,,,,,.5],
    error_correct:[.5,,587,.02,.08,.2,1,1.6,,,784,.04,,,,,,.55],

    // Cursor Crawl
    cursor_eat:  [.5,,440,.02,.04,.12,1,1.7,,,660,.04,,,,,,.55],

    // USB Defender
    usb_deflect: [.4,,420,.02,.04,.1,1,1.8,,,,,,,,,,.55],
    usb_zap:     [.4,,800,.01,.03,.08,3,1.5,,,,,,1,,,,.5],

    // Bug Smasher
    bug_smash:   [.5,,300,.02,.05,.18,2,1.6,,,,,,2,,,,.55,.05],

    // Spam Blaster
    spam_shoot:  [.3,,900,.01,.02,.06,1,1.8,,,,,,,,,,.4],
    spam_kill:   [.5,,150,.02,.08,.2,3,1.5,,,,,,2,,,,.55,.06],

    // Tower Stack
    tower_drop:  [.5,,300,.02,.04,.12,2,1.6,,,,,,,,,,.5,.05],
    tower_clear: [1,,587,.02,.12,.3,1,1.7,,,784,.06,,,,,,.6,.06,,880],

    // Packet Sort
    packet_catch:[.4,,660,.02,.04,.1,1,1.8,,,880,.04,,,,,,.5],
    packet_miss: [.4,,140,.02,.05,.15,3,1.5,,,,,,1.5,,,,.5],

    // Loop Trap
    loop_ticket: [.3,,1100,.005,.01,.04,1,2,,,,,,,,,,.3],
    loop_pellet: [.6,,440,.02,.06,.18,1,1.6,,,660,.05,,,,,,.55],
    loop_eat_tracer:[.7,,200,.02,.08,.2,2,1.5,,,440,.06,,,,,,.6,.05],
    loop_death:  [1,,180,.04,.3,.5,3,2,,-3,,,,1.5,,,,.4,.15],

    // Cable Untangle
    cable_pull:  [.5,,500,.04,.1,.22,1,1.6,,,700,.06,,,,,,.55,.05],
    cable_spark: [.6,,180,.01,.06,.2,4,2,,,,,,2,,,,.5,.06],

    // Portal page
    portal_whoosh:  [1,,80,.05,.5,.8,3,2,,,,,,1.5,,.2,,.5,.2,,440],
    portal_present: [.6,,440,.04,.16,.3,1,1.5,,,659,.06,,,,,,.6,.08],
    portal_reveal:  [1.5,,523,.04,.3,.6,1,1.6,,,784,.08,,,,,,.7,.12,,1046],
    portal_hover:   [.25,,1200,.005,,.04,1,2,,,,,,,,,,.4],
  };

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  const SS_KEY = 'arcade-sound-muted';
  const state = {
    // default to muted on first visit
    muted: (function () {
      try {
        const v = sessionStorage.getItem(SS_KEY);
        return v === null ? true : v === '1';
      } catch (e) {
        return true;
      }
    })(),
    listeners: [],
  };

  function persistMuted() {
    try {
      sessionStorage.setItem(SS_KEY, state.muted ? '1' : '0');
    } catch (e) {}
  }

  function setMuted(m) {
    state.muted = !!m;
    persistMuted();
    setMusicMuted(state.muted);
    state.listeners.forEach(fn => {
      try { fn(state.muted); } catch (e) {}
    });
  }

  function toggleMute() {
    setMuted(!state.muted);
    // If unmuting, play a tiny "ding" so user gets immediate feedback
    if (!state.muted) {
      // small delay so audio context resumes first
      setTimeout(() => {
        try { zzfxPlay(...SOUNDS.button_click); } catch (e) {}
      }, 30);
    }
  }

  function play(name) {
    if (state.muted) return;
    const params = SOUNDS[name];
    if (!params) {
      console.warn('[ArcadeSound] unknown sound:', name);
      return;
    }
    try {
      zzfxPlay(...params);
    } catch (e) {
      // Audio context not unlocked yet — silently fail
    }
  }

  // ---------------------------------------------------------------
  // Chiptune music engine
  // ---------------------------------------------------------------
  // Notes are encoded as semitone offsets from A4 (440 Hz).
  // 0 = A4, 12 = A5, -12 = A3, etc.  null = rest.
  // Each track has a bass line and a lead melody, plus a tempo (bpm)
  // and a wave shape per voice. The scheduler plays both voices in
  // sync, looping the patterns indefinitely.
  // ---------------------------------------------------------------

  // Helper: convert semitone offset to frequency
  function noteFreq(semitone) {
    if (semitone === null || semitone === undefined) return 0;
    return 440 * Math.pow(2, semitone / 12);
  }

  // Note name shortcut for readability when defining tracks below
  // C4 = -9, D4 = -7, E4 = -5, F4 = -4, G4 = -2, A4 = 0, B4 = 2
  // C5 = 3, D5 = 5, E5 = 7, F5 = 8, G5 = 10, A5 = 12, B5 = 14
  const N = {
    rest: null,
    // Octave 2 (very low bass)
    A2: -24, B2: -22, C2: -33, D2: -31, E2: -29, F2: -28, G2: -26,
    // Octave 3 (low bass)
    C3: -21, D3: -19, E3: -17, F3: -16, G3: -14, A3: -12, B3: -10,
    Cs3: -20, Ds3: -18, Fs3: -15, Gs3: -13, As3: -11,
    // Octave 4 (middle)
    C4: -9, D4: -7, E4: -5, F4: -4, G4: -2, A4: 0, B4: 2,
    Cs4: -8, Ds4: -6, Fs4: -3, Gs4: -1, As4: 1,
    // Octave 5 (lead)
    C5: 3, D5: 5, E5: 7, F5: 8, G5: 10, A5: 12, B5: 14,
    Cs5: 4, Ds5: 6, Fs5: 9, Gs5: 11, As5: 13,
    // Octave 6 (high lead)
    C6: 15, D6: 17, E6: 19, F6: 20, G6: 22, A6: 24,
  };

  // -------------------------
  // Track definitions
  // Each track: { tempo, lead: [...notes], bass: [...notes], shape: 'square' | 'triangle' | 'sawtooth' }
  // Notes are quarter-beats by default. Each entry = 1 beat.
  // -------------------------
  const TRACKS = {
    // ===== REPAIR BAY =====
    // Component Match — gentle puzzle: walking bass + simple major melody
    'component-match': {
      tempo: 110,
      leadShape: 'square',
      lead: [
        N.C5, N.E5, N.G5, N.E5,  N.D5, N.F5, N.A5, N.F5,
        N.E5, N.G5, N.C6, N.G5,  N.E5, N.D5, N.C5, N.rest,
        N.A4, N.C5, N.E5, N.C5,  N.G4, N.B4, N.D5, N.B4,
        N.C5, N.E5, N.G5, N.E5,  N.D5, N.C5, N.rest, N.rest,
      ],
      bass: [
        N.C3, N.rest, N.G3, N.rest,  N.F3, N.rest, N.C3, N.rest,
        N.C3, N.rest, N.G3, N.rest,  N.C3, N.G3, N.C3, N.rest,
        N.A3, N.rest, N.E3, N.rest,  N.G3, N.rest, N.D3, N.rest,
        N.C3, N.rest, N.G3, N.rest,  N.F3, N.G3, N.C3, N.rest,
      ],
    },

    // USB Defender — bouncy upbeat: defending the breakout
    'usb-defender': {
      tempo: 130,
      leadShape: 'square',
      lead: [
        N.E5, N.E5, N.B4, N.E5,  N.G5, N.rest, N.D5, N.rest,
        N.C5, N.E5, N.A5, N.G5,  N.E5, N.D5, N.C5, N.B4,
        N.E5, N.E5, N.B4, N.E5,  N.G5, N.A5, N.B5, N.A5,
        N.G5, N.E5, N.D5, N.E5,  N.C5, N.B4, N.A4, N.rest,
      ],
      bass: [
        N.E3, N.B3, N.E3, N.B3,  N.G3, N.D4, N.G3, N.D4,
        N.A3, N.E4, N.A3, N.E4,  N.E3, N.B3, N.E3, N.B3,
        N.E3, N.B3, N.E3, N.B3,  N.G3, N.D4, N.G3, N.D4,
        N.A3, N.E4, N.A3, N.E4,  N.E3, N.B3, N.E3, N.rest,
      ],
    },

    // Tower Stack — methodical building rhythm
    'tower-stack': {
      tempo: 120,
      leadShape: 'square',
      lead: [
        N.A4, N.rest, N.E5, N.rest,  N.A5, N.G5, N.E5, N.rest,
        N.D5, N.rest, N.A4, N.rest,  N.E5, N.D5, N.C5, N.rest,
        N.A4, N.rest, N.E5, N.rest,  N.A5, N.B5, N.A5, N.G5,
        N.E5, N.D5, N.E5, N.A4,  N.E5, N.A5, N.A4, N.rest,
      ],
      bass: [
        N.A2, N.rest, N.A3, N.rest,  N.A2, N.rest, N.E3, N.rest,
        N.D3, N.rest, N.D3, N.rest,  N.A2, N.rest, N.E3, N.rest,
        N.A2, N.rest, N.A3, N.rest,  N.A2, N.rest, N.E3, N.rest,
        N.D3, N.rest, N.D3, N.rest,  N.A2, N.E3, N.A3, N.rest,
      ],
    },

    // ===== CRASH COURSE =====
    // Whack-a-Virus — frantic minor key chase
    'whack-a-virus': {
      tempo: 150,
      leadShape: 'square',
      lead: [
        N.A4, N.C5, N.E5, N.A5,  N.G5, N.E5, N.C5, N.A4,
        N.A4, N.C5, N.E5, N.A5,  N.B5, N.A5, N.G5, N.E5,
        N.F5, N.E5, N.D5, N.C5,  N.B4, N.C5, N.D5, N.E5,
        N.A4, N.C5, N.E5, N.G5,  N.A5, N.E5, N.A4, N.rest,
      ],
      bass: [
        N.A3, N.E3, N.A3, N.E3,  N.A3, N.E3, N.A3, N.E3,
        N.A3, N.E3, N.A3, N.E3,  N.G3, N.D3, N.G3, N.D3,
        N.F3, N.C3, N.F3, N.C3,  N.G3, N.D3, N.G3, N.D3,
        N.A3, N.E3, N.A3, N.E3,  N.A3, N.E3, N.A3, N.rest,
      ],
    },

    // Bug Smasher — driving brick-breaker beat
    'bug-smasher': {
      tempo: 140,
      leadShape: 'square',
      lead: [
        N.D5, N.rest, N.A5, N.D5,  N.F5, N.A5, N.D6, N.A5,
        N.G5, N.E5, N.D5, N.A4,  N.D5, N.F5, N.A5, N.rest,
        N.D5, N.rest, N.A5, N.D5,  N.F5, N.A5, N.C6, N.A5,
        N.G5, N.E5, N.F5, N.E5,  N.D5, N.A4, N.D5, N.rest,
      ],
      bass: [
        N.D3, N.A3, N.D3, N.A3,  N.D3, N.A3, N.D3, N.A3,
        N.G3, N.D3, N.G3, N.D3,  N.A3, N.E3, N.A3, N.E3,
        N.D3, N.A3, N.D3, N.A3,  N.F3, N.C3, N.F3, N.C3,
        N.G3, N.D3, N.A3, N.E3,  N.D3, N.A3, N.D3, N.rest,
      ],
    },

    // Spam Blaster — space invaders descending bass
    'spam-blaster': {
      tempo: 160,
      leadShape: 'square',
      lead: [
        N.E4, N.E5, N.E4, N.E5,  N.G5, N.E5, N.B4, N.G4,
        N.D5, N.D4, N.D5, N.D4,  N.F5, N.D5, N.A4, N.F4,
        N.C5, N.C4, N.C5, N.C4,  N.E5, N.C5, N.G4, N.E4,
        N.B4, N.A4, N.G4, N.A4,  N.B4, N.D5, N.E5, N.rest,
      ],
      bass: [
        N.E3, N.E3, N.D3, N.D3,  N.C3, N.C3, N.B3, N.B3,
        N.E3, N.E3, N.D3, N.D3,  N.C3, N.C3, N.B3, N.B3,
        N.E3, N.E3, N.D3, N.D3,  N.C3, N.C3, N.B3, N.B3,
        N.A3, N.A3, N.B3, N.B3,  N.E3, N.E3, N.E3, N.rest,
      ],
    },

    // ===== SPEED LAB =====
    // System Response — sparse, suspenseful waiting
    'system-response': {
      tempo: 100,
      leadShape: 'triangle',
      lead: [
        N.C5, N.rest, N.rest, N.E5,  N.rest, N.G5, N.rest, N.rest,
        N.A4, N.rest, N.rest, N.C5,  N.rest, N.E5, N.rest, N.rest,
        N.G4, N.rest, N.rest, N.B4,  N.rest, N.D5, N.rest, N.rest,
        N.C5, N.rest, N.E5, N.rest,  N.G5, N.rest, N.C5, N.rest,
      ],
      bass: [
        N.C3, N.rest, N.rest, N.rest,  N.G3, N.rest, N.rest, N.rest,
        N.A3, N.rest, N.rest, N.rest,  N.E3, N.rest, N.rest, N.rest,
        N.G3, N.rest, N.rest, N.rest,  N.D3, N.rest, N.rest, N.rest,
        N.C3, N.rest, N.E3, N.rest,  N.G3, N.rest, N.C3, N.rest,
      ],
    },

    // Error Override — tense typing rhythm
    'error-override': {
      tempo: 145,
      leadShape: 'square',
      lead: [
        N.B4, N.D5, N.F5, N.D5,  N.B4, N.D5, N.F5, N.A5,
        N.G5, N.E5, N.C5, N.E5,  N.G5, N.E5, N.C5, N.rest,
        N.A4, N.C5, N.E5, N.C5,  N.A4, N.C5, N.E5, N.G5,
        N.F5, N.D5, N.B4, N.D5,  N.F5, N.A5, N.B5, N.rest,
      ],
      bass: [
        N.B3, N.F3, N.B3, N.F3,  N.B3, N.F3, N.B3, N.F3,
        N.C4, N.G3, N.C4, N.G3,  N.C4, N.G3, N.C4, N.rest,
        N.A3, N.E3, N.A3, N.E3,  N.A3, N.E3, N.A3, N.E3,
        N.B3, N.F3, N.B3, N.F3,  N.B3, N.F3, N.B3, N.rest,
      ],
    },

    // Packet Sort — cyberpunk pulse, syncopated
    'packet-sort': {
      tempo: 135,
      leadShape: 'square',
      lead: [
        N.E5, N.rest, N.E5, N.G5,  N.rest, N.E5, N.D5, N.E5,
        N.B4, N.D5, N.E5, N.rest,  N.G5, N.E5, N.D5, N.B4,
        N.A4, N.rest, N.A4, N.C5,  N.rest, N.E5, N.D5, N.C5,
        N.B4, N.D5, N.E5, N.G5,  N.E5, N.D5, N.E5, N.rest,
      ],
      bass: [
        N.E3, N.E3, N.B3, N.E3,  N.E3, N.E3, N.B3, N.E3,
        N.G3, N.G3, N.D4, N.G3,  N.G3, N.G3, N.D4, N.G3,
        N.A3, N.A3, N.E4, N.A3,  N.A3, N.A3, N.E4, N.A3,
        N.E3, N.B3, N.G3, N.D4,  N.E3, N.B3, N.E3, N.rest,
      ],
    },

    // ===== CODE MAZE =====
    // Cursor Crawl — classic snake-game vibe
    'cursor-crawl': {
      tempo: 125,
      leadShape: 'square',
      lead: [
        N.G4, N.B4, N.D5, N.G5,  N.D5, N.B4, N.G4, N.rest,
        N.A4, N.C5, N.E5, N.A5,  N.E5, N.C5, N.A4, N.rest,
        N.G4, N.B4, N.D5, N.G5,  N.E5, N.D5, N.B4, N.A4,
        N.G4, N.B4, N.D5, N.B4,  N.G4, N.D4, N.G4, N.rest,
      ],
      bass: [
        N.G3, N.D3, N.G3, N.D3,  N.G3, N.D3, N.G3, N.D3,
        N.A3, N.E3, N.A3, N.E3,  N.A3, N.E3, N.A3, N.E3,
        N.G3, N.D3, N.G3, N.D3,  N.C3, N.G3, N.C3, N.G3,
        N.G3, N.D3, N.G3, N.D3,  N.G3, N.D3, N.G3, N.rest,
      ],
    },

    // Loop Trap — pac-man maze chase
    'loop-trap': {
      tempo: 145,
      leadShape: 'square',
      lead: [
        N.C5, N.E5, N.G5, N.E5,  N.C5, N.E5, N.G5, N.A5,
        N.G5, N.F5, N.E5, N.D5,  N.C5, N.D5, N.E5, N.rest,
        N.B4, N.D5, N.F5, N.D5,  N.B4, N.D5, N.F5, N.G5,
        N.F5, N.E5, N.D5, N.C5,  N.D5, N.E5, N.C5, N.rest,
      ],
      bass: [
        N.C3, N.G3, N.C3, N.G3,  N.C3, N.G3, N.C3, N.G3,
        N.F3, N.C3, N.F3, N.C3,  N.G3, N.D3, N.G3, N.D3,
        N.B3, N.F3, N.B3, N.F3,  N.B3, N.F3, N.B3, N.F3,
        N.F3, N.C3, N.G3, N.D3,  N.C3, N.G3, N.C3, N.rest,
      ],
    },

    // Cable Untangle — thoughtful, slower puzzle vibe
    'cable-untangle': {
      tempo: 105,
      leadShape: 'triangle',
      lead: [
        N.D5, N.F5, N.A5, N.F5,  N.D5, N.A4, N.D5, N.rest,
        N.C5, N.E5, N.G5, N.E5,  N.C5, N.G4, N.C5, N.rest,
        N.B4, N.D5, N.F5, N.D5,  N.B4, N.F4, N.B4, N.rest,
        N.A4, N.C5, N.E5, N.G5,  N.E5, N.C5, N.A4, N.rest,
      ],
      bass: [
        N.D3, N.rest, N.A3, N.rest,  N.D3, N.rest, N.A3, N.rest,
        N.C3, N.rest, N.G3, N.rest,  N.C3, N.rest, N.G3, N.rest,
        N.B3, N.rest, N.F3, N.rest,  N.B3, N.rest, N.F3, N.rest,
        N.A3, N.rest, N.E3, N.rest,  N.A3, N.E3, N.A3, N.rest,
      ],
    },

    // ===== AMBIENT / CHILL TRACKS (lobby, rooms, portal, trophies) =====
    // These are quieter and slower — atmospheric, not attention-grabbing.

    // Portal — mysterious, slow, ethereal
    'portal': {
      tempo: 70,
      leadShape: 'triangle',
      volume: 0.07,
      lead: [
        N.A4, N.rest, N.rest, N.E5,  N.rest, N.rest, N.A5, N.rest,
        N.G5, N.rest, N.rest, N.E5,  N.rest, N.rest, N.D5, N.rest,
        N.C5, N.rest, N.rest, N.G4,  N.rest, N.rest, N.C5, N.rest,
        N.B4, N.rest, N.rest, N.E5,  N.rest, N.rest, N.A4, N.rest,
      ],
      bass: [
        N.A2, N.rest, N.rest, N.rest,  N.E3, N.rest, N.rest, N.rest,
        N.G2, N.rest, N.rest, N.rest,  N.D3, N.rest, N.rest, N.rest,
        N.C3, N.rest, N.rest, N.rest,  N.G2, N.rest, N.rest, N.rest,
        N.E3, N.rest, N.rest, N.rest,  N.A2, N.rest, N.rest, N.rest,
      ],
    },

    // Lobby — chill upbeat arcade ambient
    'lobby': {
      tempo: 85,
      leadShape: 'triangle',
      volume: 0.07,
      lead: [
        N.E5, N.rest, N.G5, N.rest,  N.A5, N.rest, N.G5, N.E5,
        N.D5, N.rest, N.E5, N.rest,  N.G5, N.rest, N.A5, N.rest,
        N.B5, N.rest, N.A5, N.G5,  N.E5, N.rest, N.D5, N.rest,
        N.E5, N.G5, N.A5, N.G5,  N.E5, N.D5, N.E5, N.rest,
      ],
      bass: [
        N.E3, N.rest, N.E3, N.rest,  N.A3, N.rest, N.A3, N.rest,
        N.D3, N.rest, N.D3, N.rest,  N.G3, N.rest, N.G3, N.rest,
        N.E3, N.rest, N.E3, N.rest,  N.A3, N.rest, N.A3, N.rest,
        N.D3, N.rest, N.G3, N.rest,  N.A3, N.E3, N.A3, N.rest,
      ],
    },

    // Repair Bay — relaxed workshop, blue mood
    'repair-bay': {
      tempo: 80,
      leadShape: 'triangle',
      volume: 0.06,
      lead: [
        N.D5, N.rest, N.F5, N.rest,  N.A5, N.rest, N.F5, N.rest,
        N.D5, N.rest, N.A4, N.rest,  N.D5, N.F5, N.A4, N.rest,
        N.C5, N.rest, N.E5, N.rest,  N.G5, N.rest, N.E5, N.rest,
        N.D5, N.rest, N.F5, N.D5,  N.A4, N.D5, N.A4, N.rest,
      ],
      bass: [
        N.D3, N.rest, N.A3, N.rest,  N.D3, N.rest, N.A3, N.rest,
        N.G3, N.rest, N.D3, N.rest,  N.A3, N.rest, N.D3, N.rest,
        N.C3, N.rest, N.G3, N.rest,  N.C3, N.rest, N.G3, N.rest,
        N.D3, N.rest, N.A3, N.rest,  N.D3, N.A3, N.D3, N.rest,
      ],
    },

    // Crash Course — slightly tense but laid-back, red mood
    'crash-course': {
      tempo: 90,
      leadShape: 'triangle',
      volume: 0.06,
      lead: [
        N.A4, N.rest, N.C5, N.rest,  N.E5, N.rest, N.C5, N.A4,
        N.G4, N.rest, N.B4, N.rest,  N.D5, N.rest, N.B4, N.G4,
        N.F4, N.rest, N.A4, N.rest,  N.C5, N.rest, N.E5, N.rest,
        N.A4, N.C5, N.E5, N.C5,  N.A4, N.E4, N.A4, N.rest,
      ],
      bass: [
        N.A3, N.rest, N.E3, N.rest,  N.A3, N.rest, N.E3, N.rest,
        N.G3, N.rest, N.D3, N.rest,  N.G3, N.rest, N.D3, N.rest,
        N.F3, N.rest, N.C3, N.rest,  N.F3, N.rest, N.C3, N.rest,
        N.A3, N.rest, N.E3, N.rest,  N.A3, N.E3, N.A3, N.rest,
      ],
    },

    // Speed Lab — clean cyberpunk drift, cyan mood
    'speed-lab': {
      tempo: 88,
      leadShape: 'triangle',
      volume: 0.06,
      lead: [
        N.E5, N.rest, N.B4, N.rest,  N.E5, N.rest, N.G5, N.rest,
        N.D5, N.rest, N.A4, N.rest,  N.D5, N.rest, N.F5, N.rest,
        N.C5, N.rest, N.G4, N.rest,  N.C5, N.rest, N.E5, N.rest,
        N.D5, N.E5, N.G5, N.E5,  N.D5, N.B4, N.E5, N.rest,
      ],
      bass: [
        N.E3, N.rest, N.B3, N.rest,  N.E3, N.rest, N.B3, N.rest,
        N.D3, N.rest, N.A3, N.rest,  N.D3, N.rest, N.A3, N.rest,
        N.C3, N.rest, N.G3, N.rest,  N.C3, N.rest, N.G3, N.rest,
        N.D3, N.rest, N.A3, N.rest,  N.E3, N.B3, N.E3, N.rest,
      ],
    },

    // Code Maze — chill matrix groove, green mood
    'code-maze': {
      tempo: 82,
      leadShape: 'triangle',
      volume: 0.06,
      lead: [
        N.G4, N.rest, N.B4, N.rest,  N.D5, N.rest, N.G5, N.rest,
        N.F5, N.rest, N.D5, N.rest,  N.B4, N.rest, N.G4, N.rest,
        N.A4, N.rest, N.C5, N.rest,  N.E5, N.rest, N.A5, N.rest,
        N.G5, N.E5, N.D5, N.B4,  N.G4, N.D4, N.G4, N.rest,
      ],
      bass: [
        N.G3, N.rest, N.D3, N.rest,  N.G3, N.rest, N.D3, N.rest,
        N.G3, N.rest, N.D3, N.rest,  N.G3, N.rest, N.D3, N.rest,
        N.A3, N.rest, N.E3, N.rest,  N.A3, N.rest, N.E3, N.rest,
        N.G3, N.D3, N.G3, N.D3,  N.G3, N.D3, N.G3, N.rest,
      ],
    },

    // Trophies — slow triumphant hall of fame
    'trophies': {
      tempo: 75,
      leadShape: 'triangle',
      volume: 0.06,
      lead: [
        N.C5, N.rest, N.E5, N.rest,  N.G5, N.rest, N.C6, N.rest,
        N.B5, N.rest, N.G5, N.rest,  N.E5, N.rest, N.C5, N.rest,
        N.A4, N.rest, N.C5, N.rest,  N.F5, N.rest, N.A5, N.rest,
        N.G5, N.E5, N.C5, N.E5,  N.G5, N.C5, N.G4, N.rest,
      ],
      bass: [
        N.C3, N.rest, N.G3, N.rest,  N.C3, N.rest, N.G3, N.rest,
        N.G3, N.rest, N.D3, N.rest,  N.G3, N.rest, N.D3, N.rest,
        N.F3, N.rest, N.C3, N.rest,  N.F3, N.rest, N.C3, N.rest,
        N.C3, N.G3, N.C3, N.G3,  N.C3, N.G3, N.C3, N.rest,
      ],
    },
  };

  // -------------------------
  // Music scheduler
  // -------------------------
  let musicState = null; // { trackName, gainNode, schedulerHandle, stopAt }

  function startMusic(trackName) {
    const track = TRACKS[trackName];
    if (!track) {
      console.warn('[ArcadeSound] unknown track:', trackName);
      return;
    }
    stopMusic();

    const ctx = getCtx();
    if (!ctx) return;

    // Per-track volume (chill bg tracks are quieter than game tracks)
    const trackVolume = track.volume !== undefined ? track.volume : 0.13;

    const masterGain = ctx.createGain();
    masterGain.gain.value = state.muted ? 0 : trackVolume;
    masterGain.connect(ctx.destination);

    musicState = {
      trackName,
      masterGain,
      track,
      ctx,
      trackVolume,
      nextNoteTime: ctx.currentTime + 0.1,
      step: 0,
      schedulerHandle: null,
      activeOscs: [],
    };

    scheduleAhead();
  }

  function scheduleAhead() {
    if (!musicState) return;
    const { ctx, track, masterGain } = musicState;
    const beatDur = 60 / track.tempo / 2; // each entry is 1/8th note
    const lookahead = 0.2; // seconds to schedule ahead
    const interval = 50; // ms

    while (musicState.nextNoteTime < ctx.currentTime + lookahead) {
      const idx = musicState.step % track.lead.length;
      const leadNote = track.lead[idx];
      const bassNote = track.bass[idx];
      scheduleNote(leadNote, musicState.nextNoteTime, beatDur, track.leadShape || 'square', 0.5, masterGain);
      scheduleNote(bassNote, musicState.nextNoteTime, beatDur, 'triangle', 0.7, masterGain);
      musicState.nextNoteTime += beatDur;
      musicState.step++;
    }

    musicState.schedulerHandle = setTimeout(scheduleAhead, interval);
  }

  function scheduleNote(semitone, time, duration, shape, vol, destination) {
    if (semitone === null || semitone === undefined) return;
    const ctx = musicState.ctx;
    const osc = ctx.createOscillator();
    osc.type = shape;
    osc.frequency.value = noteFreq(semitone);

    const noteGain = ctx.createGain();
    // Quick attack and decay so notes don't blend into a wash
    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(vol, time + 0.005);
    noteGain.gain.linearRampToValueAtTime(vol * 0.6, time + duration * 0.3);
    noteGain.gain.linearRampToValueAtTime(0, time + duration * 0.95);

    osc.connect(noteGain);
    noteGain.connect(destination);
    osc.start(time);
    osc.stop(time + duration);

    // Track for cleanup
    if (musicState && musicState.activeOscs) {
      musicState.activeOscs.push(osc);
      // Self-cleanup
      osc.onended = () => {
        if (musicState && musicState.activeOscs) {
          const i = musicState.activeOscs.indexOf(osc);
          if (i >= 0) musicState.activeOscs.splice(i, 1);
        }
      };
    }
  }

  function stopMusic() {
    if (!musicState) return;
    if (musicState.schedulerHandle) {
      clearTimeout(musicState.schedulerHandle);
      musicState.schedulerHandle = null;
    }
    const ctx = musicState.ctx;
    if (ctx && musicState.masterGain) {
      try {
        musicState.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      } catch (e) {}
    }
    setTimeout(() => {
      if (musicState && musicState.activeOscs) {
        musicState.activeOscs.forEach(o => { try { o.stop(); } catch (e) {} });
      }
      musicState = null;
    }, 350);
  }

  function setMusicMuted(muted) {
    if (!musicState) return;
    const ctx = musicState.ctx;
    if (!ctx) return;
    try {
      musicState.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : (musicState.trackVolume || 0.13),
        ctx.currentTime + 0.2
      );
    } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Mute toggle button — injected into page, top-right area
  // ---------------------------------------------------------------
  const ICON_MUTED = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 9 L7 9 L12 5 L12 19 L7 15 L3 15 Z" fill="currentColor"/><line x1="16" y1="9" x2="22" y2="15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><line x1="22" y1="9" x2="16" y2="15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const ICON_UNMUTED = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 9 L7 9 L12 5 L12 19 L7 15 L3 15 Z" fill="currentColor"/><path d="M16 8 Q19 12 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M19 5 Q23 12 19 19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function injectToggleButton(opts) {
    opts = opts || {};
    if (document.getElementById('arcade-sound-toggle')) return; // already injected
    const btn = document.createElement('button');
    btn.id = 'arcade-sound-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
    btn.innerHTML = state.muted ? ICON_MUTED : ICON_UNMUTED;
    btn.style.cssText = [
      'position:fixed',
      'top:1rem',
      'right:1rem',
      'z-index:100',
      'width:2.5rem',
      'height:2.5rem',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'padding:0',
      'background:rgba(0,0,0,0.5)',
      'border:1.5px solid rgba(148,163,184,0.45)',
      'border-radius:8px',
      'color:#cbd5e1',
      'cursor:pointer',
      'box-shadow:0 0 12px rgba(0,0,0,0.4)',
      'transition:all 0.2s ease',
      '-webkit-tap-highlight-color:transparent',
    ].join(';');

    btn.addEventListener('mouseenter', () => {
      btn.style.borderColor = '#fbbf24';
      btn.style.color = '#fbbf24';
      btn.style.boxShadow = '0 0 18px rgba(251,191,36,0.4)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.borderColor = 'rgba(148,163,184,0.45)';
      btn.style.color = '#cbd5e1';
      btn.style.boxShadow = '0 0 12px rgba(0,0,0,0.4)';
    });

    btn.addEventListener('click', () => {
      toggleMute();
    });

    btn.querySelector('svg').style.width = '1.25rem';
    btn.querySelector('svg').style.height = '1.25rem';

    state.listeners.push((muted) => {
      btn.innerHTML = muted ? ICON_MUTED : ICON_UNMUTED;
      btn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
      btn.querySelector('svg').style.width = '1.25rem';
      btn.querySelector('svg').style.height = '1.25rem';
    });

    document.body.appendChild(btn);
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------
  window.ArcadeSound = {
    play,
    isMuted: () => state.muted,
    setMuted,
    toggleMute,
    injectToggleButton,
    onMuteChange: (fn) => state.listeners.push(fn),
    startMusic,
    stopMusic,
    // Backwards-compat no-ops in case any page still calls these
    startAmbient: function () {},
    stopAmbient: function () {},
    SOUNDS, // exposed for debugging
    TRACKS, // exposed for debugging
  };

})(window);
