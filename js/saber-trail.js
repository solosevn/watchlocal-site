/* WatchLocal.ai — cyan mouse trail (visual only, no audio in v15)
   Solid cyan line that fades behind the cursor. */
(function () {
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

  var positions = [];
  var TRAIL_LIFETIME = 500;

  window.addEventListener('mousemove', function (e) {
    var now = performance.now();
    positions.unshift({ x: e.clientX, y: e.clientY, time: now });
    if (positions.length > 80) positions.pop();
  });

  function render() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    var now = performance.now();
    if (positions.length >= 2) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var i = 0; i < positions.length - 1; i++) {
        var p1 = positions[i];
        var p2 = positions[i + 1];
        var age = now - p1.time;
        if (age > TRAIL_LIFETIME) break;
        var alpha = 1 - (age / TRAIL_LIFETIME);
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
    while (positions.length && (now - positions[positions.length - 1].time) > TRAIL_LIFETIME) {
      positions.pop();
    }
    requestAnimationFrame(render);
  }
  render();
})();
