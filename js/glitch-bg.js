/* WatchLocal.ai — WebGL bg with seam-based diagonal crack fracture
   v5: Cracks open along the carbon-fiber's OWN diagonal weave lines
   (its natural fault lines), revealing cyan layer beneath. As trail
   fades, the weave seals back up. No orthogonal tile artifacts. */
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

  // Trail mask canvas
  var TRAIL_W = 512, TRAIL_H = 512;
  var trailCanvas = document.createElement('canvas');
  trailCanvas.width = TRAIL_W;
  trailCanvas.height = TRAIL_H;
  var trailCtx = trailCanvas.getContext('2d');
  trailCtx.fillStyle = '#000';
  trailCtx.fillRect(0, 0, TRAIL_W, TRAIL_H);

  var VERT = [
    'attribute vec2 a_pos;',
    'void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uResolution;',
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
    '  // === TRAIL INTENSITY AT THIS PIXEL ===',
    '  float trail = texture2D(uTrail, uv).r;',
    '',
    '  // === TEXTURE COLOR (carbon fiber + halos + grain — unchanged) ===',
    '  vec3 texCol = vec3(0.039, 0.055, 0.078);',
    '  vec2 halo1 = vec2(0.10, 0.95);',
    '  float h1 = exp(-length((uv - halo1) * vec2(1.8, 1.5)) * 1.3);',
    '  texCol += vec3(0.0, 0.9, 1.0) * h1 * 0.09;',
    '  vec2 halo2 = vec2(1.05, 0.05);',
    '  float h2 = exp(-length((uv - halo2) * vec2(1.8, 1.5)) * 1.3);',
    '  texCol += vec3(1.0, 0.48, 0.0) * h2 * 0.20;',
    '  float p45 = mod(dot(cssPx, vec2(0.7071, 0.7071)), 7.0);',
    '  texCol += step(p45, 1.0) * vec3(0.026);',
    '  texCol -= step(3.0, p45) * (1.0 - step(4.0, p45)) * vec3(0.22);',
    '  float pm45 = mod(dot(cssPx, vec2(0.7071, -0.7071)), 7.0);',
    '  texCol += step(pm45, 1.0) * vec3(0.022);',
    '  texCol -= step(3.0, pm45) * (1.0 - step(4.0, pm45)) * vec3(0.20);',
    '  float p115 = mod(dot(cssPx, vec2(-0.4226, 0.9063)), 14.0);',
    '  texCol += step(p115, 2.0) * vec3(0.010);',
    '  float grain = fbm(cssPx * 0.85) * 0.05 - 0.025;',
    '  texCol += vec3(grain);',
    '',
    '  // === SEAM PROXIMITY (distance to nearest carbon-fiber weave line) ===',
    '  // Both +45deg and -45deg lines have a 7px period.',
    '  // Compute signed distance to the NEAREST line of each family, then min.',
    '  float seam45 = abs(mod(dot(cssPx, vec2(0.7071, 0.7071)) + 3.5, 7.0) - 3.5);',
    '  float seamPm45 = abs(mod(dot(cssPx, vec2(0.7071, -0.7071)) + 3.5, 7.0) - 3.5);',
    '  float seamDist = min(seam45, seamPm45);  // 0 at seam, up to ~3.5 in tile centers',
    '',
    '  // === RANDOM PER-LOCATION OFFSET so not every seam cracks at the same trail level ===',
    '  // 3.5 CSS-px cell hash → coarse stagger so neighboring seams crack at different times',
    '  vec2 staggerCell = floor(cssPx / 5.0);',
    '  float staggerRand = hash(staggerCell);',
    '',
    '  // === CRACK INTENSITY ===',
    '  // Cracks form where trail is hot AND we are close to a seam',
    '  // staggerRand modulates which seams crack first',
    '  float trailMod = trail * (1.0 + staggerRand * 0.4);',
    '  float seamFactor = 1.0 - smoothstep(0.2, 2.5, seamDist);',
    '  // 1 right on the seam, 0 by 2.5px away',
    '  float crackOpen = clamp(trailMod * seamFactor * 2.5, 0.0, 1.0);',
    '',
    '  // === CYAN UNDERLAYER (always present beneath the texture) ===',
    '  vec3 cyanUnder = vec3(0.05, 0.85, 1.0) * 0.55;',
    '',
    '  // === COMPOSITE: texture on top, cyan beneath, crack reveals cyan ===',
    '  vec3 col = mix(texCol, cyanUnder, crackOpen);',
    '',
    '  // === HOT EDGE GLOW exactly at the seam midpoint ===',
    '  float seamGlow = (1.0 - smoothstep(0.0, 0.8, seamDist)) * trail;',
    '  col += vec3(0.2, 1.0, 1.0) * seamGlow * 0.6;',
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
  var uPxLoc = gl.getUniformLocation(program, 'uPxScale');
  var uTrailLoc = gl.getUniformLocation(program, 'uTrail');

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

  function paintTrail(clientX, clientY) {
    var tx = (clientX / window.innerWidth) * TRAIL_W;
    var ty = (clientY / window.innerHeight) * TRAIL_H;
    var radius = 6;  // tighter brush
    var grad = trailCtx.createRadialGradient(tx, ty, 0, tx, ty, radius);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');   // lighter brush so trail doesnt saturate
    grad.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    trailCtx.fillStyle = grad;
    trailCtx.beginPath();
    trailCtx.arc(tx, ty, radius, 0, Math.PI * 2);
    trailCtx.fill();
  }

  var lastPaintX = -1, lastPaintY = -1;
  window.addEventListener('mousemove', function (e) {
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

  function render() {
    if (document.hidden) { requestAnimationFrame(render); return; }

    // Fade trail FAST so cracks heal quickly behind cursor
    trailCtx.globalCompositeOperation = 'destination-out';
    trailCtx.fillStyle = 'rgba(0,0,0,0.085)';  // ~8.5% per frame → ~200ms full decay
    trailCtx.fillRect(0, 0, TRAIL_W, TRAIL_H);
    trailCtx.globalCompositeOperation = 'source-over';

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, trailTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trailCanvas);

    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform1f(uPxLoc, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }
  render();
})();
