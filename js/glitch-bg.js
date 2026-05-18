/* WatchLocal.ai — WebGL background with cursor-following texture displacement
   v2: SHARP carbon-fiber lines (matching original CSS repeating-linear-gradient
   spec: 1px bright line every 7px + 1px dark at offset 3px on each diagonal)
   + 2-octave fractal noise grain (matching SVG fractalNoise look).
   Less glossy, more "flat carbon fiber" feel.

   Mobile (<768px viewport or mobile UA) skipped, CSS texture fallback. */
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
    'uniform float uPxScale;  // canvas pixels per CSS pixel (DPR)',
    '',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
    '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
    '}',
    '// 2-octave fractal noise — matches SVG fractalNoise feel',
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
    '',
    '  // === CURSOR DISPLACEMENT ===',
    '  vec2 md = px - uMouse;',
    '  float dist = length(md);',
    '  float radius = 240.0 * uPxScale;',
    '  float falloff = smoothstep(radius, 0.0, dist);',
    '  float strength = falloff * uActivity * 32.0 * uPxScale;',
    '  float ang = noise(px * 0.018 + uTime * 0.7) * 6.2832;',
    '  vec2 disp = vec2(cos(ang), sin(ang)) * strength;',
    '  vec2 dispPx = px + disp;',
    '  vec2 dispCss = dispPx / uPxScale;  // back to CSS pixel coords',
    '',
    '  // === BASE COLOR ===',
    '  vec3 col = vec3(0.039, 0.055, 0.078);  // #0a0e14',
    '',
    '  // === HALOS (UV, undisplaced) ===',
    '  vec2 halo1 = vec2(0.10, 0.95);',
    '  float h1 = exp(-length((uv - halo1) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(0.0, 0.9, 1.0) * h1 * 0.09;',
    '  vec2 halo2 = vec2(1.05, 0.05);',
    '  float h2 = exp(-length((uv - halo2) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(1.0, 0.48, 0.0) * h2 * 0.20;',
    '',
    '  // === CARBON FIBER (sharp, matches CSS repeating-linear-gradient spec) ===',
    '  // +45deg diagonal: 1px bright @0px + 1px dark @3px, period 7px',
    '  float p45 = mod(dot(dispCss, vec2(0.7071, 0.7071)), 7.0);',
    '  col += step(p45, 1.0) * vec3(0.026);                                    // 1px white-ish line',
    '  col -= step(3.0, p45) * (1.0 - step(4.0, p45)) * vec3(0.22);            // 1px dark line',
    '  // -45deg diagonal: same pattern',
    '  float pm45 = mod(dot(dispCss, vec2(0.7071, -0.7071)), 7.0);',
    '  col += step(pm45, 1.0) * vec3(0.022);',
    '  col -= step(3.0, pm45) * (1.0 - step(4.0, pm45)) * vec3(0.20);',
    '  // 115deg cross-stripe: 2px bright every 14px',
    '  float p115 = mod(dot(dispCss, vec2(-0.4226, 0.9063)), 14.0);',
    '  col += step(p115, 2.0) * vec3(0.010);',
    '',
    '  // === LEATHER GRAIN (sharp 2-octave fractal noise) ===',
    '  float grain = fbm(dispCss * 0.85) * 0.05 - 0.025;',
    '  col += vec3(grain);',
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
