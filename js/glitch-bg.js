/* WatchLocal.ai — WebGL background with cursor-following texture displacement
   Procedurally recreates the carbon-fiber + leather + halo texture in a
   fragment shader. Cursor position drives a localized UV displacement field
   so the texture appears to fracture and reassemble around the mouse.

   Disabled on mobile (<768px viewport or mobile UA) — falls back to the
   existing CSS body::before/body::after texture layers. */
(function () {
  // Mobile detection — bail early if so
  function isMobile() {
    if (window.innerWidth < 768) return true;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  if (isMobile()) return;

  // Create canvas behind everything
  var canvas = document.createElement('canvas');
  canvas.id = 'gl-bg-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false }) ||
           canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) {
    // No WebGL support — leave CSS texture in place
    canvas.remove();
    return;
  }

  // Once WebGL is up, hide the CSS texture layers (we replace them)
  document.body.classList.add('gl-bg-active');

  // ===== SHADERS =====
  var VERT = [
    'attribute vec2 a_pos;',
    'void main() {',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uResolution;',
    'uniform vec2 uMouse;',
    'uniform float uTime;',
    'uniform float uActivity;',
    '',
    '// Cheap hash + value noise',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), u.x),',
    '             mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);',
    '}',
    '',
    'void main() {',
    '  vec2 px = gl_FragCoord.xy;',
    '  vec2 res = uResolution;',
    '  vec2 uv = px / res;',
    '',
    '  // === CURSOR DISPLACEMENT FIELD ===',
    '  vec2 md = px - uMouse;',
    '  float dist = length(md);',
    '  float radius = 240.0;',
    '  float falloff = smoothstep(radius, 0.0, dist);',
    '  float strength = falloff * uActivity * 32.0;',
    '  // Swirling noisy displacement direction',
    '  float ang = noise(px * 0.018 + uTime * 0.7) * 6.2832;',
    '  vec2 disp = vec2(cos(ang), sin(ang)) * strength;',
    '  vec2 dispPx = px + disp;',
    '  vec2 dispUV = dispPx / res;',
    '',
    '  // === BASE COLOR ===',
    '  vec3 col = vec3(0.039, 0.055, 0.078);  // #0a0e14',
    '',
    '  // === CYAN HALO (top-left, not displaced — backdrop glow) ===',
    '  vec2 halo1Pos = vec2(0.10, 0.95);',
    '  float halo1 = exp(-length((uv - halo1Pos) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(0.0, 0.9, 1.0) * halo1 * 0.10;',
    '',
    '  // === ORANGE HALO (bottom-right, not displaced) ===',
    '  vec2 halo2Pos = vec2(1.05, 0.05);',
    '  float halo2 = exp(-length((uv - halo2Pos) * vec2(1.8, 1.5)) * 1.3);',
    '  col += vec3(1.0, 0.48, 0.0) * halo2 * 0.22;',
    '',
    '  // === LEATHER NOISE GRAIN (displaced) ===',
    '  float grain = noise(dispPx * 1.4) * 0.045 - 0.022;',
    '  col += vec3(grain);',
    '',
    '  // === CARBON-FIBER CROSS-HATCH (displaced) ===',
    '  // Diagonals at +45deg and -45deg',
    '  float d1 = sin(dot(dispPx, vec2(0.7071, 0.7071)) * 0.95);',
    '  float d2 = sin(dot(dispPx, vec2(0.7071, -0.7071)) * 0.95);',
    '  float weave = (smoothstep(0.0, 0.12, d1) - smoothstep(0.0, 0.12, d2)) * 0.028;',
    '  col += vec3(weave);',
    '',
    '  // Subtle 115deg cross-stripe for woven depth',
    '  float d3 = sin(dot(dispPx, vec2(-0.4226, 0.9063)) * 0.55) * 0.014;',
    '  col += vec3(d3);',
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
  if (!vs || !fs) {
    document.body.classList.remove('gl-bg-active');
    canvas.remove();
    return;
  }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    document.body.classList.remove('gl-bg-active');
    canvas.remove();
    return;
  }
  gl.useProgram(program);

  // Full-screen quad (2 triangles covering NDC -1..1)
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

  // === RESIZE ===
  function resize() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // === CURSOR + ACTIVITY ===
  var mouseX = -1000, mouseY = -1000;
  var lastMoveTime = -Infinity;
  var activityTarget = 0;
  var activityCurrent = 0;

  window.addEventListener('mousemove', function (e) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    mouseX = e.clientX * dpr;
    // GL Y is flipped — bottom = 0
    mouseY = (window.innerHeight - e.clientY) * dpr;
    lastMoveTime = performance.now();
    activityTarget = 1;
  });

  // === RENDER LOOP ===
  var startTime = performance.now();
  function render() {
    if (document.hidden) {
      requestAnimationFrame(render);
      return;
    }
    var now = performance.now();
    var t = (now - startTime) / 1000;

    // Activity decays after cursor stops
    var sinceMove = now - lastMoveTime;
    if (sinceMove > 200) {
      activityTarget = Math.max(0, 1 - (sinceMove - 200) / 600);
    }
    // Smooth ramp
    activityCurrent += (activityTarget - activityCurrent) * 0.08;

    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform2f(uMouseLoc, mouseX, mouseY);
    gl.uniform1f(uTimeLoc, t);
    gl.uniform1f(uActLoc, activityCurrent);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
  }
  render();
})();
