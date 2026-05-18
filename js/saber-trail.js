/* WatchLocal.ai — cyan trail + shatter debris + lightsaber swing
   v5: adds triangular shard particles that fly outward from cursor and
   ease back to origin, creating a "screen breaks up & reassembles" effect. */
(function () {
  // -------- CANVAS SETUP --------
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

  // -------- DATA STORES --------
  var positions = [];       // cursor positions for the cyan line trail
  var shards = [];          // triangular debris particles
  var TRAIL_LIFETIME = 500; // ms — line fade
  var MAX_SHARDS = 220;

  // -------- AUDIO STATE --------
  var audioCtx = null;
  var swingBuffer = null;
  var bufferLoading = false;
  var lastSwingTime = 0;

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
    var cooldown = 600 - Math.min(320, speed * 0.2);
    if (now - lastSwingTime < cooldown) return;
    lastSwingTime = now;

    var source = audioCtx.createBufferSource();
    source.buffer = swingBuffer;
    var gain = audioCtx.createGain();
    var speedNorm = Math.min(1, speed / 1500);
    gain.gain.value = 0.02 + speedNorm * 0.05;
    source.playbackRate.value = 0.9 + Math.random() * 0.25;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  }

  // -------- MOUSE TRACKING --------
  var lastMoveX = 0, lastMoveY = 0, lastMoveTime = 0;
  var mouseSpeed = 0;

  function spawnShards(x, y, speed) {
    var count = Math.min(4, Math.floor(speed / 200) + 1);
    for (var s = 0; s < count; s++) {
      var angle = Math.random() * Math.PI * 2;
      var burst = 1 + Math.random() * 2.5;
      shards.push({
        ox: x, oy: y,        // origin
        x: x, y: y,
        vx: Math.cos(angle) * burst,
        vy: Math.sin(angle) * burst,
        size: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.12,
        life: 0,
        maxLife: 38 + Math.random() * 22
      });
    }
    if (shards.length > MAX_SHARDS) {
      shards.splice(0, shards.length - MAX_SHARDS);
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

    positions.unshift({ x: e.clientX, y: e.clientY, time: now });
    if (positions.length > 80) positions.pop();

    if (mouseSpeed > 100) spawnShards(e.clientX, e.clientY, mouseSpeed);
    if (mouseSpeed > 250) playSwing(mouseSpeed);
  });

  // -------- RENDER --------
  function render() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var now = performance.now();

    // 1) Shards FIRST (so cyan line draws over them)
    for (var i = shards.length - 1; i >= 0; i--) {
      var sh = shards[i];
      sh.life++;
      if (sh.life >= sh.maxLife) { shards.splice(i, 1); continue; }
      var t = sh.life / sh.maxLife;
      if (t < 0.35) {
        // Expansion phase — fly outward
        sh.x += sh.vx;
        sh.y += sh.vy;
        // air drag
        sh.vx *= 0.92;
        sh.vy *= 0.92;
      } else {
        // Return phase — ease toward origin
        var k = 0.91;
        sh.x = sh.x * k + sh.ox * (1 - k);
        sh.y = sh.y * k + sh.oy * (1 - k);
      }
      sh.rot += sh.rotSpeed;

      var alpha = (1 - t) * 0.38;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      // Dark navy fill (matches bg) + thin cyan stroke = looks like a piece of bg with a glowing edge
      ctx.fillStyle = 'rgba(10,14,20,' + (alpha * 0.85) + ')';
      ctx.strokeStyle = 'rgba(0,229,255,' + (alpha * 0.55) + ')';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-sh.size, -sh.size * 0.8);
      ctx.lineTo(sh.size, -sh.size * 0.4);
      ctx.lineTo(sh.size * 0.2, sh.size);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 2) Cyan line trail (drawn on top)
    if (positions.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var p = 0; p < positions.length - 1; p++) {
        var p1 = positions[p];
        var p2 = positions[p + 1];
        var age = now - p1.time;
        if (age > TRAIL_LIFETIME) break;
        var alpha2 = 1 - (age / TRAIL_LIFETIME);
        ctx.strokeStyle = 'rgba(0,229,255,' + (alpha2 * 0.55) + ')';
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,229,255,' + (alpha2 * 0.4) + ')';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
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
