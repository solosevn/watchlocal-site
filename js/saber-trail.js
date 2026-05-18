/* WatchLocal.ai — orange mouse trail + lightsaber hum
   Visual: canvas particle trail in #ff7a00, fades over ~35 frames (~600ms).
   Audio: Web Audio API procedural saber hum, modulated by mouse speed.
   Audio unlocks after any user click (browser autoplay policy). */
(function () {
  // -------- VISUAL: ORANGE PARTICLE TRAIL --------
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var dpr = window.devicePixelRatio || 1;
  var ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  var particles = [];
  var MAX_PARTICLES = 80;
  var lastX = -1, lastY = -1;

  window.addEventListener('mousemove', function (e) {
    // Interpolate between last and current position for smoother trail
    if (lastX !== -1) {
      var dx = e.clientX - lastX;
      var dy = e.clientY - lastY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var steps = Math.min(8, Math.max(1, Math.floor(dist / 6)));
      for (var i = 0; i < steps; i++) {
        var t = (i + 1) / steps;
        particles.push({
          x: lastX + dx * t,
          y: lastY + dy * t,
          age: 0,
          max: 35
        });
      }
    } else {
      particles.push({ x: e.clientX, y: e.clientY, age: 0, max: 35 });
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
      var radius = 7 * alpha + 1;
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255,122,0,' + alpha + ')';
      ctx.fillStyle = 'rgba(255,180,80,' + (alpha * 0.95) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(render);
  }
  render();

  // -------- AUDIO: PROCEDURAL LIGHTSABER HUM --------
  var audioCtx = null;
  var masterGain = null;
  var mouseSpeed = 0;
  var lastMoveX = 0, lastMoveY = 0, lastMoveTime = 0;
  var targetVolume = 0;

  function initAudio() {
    if (audioCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();

      // Two oscillators for the saber tone (fundamental + octave harmonic)
      var osc1 = audioCtx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.value = 65;

      var osc2 = audioCtx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 130;

      // LFO for the iconic saber wobble
      var lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 4.5;
      var lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 3.5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // Warm low-pass filter
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 4;

      // Master gain (volume) — starts silent
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
      lfo.start();
    } catch (e) {
      // Audio failed — silently no-op, visual trail still works
    }
  }

  // Track mouse speed continuously
  window.addEventListener('mousemove', function (e) {
    var now = performance.now();
    var dt = Math.max(1, now - lastMoveTime);
    var dx = e.clientX - lastMoveX;
    var dy = e.clientY - lastMoveY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    mouseSpeed = (dist / dt) * 1000; // pixels per second
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    lastMoveTime = now;
  });

  // Update saber volume ~30fps based on mouse activity
  setInterval(function () {
    if (!audioCtx || !masterGain) return;
    var now = performance.now();
    var sinceLast = now - lastMoveTime;
    // Volume target: 0 when still, up to 0.15 when moving fast
    if (sinceLast > 250) {
      targetVolume = 0;
    } else {
      var speedNorm = Math.min(1, mouseSpeed / 1200);
      targetVolume = 0.03 + speedNorm * 0.12; // 0.03 (faint idle) to 0.15 (max)
    }
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(targetVolume, audioCtx.currentTime + 0.12);
  }, 33);

  // Browser autoplay policy: audio context must be unlocked by user gesture
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
