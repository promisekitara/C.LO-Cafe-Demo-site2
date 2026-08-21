/**
 * C.LO CAFE — Auto-Transitioning WebGL Frame Morph Engine
 * Automatically transitions through Frames 1 to 6 in the Hero section with their story cards,
 * with full interactive controls (dots, arrows, pause on hover) and normal natural downward page scrolling.
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
      subtitle: 'Shade-grown Guatemalan beans, roasted fresh and brewed with care in Ridgewood.',
      pill1: '1,800m Elevation',
      pill2: 'Guatemala Roots'
    },
    {
      step: '02',
      tag: 'Volcanic Terroir',
      title: 'Highland Harvest',
      subtitle: 'Hand-picked ripe cherries with notes of raw cocoa, mountain citrus, and sweet honey.',
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
      subtitle: 'Velvety micro-foam and handcrafted latte art poured fresh to order.',
      pill1: 'Organic Oat',
      pill2: '65°C Perfect Steam'
    },
    {
      step: '05',
      tag: 'House Favorites',
      title: 'Signature Horchata',
      subtitle: 'Spiced cinnamon rice milk espresso and fresh scratch kitchen breakfast pairings.',
      pill1: 'House Recipe',
      pill2: 'Fresh Daily'
    },
    {
      step: '06',
      tag: 'Your Sanctuary',
      title: 'Ridgewood Cafe',
      subtitle: '6-60 Fairview Ave. Open 7 days a week from 7:00 AM to 7:00 PM with garden patio.',
      pill1: 'Garden Patio',
      pill2: 'Open 7am–7pm'
    }
  ];

  let canvas;
  let gl;
  let program;
  let textures = [];
  let images = [];
  let isReady = false;

  let currentChapter = 0;
  let fromChapter = 0;
  let toChapter = 0;
  let transitionProgress = 1.0;
  let isTransitioning = false;

  let autoPlayTimer = null;
  const AUTO_PLAY_INTERVAL = 4500; // 4.5 seconds per frame
  let isPaused = false;

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

  // Clean, crisp optical cross-fade dissolve
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
      float blend = smoothstep(0.0, 1.0, p);

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
    initHoverPause();
    updateUI(0);
    updateTextCard(0);
    startAutoPlay();
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
    render();
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
    let loadedCount = 0;
    FRAME_PATHS.forEach((path, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = path;
      img.onload = () => {
        images[idx] = img;
        if (gl) {
          uploadTexture(idx, img);
        }
        loadedCount++;
        if (loadedCount === 1) {
          fromChapter = 0;
          toChapter = 0;
          transitionProgress = 1.0;
          render();
        }
        if (loadedCount === FRAME_PATHS.length) {
          isReady = true;
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

  function goToChapter(targetIndex) {
    if (targetIndex < 0 || targetIndex >= CHAPTER_DATA.length) return;
    if (targetIndex === currentChapter && transitionProgress >= 1.0) return;

    fromChapter = currentChapter;
    toChapter = targetIndex;
    currentChapter = targetIndex;
    transitionProgress = 0.0;
    isTransitioning = true;

    updateUI(currentChapter);
    updateTextCard(currentChapter);
    resetAutoPlay();
  }

  function nextChapter() {
    const nextIdx = (currentChapter + 1) % CHAPTER_DATA.length;
    goToChapter(nextIdx);
  }

  function prevChapter() {
    const prevIdx = (currentChapter - 1 + CHAPTER_DATA.length) % CHAPTER_DATA.length;
    goToChapter(prevIdx);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(() => {
      if (!isPaused && isReady) {
        nextChapter();
      }
    }, AUTO_PLAY_INTERVAL);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  function resetAutoPlay() {
    startAutoPlay();
  }

  function initHoverPause() {
    const card = document.getElementById('interactive-story-card');
    const controls = document.querySelector('.stage-nav-controller');
    const scrubber = document.querySelector('.side-scrubber-dots');

    [card, controls, scrubber].forEach(el => {
      if (el) {
        el.addEventListener('mouseenter', () => { isPaused = true; });
        el.addEventListener('mouseleave', () => { isPaused = false; });
      }
    });
  }

  function startRenderLoop() {
    let lastTime = performance.now();

    function loop(now) {
      requestAnimationFrame(loop);
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isTransitioning) {
        // Fast, elegant cross-fade transition (~280ms duration)
        transitionProgress += dt * 3.6;
        if (transitionProgress >= 1.0) {
          transitionProgress = 1.0;
          isTransitioning = false;
          fromChapter = currentChapter;
          toChapter = currentChapter;
        }
        render();
      }
    }
    requestAnimationFrame(loop);
  }

  function render() {
    const tex1 = textures[fromChapter] || textures[0];
    const tex2 = textures[toChapter] || textures[fromChapter] || textures[0];

    if (!useFallback2D && gl && tex1 && tex2) {
      gl.useProgram(program);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex1);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex2);

      gl.uniform1f(uProgressLoc, transitionProgress);
      gl.uniform2f(uResLoc, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (ctx2d) {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx2d.clearRect(0, 0, cw, ch);

      const img1 = images[fromChapter] || images[0];
      const img2 = images[toChapter] || images[fromChapter] || images[0];

      if (img1) drawCover2D(img1, 1.0 - transitionProgress);
      if (img2) drawCover2D(img2, transitionProgress);
    }
  }

  function drawCover2D(img, alpha) {
    ctx2d.save();
    ctx2d.globalAlpha = Math.max(0, Math.min(1, alpha));
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

  function updateTextCard(index) {
    const data = CHAPTER_DATA[index];
    if (!data) return;

    const liveTag = document.getElementById('hero-live-tag');
    if (liveTag) {
      liveTag.textContent = `${data.step}. ${data.tag} • ${data.pill1}`;
    }

    const liveSub = document.getElementById('hero-subtitle');
    if (liveSub) {
      liveSub.textContent = data.subtitle;
    }
  }

  function updateUI(index) {
    document.querySelectorAll('.scrubber-dot').forEach((dot, idx) => {
      if (idx === index) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    document.querySelectorAll('.thumb-btn').forEach((btn, idx) => {
      if (idx === index) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const counterEl = document.getElementById('stage-counter');
    if (counterEl) {
      counterEl.textContent = `0${index + 1} / 06`;
    }
  }

  // Subtle Mouse Parallax on Story Card
  function initParallax() {
    window.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 8;
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      
      const card = document.getElementById('interactive-story-card');
      if (card) {
        card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    }, { passive: true });
  }

  return {
    init,
    goToChapter,
    nextChapter,
    prevChapter,
    getCurrentChapter: () => currentChapter
  };
})();
