/**
 * C.LO CAFE — Pure Sticky Scroll WebGL Morph Engine with Staggered Card Animation
 */

window.MorphEngine = (function () {
  const FRAME_PATHS = [
    'assets/sequence/frames/frame-1.png',
    'assets/sequence/frames/frame-2.png',
    'assets/sequence/frames/frame-3.png',
    'assets/sequence/frames/frame-4.png',
    'assets/sequence/frames/frame-5.png',
    'assets/sequence/frames/frame-6.png'
  ];

  const CHAPTER_DATA = [
    {
      step: '01',
      tag: 'Single-Origin Coffee',
      title: 'Morning Light',
      subtitle: 'Shade-grown Guatemalan beans, roasted fresh and brewed in Ridgewood.',
      pill1: '1,800m Elevation',
      pill2: 'Guatemala Roots'
    },
    {
      step: '02',
      tag: 'Volcanic Terroir',
      title: 'Highland Harvest',
      subtitle: 'Hand-picked ripe cherries with notes of raw cocoa and mountain citrus.',
      pill1: 'Direct Trade',
      pill2: '100% Arabica'
    },
    {
      step: '03',
      tag: 'Espresso Craft',
      title: 'The 9-Bar Pull',
      subtitle: 'Every double shot weighed to 0.1g for rich flavor and dense golden crema.',
      pill1: '20g Dose',
      pill2: 'Synesso MVP'
    },
    {
      step: '04',
      tag: 'Silky Texture',
      title: 'Steamed Oat & Pour',
      subtitle: 'Velvety micro-foam and handcrafted latte art poured to order.',
      pill1: 'Organic Oat',
      pill2: '65°C Perfect Steam'
    },
    {
      step: '05',
      tag: 'House Favorites',
      title: 'Signature Horchata',
      subtitle: 'Spiced cinnamon rice milk espresso and fresh scratch kitchen pairings.',
      pill1: 'House Recipe',
      pill2: 'Fresh Daily'
    },
    {
      step: '06',
      tag: 'Your Sanctuary',
      title: 'Ridgewood Cafe',
      subtitle: '6-60 Fairview Ave. Open 7 days a week from 7:00 AM to 7:00 PM.',
      pill1: 'Garden Patio',
      pill2: 'Open 7am–7pm'
    }
  ];

  let canvas;
  let gl;
  let program;
  let textures = [];
  let images = [];
  
  let currentScrollProgress = 0;
  let targetScrollProgress = 0;
  let activeChapterIndex = 0;

  let uTex1Loc, uTex2Loc, uProgressLoc, uResLoc, uTexResLoc;
  let useFallback2D = false;
  let ctx2d = null;

  const VS_SOURCE = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = (aPosition + 1.0) * 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  // Clean, tight optical linear dissolve
  const FS_SOURCE = `
    precision mediump float;
    uniform sampler2D uTex1;
    uniform sampler2D uTex2;
    uniform float uProgress;
    uniform vec2 uResolution;
    uniform vec2 uTextureRes;
    varying vec2 vUv;

    vec2 getCoverUv(vec2 uv, vec2 screenRes, vec2 texRes) {
      float screenRatio = screenRes.x / screenRes.y;
      float texRatio = texRes.x / texRes.y;
      vec2 ratio = vec2(
        min(screenRatio / texRatio, 1.0),
        min((1.0 / screenRatio) / (1.0 / texRatio), 1.0)
      );
      return vec2(
        uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        uv.y * ratio.y + (1.0 - ratio.y) * 0.5
      );
    }

    void main() {
      vec2 uv = getCoverUv(vUv, uResolution, uTextureRes);
      float p = clamp(uProgress, 0.0, 1.0);
      float blend = smoothstep(0.35, 0.65, p);

      vec4 col1 = texture2D(uTex1, uv);
      vec4 col2 = texture2D(uTex2, uv);

      gl_FragColor = mix(col1, col2, blend);
    }
  `;

  function init() {
    canvas = document.getElementById('morph-canvas');
    if (!canvas) return;

    resizeCanvas();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) ||
           canvas.getContext('experimental-webgl');
      
      if (gl) {
        initGL();
      } else {
        useFallback2D = true;
        ctx2d = canvas.getContext('2d');
      }
    } catch (e) {
      useFallback2D = true;
      ctx2d = canvas.getContext('2d');
    }

    preloadImages();
    startRenderLoop();
    initParallax();
    onScroll();
    updateTextCard(0);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  function onResize() {
    resizeCanvas();
    if (gl && program && uResLoc) {
      gl.useProgram(program);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);
    }
    onScroll();
  }

  function initGL() {
    const vs = createShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) {
      useFallback2D = true;
      ctx2d = canvas.getContext('2d');
      return;
    }

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      useFallback2D = true;
      ctx2d = canvas.getContext('2d');
      return;
    }

    gl.useProgram(program);

    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    uTex1Loc = gl.getUniformLocation(program, 'uTex1');
    uTex2Loc = gl.getUniformLocation(program, 'uTex2');
    uProgressLoc = gl.getUniformLocation(program, 'uProgress');
    uResLoc = gl.getUniformLocation(program, 'uResolution');
    uTexResLoc = gl.getUniformLocation(program, 'uTextureRes');

    gl.uniform1i(uTex1Loc, 0);
    gl.uniform1i(uTex2Loc, 1);
    gl.uniform2f(uResLoc, canvas.width, canvas.height);
    gl.uniform2f(uTexResLoc, 1280.0, 720.0);
  }

  function createShader(glCtx, type, source) {
    const shader = glCtx.createShader(type);
    glCtx.shaderSource(shader, source);
    glCtx.compileShader(shader);
    if (!glCtx.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      glCtx.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function preloadImages() {
    FRAME_PATHS.forEach((path, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = path;
      img.onload = () => {
        images[idx] = img;
        if (gl) {
          uploadTexture(idx, img);
        }
        if (idx === 0) {
          render();
        }
      };
    });
  }

  function uploadTexture(index, img) {
    if (!gl) return;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    textures[index] = tex;
  }

  function onScroll() {
    const container = document.getElementById('sequence-scroll-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollableDistance = container.offsetHeight - window.innerHeight;

    if (scrollableDistance <= 0) {
      targetScrollProgress = 0;
      return;
    }

    const scrolled = -rect.top;
    targetScrollProgress = Math.max(0, Math.min(1, scrolled / scrollableDistance));
  }

  function scrollToChapter(index) {
    const container = document.getElementById('sequence-scroll-container');
    if (!container) return;

    const scrollableDistance = container.offsetHeight - window.innerHeight;
    const targetY = container.offsetTop + (index / 5) * scrollableDistance;

    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  }

  function startRenderLoop() {
    function loop() {
      requestAnimationFrame(loop);

      // Smooth interpolation
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.12;

      render();
      checkChapterUpdate();
    }
    requestAnimationFrame(loop);
  }

  function render() {
    const numTransitions = 5;
    const scaledProgress = currentScrollProgress * numTransitions;
    const frameIndex1 = Math.min(Math.floor(scaledProgress), 4);
    const frameIndex2 = Math.min(frameIndex1 + 1, 5);
    const frameBlend = scaledProgress - frameIndex1;

    if (!useFallback2D && gl && textures[frameIndex1]) {
      const tex1 = textures[frameIndex1];
      const tex2 = textures[frameIndex2] || textures[frameIndex1];

      gl.useProgram(program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex1);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex2);

      gl.uniform1f(uProgressLoc, frameBlend);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (ctx2d && images[frameIndex1]) {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx2d.clearRect(0, 0, cw, ch);

      const tBlend = Math.max(0, Math.min(1, (frameBlend - 0.35) / 0.3));

      const img1 = images[frameIndex1];
      const img2 = images[frameIndex2] || img1;

      if (img1) drawCover2D(img1, 1.0);
      if (tBlend > 0 && img2) drawCover2D(img2, tBlend);
    }
  }

  function drawCover2D(img, alpha) {
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;
    const ratio = Math.max(cw / iw, ch / ih);
    const nw = iw * ratio;
    const nh = ih * ratio;
    const nx = (cw - nw) / 2;
    const ny = (ch - nh) / 2;
    ctx2d.drawImage(img, nx, ny, nw, nh);
    ctx2d.restore();
  }

  function checkChapterUpdate() {
    const chapterIdx = Math.min(
      Math.floor(currentScrollProgress * 6),
      5
    );

    if (chapterIdx !== activeChapterIndex) {
      activeChapterIndex = chapterIdx;
      updateTextCard(chapterIdx);
      updateUI(chapterIdx);
    }

    const progLine = document.getElementById('scroll-progress-line');
    if (progLine) {
      progLine.style.width = `${(currentScrollProgress * 100).toFixed(1)}%`;
    }
  }

  function updateTextCard(index) {
    const data = CHAPTER_DATA[index];
    if (!data) return;

    const card = document.getElementById('interactive-story-card');
    if (!card) return;

    // Start staggered fade-out
    card.classList.add('card-updating');

    setTimeout(() => {
      const stepEl = document.getElementById('card-step');
      const tagEl = document.getElementById('card-tag');
      const titleEl = document.getElementById('card-title');
      const subEl = document.getElementById('card-sub');
      const pill1El = document.getElementById('card-pill-1');
      const pill2El = document.getElementById('card-pill-2');

      if (stepEl) stepEl.textContent = data.step;
      if (tagEl) tagEl.textContent = data.tag;
      if (titleEl) titleEl.innerHTML = `${data.title}`;
      if (subEl) subEl.textContent = data.subtitle;
      if (pill1El) pill1El.textContent = data.pill1;
      if (pill2El) pill2El.textContent = data.pill2;

      // Update Mini Progress Dashes
      const pips = document.querySelectorAll('.dash-pip');
      pips.forEach((pip, pIdx) => {
        if (pIdx === index) {
          pip.classList.add('active');
        } else {
          pip.classList.remove('active');
        }
      });

      const ctaBtn = document.getElementById('card-action-btn');
      if (ctaBtn) {
        if (index === 5) {
          ctaBtn.innerHTML = `<span>Explore Full Menu ↓</span>`;
          ctaBtn.onclick = () => {
            document.getElementById('menu-showcase')?.scrollIntoView({ behavior: 'smooth' });
          };
        } else {
          ctaBtn.innerHTML = `<span>Next Stage →</span>`;
          ctaBtn.onclick = () => scrollToChapter(index + 1);
        }
      }

      // Smooth staggered entrance
      card.classList.remove('card-updating');
    }, 120);
  }

  function updateUI(index) {
    document.querySelectorAll('.scrubber-dot').forEach((dot, idx) => {
      if (idx === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Subtle Mouse Parallax
  function initParallax() {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      
      const card = document.getElementById('interactive-story-card');
      if (card) {
        card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }, { passive: true });
  }

  return {
    init,
    scrollToChapter,
    getCurrentChapter: () => activeChapterIndex
  };
})();
