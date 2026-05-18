/* WatchLocal.ai — orange mouse trail + lightsaber swing audio (v3)
   v3: replaces procedural Web Audio synth with real saber swing MP3.
   Each significant mouse movement triggers a swing sound with cooldown
   so rapid moves don't cause overlap chaos.
   Audio: freesound CC0 — audio/saber-swing.mp3 */
(function () {
  // -------- VISUAL: ORANGE PARTICLE TRAIL (thin, dim) --------
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

  // -------- AUDIO STATE --------
  var audioCtx = null;
  var swingBuffer = null;
  var bufferLoading = false;
  var lastSwingTime = 0;
  var SWING_COOLDOWN_MIN = 280; // ms between swings minimum
  var SWING_COOLDOWN_MAX = 600;

  function loadBuffer() {
    if (swingBuffer || bufferLoading || !audioCtx) return;
    bufferLoading = true;
    fetch('audio/saber-swing.mp3')
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (ab) { return audioCtx.decodeAudioData(ab); })
      .then(function (buf) { swingBuffer = buf; bufferLoading = false; })
      .catch(function () { bufferLoading = false; });
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      loadBuffer();
    } catch (e) { /* no-op */ }
  }

  function playSwing(speed) {
    if (!audioCtx || !swingBuffer) return;
    var now = performance.now();
    // Cooldown shorter when moving fast, longer when slow
    var cooldown = SWING_COOLDOWN_MAX - Math.min(SWING_COOLDOWN_MAX - SWING_COOLDOWN_MIN, speed * 0.2);
    if (now - lastSwingTime < cooldown) return;
    lastSwingTime = now;

    var source = audioCtx.createBufferSource();
    source.buffer = swingBuffer;

    // Volume scales with mouse speed: faint at slow, louder at fast
    var gain = audioCtx.createGain();
    var speedNorm = Math.min(1, speed / 1500);
    gain.gain.value = 0.04 + speedNorm * 0.10; // 0.04 (faint) → 0.14 (max)

    // Random small pitch variation so back-to-back swings don't sound identical
    source.playbackRate.value = 0.9 + Math.random() * 0.25;

    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  }

  // -------- MOUSE TRACKING --------
  var lastMoveX = 0, lastMoveY = 0, lastMoveTime = 0;
  var mouseSpeed = 0;

  window.addEventListener('mousemove', function (e) {
    var now = performance.now();
    var dt = Math.max(1, now - lastMoveTime);
    var dx = e.clientX - lastMoveX;
    var dy = e.clientY - lastMoveY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    mouseSpeed = (dist / dt) * 1000; // px/s
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    lastMoveTime = now;

    // Particles
    if (lastX !== -1) {
      var ldx = e.clientX - lastX;
      var ldy = e.clientY - lastY;
      var ldist = Math.sqrt(ldx * ldx + ldy * ldy);
      var steps = Math.min(10, Math.max(1, Math.floor(ldist / 4)));
      for (var i = 0; i < steps; i++) {
        var t = (i + 1) / steps;
        particles.push({
          x: lastX + ldx * t,
          y: lastY + ldy * t,
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

    // Trigger swing if movement is meaningful
    if (mouseSpeed > 250) {
      playSwing(mouseSpeed);
    }
  });

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age++;
      if (p.age >= p.max) { particles.splice(i, 1); continue; }
      var alpha = 1 - (p.age / p.max);
      var radius = 1.4 * alpha + 0.4;
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
