// ============================================
// 樂聚娱乐 - 高级交互系统
// 双向循环滚动动画 / 视差效果 / 霓虹光球 / 渐进揭示
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ========================================
  // PRELOADER - 品牌加载动画
  // ========================================
  const preloader = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloaderBar');
  const preloaderPercent = document.getElementById('preloaderPercent');
  let progress = 0;
  let preloaderDone = false;

  function onPreloaderEnd() {
    preloaderDone = true;
    // 启动滚动动画观察器
    animationObserverStarted = true;
    // 手动触发一次检测，确保当前视口内元素动画启动
    animateElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const delay = parseInt(el.dataset.delay) || 0;
        el.classList.remove('animating-out');
        setTimeout(() => el.classList.add('animated'), delay);
      }
    });
    // section headers 也触发（双向同步状态）
    document.querySelectorAll('.section-header').forEach(header => {
      if (header.getBoundingClientRect().top < window.innerHeight) {
        header.style.opacity = '1';
        header.style.transform = 'translateY(0)';
        header.classList.add('header-visible');
      }
    });
    // 计数器动画触发（hero stats 在视口内）
    if (!countersAnimated) {
      animateCounters();
      countersAnimated = true;
    }
    setTimeout(() => {
      preloader.classList.add('hidden');
      document.body.style.overflow = '';
    }, 400);
  }

  function updatePreloader() {
    if (preloaderDone) return;
    const increment = Math.random() * 8 + 2;
    progress = Math.min(progress + increment, 100);
    if (preloaderBar) preloaderBar.style.width = progress + '%';
    if (preloaderPercent) preloaderPercent.textContent = Math.floor(progress);

    if (progress >= 100) {
      onPreloaderEnd();
    } else {
      setTimeout(updatePreloader, 40 + Math.random() * 80);
    }
  }

  document.body.style.overflow = 'hidden';
  setTimeout(updatePreloader, 600);

  // Fallback: 5秒后强制结束加载
  setTimeout(() => {
    if (!preloaderDone) {
      progress = 100;
      if (preloaderBar) preloaderBar.style.width = '100%';
      if (preloaderPercent) preloaderPercent.textContent = '100';
      onPreloaderEnd();
    }
  }, 5000);

  // Page visibility reset
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && preloaderDone) {
      // Don't reset, just ensure overflow is correct
      document.body.style.overflow = '';
    }
  });

  // ========================================
  // SIDE FLOW LIGHTS - 两侧流水灯系统
  // ========================================
  const sideLeft  = document.getElementById('sideFlowLeft');
  const sideRight = document.getElementById('sideFlowRight');
  const glowLeft  = document.getElementById('sideFlowGlowLeft');
  const glowRight = document.getElementById('sideFlowGlowRight');

  if (sideLeft && sideRight) {
    // 生成流水灯点 — 每边 28 个，延迟递增产生追逐效果
    const dotCount = 28;
    [sideLeft, sideRight].forEach(strip => {
      for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'flow-dot';
        dot.style.setProperty('--dot-delay', (i * 0.1) + 's');
        strip.appendChild(dot);
      }
    });
  }

  // 监听 Hero section 高度，滚动超过后显示流水灯
  let flowLightsVisible = false;
  const hero = document.getElementById('hero');
  const heroHeight = hero ? hero.offsetHeight : window.innerHeight;

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const shouldShow = scrolled > heroHeight * 0.4;

    if (shouldShow && !flowLightsVisible) {
      flowLightsVisible = true;
      if (sideLeft) sideLeft.classList.add('visible');
      if (sideRight) sideRight.classList.add('visible');
      if (glowLeft) glowLeft.classList.add('visible');
      if (glowRight) glowRight.classList.add('visible');
    } else if (!shouldShow && flowLightsVisible) {
      flowLightsVisible = false;
      if (sideLeft) sideLeft.classList.remove('visible');
      if (sideRight) sideRight.classList.remove('visible');
      if (glowLeft) glowLeft.classList.remove('visible');
      if (glowRight) glowRight.classList.remove('visible');
    }
  }, { passive: true });

  // ========================================
  // 霓虹灯边框 - 玻璃灯管闪烁启动 × 呼吸光效
  // ========================================
  const neonFrame = document.getElementById('neonBorderFrame');
  if (neonFrame) {
    const sides = {
      top: document.getElementById('neonBorderTop'),
      right: document.getElementById('neonBorderRight'),
      bottom: document.getElementById('neonBorderBottom'),
      left: document.getElementById('neonBorderLeft')
    };
    const bulbCount = { top: 24, right: 14, bottom: 24, left: 14 };
    let allBulbs = [];

    // 为每个灯泡随机分配暖色/冷色变体
    const bulbPalettes = [
      { core: 'rgba(255,255,255,0.95)', mid: 'rgba(200,155,255,0.7)', outer: 'rgba(160,110,240,0.3)' },
      { core: 'rgba(255,255,255,0.95)', mid: 'rgba(210,170,255,0.7)', outer: 'rgba(170,120,250,0.3)' },
      { core: 'rgba(255,245,255,0.95)', mid: 'rgba(220,140,255,0.65)', outer: 'rgba(180,100,250,0.25)' },
      { core: 'rgba(255,255,255,0.9)', mid: 'rgba(190,180,255,0.7)', outer: 'rgba(140,130,240,0.35)' },
    ];

    Object.keys(sides).forEach(key => {
      const el = sides[key];
      if (!el) return;
      for (let i = 0; i < bulbCount[key]; i++) {
        const bulb = document.createElement('div');
        bulb.className = 'neon-bulb';
        const palette = bulbPalettes[Math.floor(Math.random() * bulbPalettes.length)];
        bulb.dataset.palette = JSON.stringify(palette);
        el.appendChild(bulb);
        allBulbs.push(bulb);
      }
    });

    // 延迟显示边框框架
    setTimeout(() => neonFrame.classList.add('visible'), 600);

    // 全部亮起（lit 提供基础光晕，chase 控制亮度波动）
    allBulbs.forEach(bulb => {
      bulb.classList.add('lit');
    });
    setTimeout(() => {
      neonFrame.classList.add('corners-lit');
      ['neonCornerTL', 'neonCornerTR', 'neonCornerBL', 'neonCornerBR'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      });
    }, 200);

    // ==========================================
    // 循环追逐 — 亮波不断绕边框流动 (GPU优化版)
    // ==========================================
    const trailLen = 16;       // 拖尾长度
    const chaseSpeed = 45;     // 每步间隔 ms
    const len = allBulbs.length;

    // 预计算每个灯泡的trail状态
    function updateAllBulbs() {
      for (let i = 0; i < len; i++) {
        const dist = (i - currentBulb + len) % len;
        if (dist === 0) {
          allBulbs[i].style.filter = 'brightness(1.4)';
          allBulbs[i].style.opacity = '1';
        } else if (dist <= trailLen) {
          const t = dist / trailLen;
          const ease = t * t * (3 - 2 * t);
          allBulbs[i].style.filter = `brightness(${1.4 - ease * 0.9})`;
          allBulbs[i].style.opacity = `${1 - ease * 0.7}`;
        } else {
          allBulbs[i].style.filter = 'brightness(0.35)';
          allBulbs[i].style.opacity = '0.22';
        }
      }
      currentBulb = (currentBulb + 1) % len;
    }

    let currentBulb = 0;
    let lastChaseTime = 0;
    let neonChaseActive = true;
    let neonChaseRafId = null;

    function neonChaseRaf(timestamp) {
      if (!neonChaseActive) { neonChaseRafId = null; return; }
      if (timestamp - lastChaseTime >= chaseSpeed) {
        updateAllBulbs();
        lastChaseTime = timestamp;
      }
      neonChaseRafId = requestAnimationFrame(neonChaseRaf);
    }

    // 用 IntersectionObserver 检测霓虹框是否在视口附近，不可见时暂停追逐
    if (neonFrame) {
      const neonVisibilityObserver = new IntersectionObserver((entries) => {
        neonChaseActive = entries[0].isIntersecting;
        if (neonChaseActive && !neonChaseRafId) {
          lastChaseTime = performance.now();
          neonChaseRafId = requestAnimationFrame(neonChaseRaf);
        }
      }, { rootMargin: '200px' });
      neonVisibilityObserver.observe(neonFrame);
    }

    neonChaseRafId = requestAnimationFrame(neonChaseRaf);

    // 框架显示
    setTimeout(() => neonFrame.classList.add('visible'), 600);
  }

  // ========================================
  // CURSOR FOLLOWER
  // ========================================
  const cursor = document.getElementById('cursorFollower');
  let cursorVisible = false;

  if (window.innerWidth > 768 && cursor) {
    document.addEventListener('mousemove', (e) => {
      if (!cursorVisible) {
        cursor.classList.add('active');
        cursorVisible = true;
      }
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });
    document.addEventListener('mouseleave', () => {
      cursor.classList.remove('active');
      cursorVisible = false;
    });
  }

  // ========================================
  // RIPPLE EFFECT
  // ========================================
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.btn, .brand-card, .nav-link');
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.5;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });

  // ========================================
  // PRESS DEPTH
  // ========================================
  document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('.brand-card, .btn');
    if (!target) return;
    target.classList.remove('depth-rebound');
    target.offsetHeight;
    target.classList.add('press-depth');
  });

  document.addEventListener('mouseup', () => {
    document.querySelectorAll('.press-depth').forEach(el => {
      el.classList.remove('press-depth');
      el.classList.add('depth-rebound');
      setTimeout(() => el.classList.remove('depth-rebound'), 600);
    });
  });

  document.addEventListener('mouseleave', () => {
    document.querySelectorAll('.press-depth').forEach(el => {
      el.classList.remove('press-depth');
      el.classList.add('depth-rebound');
      setTimeout(() => el.classList.remove('depth-rebound'), 600);
    });
  }, true);

  // ========================================
  // PARTICLES
  // ========================================
  const particlesContainer = document.getElementById('particles');
  if (particlesContainer) {
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (4 + Math.random() * 5) + 's';
      particle.style.width = (1 + Math.random() * 3) + 'px';
      particle.style.height = particle.style.width;
      particlesContainer.appendChild(particle);
    }
  }

  // ========================================
  // NAVBAR SCROLL + BACK TO TOP
  // ========================================
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('backToTop');

  function handleScrollBasics() {
    const scrollY = window.scrollY;
    if (navbar) {
      if (scrollY > 50) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    }
    if (backToTop) {
      if (scrollY > 400) backToTop.classList.add('visible');
      else backToTop.classList.remove('visible');
    }
    updateActiveNav(scrollY);
  }

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ========================================
  // ACTIVE NAV LINK
  // ========================================
  function updateActiveNav(scrollY) {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-menu .nav-link');
    let current = '';

    sections.forEach(section => {
      const top = section.offsetTop - 200;
      if (scrollY >= top) current = section.getAttribute('id');
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === '#' + current || (!current && href === '#hero')) {
        link.classList.add('active');
      }
    });
  }

  // ========================================
  // MOBILE NAV TOGGLE
  // ========================================
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const spans = navToggle.querySelectorAll('span');
      if (navMenu.classList.contains('open')) {
        if (spans[0]) spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        if (spans[1]) spans[1].style.opacity = '0';
        if (spans[2]) spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        if (spans[0]) spans[0].style.transform = '';
        if (spans[1]) spans[1].style.opacity = '';
        if (spans[2]) spans[2].style.transform = '';
      }
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        const spans = navToggle.querySelectorAll('span');
        if (spans[0]) spans[0].style.transform = '';
        if (spans[1]) spans[1].style.opacity = '';
        if (spans[2]) spans[2].style.transform = '';
      });
    });
  }

  document.querySelectorAll('.nav-dropdown > .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  // ============================================
  // BIDIRECTIONAL SCROLL ANIMATION SYSTEM
  // 双向循环：入屏动画进入，出屏动画退出，滚动即生即灭
  // 优化：requestAnimationFrame 批量处理 + 防抖阈值
  // ============================================
  const animateElements = document.querySelectorAll('[data-animate]');
  let animationObserverStarted = false;

  // RAF 批量处理队列，避免频繁触发回流
  let pendingAnimations = new Set();
  let animRafId = null;

  function processAnimationQueue() {
    animRafId = null;
    pendingAnimations.forEach(item => {
      const { el, action, delay } = item;
      if (action === 'enter') {
        el.classList.remove('animating-out');
        setTimeout(() => {
          // 二次确认：还在视口内才添加 animated
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('animated');
          }
        }, delay);
      } else if (action === 'leave') {
        el.classList.remove('animated');
        el.classList.add('animating-out');
      }
    });
    pendingAnimations.clear();
  }

  const animationObserver = new IntersectionObserver((entries) => {
    if (!animationObserverStarted) return;
    entries.forEach(entry => {
      const el = entry.target;
      const delay = parseInt(el.dataset.delay) || 0;

      if (entry.isIntersecting) {
        // 进入视口 → 播放入场动画
        if (!el.classList.contains('animated')) {
          pendingAnimations.add({ el, action: 'enter', delay });
        }
      } else {
        // 离开视口 → 播放出场动画（仅当已经 animated 时）
        if (el.classList.contains('animated')) {
          pendingAnimations.add({ el, action: 'leave' });
        }
      }
    });
    // RAF 合并同一帧内的所有更新
    if (!animRafId && pendingAnimations.size > 0) {
      animRafId = requestAnimationFrame(processAnimationQueue);
    }
  }, {
    threshold: 0.12,
    rootMargin: '-20px 0px -20px 0px'
  });

  animateElements.forEach(el => animationObserver.observe(el));

  // ============================================
  // BRAND CARDS - 纯CSS hover效果，无滚动动画
  // ============================================

  // ============================================
  // PARALLAX NEON ORBS - 霓虹光球视差
  // 使用 margin/position 偏移，避免与 CSS animation transform 冲突
  // ============================================
  const heroOrbs = document.querySelectorAll('.hero-neon-orb');

  function updateNeonOrbs() {
    const scrollY = window.scrollY;

    // Hero orbs - margin-based scroll parallax (不碰 transform)
    heroOrbs.forEach((orb, index) => {
      const speed = (index + 1) * 0.5;
      const yOffset = scrollY * speed * 0.25;
      orb.style.marginTop = yOffset + 'px';
    });
  }

  // ============================================
  // SECTION REVEAL STAGGER - 板块标题渐进（双向）
  // ============================================
  const sectionHeaders = document.querySelectorAll('.section-header');

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        entry.target.classList.add('header-visible');
      } else {
        // 离开视口时优雅隐藏，重置状态为下次进入做准备
        if (entry.target.classList.contains('header-visible')) {
          entry.target.style.opacity = '0';
          entry.target.style.transform = 'translateY(20px)';
          entry.target.classList.remove('header-visible');
        }
      }
    });
  }, { threshold: 0.05, rootMargin: '-20px 0px -20px 0px' });

  sectionHeaders.forEach(header => {
    header.style.opacity = '0';
    header.style.transform = 'translateY(30px)';
    header.style.transition = 'opacity 0.7s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)';
    sectionObserver.observe(header);
  });

  // ============================================
  // COUNTER ANIMATION (bidirectional)
  // ============================================
  let countersAnimated = false;

  function animateCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    counters.forEach(counter => {
      const target = parseInt(counter.dataset.count);
      const duration = 2000;
      const startTime = performance.now();

      function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(updateCounter);
        else counter.textContent = target;
      }
      requestAnimationFrame(updateCounter);
    });
  }

  function resetCounters() {
    document.querySelectorAll('.stat-number[data-count]').forEach(c => {
      c.textContent = '0';
    });
    countersAnimated = false;
  }

  const statsSection = document.querySelector('.hero-stats');
  if (statsSection) {
    const statsObserver = new IntersectionObserver((entries) => {
      if (!animationObserverStarted) return;
      if (entries[0].isIntersecting && !countersAnimated) {
        animateCounters();
        countersAnimated = true;
      }
    }, { threshold: 0.3 });
    statsObserver.observe(statsSection);
  }




  // ============================================
  // SMOOTH SCROLL
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80;
        const pos = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: pos, behavior: 'smooth' });
      }
    });
  });

  // ============================================
  // MAIN SCROLL LOOP - RAF throttle
  // ============================================
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScrollBasics();
        // 移除视差球体滚动更新以减少主线程负担
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // Initial call
  handleScrollBasics();
  updateNeonOrbs();

  // ============================================
  // MOUSE PARALLAX ON HERO ORBS (desktop only)
  // 使用 left/top 百分比偏移，不与 CSS animation transform 冲突
  // ============================================
  if (window.innerWidth > 768) {
    document.addEventListener('mousemove', (e) => {
      const mouseX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 ~ 1
      const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

      heroOrbs.forEach((orb, index) => {
        const factor = (index + 1) * 6;
        const tx = mouseX * factor;
        const ty = mouseY * factor;
        orb.style.marginLeft = tx + 'px';
        orb.style.marginTop = (parseFloat(orb.style.marginTop) || 0) + ty * 0.3 + 'px';
      });
    });
  }

  // ============================================
  // RESIZE HANDLER
  // ============================================
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateNeonOrbs();
    }, 150);
  });

  // ============================================
  // STORE CARDS & DETAIL MODAL
  // ============================================
  const IMG_BASE = 'https://leju.nclaimo.com/images/product';
  const IMG_LOCAL = 'images/';
  // 本地图片映射：门店ID → 本地文件名
  const LOCAL_IMG_MAP = {
    37: 'store-37-leju-mengshidai.jpg',
    38: 'store-38-leju-jingkai.jpg',
    39: 'store-39-leju-hangtian.jpg',
    41: 'store-41-leju-honggutan.jpg',
    42: 'store-42-leju-bubugao.jpg',
    49: 'store-42-leju-bubugao.jpg',
    43: 'store-43-leju-yiwu-wanbo.jpg',
    45: 'store-45-leju-liuyanjing.jpg',
    46: 'store-46-haolechao-zijing.jpg',
    47: 'store-47-haolechao-huihai.jpg',
    48: 'store-48-leju-yiwu-wanda.jpg',
  };
  function storeImgUrl(store) {
    if (LOCAL_IMG_MAP[store.id]) return IMG_LOCAL + LOCAL_IMG_MAP[store.id];
    return IMG_BASE + '/' + store.img;
  }
  // 图片加载失败时的品牌色渐变回退
  function imgFallbackGradient(store) {
    return store.brand === 'leju'
      ? 'linear-gradient(135deg, #1a0e38 0%, #2d1b69 50%, #1a0e38 100%)'
      : 'linear-gradient(135deg, #2d1a0e 0%, #5c3d1e 50%, #2d1a0e 100%)';
  }
  // 数据来源：leju.nclaimo.com 旗下品牌页面核对
  const STORE_DATA = [
    // ======== 樂聚KTV 门店 ========
    { id:37, name:'南昌-梦时代店',     city:'南昌', brand:'leju',  img:'37_1774491710020794_thumb.jpg', tag:'热门门店',  location:'南昌市 · 梦时代广场',    phone:'400-999-8305', desc:'位于南昌核心商圈梦时代广场，交通便利，配套齐全。门店采用最新一代智能点歌系统，配备专业级音响设备，是年轻人聚会首选。', features:['核心商圈','智能点歌','专业音响'] },
    { id:38, name:'南昌-经开下罗店',   city:'南昌', brand:'leju',  img:'38_1774492475669828_thumb.jpg', tag:'新店开业',  location:'南昌市 · 经开区下罗',    phone:'400-999-8305', desc:'坐落于南昌经开区核心地段，覆盖周边高校及社区客群。空间设计融合潮流元素，为年轻消费者打造沉浸式音乐社交体验。', features:['高校商圈','潮流设计','社交空间'] },
    { id:39, name:'南昌-航天科创店',   city:'南昌', brand:'leju',  img:'39_1774492547797834_thumb.jpg', tag:'科技主题',  location:'南昌市 · 航天科创广场',  phone:'400-999-8305', desc:'以科技未来风为主题设计，包厢内配备三连巨屏×三叠屏黑科技设备，是樂聚KTV科技创新的集中展示门店。', features:['三连巨屏','科技主题','三叠屏'] },
    { id:40, name:'南昌-八一广场店',   city:'南昌', brand:'leju',  img:'40_1774492601188117_thumb.jpg', tag:'旗舰门店',  location:'南昌市 · 八一广场',      phone:'400-999-8305', desc:'位于南昌地标八一广场商圈，是樂聚KTV城市旗舰店。面积最大、包厢类型最全，覆盖家庭聚会、商务宴请、年轻人社交等全场景。', features:['旗舰店','全场景','商务宴请'] },
    { id:41, name:'南昌-红谷滩和昌里店',city:'南昌',brand:'leju',  img:'41_1774507524025693_thumb.jpg', tag:'CBD商圈',   location:'南昌市 · 红谷滩和昌里',  phone:'400-999-8305', desc:'位于南昌CBD红谷滩核心区，周边商务人群密集。门店设计融合商务与休闲风格，满足白领精英的高品质聚会需求。', features:['CBD商圈','商务休闲','品质服务'] },
    { id:42, name:'赣州-步步高店',     city:'赣州', brand:'leju',  img:'42_1774507537761390_thumb.jpg', tag:'赣州首店',  location:'赣州市 · 步步高商圈',    phone:'400-999-8305', desc:'樂聚KTV赣州首店，秉承"聚会从这里开始"品牌理念，以智能化点歌系统+高性价比优势，为赣州市民带来全新KTV体验。', features:['赣州首店','智能点歌','高性价比'] },
    { id:49, name:'赣州-巨亿万达店',   city:'赣州', brand:'leju',  img:'42_1774507537761390_thumb.jpg', tag:'赣州新店',  location:'赣州市 · 巨亿万达广场',  phone:'400-999-8305', desc:'樂聚KTV赣州第二店，入驻巨亿万达广场核心商圈。延续品牌"智能×平价"优势，配备最新智能点歌系统，为赣州南部消费者提供高品质聚会体验。', features:['万达商圈','智能点歌','品质聚会'] },
    { id:43, name:'义乌-万博悦街店',   city:'义乌', brand:'leju',  img:'43_1774507554531962_thumb.jpg', tag:'华东拓展',  location:'义乌市 · 万博悦街',      phone:'400-999-8305', desc:'樂聚KTV华东拓展重要节点门店，坐落于义乌万博悦街商圈，将智能化KTV体验带给义乌消费者。', features:['华东市场','核心商圈','智能体验'] },
    { id:44, name:'南昌-南大店',       city:'南昌', brand:'leju',  img:'44_1774507567787077_thumb.jpg', tag:'高校商圈',  location:'南昌市 · 南昌大学商圈',  phone:'400-999-8305', desc:'紧邻南昌大学，精准服务大学生客群。价格亲民、活动丰富，是大学生聚会交友的热门打卡地。', features:['大学生客群','价格亲民','活动丰富'] },
    { id:45, name:'南昌-六眼井店',     city:'南昌', brand:'leju',  img:'45_1774507584714088_thumb.jpg', tag:'老城新店',  location:'南昌市 · 六眼井',        phone:'400-999-8305', desc:'樂聚KTV南昌老城区新店，延续品牌"智能×平价"核心优势，为老城区居民提供高品质聚会选择。', features:['品质聚会','智能体验','老城区'] },
    { id:48, name:'义乌-万达广场店',   city:'义乌', brand:'leju',  img:'48_1774507619183253_thumb.jpg', tag:'万达商圈',  location:'义乌市 · 万达广场',      phone:'400-999-8305', desc:'樂聚KTV义乌第二店，入驻万达广场核心商圈，依托万达商业生态为消费者提供一站式娱乐体验。', features:['万达商圈','商业生态','一站式娱乐'] },
    // ======== 豪樂巢KTV 门店 ========
    { id:46, name:'南昌-紫荆夜市店',   city:'南昌', brand:'haolechao',img:'46_1774507595615887_thumb.jpg',tag:'夜经济',   location:'南昌市 · 紫荆夜市',      phone:'400-999-8305', desc:'豪樂巢KTV毗邻南昌著名夜市商圈，为夜生活爱好者提供一站式吃喝玩乐聚会方案，是夜猫子的欢聚圣地。', features:['夜市商圈','夜生活','一站式'] },
    { id:47, name:'南昌-汇海国际店',   city:'南昌', brand:'haolechao',img:'47_1774507606782691_thumb.jpg',tag:'商务区',   location:'南昌市 · 汇海国际',      phone:'400-999-8305', desc:'豪樂巢KTV位于南昌汇海国际商务区，辐射企业白领客群，兼顾商务接待与团队建设活动。', features:['商务接待','团队建设','白领客群'] },
  ];

  function renderStoreCards() {
    const grid = document.getElementById('brandStoresGrid');
    if (!grid) return;
    grid.innerHTML = STORE_DATA.map((store, idx) => {
      const imgUrl = storeImgUrl(store);
      const badgeText = store.brand === 'leju' ? '樂聚KTV' : '豪樂巢KTV';
      const town = store.name.replace(/^[\u4e00-\u9fa5]+-/, ''); // 去掉城市前缀
      return `
      <div class="store-card" data-store-id="${store.id}" onclick="openStoreDetail(${store.id})">
        <div class="store-card-image">
          <img src="${imgUrl}" alt="${store.name}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('store-card-image-fallback');this.parentElement.innerHTML+='<span class=\\'store-card-fallback-label\\'>${town}</span>';" />
          <div class="store-card-image-overlay"></div>
        </div>
        <span class="store-card-badge ${store.brand}">${badgeText}</span>
        <div class="store-card-body">
          <div class="store-card-name">${store.name}</div>
          <div class="store-card-city">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:3px;flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${store.location}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  window.openStoreDetail = function(storeId) {
    const store = STORE_DATA.find(s => s.id === storeId);
    if (!store) return;

    const modalImg = document.getElementById('storeModalImage');
    if (!modalImg) return;
    modalImg.innerHTML = `<img src="${storeImgUrl(store)}" alt="${store.name}" onerror="this.style.opacity='0';this.parentElement.style.background='${imgFallbackGradient(store)}';this.parentElement.classList.add('store-modal-image-fallback');" />`;
    modalImg.style.background = imgFallbackGradient(store);
    const modalBadge = document.getElementById('storeModalBadge');
    const modalName = document.getElementById('storeModalName');
    const modalLoc = document.getElementById('storeModalLocation');
    const modalDesc = document.getElementById('storeModalDesc');
    const modalInfo = document.getElementById('storeModalInfoGrid');
    const modalFeatures = document.getElementById('storeModalFeatures');
    const overlay = document.getElementById('storeModalOverlay');

    if (modalBadge) {
      modalBadge.textContent = store.tag;
      modalBadge.className = `store-modal-badge ${store.brand === 'leju' ? 'modal-badge-leju' : 'modal-badge-haolechao'}`;
    }
    if (modalName) modalName.textContent = store.name;
    if (modalLoc) modalLoc.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${store.location}`;
    const modalActions = document.getElementById('storeModalActions');
    if (modalActions) {
      const mapQuery = encodeURIComponent(store.location);
      modalActions.innerHTML = `
        <a href="tel:${store.phone}" class="store-modal-action-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          ${store.phone}
        </a>
        <a href="https://uri.amap.com/search?keyword=${mapQuery}" target="_blank" class="store-modal-action-btn store-modal-action-navi">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          一键导航
        </a>
      `;
    }
    if (modalDesc) modalDesc.textContent = store.desc;
    if (modalInfo) modalInfo.innerHTML = `
      <div class="store-modal-info-item">
        <div class="store-modal-info-label">所属品牌</div>
        <div class="store-modal-info-value">${store.brand === 'leju' ? '樂聚KTV' : '豪樂巢KTV'}</div>
      </div>
      <div class="store-modal-info-item">
        <div class="store-modal-info-label">所在城市</div>
        <div class="store-modal-info-value">${store.city}</div>
      </div>
    `;
    if (modalFeatures) modalFeatures.innerHTML = store.features.map(f =>
      `<span class="store-modal-feature-tag">${f}</span>`
    ).join('');

    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeStoreDetail = function() {
    const overlay = document.getElementById('storeModalOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Modal close handlers (with null guards)
  const storeModalCloseBtn = document.getElementById('storeModalClose');
  const storeModalOverlayEl = document.getElementById('storeModalOverlay');
  if (storeModalCloseBtn) {
    storeModalCloseBtn.addEventListener('click', () => window.closeStoreDetail());
  }
  if (storeModalOverlayEl) {
    storeModalOverlayEl.addEventListener('click', (e) => {
      if (e.target === storeModalOverlayEl) window.closeStoreDetail();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('storeModalOverlay')?.classList.contains('active')) {
      window.closeStoreDetail();
    }
  });

  // ============================================
  // JOIN FORM HANDLER
  // ============================================
  window.handleJoinSubmit = function(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('.join-form-submit');
    const originalText = btn.innerHTML;
    btn.innerHTML = '提交中...';
    btn.disabled = true;
    
    // 发送到邮箱：https://formsubmit.co/17779127516@163.com
    const formData = new FormData(form);
    fetch('https://formsubmit.co/17779127516@163.com', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (response.ok) {
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> 提交成功，顾问将尽快联系您';
        btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        btn.style.borderColor = '#10b981';
        form.reset();
      } else {
        throw new Error('发送失败');
      }
    })
    .catch(() => {
      btn.innerHTML = '提交失败，请重试';
      btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      btn.style.borderColor = '#ef4444';
    })
    .finally(() => {
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.disabled = false;
      }, 3000);
    });
  };

  // View all stores button
  const viewAllBtn = document.getElementById('viewAllStores');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Scroll to all stores, expand to show all
      const firstCard = document.querySelector('.store-card');
      if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      document.querySelectorAll('.store-card').forEach((card, i) => {
        setTimeout(() => {
          card.style.borderColor = 'rgba(168,85,247,0.5)';
          card.style.boxShadow = '0 0 30px rgba(168,85,247,0.2)';
          setTimeout(() => {
            card.style.borderColor = '';
            card.style.boxShadow = '';
          }, 600);
        }, i * 80);
      });
    });
  }

  // 门店卡片已在 HTML 中以 base64 图片硬编码，不再动态渲染



});
