/* WatchLocal.ai — orange mouse trail + lightsaber hum (v2: refined)
   v1 was too bright/thick visually and too low/loud audibly.
   v2: thinner dimmer trail to match the orange divider lines;
       lightsaber audio with proper saber tone (sawtooth 200Hz + harmonics
       + filtered noise buzz) at much lower volume. */
(function () {
  // -------- VISUAL: ORANGE PARTICLE TRAIL (THIN, DIM) --------
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var dpr = window.devicePixelRatio || 1;
  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  var particles = [];
  var MAX_PARTICLES = 100;
  var lastX = -1, lastY = -1;

  window.addEventListener('mousemove', function (e) {
    if (lastX !== -1) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var steps = Math.min(10, Math.max(1, Math.floor(dist / 4)));
      for (var i = 0; i < steps; i++) {
        var t = (i + 1) / steps;
        particles.push({
          x: lastX + dx * t,
          y: lastY + dy * t,
          age: 0,
          max: 28
        });
      }
    } else {
      particles.push({ x: e.clientX, y: e.clientY, age: 0, max: 28 });
    }
    lastX = e.clientX;
    lastY = e.clientY;
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  });

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age++;
      if (p.age >= p.max) { particles.splice(i, 1); continue; }
      var alpha = 1 - (p.age / p.max);
      // THIN: max radius 1.8px tapering to 0.4px (was 7px)
      var radius = 1.4 * alpha + 0.4;
      // DIM: peak alpha ~0.4 instead of ~0.95
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(255,122,0,' + (alpha * 0.5) + ')';
      ctx.fillStyle = 'rgba(255,122,0,' + (alpha * 0.45) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();

  // -------- AUDIO: PROCEDURAL LIGHTSABER HUM (REFINED) --------
  var audioCtx = null;
  var masterGain = null;
  var mouseSpeed = 0;
  var lastMoveX = 0, lastMoveY = 0, lastMoveTime = 0;

  function initAudio() {
    if (audioCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();

      // === SABER TONE BODY ===
      // Fundamental at 200Hz (recognizable saber pitch, not too bass)
      var osc1 = audioCtx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 200;

      // Octave harmonic
      var osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = 400;

      // 3rd harmonic for richness
      var osc3 = audioCtx.createOscillator();
      osc3.type = 'sine';
      osc3.frequency.value = 720;

      // LFO for saber wobble — modulates frequency subtly
      var lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5;
      var lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 4;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // === BUZZ / SIZZLE LAYER ===
      // White noise through narrow band-pass for the iconic "buzz" character
      var noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      var noiseData = noiseBuffer.getChannelData(0);
      for (var n = 0; n < noiseData.length; n++) {
        noiseData[n] = Math.random() * 2 - 1;
      }
      var noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      var noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 850;
      noiseFilter.Q.value = 8;

      var noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.3; // noise is mixed in at 30% of master

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);

      // === MIX / FILTER / OUTPUT ===
      var toneMix = audioCtx.createGain();
      toneMix.gain.value = 0.7;
      osc1.connect(toneMix);
      osc2.connect(toneMix);
      osc3.connect(toneMix);

      // Master low-pass keeps things warm
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1500;
      filter.Q.value = 2;

      toneMix.connect(filter);
      noiseGain.connect(filter);

      // Master gain — starts silent, ramps with mouse speed
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0;
      filter.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      osc3.start();
      lfo.start();
      noiseSource.start();
    } catch (e) {
      // silently no-op
    }
  }

  window.addEventListener('mousemove', function (e) {
    var now = performance.now();
    var dt = Math.max(1, now - lastMoveTime);
    var dx = e.clientX - lastMoveX;
    var dy = e.clientY - lastMoveY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    mouseSpeed = (dist / dt) * 1000;
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    lastMoveTime = now;
  });

  // Volume modulation — much quieter overall
  setInterval(function () {
    if (!audioCtx || !masterGain) return;
    var now = performance.now();
    var sinceLast = now - lastMoveTime;
    var targetVolume;
    if (sinceLast > 250) {
      targetVolume = 0;
    } else {
      var speedNorm = Math.min(1, mouseSpeed / 1500);
      // QUIETER: 0.01 idle → 0.05 max (was 0.03 → 0.15)
      targetVolume = 0.01 + speedNorm * 0.04;
    }
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 0.12);
  }, 33);

  function unlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
  document.addEventListener('click', unlockAudio, { once: false });
  document.addEventListener('touchstart', unlockAudio, { once: false });
  document.addEventListener('keydown', unlockAudio, { once: false });
})();
