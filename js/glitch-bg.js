/* WatchLocal.ai — WebGL background with cursor-TRAIL tile-fracture
   v4: cracks follow the trail (sword cutting through Earth crust), not a circle.
       Trail mask canvas paints cursor path, fades over ~700ms.
       Tiles crack proportional to trail intensity at their location.
       Cyan glow shows through cracks. Texture is unchanged. */
(function () {
  function isMobile() {
    if (window.innerWidth < 768) return true;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  if (isMobile()) return;

  // Main WebGL canvas (background)
  var canvas = document.createElement('canvas');
  canvas.id = 'gl-bg-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false }) ||
           canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) { canvas.remove(); return; }
  document.body.classList.add('gl-bg-active');

  // Trail-mask canvas (CPU side, low-res, 2D)
  var TRAIL_W = 512;
  var TRAIL_H = 512;
  var trailCanvas = document.createElement('canvas');
  trailCanvas.width = TRAIL_W;
  trailCanvas.height = TRAIL_H;
  var trailCtx = trailCanvas.getContext('2d');
  trailCtx.fillStyle = '#000';
  trailCtx.fillRect(0, 0, TRAIL_W, TRAIL_H);

  // === SHADER ===
  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uResolution;',
    'uniform float uTime;',
    'uniform float uPxScale;',
    'uniform sampler2D uTrail;',
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
    '  // === TEXTURE (unchanged carbon-fiber + halos + grain) ===',
    '  vec3 col = vec3(0.039, 0.055, 0.078);',
    '  vec2 halo1 = vec2(0.10, 0.95);',
    '  float h1 = exp(-length((uv - halo1) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(0.0, 0.9, 1.0) * h1 * 0.09;',
    '  vec2 halo2 = vec2(1.05, 0.05);',
    '  float h2 = exp(-length((uv - halo2) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(1.0, 0.48, 0.0) * h2 * 0.20;',
    '  float p45 = mod(dot(cssPx, vec2(0.7071, 0.7071)), 7.0);',
    '  col += step(p45, 1.0) * vec3(0.026);',
    '  col -= step(3.0, p45) * (1.0 - step(4.0, p45)) * vec3(0.22);',
    '  float pm45 = mod(dot(cssPx, vec2(0.7071, -0.7071)), 7.0);',
    '  col += step(pm45, 1.0) * vec3(0.022);',
    '  col -= step(3.0, pm45) * (1.0 - step(4.0, pm45)) * vec3(0.20);',
    '  float p115 = mod(dot(cssPx, vec2(-0.4226, 0.9063)), 14.0);',
    '  col += step(p115, 2.0) * vec3(0.010);',
    '  float grain = fbm(cssPx * 0.85) * 0.05 - 0.025;',
    '  col += vec3(grain);',
    '',
    '  // === TRAIL-DRIVEN TILE FRACTURE ===',
    '  float CELL = 16.0;',
    '  vec2 cellId = floor(cssPx / CELL);',
    '  vec2 cellCenter = (cellId + 0.5) * CELL;',
    '  // Sample trail texture at this tile center',
    '  vec2 cssRes = res / uPxScale;',
    '  vec2 cellUV = cellCenter / cssRes;',
    '  float trail = texture2D(uTrail, cellUV).r;',
    '  // Per-tile randomness for staggered cracking',
    '  float cellRand = hash(cellId);',
    '  float openAmt = clamp(trail * 1.8 - cellRand * 0.3, 0.0, 1.0);',
    '',
    '  vec2 cellLocal = abs(cssPx - cellCenter);',
    '  float cellMaxDim = max(cellLocal.x, cellLocal.y);',
    '  float tileExtent = (CELL * 0.5 - 0.5) * (1.0 - openAmt * 0.8);',
    '  float insideTile = step(cellMaxDim, tileExtent);',
    '',
    '  // Cyan glow beneath',
    '  vec3 underColor = vec3(0.05, 0.85, 1.0) * 0.55;',
    '  col = mix(underColor, col, insideTile);',
    '',
    '  // Bright edge glow at crack',
    '  float edgeBand = smoothstep(tileExtent, tileExtent + 1.0, cellMaxDim) -',
    '                   smoothstep(tileExtent + 2.0, tileExtent + 3.0, cellMaxDim);',
    '  col += vec3(0.2, 1.0, 1.0) * edgeBand * openAmt;',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compileShader(type, source) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('Shader compile:', gl.getShaderInfoLog(sh));
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
  var uTimeLoc = gl.getUniformLocation(program, 'uTime');
  var uPxLoc = gl.getUniformLocation(program, 'uPxScale');
  var uTrailLoc = gl.getUniformLocation(program, 'uTrail');

  // Trail texture setup
  var trailTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, trailTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.uniform1i(uTrailLoc, 0);

  var dpr;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // === TRAIL PAINTING ===
  function paintTrail(clientX, clientY) {
    var tx = (clientX / window.innerWidth) * TRAIL_W;
    var ty = (clientY / window.innerHeight) * TRAIL_H;
    var radius = 8;
    var grad = trailCtx.createRadialGradient(tx, ty, 0, tx, ty, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    trailCtx.fillStyle = grad;
    trailCtx.beginPath();
    trailCtx.arc(tx, ty, radius, 0, Math.PI * 2);
    trailCtx.fill();
  }

  var lastPaintX = -1, lastPaintY = -1;
  window.addEventListener('mousemove', function (e) {
    // Interpolate brush strokes between last and current position for smooth trail
    if (lastPaintX !== -1) {
      var dx = e.clientX - lastPaintX;
      var dy = e.clientY - lastPaintY;
      var dist = Math.sqrt(dx*dx + dy*dy);
      var steps = Math.max(1, Math.min(15, Math.floor(dist / 6)));
      for (var i = 1; i <= steps; i++) {
        var t = i / steps;
        paintTrail(lastPaintX + dx*t, lastPaintY + dy*t);
      }
    } else {
      paintTrail(e.clientX, e.clientY);
    }
    lastPaintX = e.clientX;
    lastPaintY = e.clientY;
  });

  // === RENDER LOOP ===
  var startTime = performance.now();
  function render() {
    if (document.hidden) { requestAnimationFrame(render); return; }
    var t = (performance.now() - startTime) / 1000;

    // Fade trail canvas each frame (cracks heal)
    trailCtx.globalCompositeOperation = 'destination-out';
    trailCtx.fillStyle = 'rgba(0,0,0,0.045)'; // ~4.5% per frame → ~700ms full decay
    trailCtx.fillRect(0, 0, TRAIL_W, TRAIL_H);
    trailCtx.globalCompositeOperation = 'source-over';

    // Upload trail canvas to texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trailCanvas);

    // Draw
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uTimeLoc, t);
    gl.uniform1f(uPxLoc, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }
  render();
})();
