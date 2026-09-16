/* Signature Paper34 — onde de fumée fluide WebGL au survol du logo (kit officiel,
   port vanilla de PaperSignature.tsx + SplashCursor.tsx).
   Fluid simulation adaptée de Pavel Dobryakov (MIT) :
   https://github.com/PavelDoGreat/WebGL-Fluid-Simulation

   Comportement : au survol du logo « Réalisé par Paper34 » dans le footer, une onde
   circulaire bleue part du logo puis la fumée suit le curseur. Quand le curseur quitte
   le logo : arrêt d'émission après 500 ms, dissipation naturelle, démontage du canvas
   après 10 s (jamais de fondu d'opacité). Coupé si prefers-reduced-motion ou pointeur
   tactile (harnais standard studio). Montage à la demande : rien n'est créé avant le
   premier survol. */
(function () {
  'use strict';

  var SMOKE = [ // bleus Paper34 (RGB 0..1)
    { r: 0, g: 0.45, b: 0.9 }, { r: 0.1, g: 0.6, b: 1.0 },
    { r: 0.6, g: 0.4, b: 1.0 }, { r: 0.0, g: 0.3, b: 0.7 }
  ];
  var CONFIG = {
    SIM_RESOLUTION: 128, DYE_RESOLUTION: 1024,
    DENSITY_DISSIPATION: 1.6, VELOCITY_DISSIPATION: 1.6,
    PRESSURE: 0.1, PRESSURE_ITERATIONS: 20, CURL: 8,
    SPLAT_RADIUS: 0.28, SPLAT_FORCE: 7000
  };

  function reduced() {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
             window.matchMedia('(pointer: coarse)').matches;
    } catch (e) { return true; }
  }

  /* ─── Moteur fluide : monte un canvas dans `container`, retourne une API ─── */
  function createFluid(container) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    container.appendChild(canvas);

    var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false, premultipliedAlpha: false };
    var gl = canvas.getContext('webgl2', params);
    var isWebGL2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    if (!gl) { container.removeChild(canvas); return null; }

    var halfFloat = null, supportLinearFiltering = null;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0, 0, 0, 0);
    var halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);

    function supportRenderTextureFormat(internalFormat, format, type) {
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    function getSupportedFormat(internalFormat, format, type) {
      if (!supportRenderTextureFormat(internalFormat, format, type)) {
        switch (internalFormat) {
          case gl.R16F: return getSupportedFormat(gl.RG16F, gl.RG, type);
          case gl.RG16F: return getSupportedFormat(gl.RGBA16F, gl.RGBA, type);
          default: return null;
        }
      }
      return { internalFormat: internalFormat, format: format };
    }
    var formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = formatRGBA; formatR = formatRGBA;
    }
    if (!formatRGBA || !formatRG || !formatR || !halfFloatTexType) { container.removeChild(canvas); return null; }

    /* Shaders */
    function compileShader(type, source) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }
    function createProgram(vs, fs) {
      var program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs);
      gl.linkProgram(program);
      return program;
    }
    function getUniforms(program) {
      var u = {}, n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(program, i); u[info.name] = gl.getUniformLocation(program, info.name); }
      return u;
    }
    var V = 'precision highp float;attribute vec2 aPosition;varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;uniform vec2 texelSize;void main(){vUv=aPosition*0.5+0.5;vL=vUv-vec2(texelSize.x,0.0);vR=vUv+vec2(texelSize.x,0.0);vT=vUv+vec2(0.0,texelSize.y);vB=vUv-vec2(0.0,texelSize.y);gl_Position=vec4(aPosition,0.0,1.0);}';
    var H = 'precision highp float;precision highp sampler2D;varying vec2 vUv;varying vec2 vL;varying vec2 vR;varying vec2 vT;varying vec2 vB;';
    var M = 'precision mediump float;precision mediump sampler2D;varying highp vec2 vUv;varying highp vec2 vL;varying highp vec2 vR;varying highp vec2 vT;varying highp vec2 vB;';
    var F = {
      clear: M + 'uniform sampler2D uTexture;uniform float value;void main(){gl_FragColor=value*texture2D(uTexture,vUv);}',
      display: H + 'uniform sampler2D uTexture;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float a=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c,a);}',
      splat: H + 'uniform sampler2D uTarget;uniform float aspectRatio;uniform vec3 color;uniform vec2 point;uniform float radius;void main(){vec2 p=vUv-point.xy;p.x*=aspectRatio;vec3 splat=exp(-dot(p,p)/radius)*color;vec3 base=texture2D(uTarget,vUv).xyz;gl_FragColor=vec4(base+splat,1.0);}',
      advection: H + 'uniform sampler2D uVelocity;uniform sampler2D uSource;uniform vec2 texelSize;uniform vec2 dyeTexelSize;uniform float dt;uniform float dissipation;' +
        (supportLinearFiltering ? '' : 'vec4 bilerp(sampler2D sam,vec2 uv,vec2 tsize){vec2 st=uv/tsize-0.5;vec2 iuv=floor(st);vec2 fuv=fract(st);vec4 a=texture2D(sam,(iuv+vec2(0.5,0.5))*tsize);vec4 b=texture2D(sam,(iuv+vec2(1.5,0.5))*tsize);vec4 c=texture2D(sam,(iuv+vec2(0.5,1.5))*tsize);vec4 d=texture2D(sam,(iuv+vec2(1.5,1.5))*tsize);return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y);}') +
        'void main(){' + (supportLinearFiltering
          ? 'vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;vec4 result=texture2D(uSource,coord);'
          : 'vec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;vec4 result=bilerp(uSource,coord,dyeTexelSize);') +
        'float decay=1.0+dissipation*dt;gl_FragColor=result/decay;}',
      divergence: M + 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).x;float R=texture2D(uVelocity,vR).x;float T=texture2D(uVelocity,vT).y;float B=texture2D(uVelocity,vB).y;vec2 C=texture2D(uVelocity,vUv).xy;if(vL.x<0.0){L=-C.x;}if(vR.x>1.0){R=-C.x;}if(vT.y>1.0){T=-C.y;}if(vB.y<0.0){B=-C.y;}float div=0.5*(R-L+T-B);gl_FragColor=vec4(div,0.0,0.0,1.0);}',
      curl: M + 'uniform sampler2D uVelocity;void main(){float L=texture2D(uVelocity,vL).y;float R=texture2D(uVelocity,vR).y;float T=texture2D(uVelocity,vT).x;float B=texture2D(uVelocity,vB).x;float vorticity=R-L-T+B;gl_FragColor=vec4(0.5*vorticity,0.0,0.0,1.0);}',
      vorticity: H + 'uniform sampler2D uVelocity;uniform sampler2D uCurl;uniform float curl;uniform float dt;void main(){float L=texture2D(uCurl,vL).x;float R=texture2D(uCurl,vR).x;float T=texture2D(uCurl,vT).x;float B=texture2D(uCurl,vB).x;float C=texture2D(uCurl,vUv).x;vec2 force=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L));force/=length(force)+0.0001;force*=curl*C;force.y*=-1.0;vec2 velocity=texture2D(uVelocity,vUv).xy;velocity+=force*dt;velocity=min(max(velocity,-1000.0),1000.0);gl_FragColor=vec4(velocity,0.0,1.0);}',
      pressure: M + 'uniform sampler2D uPressure;uniform sampler2D uDivergence;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;float divergence=texture2D(uDivergence,vUv).x;float pressure=(L+R+B+T-divergence)*0.25;gl_FragColor=vec4(pressure,0.0,0.0,1.0);}',
      gradientSubtract: M + 'uniform sampler2D uPressure;uniform sampler2D uVelocity;void main(){float L=texture2D(uPressure,vL).x;float R=texture2D(uPressure,vR).x;float T=texture2D(uPressure,vT).x;float B=texture2D(uPressure,vB).x;vec2 velocity=texture2D(uVelocity,vUv).xy;velocity.xy-=vec2(R-L,T-B);gl_FragColor=vec4(velocity,0.0,1.0);}'
    };
    var vs = compileShader(gl.VERTEX_SHADER, V);
    var programs = {}, uniforms = {};
    Object.keys(F).forEach(function (k) {
      programs[k] = createProgram(vs, compileShader(gl.FRAGMENT_SHADER, F[k]));
      uniforms[k] = getUniforms(programs[k]);
    });

    /* Blit */
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    function blit(target) {
      if (target === null) { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
      else { gl.viewport(0, 0, target.width, target.height); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    /* FBO */
    function createFBO(w, h, internalFormat, format, type, param) {
      gl.activeTexture(gl.TEXTURE0);
      var texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture: texture, fbo: fbo, width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, texture); return id; } };
    }
    function createDoubleFBO(w, h, internalFormat, format, type, param) {
      var a = createFBO(w, h, internalFormat, format, type, param), b = createFBO(w, h, internalFormat, format, type, param);
      return { width: w, height: h, texelSizeX: 1 / w, texelSizeY: 1 / h,
        get read() { return a; }, get write() { return b; },
        swap: function () { var t = a; a = b; b = t; } };
    }
    function getResolution(resolution) {
      var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) aspect = 1 / aspect;
      var min = Math.round(resolution), max = Math.round(resolution * aspect);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? { width: max, height: min } : { width: min, height: max };
    }
    var dye, velocity, divergence, curlFbo, pressureFbo;
    function initFramebuffers() {
      var simRes = getResolution(CONFIG.SIM_RESOLUTION), dyeRes = getResolution(CONFIG.DYE_RESOLUTION);
      var filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);
      dye = createDoubleFBO(dyeRes.width, dyeRes.height, formatRGBA.internalFormat, formatRGBA.format, halfFloatTexType, filtering);
      velocity = createDoubleFBO(simRes.width, simRes.height, formatRG.internalFormat, formatRG.format, halfFloatTexType, filtering);
      divergence = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
      curlFbo = createFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
      pressureFbo = createDoubleFBO(simRes.width, simRes.height, formatR.internalFormat, formatR.format, halfFloatTexType, gl.NEAREST);
    }
    function resizeCanvas() {
      var dpr = window.devicePixelRatio || 1;
      var w = Math.floor(container.clientWidth * dpr), h = Math.floor(container.clientHeight * dpr);
      if (w < 1 || h < 1) return false;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
      return false;
    }
    resizeCanvas();
    initFramebuffers();

    /* Splat */
    function correctRadius(radius) { var a = canvas.width / canvas.height; return a > 1 ? radius * a : radius; }
    function splat(x, y, dx, dy, color) {
      gl.useProgram(programs.splat);
      gl.uniform1i(uniforms.splat.uTarget, velocity.read.attach(0));
      gl.uniform1f(uniforms.splat.aspectRatio, canvas.width / canvas.height);
      gl.uniform2f(uniforms.splat.point, x, y);
      gl.uniform3f(uniforms.splat.color, dx, dy, 0);
      gl.uniform1f(uniforms.splat.radius, correctRadius(CONFIG.SPLAT_RADIUS / 100));
      blit(velocity.write); velocity.swap();
      gl.uniform1i(uniforms.splat.uTarget, dye.read.attach(0));
      gl.uniform3f(uniforms.splat.color, color.r, color.g, color.b);
      blit(dye.write); dye.swap();
    }
    function getColor() {
      var c = SMOKE[Math.floor(Math.random() * SMOKE.length)];
      return { r: c.r * 0.15, g: c.g * 0.15, b: c.b * 0.15 };
    }

    /* Pointeur */
    var pointer = { texcoordX: 0, texcoordY: 0, prevTexcoordX: 0, prevTexcoordY: 0, deltaX: 0, deltaY: 0, moved: false, color: getColor(), primed: false };
    function updatePointer(x, y) {
      var rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var tx = (x - rect.left) / rect.width, ty = 1 - (y - rect.top) / rect.height;
      if (!pointer.primed) { pointer.texcoordX = tx; pointer.texcoordY = ty; pointer.primed = true; }
      pointer.prevTexcoordX = pointer.texcoordX; pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = tx; pointer.texcoordY = ty;
      var a = canvas.width / canvas.height;
      pointer.deltaX = (tx - pointer.prevTexcoordX) * (a < 1 ? a : 1);
      pointer.deltaY = (ty - pointer.prevTexcoordY) / (a > 1 ? a : 1);
      pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
    }
    function applyInputs() {
      if (!pointer.moved) return;
      pointer.moved = false;
      splat(pointer.texcoordX, pointer.texcoordY, pointer.deltaX * CONFIG.SPLAT_FORCE, pointer.deltaY * CONFIG.SPLAT_FORCE, pointer.color);
    }

    /* Simulation */
    function step(dt) {
      gl.disable(gl.BLEND);
      gl.useProgram(programs.curl);
      gl.uniform2f(uniforms.curl.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(uniforms.curl.uVelocity, velocity.read.attach(0));
      blit(curlFbo);

      gl.useProgram(programs.vorticity);
      gl.uniform2f(uniforms.vorticity.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(uniforms.vorticity.uVelocity, velocity.read.attach(0));
      gl.uniform1i(uniforms.vorticity.uCurl, curlFbo.attach(1));
      gl.uniform1f(uniforms.vorticity.curl, CONFIG.CURL);
      gl.uniform1f(uniforms.vorticity.dt, dt);
      blit(velocity.write); velocity.swap();

      gl.useProgram(programs.divergence);
      gl.uniform2f(uniforms.divergence.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(uniforms.divergence.uVelocity, velocity.read.attach(0));
      blit(divergence);

      gl.useProgram(programs.clear);
      gl.uniform1i(uniforms.clear.uTexture, pressureFbo.read.attach(0));
      gl.uniform1f(uniforms.clear.value, CONFIG.PRESSURE);
      blit(pressureFbo.write); pressureFbo.swap();

      gl.useProgram(programs.pressure);
      gl.uniform2f(uniforms.pressure.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(uniforms.pressure.uDivergence, divergence.attach(0));
      for (var i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
        gl.uniform1i(uniforms.pressure.uPressure, pressureFbo.read.attach(1));
        blit(pressureFbo.write); pressureFbo.swap();
      }

      gl.useProgram(programs.gradientSubtract);
      gl.uniform2f(uniforms.gradientSubtract.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      gl.uniform1i(uniforms.gradientSubtract.uPressure, pressureFbo.read.attach(0));
      gl.uniform1i(uniforms.gradientSubtract.uVelocity, velocity.read.attach(1));
      blit(velocity.write); velocity.swap();

      gl.useProgram(programs.advection);
      gl.uniform2f(uniforms.advection.texelSize, velocity.texelSizeX, velocity.texelSizeY);
      if (!supportLinearFiltering) gl.uniform2f(uniforms.advection.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
      var velocityId = velocity.read.attach(0);
      gl.uniform1i(uniforms.advection.uVelocity, velocityId);
      gl.uniform1i(uniforms.advection.uSource, velocityId);
      gl.uniform1f(uniforms.advection.dt, dt);
      gl.uniform1f(uniforms.advection.dissipation, CONFIG.VELOCITY_DISSIPATION);
      blit(velocity.write); velocity.swap();

      if (!supportLinearFiltering) gl.uniform2f(uniforms.advection.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
      gl.uniform1i(uniforms.advection.uVelocity, velocity.read.attach(0));
      gl.uniform1i(uniforms.advection.uSource, dye.read.attach(1));
      gl.uniform1f(uniforms.advection.dissipation, CONFIG.DENSITY_DISSIPATION);
      blit(dye.write); dye.swap();
    }
    function render() {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(programs.display);
      gl.uniform1i(uniforms.display.uTexture, dye.read.attach(0));
      blit(null);
    }

    var lastTime = performance.now(), rafId = 0, alive = true;
    function update() {
      if (!alive) return;
      var now = performance.now();
      var dt = Math.min((now - lastTime) / 1000, 0.016666);
      lastTime = now;
      if (resizeCanvas()) initFramebuffers();
      applyInputs();
      step(dt);
      render();
      rafId = requestAnimationFrame(update);
    }
    update();

    return {
      /* Fumée qui suit le curseur (appelé sur mousemove tant que l'émission est ouverte) */
      move: function (clientX, clientY) { updatePointer(clientX, clientY); },
      recolor: function () { pointer.color = getColor(); },
      /* Onde circulaire unique : 14 splats radiaux simultanés */
      splashAt: function (clientX, clientY, intensity) {
        var rect = container.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var cx = (clientX - rect.left) / rect.width, cy = 1 - (clientY - rect.top) / rect.height;
        var count = 14, force = CONFIG.SPLAT_FORCE * 0.55 * (intensity == null ? 1 : intensity);
        for (var i = 0; i < count; i++) {
          var angle = (i / count) * Math.PI * 2;
          splat(cx, cy, Math.cos(angle) * force, Math.sin(angle) * force, getColor());
        }
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(rafId);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  /* ─── Harnais : survol du logo Paper34 dans le footer ─── */
  function init() {
    var footer = document.querySelector('.cem-foot');
    var link = footer && footer.querySelector('.cem-foot-paper');
    if (!footer || !link || reduced()) return;

    var overlay = footer.querySelector('.paper-smoke');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'paper-smoke';
      overlay.setAttribute('aria-hidden', 'true');
      footer.insertBefore(overlay, footer.firstChild);
    }

    var fluid = null, emitting = false, stopTimer = 0, killTimer = 0;

    function onMove(e) {
      if (!fluid || !emitting) return;
      fluid.move(e.clientX, e.clientY);
    }
    function burst(tries) {
      if (!fluid) return;
      var r = link.getBoundingClientRect();
      if (!r.width && tries > 0) { setTimeout(function () { burst(tries - 1); }, 120); return; }
      fluid.splashAt(r.left + r.width / 2, r.top + r.height / 2, 0.45);
    }
    function enter() {
      clearTimeout(stopTimer); clearTimeout(killTimer);
      if (!fluid) {
        fluid = createFluid(overlay);
        if (!fluid) return;
        window.addEventListener('mousemove', onMove, { passive: true });
      }
      emitting = true;
      fluid.recolor();
      requestAnimationFrame(function () { setTimeout(function () { burst(3); }, 60); });
    }
    function leave() {
      clearTimeout(stopTimer); clearTimeout(killTimer);
      stopTimer = setTimeout(function () { emitting = false; }, 500);      // arrêt d'émission
      killTimer = setTimeout(function () {                                 // démontage, sans fondu
        if (fluid) { fluid.destroy(); fluid = null; }
        emitting = false;
        window.removeEventListener('mousemove', onMove);
      }, 10000);
    }
    link.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' || e.pointerType === 'pen') enter(); });
    link.addEventListener('pointerleave', leave);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
