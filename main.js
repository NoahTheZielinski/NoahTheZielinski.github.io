import { load_info, loadContent } from './contentloader.js';

const overlay = {
    dom: document.getElementById('overlay'),
    
    dismiss() {
        overlay.dom.style.pointerEvents = 'none';
        overlay.dom.style.opacity = 0;
        setTimeout(() => {
            overlay.dom.style.zIndex = -1;
        }, 600);
    },

    show() {
        overlay.dom.style.zIndex = '';
        overlay.dom.style.opacity = 1;
        setTimeout(() => {
            overlay.dom.style.pointerEvents = '';
        }, 600);
    }
}

const progCir = {
    cx: 100,
    cy: 50,

    desiredProgress: 0,

    progress: 0,

    dotOffset: 0,

    r: 0,

    ready: false,

    animating: false,

    el: {
        progCirBG:   document.getElementById('progress-circle-background'),
        progClip:    document.getElementById('progress-clip-path'),
        progDots:    document.getElementById('progress-dots'),
        progTipS:   document.getElementById('progress-tip-s'),
        progTipE:   document.getElementById('progress-tip-e')
    },

    polarToCartesian(cx, cy, r, degrees) {
        const rad = (degrees) * Math.PI / 180;
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad)
        };
    },

    describeArc(cx, cy, r, progress) {
        const angle = progress * 360;
        const start = progCir.polarToCartesian(cx, cy, r, 0);
        const end   = progCir.polarToCartesian(cx, cy, r, angle);
        const large = angle > 180 ? 1 : 0;

        if (progress >= 1) return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;

        return `M ${cx},${cy} L ${start.x},${start.y} A ${r},${r} 0 ${large},1 ${end.x},${end.y} Z`;
    },

    drawCircleProgress(progress, r) {
        if (!r || r <= 0) return;

        progCir.progress = progress;
        progCir.r = r;

        progCir.el.progClip.setAttribute('d', progCir.describeArc(progCir.cx, progCir.cy, r, progress));

        const angle = progress * 360;

        const start = progCir.polarToCartesian(
            progCir.cx,
            progCir.cy,
            r + progCir.pushCaps(),
            0
        );

        const end = progCir.polarToCartesian(
            progCir.cx,
            progCir.cy,
            r + progCir.pushCaps(),
            angle
        );

        progCir.el.progTipE.setAttribute('cx', end.x);
        progCir.el.progTipE.setAttribute('cy', end.y);
        progCir.el.progTipE.setAttribute('r', 0.5);

        progCir.el.progTipS.setAttribute('cx', start.x);
        progCir.el.progTipS.setAttribute('cy', start.y);
        progCir.el.progTipS.setAttribute('r', 0.5);


        const dashAmount = 40
        const dash = (r - 1) * Math.PI / dashAmount
        const space = (r - 1) * Math.PI / dashAmount
        progCir.el.progDots.setAttribute('stroke-dasharray', `${dash} ${space}`);
        progCir.el.progDots.setAttribute('stroke-dashoffset', progCir.dotOffset);
    },

    pushCaps() {
        return Number(progCir.progress === 0) * 3 - 1;
    },

    pushProgress(progress) {
        if (progress >= 1) progress = 1.1;
        progCir.desiredProgress = progress;

        if (!progCir.animating) {
            progCir.animating = true;
            requestAnimationFrame(progCir.update);
        }
    },

    update(ts) {
        if (!progCir.ready) {
            progCir.animating = false;
            return;
        }

        const tolerance = 0.001;
        const diff = progCir.desiredProgress - progCir.progress;

        if (Math.abs(diff) < tolerance) {
            progCir.progress = progCir.desiredProgress;
            progCir.drawCircleProgress(progCir.progress, progCir.r);
            progCir.animating = false;
            if (progCir.progress >= 1.0) overlay.dismiss();  // ← check here, after snapping
            return;
        }

        progCir.progress += diff * 0.05;
        progCir.drawCircleProgress(progCir.progress, progCir.r);

        requestAnimationFrame(progCir.update);
    }
};

//Play the bootup animations:
(function startAnimations() {

  // ============================================================
  // elements
  // ============================================================

    const el = {
        lidTopOuter: document.getElementById('lid-top-outer'),
        lidBotOuter: document.getElementById('lid-bot-outer'),
        lidTopInner: document.getElementById('lid-top-inner'),
        lidBotInner: document.getElementById('lid-bot-inner'),
        pupil:       document.getElementById('pupil'),
        nLeft:       document.getElementById('n-left'),
        nDiag:       document.getElementById('n-diag'),
        nRight:      document.getElementById('n-right'),
        zTop:        document.getElementById('z-top'),
        zDiag:       document.getElementById('z-diag'),
        zBot:        document.getElementById('z-bot'),
    };

    const eyeOpen = {
        started: false,

        setEye(xSpread, ySpread) {
            const outerX = 16, outerArc = 9;
            const innerX = 12, innerArc = 6;

            const cx = progCir.cx;
            const cy = progCir.cy;

            const ox1 = cx - outerX * xSpread,  ox2 = cx + outerX * xSpread;
            const ix1 = cx - innerX * xSpread,  ix2 = cx + innerX * xSpread;
            const oArc = outerArc * ySpread;
            const iArc = innerArc * ySpread;
            el.lidTopOuter.setAttribute('d', `M ${ox1},${cy} C ${cx-6},${cy-oArc} ${cx+6},${cy-oArc} ${ox2},${cy}`);
            el.lidBotOuter.setAttribute('d', `M ${ox1},${cy} C ${cx-6},${cy+oArc} ${cx+6},${cy+oArc} ${ox2},${cy}`);
            el.lidTopInner.setAttribute('d', `M ${ix1},${cy} C ${cx-6},${cy-iArc} ${cx+6},${cy-iArc} ${ix2},${cy}`);
            el.lidBotInner.setAttribute('d', `M ${ix1},${cy} C ${cx-6},${cy+iArc} ${cx+6},${cy+iArc} ${ix2},${cy}`);
        }
    };

    // ============================================================
    // utilities
    // ============================================================

    function ease(t) {
        return t < 0.5 ? 2*t*t : -1 + (4 - 2*t) * t;
    };

    function normalize(progress, min, max) {
        return min + progress * (max - min);
    };

    function drawStroke(element, progress) {
        const length = element.getTotalLength();
        element.setAttribute('stroke-dasharray', length);
        element.setAttribute('stroke-dashoffset', length * (1 - progress));
    };

    // ============================================================
    // init
    // ============================================================

    function init() {
        eyeOpen.setEye(0, 0);
        [el.nLeft, el.nDiag, el.nRight, el.zTop, el.zDiag, el.zBot].forEach(path => {
          const length = path.getTotalLength();
          path.setAttribute('stroke-dasharray', length);
          path.setAttribute('stroke-dashoffset', length);
        });
    };

    init();

    // ============================================================
    // scenes
    // ============================================================

    function sceneWaitABit(progress) {
        progCir.drawCircleProgress(progCir.progress, progCir.r);
    };

    function sceneLineGrow(progress) {
        eyeOpen.setEye(progress, 0);

        // set radius first, then draw progress so getTotalLength() reads the right value
        const r = normalize(progress, 3, 35);
        progCir.el.progCirBG.setAttribute('r', r);
        progCir.el.progDots.setAttribute('r', r);

        progCir.drawCircleProgress(progCir.progress, normalize(progress, 3, 36));
    };

    function sceneEyeOpen(progress) {
        if (!eyeOpen.started) {
          eyeOpen.started = true;

          document.documentElement.dataset.theme =
            Math.random() < 0.5 ? "teal" : "ember";
        }

        eyeOpen.setEye(1, progress);
        drawStroke(el.nLeft,  progress);
        drawStroke(el.nRight, progress);
        drawStroke(el.zTop,   progress);
        drawStroke(el.zBot,   progress);
        drawStroke(el.nDiag,  progress);
        drawStroke(el.zDiag,  progress);

        progCir.drawCircleProgress(progCir.progress, progCir.r);
    };

    function scenePupilOpen(progress) {
        el.pupil.setAttribute('r', progress * 3);
        progCir.drawCircleProgress(progCir.progress, progCir.r);
    };

    function sceneEndless(progress) {
        progCir.drawCircleProgress(progCir.progress, progCir.r);
    };

    // ============================================================
    // scene manager
    // ============================================================


    const controller = {
        scenes: [
            { fn: sceneWaitABit,  duration: 100  },
            { fn: sceneLineGrow,  duration: 1500 },
            { fn: sceneEyeOpen,   duration: 300  },
            { fn: scenePupilOpen, duration: 400  },
            { fn: sceneEndless,   duration: Infinity, onStart: () => {
                progCir.ready = true;
                requestAnimationFrame(progCir.update)
            }}
        ],

        totalDuration: 0,

        start: null,

        ready: false,

        animate(ts) {
            if (!controller.start) {
                controller.start = ts
                controller.totalDuration = controller.scenes.reduce((sum, s) => sum + s.duration, 0);
            };
            const elapsed = ts - controller.start;

            progCir.dotOffset += 0.1;

            let sceneStart = 0;
            for (const scene of controller.scenes) {
                const sceneElapsed = elapsed - sceneStart;
                if (sceneElapsed < scene.duration) {
                    if (!scene._started) {
                        scene._started = true;
                        scene.onStart?.();
                    }
                    scene.fn(ease(Math.min(1, sceneElapsed / scene.duration)));
                    break;
                } else {
                    scene.fn(1);
                }
                sceneStart += scene.duration;
            }

            if (elapsed < controller.totalDuration) requestAnimationFrame(controller.animate);
        }
    };

    requestAnimationFrame(controller.animate);
})();

//start building cards
(async function buildCards() {
    for await (const update of loadContent('portfolio')) {
        console.log(update);

        const truePercent = Math.min(Math.max(
            (update.progress.processes_complete.length + update.progress.percent_complete)
            / Object.keys(load_info.processes).length,
            0), 1.0);
        
        progCir.pushProgress(truePercent);
    }
})();

//content width bar:
(function initWidthBar() {
  const MIN_PCT = 10, MAX_PCT = 96;
  const bar = document.getElementById('width-bar');
  const pct = document.getElementById('bar-pct');
  const container = document.getElementById('content_container');
  let dragging = false;

  function render(p) {
    const w = Math.max(MIN_PCT, Math.min(MAX_PCT, p));
    const visual = Math.max(MIN_PCT, Math.min(100, p));
    bar.style.width = visual + '%';
    container.style.width = w + '%';
    pct.textContent = Math.round(w) + '%';
  }

  render(50);

  function onDown(e) {
    dragging = true;
    bar.classList.add('dragging');
    e.preventDefault();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const vw = document.documentElement.clientWidth;
    render((Math.abs(clientX - vw / 2) / vw) * 200);
  }

  function onUp() {
    dragging = false;
    bar.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
  }

  bar.addEventListener('mousedown', onDown);
  bar.addEventListener('touchstart', onDown, { passive: false });
})();