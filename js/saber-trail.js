/* WatchLocal.ai — cyan mouse trail (solid line) + lightsaber swing (faint)
   v4: trail is now a solid cyan line that fades behind cursor (was orange dots);
       audio volume halved. */
(function () {
  // -------- VISUAL: CYAN SOLID LINE TRAIL --------
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

  // Position queue (newest first)
  var positions = [];
  var TRAIL_LIFETIME = 500; // ms — how long until line fades to nothing

  // -------- AUDIO STATE --------
  var audioCtx = null;
  var swingBuffer = null;
  var bufferLoading = false;
  var lastSwingTime = 0;
  var SWING_COOLDOWN_MIN = 280;
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
    var cooldown = SWING_COOLDOWN_MAX - Math.min(SWING_COOLDOWN_MAX - SWING_COOLDOWN_MIN, speed * 0.2);
    if (now - lastSwingTime < cooldown) return;
    lastSwingTime = now;

    var source = audioCtx.createBufferSource();
    source.buffer = swingBuffer;

    var gain = audioCtx.createGain();
    var speedNorm = Math.min(1, speed / 1500);
    // QUIETER: 0.02 (faint slow) → 0.07 (max fast). Was 0.04 → 0.14.
    gain.gain.value = 0.02 + speedNorm * 0.05;

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
    mouseSpeed = (dist / dt) * 1000;
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    lastMoveTime = now;

    // Push position to trail queue
    positions.unshift({ x: e.clientX, y: e.clientY, time: now });
    if (positions.length > 80) positions.pop();

    if (mouseSpeed > 250) {
      playSwing(mouseSpeed);
    }
  });

  function render() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var now = performance.now();

    // Draw line segments between consecutive positions, each with alpha based on age
    if (positions.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (var i = 0; i < positions.length - 1; i++) {
        var p1 = positions[i];
        var p2 = positions[i + 1];
        var age = now - p1.time;
        if (age > TRAIL_LIFETIME) break;
        var alpha = 1 - (age / TRAIL_LIFETIME);

        // Solid cyan line that fades
        ctx.strokeStyle = 'rgba(0,229,255,' + (alpha * 0.55) + ')';
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,229,255,' + (alpha * 0.4) + ')';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }

    // Drop expired positions
    while (positions.length && (now - positions[positions.length - 1].time) > TRAIL_LIFETIME) {
      positions.pop();
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
