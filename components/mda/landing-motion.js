// @ts-nocheck
/* Generated from the Stitch screen script. Auth submit is injected by the caller. */
export function startLandingMotion(onSubmit) {
  if (!window.matchMedia) {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  }
  const canAnimate = Boolean(window.gsap && window.ScrollTrigger);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.landingMotion = canAnimate ? "ready" : "unavailable";
  }
  const gsap = window.gsap || {
    registerPlugin() {},
    timeline() {
      const chain = { to() { return chain; }, kill() {} };
      return chain;
    },
    to() {},
  };
  const ScrollTrigger = window.ScrollTrigger || {
    create() { return { kill() {} }; },
    getAll() { return []; },
  };
  const cleanups = [];
  let running = true;
  const authForm = document.getElementById("authForm");
  const onAuth = (event) => {
    event.preventDefault();
    const email = document.getElementById("authEmail");
    const password = document.getElementById("authPassword");
    const mode = document.getElementById("authSubmitBtn")?.textContent?.includes("CREATE") ? "signup" : "login";
    if (mode === "signup") {
      const confirm = document.getElementById("authConfirm");
      if ((confirm ? confirm.value : "") !== (password ? password.value : "")) {
        const feedback = document.getElementById("authFeedback");
        if (feedback) feedback.textContent = "Passwords do not match.";
        return;
      }
    }
    onSubmit(mode, email ? email.value : "", password ? password.value : "");
  };
  if (authForm) authForm.addEventListener("submit", onAuth);
  cleanups.push(() => authForm && authForm.removeEventListener("submit", onAuth));
  const forgotBtn = document.getElementById("authForgotBtn");
  const onForgot = (event) => {
    event.preventDefault();
    const email = document.getElementById("authEmail");
    onSubmit("reset", email ? email.value : "", "");
  };
  if (forgotBtn) forgotBtn.addEventListener("click", onForgot);
  cleanups.push(() => forgotBtn && forgotBtn.removeEventListener("click", onForgot));

  if (!gsap || !ScrollTrigger) {
    return () => cleanups.forEach((fn) => fn());
  }

  
    
      gsap.registerPlugin(ScrollTrigger);
  const scroller = document.getElementById("main-content") || document.documentElement;
  if (typeof ScrollTrigger.defaults === "function") {
    ScrollTrigger.defaults({ scroller });
  }
  const scrollTop = () => (scroller === document.documentElement ? window.scrollY : scroller.scrollTop);

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. DUAL-TAB AUTH MODAL
      const authModal = document.getElementById('authModal');
      const authScrim = document.getElementById('authScrim');
      const loginTrigger = document.getElementById('loginTrigger');
      const authClose = document.getElementById('authClose');
      const tabLogInBtn = document.getElementById('tabLogInBtn');
      const tabCreateBtn = document.getElementById('tabCreateBtn');
      const authSubmitBtn = document.getElementById('authSubmitBtn');

      let currentTab = 'login'; // 'login' | 'create'

      const setTab = (tab) => {
        currentTab = tab;
        if (tab === 'login') {
          tabLogInBtn.classList.add('text-ice', 'border-ice');
          tabLogInBtn.classList.remove('text-steel', 'border-transparent');
          tabCreateBtn.classList.remove('text-ice', 'border-ice');
          tabCreateBtn.classList.add('text-steel', 'border-transparent');
          authSubmitBtn.textContent = 'LOG IN';
        } else {
          tabCreateBtn.classList.add('text-ice', 'border-ice');
          tabCreateBtn.classList.remove('text-steel', 'border-transparent');
          tabLogInBtn.classList.remove('text-ice', 'border-ice');
          tabLogInBtn.classList.add('text-steel', 'border-transparent');
          authSubmitBtn.textContent = 'CREATE ACCOUNT';
        }
        if (tabLogInBtn) tabLogInBtn.setAttribute('aria-pressed', tab === 'login' ? 'true' : 'false');
        if (tabCreateBtn) tabCreateBtn.setAttribute('aria-pressed', tab === 'create' ? 'true' : 'false');
        const confirmWrap = document.getElementById('authConfirmWrap');
        const forgot = document.getElementById('authForgotBtn');
        const passwordInput = document.getElementById('authPassword');
        const creating = tab === 'create';
        if (confirmWrap) confirmWrap.classList.toggle('hidden', !creating);
        if (forgot) forgot.classList.toggle('hidden', creating);
        if (passwordInput) {
          passwordInput.setAttribute('autocomplete', creating ? 'new-password' : 'current-password');
        }
      };

      let authOpener = null;
      const setModalOpen = (open) => {
        authModal.classList.toggle('opacity-0', !open);
        authModal.classList.toggle('pointer-events-none', !open);
        authModal.classList.toggle('opacity-100', open);
        authModal.classList.toggle('pointer-events-auto', open);
        authModal.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) authModal.removeAttribute('inert');
        else authModal.setAttribute('inert', '');
      };
      const openModal = () => {
        authOpener = document.activeElement;
        setTab('login');
        setModalOpen(true);
        (tabLogInBtn || authClose).focus();
      };
      const closeModal = () => {
        if (!authModal || authModal.getAttribute('aria-hidden') !== 'false') return;
        setModalOpen(false);
        if (authOpener && typeof authOpener.focus === 'function') authOpener.focus();
      };
      const trapAuthFocus = (event) => {
        if (!authModal || authModal.getAttribute('aria-hidden') !== 'false') return;
        if (event.key === 'Escape') {
          event.preventDefault();
          closeModal();
          return;
        }
        if (event.key !== 'Tab') return;
        const items = [...authModal.querySelectorAll('button, input, [href], select, textarea')].filter(
          (el) => !el.disabled && el.tabIndex !== -1,
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      };

      if (tabLogInBtn) tabLogInBtn.addEventListener('click', () => setTab('login'));
      if (tabCreateBtn) tabCreateBtn.addEventListener('click', () => setTab('create'));
      if (loginTrigger) loginTrigger.addEventListener('click', openModal);
      if (authClose) authClose.addEventListener('click', closeModal);
      if (authScrim) authScrim.addEventListener('click', closeModal);
      document.addEventListener('keydown', trapAuthFocus);
      cleanups.push(() => document.removeEventListener('keydown', trapAuthFocus));

      // 2. FINE POINTER RETICLE
      const opticWrapper = document.getElementById('opticWrapper');
      const reticleTracker = document.getElementById('opticReticleTracker');
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

      if (hasFinePointer && opticWrapper && reticleTracker) {
        opticWrapper.addEventListener('mouseenter', () => {
          reticleTracker.style.opacity = '1';
        });
        opticWrapper.addEventListener('mouseleave', () => {
          reticleTracker.style.opacity = '0';
        });
        opticWrapper.addEventListener('mousemove', (e) => {
          reticleTracker.style.left = `${e.clientX}px`;
          reticleTracker.style.top = `${e.clientY}px`;
        });
      }

      // 3. TYPEWRITER SENTENCES (Types on once, stays)
      const typewriterMap = new Map();
      const runTypewriter = (el) => {
        if (!el || typewriterMap.get(el)) return;
        typewriterMap.set(el, true);
        const fullText = el.getAttribute('data-fulltext') || el.getAttribute('data-sentence') || el.textContent || '';
        el.textContent = '';
        
        let index = 0;
        const typingInterval = setInterval(() => {
          if (index < fullText.length) {
            el.textContent = fullText.slice(0, index + 1);
            index++;
          } else {
            clearInterval(typingInterval);
            el.textContent = fullText;
          }
        }, 20);
      };

      // 4. PLATE BRACKET DRAW-ON
      const plates = document.querySelectorAll('.plate-card');
      plates.forEach((plate) => {
        ScrollTrigger.create({
          trigger: plate,
          start: 'top 85%',
          onEnter: () => plate.classList.add('bracket-active'),
        });
      });

      // 5. STICKY WORD STACK COLOR SHIFTS
      const stickyStack = document.getElementById('stickyWordStack');
      const stackBuild = document.getElementById('stackBuild');
      const stackOptimize = document.getElementById('stackOptimize');
      const stackDominate = document.getElementById('stackDominate');

      const setStackColors = (activeWord) => {
        const words = [
          { name: 'BUILD', el: stackBuild },
          { name: 'OPTIMIZE', el: stackOptimize },
          { name: 'DOMINATE', el: stackDominate },
        ];

        words.forEach(({ name, el }) => {
          if (name === activeWord) {
            el.classList.remove('text-steel');
            el.classList.add('text-ice');
          } else {
            el.classList.remove('text-ice');
            el.classList.add('text-steel');
          }
        });
      };

      ScrollTrigger.create({
        trigger: '#heroSection',
        start: 'bottom 70%',
        end: 'bottom top',
        onEnter: () => {
          stickyStack.classList.remove('opacity-0');
          stickyStack.classList.add('opacity-100');
        },
        onLeaveBack: () => {
          stickyStack.classList.remove('opacity-100');
          stickyStack.classList.add('opacity-0');
        }
      });

      // Chapter 01 Workshop: BUILD is ice
      ScrollTrigger.create({
        trigger: '#chapterWorkshop',
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => {
          setStackColors('BUILD');
          runTypewriter(document.getElementById('sentenceWorkshop'));
        },
        onEnterBack: () => {
          setStackColors('BUILD');
        }
      });

      // Chapter 02 Strategist: OPTIMIZE is ice
      ScrollTrigger.create({
        trigger: '#chapterStrategist',
        start: 'top 60%',
        end: 'bottom 40%',
        onEnter: () => {
          setStackColors('OPTIMIZE');
          runTypewriter(document.getElementById('sentenceStrategist'));
        },
        onEnterBack: () => {
          setStackColors('OPTIMIZE');
        }
      });

      // Chapter 03 Archives: DOMINATE is ice
      ScrollTrigger.create({
        trigger: '#chapterArchives',
        start: 'top 60%',
        end: 'bottom bottom',
        onEnter: () => {
          setStackColors('DOMINATE');
          runTypewriter(document.getElementById('sentenceArchives'));
        },
        onEnterBack: () => {
          setStackColors('DOMINATE');
        }
      });

      // 6. CHASSIS BOLT HOTSPOTS & FROSTED GLASS PANELS
      const boltButtons = [
        { btn: document.getElementById('boltUL'), panel: document.getElementById('panelUL') },
        { btn: document.getElementById('boltUR'), panel: document.getElementById('panelUR') },
        { btn: document.getElementById('boltLL'), panel: document.getElementById('panelLL') },
        { btn: document.getElementById('boltLR'), panel: document.getElementById('panelLR') },
      ];

      const closeAllPanels = () => {
        boltButtons.forEach(({ btn, panel }) => {
          if (panel) {
            panel.classList.remove('panel-active');
            panel.setAttribute('aria-hidden', 'true');
          }
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
      };

      const openPanel = (targetBtn, targetPanel) => {
        // Function only when scrollY === 0
        if (scrollTop() > 0) return;
        closeAllPanels();
        if (targetPanel) {
          targetPanel.classList.add('panel-active');
          targetPanel.setAttribute('aria-hidden', 'false');
        }
        if (targetBtn) targetBtn.setAttribute('aria-expanded', 'true');
      };

      boltButtons.forEach(({ btn, panel }) => {
        if (!btn || !panel) return;
        btn.addEventListener('mouseenter', () => openPanel(btn, panel));
        btn.addEventListener('mouseleave', () => closeAllPanels());
        btn.addEventListener('focus', () => openPanel(btn, panel));
        btn.addEventListener('blur', () => closeAllPanels());
      });

      // 7. LOCALIZED VAPOR CLOUD CANVAS (~180 square particles)
      const canvas = document.getElementById('pixelCloudCanvas');
      const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
      const colors = ['#0b0e11', '#11161d', '#2c3440', '#4a5568', '#718096', '#a7ccda', '#bfe5f3', '#ffffff'];

      let width = canvas ? (canvas.width = window.innerWidth) : window.innerWidth;
      let height = canvas ? (canvas.height = window.innerHeight) : window.innerHeight;

      const onResize = () => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', onResize);
      cleanups.push(() => window.removeEventListener('resize', onResize));

      const opticWrapperEl = document.getElementById('opticWrapper');
      const archivesPlate = document.getElementById('archivesPlate');
      const opticPupil = document.getElementById('opticPupil');
      const opticAliveGlow = document.getElementById('opticAliveGlow');

      function getHeroOpticCenter() {
        const heroRightOffset = window.innerWidth >= 768 ? 96 : 48; // 6rem or 3rem
        const opticWidth = 560;
        const cx = window.innerWidth - heroRightOffset - (opticWidth / 2);
        const cy = window.innerHeight / 2;
        return { cx, cy };
      }

      function getArchivesOpticCenter() {
        if (!archivesPlate) return { cx: width / 2, cy: height / 2 };
        const rect = archivesPlate.getBoundingClientRect();
        return {
          cx: rect.left + rect.width / 2,
          cy: rect.top + 28
        };
      }

      const NUM_PARTICLES = 180;
      const particles = [];

      for (let i = 0; i < NUM_PARTICLES; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 175;
        const relX = Math.cos(angle) * radius;
        const relY = Math.sin(angle) * radius;

        particles.push({
          relX,
          relY,
          size: Math.random() * 3.5 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          noisePhase: Math.random() * 100,
          driftX: (Math.random() - 0.5) * 110,
          driftY: (Math.random() - 0.5) * 110,
          baseAlpha: Math.random() * 0.5 + 0.5
        });
      }

      let particleGlobalAlpha = 0;
      let scrollProgressVal = 0;
      let particleGatherProgress = 0;
      let isFullyReassembledAtArchives = false;

      function renderParticles() {
        if (!running || !ctx) return;
        ctx.clearRect(0, 0, width, height);

        if (particleGlobalAlpha > 0.005) {
          const heroC = getHeroOpticCenter();
          const archC = getArchivesOpticCenter();
          const travel = particleGatherProgress;
          const targetX = Math.max(48, Math.min(width - 48, archC.cx));
          const targetY = Math.max(48, Math.min(height - 48, archC.cy));
          const cloudCenterX = heroC.cx + (targetX - heroC.cx) * travel;
          const cloudCenterY = heroC.cy + (targetY - heroC.cy) * travel;

          const time = performance.now() * 0.0015;

          for (let i = 0; i < NUM_PARTICLES; i++) {
            const p = particles[i];
            const driftOscX = Math.sin(time + p.noisePhase) * 18 + p.driftX * 0.6;
            const driftOscY = Math.cos(time + p.noisePhase * 1.3) * 18 + p.driftY * 0.6;
            const compression = (1 - particleGatherProgress * 0.85);

            const px = cloudCenterX + (p.relX * 0.5 + driftOscX) * compression;
            const py = cloudCenterY + (p.relY * 0.5 + driftOscY) * compression;

            ctx.save();
            ctx.globalAlpha = p.baseAlpha * particleGlobalAlpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
            ctx.restore();
          }
        }

        requestAnimationFrame(renderParticles);
      }
      if (ctx) renderParticles();

      // 8. ARCHIVES OPTIC HOVER & PUPIL LOOP ANIMATION
      let pupilTimeline = null;

      function startPupilLoop() {
        if (prefersReducedMotion || !opticPupil) return;
        if (pupilTimeline) pupilTimeline.kill();

        pupilTimeline = gsap.timeline({ repeat: -1 });
        // Smooth 5-second ease-in-out repeating loop:
        // travels about 46 units left (-46, 0); then to (40, -30); then to (6, 38); then returns to center (0, 0)
        pupilTimeline
          .to(opticPupil, { x: -46, y: 0, duration: 1.25, ease: 'sine.inOut' })
          .to(opticPupil, { x: 40, y: -30, duration: 1.25, ease: 'sine.inOut' })
          .to(opticPupil, { x: 6, y: 38, duration: 1.25, ease: 'sine.inOut' })
          .to(opticPupil, { x: 0, y: 0, duration: 1.25, ease: 'sine.inOut' });
      }

      function stopPupilLoop() {
        if (pupilTimeline) {
          pupilTimeline.kill();
          pupilTimeline = null;
        }
        if (opticPupil) {
          gsap.to(opticPupil, { x: 0, y: 0, duration: 0.35, ease: 'sine.out' });
        }
      }

      opticWrapperEl.addEventListener('mouseenter', () => {
        if (!isFullyReassembledAtArchives || prefersReducedMotion) return;
        opticWrapperEl.classList.add('archives-hover-active');
        opticWrapperEl.style.transform = `translate(-50%, -50%) translateY(-6px) scale(0.32)`;
        startPupilLoop();
      });

      opticWrapperEl.addEventListener('mouseleave', () => {
        opticWrapperEl.classList.remove('archives-hover-active');
        if (isFullyReassembledAtArchives) {
          opticWrapperEl.style.transform = `translate(-50%, -50%) scale(0.32)`;
        }
        stopPupilLoop();
      });

      // 9. SCROLL CONTROLLER & OPTIC POSITIONING
      if (!prefersReducedMotion) {
        ScrollTrigger.create({
          trigger: document.getElementById("landing-root") || document.body,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const p = self.progress;
            scrollProgressVal = p;
            const scrollY = scrollTop();

            // Bolt hotspots interactivity & panel dismissal
            const boltLayer = document.getElementById('boltHotspotsLayer');
            if (boltLayer) {
              if (scrollY === 0) {
                boltLayer.style.pointerEvents = 'auto';
              } else {
                boltLayer.style.pointerEvents = 'none';
                closeAllPanels();
              }
            }

            // Continuous ring spinning vs paused:
            // Only unpause when fully assembled at top hero (scrollY <= 2) or fully assembled at archives (p >= 0.90)
            const atHero = scrollY <= 2;
            const atArchives = p >= 0.90;

            if (atHero || atArchives) {
              document.body.classList.remove('rings-paused');
            } else {
              document.body.classList.add('rings-paused');
            }

            // Flag whether archives hover dynamics are permitted
            isFullyReassembledAtArchives = p >= 0.98;
            if (!isFullyReassembledAtArchives) {
              opticWrapperEl.classList.remove('archives-hover-active');
              stopPupilLoop();
            }

            // TRANSITIONS & COORDINATES:
            // p < 0.14: Hero -> Dissolve to vapor
            // Exact return coordinates when back at hero:
            // top: 50%, right: 6rem (md) / 3rem, left: auto, transform: translateY(-50%)
            if (p < 0.14) {
              const heroNorm = p / 0.14;
              opticWrapperEl.style.opacity = (1 - heroNorm).toFixed(3);
              opticWrapperEl.style.top = '50%';
              opticWrapperEl.style.left = 'auto';
              opticWrapperEl.style.right = window.innerWidth >= 768 ? '6rem' : '3rem';
              opticWrapperEl.style.transform = `translateY(-50%) scale(${1 - heroNorm * 0.12})`;

              particleGlobalAlpha = heroNorm;
              particleGatherProgress = 0;
            } else if (p >= 0.14 && p < 0.70) {
              // Workshop & Strategist: Localized delicate vapor cloud
              opticWrapperEl.style.opacity = '0';
              particleGlobalAlpha = 0.92;
              particleGatherProgress = 0;
            } else if (p >= 0.70 && p < 0.90) {
              // Approaching Archives: Gather particles tightly toward top-center of Archives plate
              opticWrapperEl.style.opacity = '0';
              const gatherNorm = (p - 0.70) / 0.20;
              particleGlobalAlpha = 0.95;
              particleGatherProgress = gatherNorm;
            } else {
              // At Archives: Fully reassembled compact optic sitting top-center of plate
              const archNorm = Math.min(1, (p - 0.90) / 0.10);
              particleGlobalAlpha = 1 - archNorm;
              particleGatherProgress = 1;

              const archC = getArchivesOpticCenter();
              opticWrapperEl.style.opacity = archNorm.toFixed(3);
              opticWrapperEl.style.left = `${archC.cx}px`;
              opticWrapperEl.style.top = `${archC.cy}px`;
              opticWrapperEl.style.right = 'auto';
              if (!opticWrapperEl.classList.contains('archives-hover-active')) {
                opticWrapperEl.style.transform = `translate(-50%, -50%) scale(0.32)`;
              }
            }
          }
        });
      } else {
        // Reduced motion fallback
        document.body.classList.remove('rings-paused');
        opticWrapperEl.style.opacity = '1';
        opticWrapperEl.style.top = '50%';
        opticWrapperEl.style.right = window.innerWidth >= 768 ? '6rem' : '3rem';
        opticWrapperEl.style.left = 'auto';
        opticWrapperEl.style.transform = 'translateY(-50%)';
      }

      if (typeof ScrollTrigger.refresh === "function") ScrollTrigger.refresh();

  return () => {
    running = false;
    cleanups.forEach((fn) => fn());
    if (ScrollTrigger.getAll) ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    document.body.classList.remove("rings-paused");
  };
}
