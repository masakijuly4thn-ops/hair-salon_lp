/***********************************************
 * Const
 * ********************************************/
const html = document.documentElement;
const body = document.body;
// 動きを減らす設定
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ハンバーガーボタン
const hamburgerButton = document.getElementById('js-hamburgerButton');

// ハンバーガーメニュー
const header = document.getElementById('js-header');
const headerNav = document.getElementById('js-headerNav');
const mv = document.getElementById('js-mv');

/***********************************************
 * Method
 * ********************************************/
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ------------------------ 行分割
// .js-split の <br> ごとに <span class="line" style="--l:n"> で包む（行ごとに遅らせて表示するため）
const splitLines = (elem) => {
  const lines = elem.innerHTML.split(/<br\s*\/?>/i);
  elem.innerHTML = lines.map((line, i) => `<span class="line" style="--l:${i}">${line.trim()}</span>`).join('');
};
document.querySelectorAll('.js-split').forEach(splitLines);

// ------------------------ コームの歯
// .c-comb に縦の帯を差し込む。.view が付くと左から順に下へ抜ける（CSS側）
const COMB_TEETH = 9;
document.querySelectorAll('.c-comb').forEach((elem) => {
  const teeth = document.createElement('span');
  teeth.className = 'c-comb__teeth';
  teeth.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < COMB_TEETH; i++) {
    const tooth = document.createElement('i');
    tooth.style.setProperty('--n', i);
    teeth.appendChild(tooth);
  }
  elem.appendChild(teeth);
});

// ------------------------ ローディング
// ページ内画像の読み込み具合に合わせて鏡の縁を描き、完了したら鏡の中心から開く
const loaderRing = document.getElementById('js-loaderRing');
const loaderStart = performance.now();
const LOADER_MIN = reduceMotion ? 0 : 2000;
const LOADER_MAX = 6000;
let loaded = false;

const finishLoading = () => {
  if (loaded) return;
  loaded = true;
  if (loaderRing) loaderRing.style.setProperty('--progress', 1);
  const wait = Math.max(0, LOADER_MIN - (performance.now() - loaderStart));
  setTimeout(() => {
    body.classList.remove('is-loading');
    body.classList.add('is-loaded');
    document.dispatchEvent(new CustomEvent('opened'));
  }, wait + (reduceMotion ? 0 : 500));
};

(() => {
  const images = Array.from(document.images);
  let count = 0;
  const update = () => {
    count++;
    if (loaderRing) loaderRing.style.setProperty('--progress', (count / images.length).toFixed(3));
    if (count >= images.length) finishLoading();
  };
  if (!images.length) {
    finishLoading();
    return;
  }
  images.forEach((img) => {
    if (img.complete) {
      update();
    } else {
      img.addEventListener('load', update, { once: true });
      img.addEventListener('error', update, { once: true });
    }
  });
  // 読み込みが遅い場合でも待たせすぎない
  setTimeout(finishLoading, LOADER_MAX);
})();

// ------------------------ ページ内リンク
let scroll = new SmoothScroll('a[href*="#"]', {
  speed: 1000, // スクロールする速さ
  speedAsDuration: true,
  easing: 'easeInOutCubic',
  header: '#js-header',
});

// ------------------------ ハンバーガーメニュー
const toggleHeaderNav = (open) => {
  body.classList.toggle('is-navOpen', open);
  html.style.overflow = open ? 'hidden' : '';
  hamburgerButton.setAttribute('aria-expanded', open);
  hamburgerButton.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
};
if (hamburgerButton) {
  hamburgerButton.addEventListener('click', () => {
    toggleHeaderNav(!body.classList.contains('is-navOpen'));
  });
}
// ハンバーガーメニュー内のリンクをクリックすると閉じる
if (headerNav) {
  headerNav.addEventListener('click', (e) => {
    if (e.target.closest('a') && body.classList.contains('is-navOpen')) {
      toggleHeaderNav(false);
    }
  });
}

// ------------------------ 現在地のナビをハイライト
(() => {
  const links = document.querySelectorAll('.l-headerNav__link');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((link) => {
        link.classList.toggle('is-current', link.getAttribute('href') === `#${e.target.id}`);
      });
    });
  }, { rootMargin: '-50% 0px -50% 0px' });
  links.forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) observer.observe(target);
  });
})();

// ------------------------ inview
// .iv が画面内に入ったら .view を付与（一度きり）
const inviewObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('view');
    observer.unobserve(e.target);
    // コームの歯が抜けきったら片付ける
    if (e.target.classList.contains('c-comb')) {
      setTimeout(() => e.target.classList.add('is-combed'), 2000);
    }
  });
}, {
  rootMargin: '0px 0px -10% 0px', // 画面下10%手前で判定
  threshold: 0.15,
});
// MVの演出が終わってから監視を始める（ローディング中に発火させない）
document.addEventListener('opened', () => {
  document.querySelectorAll('.iv').forEach((elem) => inviewObserver.observe(elem));
});

// ------------------------ スクロール連動（ヘッダー / ピント合わせ / 髪の線 / MV）
(() => {
  const zooms = Array.from(document.querySelectorAll('.c-zoom'));
  const strands = Array.from(document.querySelectorAll('.js-strand'));
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;

    // ヘッダー：MVを過ぎたら帯を降ろす
    header.classList.toggle('is-scrolled', y > 80);

    if (!reduceMotion) {
      // MV：スクロール量 0〜1
      if (mv) mv.style.setProperty('--mv', clamp(y / mv.offsetHeight, 0, 1).toFixed(4));

      // ピント合わせ：写真の中心が画面中央に近いほど等倍、離れるほど少し大きく
      zooms.forEach((elem) => {
        const rect = elem.parentElement.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > vh + 100) return;
        const distance = Math.abs(rect.top + rect.height / 2 - vh / 2) / vh;
        elem.style.setProperty('--z', (1 + clamp(distance, 0, 1) * 0.1).toFixed(4));
      });

      // 髪の線：セクションが画面下から入ってきた時に描き始め、半分ほど過ぎたら描き終える
      strands.forEach((elem) => {
        const rect = elem.getBoundingClientRect();
        const t = clamp((vh - rect.top) / (rect.height + vh * 0.5), 0, 1);
        elem.style.setProperty('--draw', t.toFixed(4));
      });
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();

// ------------------------ MVスライダー
// 表示中に .is-active、1つ前に .is-prev。切り替え演出（縦の筋が広がる）はCSS側
class StrandSlider {
  constructor({ root, dots, interval = 6000 }) {
    this.slides = Array.from(root.children);
    this.root = root;
    this.dots = dots ? Array.from(dots.querySelectorAll('button')) : [];
    this.interval = interval;
    this.autoplay = !reduceMotion;
    this.index = 0;
    this.busy = false;
    this.timer = null;
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => {
      if (i !== this.index) this.go(i);
    }));
    this.addSwipe();
  }

  start() {
    if (!this.autoplay) return;
    clearTimeout(this.timer);
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.index);
      dot.classList.remove('is-running');
      dot.style.setProperty('--duration', `${this.interval}ms`);
    });
    const dot = this.dots[this.index];
    if (dot) {
      void dot.offsetWidth; // 時間の線を最初から満たし直す
      dot.classList.add('is-running');
    }
    this.timer = setTimeout(() => this.go(this.index + 1), this.interval);
  }

  go(target) {
    if (this.busy) return;
    this.busy = true;
    const length = this.slides.length;
    const nextIndex = (target + length) % length;
    const prevSlide = this.slides[this.index];
    const nextSlide = this.slides[nextIndex];

    this.slides.forEach((slide) => slide.classList.remove('is-prev', 'is-first'));
    prevSlide.classList.remove('is-active');
    prevSlide.classList.add('is-prev');
    nextSlide.classList.add('is-active');
    this.index = nextIndex;
    this.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === nextIndex));

    setTimeout(() => { this.busy = false; }, 1800);
    this.start();
  }

  addSwipe() {
    let startX = null;
    const area = this.root.closest('.p-mv') || this.root;
    area.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    area.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const diff = e.changedTouches[0].clientX - startX;
      if (Math.abs(diff) > 50) this.go(this.index + (diff < 0 ? 1 : -1));
      startX = null;
    });
  }
}

(() => {
  const mvRoot = document.getElementById('js-mvSlider');
  if (!mvRoot) return;
  const mvSlider = new StrandSlider({
    root: mvRoot,
    dots: document.getElementById('js-mvDots'),
    interval: 7000,
  });
  // 鏡が開き、見出しが出揃ってから自動送りを始める
  document.addEventListener('opened', () => setTimeout(() => mvSlider.start(), 3800));
})();

// ------------------------ スタイルのドラッグスライダー
// 指やマウスで送ると慣性で流れ、送る速さに応じて写真がわずかにたわむ
(() => {
  const viewport = document.getElementById('js-styleViewport');
  const track = document.getElementById('js-styleTrack');
  if (!viewport || !track) return;
  const prev = document.getElementById('js-stylePrev');
  const next = document.getElementById('js-styleNext');
  const bar = document.getElementById('js-styleBar');
  const cards = Array.from(track.children);

  let current = 0; // 実際の位置
  let target = 0; // 向かう位置
  let min = 0; // 左へ送れる限界（負の値）
  let dragging = false;
  let moved = false;
  let startX = 0;
  let startTarget = 0;
  let lastX = 0;
  let velocity = 0;
  let running = false;

  const measure = () => {
    min = Math.min(0, viewport.clientWidth - track.scrollWidth);
    target = clamp(target, min, 0);
    if (bar) bar.style.setProperty('--size', `${clamp((viewport.clientWidth / track.scrollWidth) * 100, 10, 100).toFixed(2)}%`);
    render();
  };
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : viewport.clientWidth * 0.3);

  const render = () => {
    track.style.setProperty('--x', `${current.toFixed(2)}px`);
    // 速度をたわみの角度に（上限 ±5deg）
    const skew = reduceMotion ? 0 : clamp((target - current) * -0.025, -5, 5);
    track.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
    const ratio = min < 0 ? current / min : 0;
    if (bar) {
      const size = parseFloat(bar.style.getPropertyValue('--size')) || 100;
      bar.style.setProperty('--pos', `${(ratio * ((100 - size) / size) * 100).toFixed(2)}%`);
    }
    if (prev) prev.disabled = target >= -1;
    if (next) next.disabled = target <= min + 1;
  };

  const loop = () => {
    current = reduceMotion ? target : lerp(current, target, 0.09);
    render();
    if (dragging || Math.abs(target - current) > 0.2) {
      requestAnimationFrame(loop);
    } else {
      current = target;
      render();
      running = false;
    }
  };
  const kick = () => {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  };

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = lastX = e.clientX;
    startTarget = target;
    velocity = 0;
    viewport.classList.add('is-grabbing');
    kick();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 4) moved = true;
    velocity = e.clientX - lastX;
    lastX = e.clientX;
    // 端を越えた分は、ゴムのように重く
    let next = startTarget + diff;
    if (next > 0) next *= 0.35;
    if (next < min) next = min + (next - min) * 0.35;
    target = next;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('is-grabbing');
    // 離した勢いで少し流れる
    target = clamp(target + velocity * 12, min, 0);
    kick();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  // ドラッグした時はリンクのクリックを無効に
  viewport.addEventListener('click', (e) => {
    if (moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  const moveBy = (dir) => {
    target = clamp(target - step() * dir, min, 0);
    kick();
  };
  if (prev) prev.addEventListener('click', () => moveBy(-1));
  if (next) next.addEventListener('click', () => moveBy(1));

  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  measure();
})();

// ------------------------ ボタン（触れた位置から色が広がる）
document.querySelectorAll('.js-ripple').forEach((button) => {
  const setOrigin = (e) => {
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--hx', `${e.clientX - rect.left}px`);
    button.style.setProperty('--hy', `${e.clientY - rect.top}px`);
  };
  button.addEventListener('mouseenter', setOrigin);
  button.addEventListener('mouseleave', setOrigin);
});

// ------------------------ ページ内のimg要素サイズを取得
const myFunc = function (src) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.src = src;
    image.onload = function () {
      resolve(image);
    };
    image.onerror = function (error) {
      reject(error);
    };
  });
};
const imgs = document.querySelectorAll('img[src]:not([src=""])');
for (const img of imgs) {
  const src = img.getAttribute('src');
  myFunc(src)
    .then(function (res) {
      if (!img.hasAttribute('width')) {
        img.setAttribute('width', res.width);
      }
      if (!img.hasAttribute('height')) {
        img.setAttribute('height', res.height);
      }
    })
    .catch(function (error) {
      console.log(error);
    });
}
