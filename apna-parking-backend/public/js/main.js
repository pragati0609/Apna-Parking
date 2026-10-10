/**
 * APNA PARKING - MAIN APPLICATION CONTROLLER
 * UI Interaction, Mobile Drawer, FAQs, Modals & Toast Alerts
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Header Scroll Effect
  const header = document.querySelector('.ap-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  // 2. Mobile Drawer Navigation Toggle
  const hamburgerBtn = document.getElementById('hamburger-toggle-btn');
  const drawerBackdrop = document.getElementById('app-drawer-backdrop');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');

  function openDrawer() {
    drawerBackdrop?.classList.add('is-open');
    hamburgerBtn?.classList.add('is-active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawerBackdrop?.classList.remove('is-open');
    hamburgerBtn?.classList.remove('is-active');
    document.body.style.overflow = '';
  }

  hamburgerBtn?.addEventListener('click', () => {
    if (drawerBackdrop?.classList.contains('is-open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  drawerCloseBtn?.addEventListener('click', closeDrawer);
  drawerBackdrop?.addEventListener('click', (e) => {
    if (e.target === drawerBackdrop) closeDrawer();
  });

  // Close drawer when any internal navigation link is tapped
  document.querySelectorAll('.drawer-nav-item a').forEach((link) => {
    link.addEventListener('click', closeDrawer);
  });

  // 3. FAQs Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-question-btn');
    btn?.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach((i) => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // 4. Toast Notification System
  window.showToast = function (message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  };

  // 5. Auth Modal & Session Management
  const authModal = document.getElementById('auth-modal');
  const authCloseBtn = document.getElementById('auth-modal-close');
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnSignup = document.getElementById('tab-btn-signup');
  const loginForm = document.getElementById('auth-login-form');
  const signupForm = document.getElementById('auth-signup-form');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const authModalTitle = document.getElementById('auth-modal-title');
  const authModalSubtitle = document.getElementById('auth-modal-subtitle');

  function openAuthModal(mode = 'login') {
    if (!authModal) return;
    if (authErrorMsg) {
      authErrorMsg.style.display = 'none';
      authErrorMsg.innerText = '';
    }
    switchAuthTab(mode);
    authModal.classList.add('is-active');
  }

  function closeAuthModal() {
    authModal?.classList.remove('is-active');
    if (authErrorMsg) authErrorMsg.style.display = 'none';
  }

  function switchAuthTab(mode) {
    if (mode === 'signup') {
      tabBtnSignup?.classList.add('active');
      tabBtnLogin?.classList.remove('active');
      if (tabBtnSignup) {
        tabBtnSignup.style.color = '#E11D74';
        tabBtnSignup.style.borderBottom = '2px solid #E11D74';
      }
      if (tabBtnLogin) {
        tabBtnLogin.style.color = '#64748B';
        tabBtnLogin.style.borderBottom = '2px solid transparent';
      }
      if (loginForm) loginForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
      if (authModalTitle) authModalTitle.innerText = 'Create Driver Account';
      if (authModalSubtitle) authModalSubtitle.innerText = 'Join Apna Parking for instant passes & guaranteed spots';
    } else {
      tabBtnLogin?.classList.add('active');
      tabBtnSignup?.classList.remove('active');
      if (tabBtnLogin) {
        tabBtnLogin.style.color = '#E11D74';
        tabBtnLogin.style.borderBottom = '2px solid #E11D74';
      }
      if (tabBtnSignup) {
        tabBtnSignup.style.color = '#64748B';
        tabBtnSignup.style.borderBottom = '2px solid transparent';
      }
      if (loginForm) loginForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
      if (authModalTitle) authModalTitle.innerText = 'Sign In to Your Account';
      if (authModalSubtitle) authModalSubtitle.innerText = 'Reserve guaranteed spots, manage passes & FASTag';
    }
    if (authErrorMsg) authErrorMsg.style.display = 'none';
  }

  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;

  document.addEventListener('click', (e) => {
    const target = e.target.closest('.btn-open-auth');
    if (target) {
      e.preventDefault();
      openAuthModal('login');
      closeDrawer();
    }
  });

  tabBtnLogin?.addEventListener('click', () => switchAuthTab('login'));
  tabBtnSignup?.addEventListener('click', () => switchAuthTab('signup'));
  authCloseBtn?.addEventListener('click', closeAuthModal);
  authModal?.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
  });

  // Login Form Submission
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const btn = document.getElementById('btn-submit-login');

    if (!email || !password) return;
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Signing In...';
    }
    if (authErrorMsg) authErrorMsg.style.display = 'none';

    const res = await window.ApnaAPI.login({ email, password });
    if (res && res.access_token) {
      closeAuthModal();
      const userName = (res.user && (res.user.name || res.user.full_name)) || 'Driver';
      window.showToast(`Welcome back, ${userName}!`, 'success');
      updateAuthUI();
      if (window.onAuthSuccessCallback) {
        const cb = window.onAuthSuccessCallback;
        window.onAuthSuccessCallback = null;
        cb(res.user);
      }
    } else {
      if (authErrorMsg) {
        authErrorMsg.innerText = (res && (res.error || res.message)) || 'Invalid email or password.';
        authErrorMsg.style.display = 'block';
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Sign In ➔';
    }
  });

  // Sign Up Form Submission
  signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name')?.value.trim();
    const email = document.getElementById('signup-email')?.value.trim();
    const phone = document.getElementById('signup-phone')?.value.trim();
    const password = document.getElementById('signup-password')?.value;
    const btn = document.getElementById('btn-submit-signup');

    if (!name || !email || !password) return;
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Creating Account...';
    }
    if (authErrorMsg) authErrorMsg.style.display = 'none';

    const res = await window.ApnaAPI.signup({
      full_name: name,
      email: email,
      phone_number: phone,
      password: password
    });

    if (res && (res.user || res.message === 'User created successfully')) {
      const loginRes = await window.ApnaAPI.login({ email, password });
      closeAuthModal();
      window.showToast('Account created successfully! Welcome to Apna Parking.', 'success');
      updateAuthUI();
      if (window.onAuthSuccessCallback) {
        const cb = window.onAuthSuccessCallback;
        window.onAuthSuccessCallback = null;
        cb(loginRes.user || res.user);
      }
    } else {
      if (authErrorMsg) {
        authErrorMsg.innerText = (res && (res.error || res.message)) || 'Signup failed. Please try again.';
        authErrorMsg.style.display = 'block';
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Create Account ➔';
    }
  });

  // Dynamic Auth State Update in Navigation Header & Mobile Drawer
  function updateAuthUI() {
    const isAuthed = window.ApnaAPI.isAuthenticated();
    const user = window.ApnaAPI.getUser();
    const authContainers = document.querySelectorAll('.nav-auth-container, #nav-auth-container');

    authContainers.forEach((container) => {
      if (isAuthed && user) {
        const fullName = user.name || user.full_name || 'Driver';
        const firstName = fullName.split(' ')[0];
        container.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <a href="/my-bookings.html" class="user-profile-badge" style="display: flex; align-items: center; gap: 6px; text-decoration: none; padding: 6px 14px; background: rgba(225, 29, 116, 0.08); border: 1.5px solid rgba(225, 29, 116, 0.25); border-radius: 999px; color: #18091E; font-size: 0.86rem; font-weight: 700; transition: all 0.2s ease;">
              <span>👤</span> <span>${firstName}</span>
            </a>
            <button type="button" class="btn-app-logout" style="background: none; border: 1px solid #CBD5E1; color: #64748B; padding: 6px 10px; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s ease;" title="Log out of account">
              Logout
            </button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <button type="button" class="btn-header-auth btn-open-auth">
            🔑 Sign In
          </button>
        `;
      }
    });

    const drawerFooter = document.querySelector('.drawer-footer');
    if (drawerFooter) {
      if (isAuthed && user) {
        const fullName = user.name || user.full_name || 'Driver';
        drawerFooter.innerHTML = `
          <div style="margin-bottom: 10px; font-size: 0.9rem; font-weight: 700; color: #18091E;">
            Logged in as 👤 ${fullName}
          </div>
          <button type="button" class="btn-app-logout btn-secondary" style="width: 100%;">
            🚪 Sign Out
          </button>
        `;
      } else {
        drawerFooter.innerHTML = `
          <button type="button" class="btn-primary btn-open-auth" style="width: 100%;">
            🔑 Driver Login / Register
          </button>
        `;
      }
    }

    document.querySelectorAll('.btn-app-logout').forEach((btn) => {
      btn.onclick = async () => {
        await window.ApnaAPI.logout();
        window.showToast('Logged out successfully.', 'info');
        updateAuthUI();
        if (window.location.pathname.includes('my-bookings')) {
          window.location.reload();
        }
      };
    });
  }

  window.updateAuthUI = updateAuthUI;
  updateAuthUI();

  window.addEventListener('apna:auth_change', updateAuthUI);
  window.addEventListener('apna:unauthorized', () => {
    window.showToast('Session expired. Please sign in again.', 'warning');
    openAuthModal('login');
  });

  // Ticket Pass Modal Close
  const ticketModal = document.getElementById('ticket-pass-modal');
  const ticketCloseBtn = document.getElementById('ticket-modal-close');
  ticketCloseBtn?.addEventListener('click', () => {
    ticketModal?.classList.remove('is-active');
  });

  // 6. Home Hero Search Bar Handler
  const heroSearchForm = document.getElementById('hero-search-form');
  heroSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('hero-search-input')?.value.trim();
    if (query) {
      window.location.href = `/find-parking.html?search=${encodeURIComponent(query)}`;
    } else {
      window.location.href = '/find-parking.html';
    }
  });

  // Hero Quick GPS Detect Button
  const heroGpsBtn = document.getElementById('btn-hero-gps');
  heroGpsBtn?.addEventListener('click', () => {
    if (window.activeMapController) {
      window.activeMapController.detectUserLocation((coords) => {
        window.showToast('📍 Recalculating nearest slots to your location...', 'success');
      });
    } else {
      window.location.href = '/find-parking.html?detectLocation=true';
    }
  });

  // 7. Vehicle Filter Chips on Home Page
  document.querySelectorAll('.home-veh-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.home-veh-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const veh = chip.dataset.type;
      if (window.activeMapController) {
        window.activeMapController.setVehicleFilter(veh);
      }
    });
  });

  // 8. Partner "Talk to us" Form Handler
  const partnerForm = document.getElementById('partner-contact-form');
  partnerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = partnerForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting Request...';
    }

    const payload = {
      name: document.getElementById('partner-name')?.value,
      email: document.getElementById('partner-email')?.value,
      phone: document.getElementById('partner-phone')?.value,
      inquiryType: document.getElementById('partner-type')?.value,
      spaceAddress: document.getElementById('partner-address')?.value,
      totalSpotsAvailable: document.getElementById('partner-spots')?.value,
      message: document.getElementById('partner-message')?.value
    };

    const res = await window.ApnaAPI.submitPartnerInquiry(payload);
    if (res && res.success) {
      window.showToast(res.message, 'success');
      partnerForm.reset();
    } else {
      window.showToast(res.message || 'Submission failed', 'error');
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Send Message ➔';
    }
  });

  // 9. Fullscreen Hero Scroll Transition
  // Keeps "How It Works" off-screen at start, then smoothly brings it up upon scroll down, unlocking standard scrolling thereafter.
  const heroSection = document.querySelector('.hero-section');
  const howItWorksSection = document.getElementById('how-it-works');
  const heroScrollCue = document.getElementById('hero-scroll-cue');

  if (heroSection && howItWorksSection) {
    let isTransitioning = false;
    let touchStartY = 0;

    const scrollToSection = (targetElement, callback) => {
      if (isTransitioning) return;
      isTransitioning = true;
      targetElement.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        isTransitioning = false;
        if (callback) callback();
      }, 750);
    };

    const scrollToTop = () => {
      if (isTransitioning) return;
      isTransitioning = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        isTransitioning = false;
      }, 750);
    };

    // Scroll Cue Click
    heroScrollCue?.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(howItWorksSection);
    });

    // Wheel Scroll Snapping from Hero
    window.addEventListener('wheel', (e) => {
      const scrollY = window.scrollY || window.pageYOffset;
      const howItWorksOffset = howItWorksSection.offsetTop - 90;

      // When at Hero section and scrolling down
      if (scrollY < 50 && e.deltaY > 10) {
        e.preventDefault();
        scrollToSection(howItWorksSection);
      }
      // When at the top of How It Works and scrolling back up to Hero
      else if (scrollY >= 50 && scrollY <= howItWorksOffset + 40 && e.deltaY < -20) {
        e.preventDefault();
        scrollToTop();
      }
    }, { passive: false });

    // Touch Event Handling for Mobile devices
    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const touchY = e.touches[0].clientY;
      const diffY = touchStartY - touchY; // positive = swipe up (scrolling down)
      const scrollY = window.scrollY || window.pageYOffset;
      const howItWorksOffset = howItWorksSection.offsetTop - 90;

      if (scrollY < 50 && diffY > 30) {
        if (e.cancelable) e.preventDefault();
        scrollToSection(howItWorksSection);
      } else if (scrollY >= 50 && scrollY <= howItWorksOffset + 40 && diffY < -30) {
        if (e.cancelable) e.preventDefault();
        scrollToTop();
      }
    }, { passive: false });

    // Keyboard Navigation (Down Arrow, PageDown, Space)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY < 50 && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ')) {
        e.preventDefault();
        scrollToSection(howItWorksSection);
      }
    });

    // Direct section anchor query & hash support (e.g. #live-map, #why-us, #how-it-works, #pricing)
    const checkTargetScroll = () => {
      const hash = window.location.hash;
      if (hash) {
        const target = document.querySelector(hash);
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth' });
            if (hash === '#live-map' && window.activeMapController?.map) {
              setTimeout(() => window.activeMapController.map.invalidateSize(), 400);
            }
          }, 100);
        }
      }
    };

    checkTargetScroll();
    window.addEventListener('hashchange', checkTargetScroll);

    // Smooth scroll for in-page anchor links in header
    document.querySelectorAll('.nav-link[href^="#"], .drawer-nav-item a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            history.pushState(null, '', href);
            target.scrollIntoView({ behavior: 'smooth' });
            if (href === '#live-map' && window.activeMapController?.map) {
              setTimeout(() => window.activeMapController.map.invalidateSize(), 400);
            }
          }
        }
      });
    });

    if (window.location.search.includes('view=why-us')) {
      const whyUs = document.getElementById('why-us');
      if (whyUs) {
        setTimeout(() => {
          whyUs.scrollIntoView({ behavior: 'instant' });
        }, 150);
      }
    } else if (window.location.search.includes('view=how-it-works')) {
      const how = document.getElementById('how-it-works');
      if (how) {
        setTimeout(() => {
          how.scrollIntoView({ behavior: 'instant' });
        }, 150);
      }
    }
  }

  // 12. How It Works - Kinetic Wave Glide Animation
  initHowItWorksWaveGlide();
});

function initHowItWorksWaveGlide() {
  const howSection = document.getElementById('how-it-works');
  if (!howSection) return;

  const path = document.getElementById('howWaveCrestPath');
  const stage = howSection.querySelector('.flowchart-fullwidth-stage');
  if (!path || !stage) return;

  // Pre-sample the wave crest path for high-precision Y lookup along the sinusoidal curve
  const totalLen = path.getTotalLength();
  const wavePoints = [];
  const sampleSteps = 800;
  for (let i = 0; i <= sampleSteps; i++) {
    const pt = path.getPointAtLength((i / sampleSteps) * totalLen);
    wavePoints.push({ x: pt.x, y: pt.y });
  }

  function getWaveY(x) {
    if (x <= wavePoints[0].x) return wavePoints[0].y;
    if (x >= wavePoints[wavePoints.length - 1].x) return wavePoints[wavePoints.length - 1].y;
    for (let i = 0; i < wavePoints.length - 1; i++) {
      if (x >= wavePoints[i].x && x <= wavePoints[i + 1].x) {
        const ratio = (x - wavePoints[i].x) / (wavePoints[i + 1].x - wavePoints[i].x);
        return wavePoints[i].y + ratio * (wavePoints[i + 1].y - wavePoints[i].y);
      }
    }
    return 75;
  }

  const items = [
    {
      id: 1,
      end: 240,
      endY: 45,
      stem: document.getElementById('flowStem1'),
      dot: document.getElementById('flowDot1'),
      ripple: document.getElementById('flowRipple1'),
      nodeGroup: document.getElementById('flowNodeGroup1'),
      pill: document.getElementById('flowPill1'),
      card: document.getElementById('flowCard1'),
      baseStemOpacity: 0.85
    },
    {
      id: 2,
      end: 600,
      endY: 110,
      stem: document.getElementById('flowStem2'),
      dot: document.getElementById('flowDot2'),
      ripple: document.getElementById('flowRipple2'),
      nodeGroup: document.getElementById('flowNodeGroup2'),
      pill: document.getElementById('flowPill2'),
      card: document.getElementById('flowCard2'),
      baseStemOpacity: 0.85
    },
    {
      id: 3,
      end: 960,
      endY: 45,
      stem: document.getElementById('flowStem3'),
      dot: document.getElementById('flowDot3'),
      ripple: document.getElementById('flowRipple3'),
      nodeGroup: document.getElementById('flowNodeGroup3'),
      pill: document.getElementById('flowPill3'),
      card: document.getElementById('flowCard3'),
      baseStemOpacity: 0.90
    }
  ];

  // Verify all elements exist
  if (!items.every(it => it.stem && it.dot && it.pill && it.card)) return;

  let isAnimating = false;
  let animFrameId = null;

  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function resetElements() {
    items.forEach(it => {
      it.card.style.transform = '';
      it.card.style.opacity = '';
      it.pill.style.left = '';
      it.pill.style.top = '';
      it.pill.style.opacity = '';
      it.stem.setAttribute('x1', it.end);
      it.stem.setAttribute('y1', it.endY);
      it.stem.setAttribute('x2', it.end);
      it.stem.setAttribute('y2', 190);
      it.stem.setAttribute('opacity', it.baseStemOpacity);
      it.dot.setAttribute('cx', it.end);
      it.dot.setAttribute('cy', it.endY);
      if (it.ripple) {
        it.ripple.setAttribute('cx', it.end);
        it.ripple.setAttribute('cy', it.endY);
      }
      if (it.nodeGroup) {
        it.nodeGroup.removeAttribute('opacity');
      }
    });
  }

  function runGlideAnimation() {
    if (window.innerWidth <= 900) return; // Desktop/tablet wide animation
    if (isAnimating) cancelAnimationFrame(animFrameId);
    isAnimating = true;

    const stageWidth = stage.offsetWidth || window.innerWidth;
    const duration = 1500; // ms for a fluid, premium motion
    const startTime = performance.now();

    // Staggered timing: Step 1 initiates immediately, Step 2 follows, Step 3 follows
    const delays = [0, 0.12, 0.24];

    function frame(now) {
      const elapsed = now - startTime;
      const rawProgress = Math.min(elapsed / duration, 1);

      items.forEach((item, idx) => {
        const delay = delays[idx];
        const localT = Math.max(0, Math.min((rawProgress - delay) / (1 - delay), 1));
        const easedLocalP = easeOutQuart(localT);

        // curX glides along the wave from left (x=0) to the step's resting position
        const curX = item.end * easedLocalP;
        const curY = getWaveY(curX);
        const opacity = Math.min(1, localT * 2.8);

        // 1. Move SVG vertical stem line in horizontal lockstep with wave
        item.stem.setAttribute('x1', curX);
        item.stem.setAttribute('y1', curY);
        item.stem.setAttribute('x2', curX);
        item.stem.setAttribute('y2', 190);
        item.stem.setAttribute('opacity', (item.baseStemOpacity * opacity).toFixed(2));

        // 2. Move glowing dot and pulse ripple strictly along the wave curve
        item.dot.setAttribute('cx', curX);
        item.dot.setAttribute('cy', curY);
        if (item.ripple) {
          item.ripple.setAttribute('cx', curX);
          item.ripple.setAttribute('cy', curY);
        }
        if (item.nodeGroup) {
          item.nodeGroup.setAttribute('opacity', opacity.toFixed(2));
        }

        // 3. Move Step Pill Badge directly above the traveling wave dot
        item.pill.style.left = (curX / 1200 * 100) + '%';
        item.pill.style.top = (curY + (item.id === 2 ? 18 : 19)) + 'px';
        item.pill.style.opacity = opacity;

        // 4. Slide milestone card horizontally in lockstep with the wave node
        const offsetPx = ((curX - item.end) / 1200) * stageWidth;
        item.card.style.transform = `translateX(${offsetPx}px)`;
        item.card.style.opacity = opacity;
      });

      if (rawProgress < 1) {
        animFrameId = requestAnimationFrame(frame);
      } else {
        isAnimating = false;
        resetElements();
      }
    }

    animFrameId = requestAnimationFrame(frame);
  }

  // Expose globally for instant testing or nav triggers
  window.runHowItWorksGlideAnimation = runGlideAnimation;

  // IntersectionObserver: trigger only when user arrives at "How It Works"
  let hasTriggeredInView = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!hasTriggeredInView) {
          hasTriggeredInView = true;
          runGlideAnimation();
        }
      } else {
        // Re-arm when user leaves section so it replays smoothly when returning
        hasTriggeredInView = false;
      }
    });
  }, {
    root: null,
    threshold: 0.2
  });

  observer.observe(howSection);

  // Smooth scroll trigger when clicking "How It Works" in navigation
  document.querySelectorAll('a[href="#how-it-works"]').forEach(link => {
    link.addEventListener('click', () => {
      hasTriggeredInView = true;
      setTimeout(() => {
        runGlideAnimation();
      }, 350);
    });
  });
}

