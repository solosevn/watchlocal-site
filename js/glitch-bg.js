/* WatchLocal.ai — WebGL background with cursor tile-fracture (cyan reveal)
   v3: Replaces blurry UV displacement with SHARP tile fracture.
   18px tiles around cursor "open up" exposing cyan glow underneath
   (like cracking through crust to reveal magma layer), then close back.
   Each tile has random per-cell offset so they crack unevenly. */
(function () {
  function isMobile() {
    if (window.innerWidth < 768) return true;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  if (isMobile()) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'gl-bg-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false }) ||
           canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }
  document.body.classList.add('gl-bg-active');

  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uResolution;',
    'uniform vec2 uMouse;',
    'uniform float uTime;',
    'uniform float uActivity;',
    'uniform float uPxScale;',
    '',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
    '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0; float a = 0.6;',
    '  v += noise(p) * a; p *= 2.1; a *= 0.55;',
    '  v += noise(p) * a;',
    '  return v;',
    '}',
    '',
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 res = uResolution;',
    '  vec2 uv = px / res;',
    '  vec2 cssPx = px / uPxScale;',
    '',
    '  // === TEXTURE COMPUTATION (no UV displacement now) ===',
    '  vec3 col = vec3(0.039, 0.055, 0.078);  // #0a0e14',
    '',
    '  // Halos',
    '  vec2 halo1 = vec2(0.10, 0.95);',
    '  float h1 = exp(-length((uv - halo1) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(0.0, 0.9, 1.0) * h1 * 0.09;',
    '  vec2 halo2 = vec2(1.05, 0.05);',
    '  float h2 = exp(-length((uv - halo2) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(1.0, 0.48, 0.0) * h2 * 0.20;',
    '',
    '  // Carbon fiber sharp lines',
    '  float p45 = mod(dot(cssPx, vec2(0.7071, 0.7071)), 7.0);',
    '  col += step(p45, 1.0) * vec3(0.026);',
    '  col -= step(3.0, p45) * (1.0 - step(4.0, p45)) * vec3(0.22);',
    '  float pm45 = mod(dot(cssPx, vec2(0.7071, -0.7071)), 7.0);',
    '  col += step(pm45, 1.0) * vec3(0.022);',
    '  col -= step(3.0, pm45) * (1.0 - step(4.0, pm45)) * vec3(0.20);',
    '  float p115 = mod(dot(cssPx, vec2(-0.4226, 0.9063)), 14.0);',
    '  col += step(p115, 2.0) * vec3(0.010);',
    '',
    '  // Leather grain',
    '  float grain = fbm(cssPx * 0.85) * 0.05 - 0.025;',
    '  col += vec3(grain);',
    '',
    '  // === TILE FRACTURE (cyan reveal underneath) ===',
    '  float CELL = 18.0;  // 18 CSS-px tiles',
    '  vec2 cellId = floor(cssPx / CELL);',
    '  vec2 cellCenter = (cellId + 0.5) * CELL;',
    '  vec2 cursorCss = uMouse / uPxScale;',
    '  float cellDistC = length(cellCenter - cursorCss);',
    '  float fracRadius = 130.0;  // smaller than before (was 240)',
    '  float fracBase = smoothstep(fracRadius, 0.0, cellDistC) * uActivity;',
    '  float cellRand = hash(cellId);',
    '  // openAmt 0..1 — how far this tile has cracked open. Each tile has a per-cell',
    '  // random offset so they crack unevenly (some break first, others later).',
    '  float openAmt = clamp(fracBase * 1.4 - cellRand * 0.5, 0.0, 1.0);',
    '',
    '  // Distance from this pixel to the tile center (L-inf for square tiles)',
    '  vec2 cellLocal = abs(cssPx - cellCenter);',
    '  float cellMaxDim = max(cellLocal.x, cellLocal.y);',
    '  // Tile extent shrinks as it opens up (so cracks widen between tiles)',
    '  float tileExtent = (CELL * 0.5 - 0.5) * (1.0 - openAmt * 0.85);',
    '  float insideTile = step(cellMaxDim, tileExtent);',
    '',
    '  // The "layer beneath" the texture = bright cyan glow',
    '  vec3 underColor = vec3(0.05, 0.85, 1.0) * 0.55;',
    '',
    '  // Replace texture with cyan glow OUTSIDE the (shrunken) tile',
    '  col = mix(underColor, col, insideTile);',
    '',
    '  // Bright cyan edge glow at the crack boundary itself',
    '  float edgeBand = smoothstep(tileExtent, tileExtent + 1.2, cellMaxDim) -',
    '                   smoothstep(tileExtent + 2.5, tileExtent + 3.5, cellMaxDim);',
    '  col += vec3(0.2, 1.0, 1.0) * edgeBand * openAmt * 1.0;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compileShader(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = compileShader(gl.VERTEX_SHADER, VERT);
  var fs = compileShader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.body.classList.remove('gl-bg-active'); canvas.remove(); return; }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Link error:', gl.getProgramInfoLog(program));
    document.body.classList.remove('gl-bg-active'); canvas.remove(); return;
  }
  gl.useProgram(program);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,   1, -1,  -1,  1,
    -1,  1,   1, -1,   1,  1
  ]), gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  var uResLoc = gl.getUniformLocation(program, 'uResolution');
  var uMouseLoc = gl.getUniformLocation(program, 'uMouse');
  var uTimeLoc = gl.getUniformLocation(program, 'uTime');
  var uActLoc = gl.getUniformLocation(program, 'uActivity');
  var uPxLoc = gl.getUniformLocation(program, 'uPxScale');

  var dpr;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  var mouseX = -1000, mouseY = -1000;
  var lastMoveTime = -Infinity;
  var activityTarget = 0;
  var activityCurrent = 0;

  window.addEventListener('mousemove', function (e) {
    mouseX = e.clientX * dpr;
    mouseY = (window.innerHeight - e.clientY) * dpr;
    lastMoveTime = performance.now();
    activityTarget = 1;
  });

  var startTime = performance.now();
  function render() {
    if (document.hidden) { requestAnimationFrame(render); return; }
    var now = performance.now();
    var t = (now - startTime) / 1000;
    var sinceMove = now - lastMoveTime;
    if (sinceMove > 200) {
      activityTarget = Math.max(0, 1 - (sinceMove - 200) / 600);
    }
    activityCurrent += (activityTarget - activityCurrent) * 0.08;

    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform2f(uMouseLoc, mouseX, mouseY);
    gl.uniform1f(uTimeLoc, t);
    gl.uniform1f(uActLoc, activityCurrent);
    gl.uniform1f(uPxLoc, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }
  render();
})();
