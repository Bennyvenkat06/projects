/**
 * skillswap/js/ui.js
 * Handles UI interactions: Theme toggling, carousels, rotators, animations
 */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initTextRotator();
    initCarousels();
    initTinderDemo();
});

/* ==========================================================================
   1. Theme Management (Dark Mode)
   ========================================================================== */
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    // Check local storage or OS preference
    const savedTheme = localStorage.getItem('skillswap-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Default to dark theme as requested by modern SaaS vibes
    let isDark = true;
    
    if (savedTheme === 'light') {
        isDark = false;
    } else if (savedTheme === 'dark') {
        isDark = true;
    } else if (!prefersDark) {
        // Only switch to light if OS specifically prefers it and no saved pref
        isDark = false;
    }

    const applyTheme = (dark) => {
        if (dark) {
            document.body.classList.add('dark-theme');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            document.body.classList.remove('dark-theme');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    };

    applyTheme(isDark);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            isDark = !isDark;
            applyTheme(isDark);
            localStorage.setItem('skillswap-theme', isDark ? 'dark' : 'light');
        });
    }
}

/* ==========================================================================
   2. Mobile Menu
   ========================================================================== */
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            // Very simple mobile menu toggle
            const isVisible = navLinks.style.display === 'flex';
            if (isVisible) {
                navLinks.style.display = 'none';
                if(navActions) navActions.style.display = 'none';
                // Reset toggle icon
                menuToggle.innerHTML = '<span></span><span></span><span></span>';
            } else {
                navLinks.style.display = 'flex';
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = 'var(--nav-height)';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.background = 'var(--bg-glass-heavy)';
                navLinks.style.padding = '2rem';
                navLinks.style.borderBottom = '1px solid var(--border-color)';
                
                if(navActions) {
                    navActions.style.display = 'flex';
                    navActions.style.position = 'absolute';
                    navActions.style.top = `calc(var(--nav-height) + 150px)`;
                    navActions.style.left = '0';
                    navActions.style.width = '100%';
                    navActions.style.justifyContent = 'center';
                    navActions.style.padding = '1rem';
                }
                
                menuToggle.innerHTML = '<span style="transform: rotate(45deg) translate(5px, 5px)"></span><span style="opacity: 0"></span><span style="transform: rotate(-45deg) translate(5px, -5px)"></span>';
            }
        });
    }
}

/* ==========================================================================
   3. Dynamic Text Rotator (Hero Section)
   ========================================================================== */
function initTextRotator() {
    const words = document.querySelectorAll('.text-rotator .word');
    if (words.length === 0) return;

    let currentIndex = 0;
    
    setInterval(() => {
        const currentWord = words[currentIndex];
        const nextIndex = (currentIndex + 1) % words.length;
        const nextWord = words[nextIndex];

        // Animate out current
        currentWord.classList.remove('active');
        currentWord.classList.add('out');

        // Reset previous 'out' classes on other words to be safe
        words.forEach((w, i) => {
            if (i !== currentIndex && i !== nextIndex) {
                w.classList.remove('out', 'active');
            }
        });

        // Animate in next
        setTimeout(() => {
            currentWord.classList.remove('out');
            nextWord.classList.add('active');
        }, 300); // Matches CSS transition

        currentIndex = nextIndex;
    }, 2500);
}

/* ==========================================================================
   4. Horizontal Carousels
   ========================================================================== */
function initCarousels() {
    const nextBtns = document.querySelectorAll('.next-btn');
    const prevBtns = document.querySelectorAll('.prev-btn');

    const scrollAmount = 300; // Pixels to scroll per click

    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const carousel = document.getElementById(targetId);
            if (carousel) {
                carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const carousel = document.getElementById(targetId);
            if (carousel) {
                carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            }
        });
    });

    // Optional: Add drag to scroll functionality
    const carousels = document.querySelectorAll('.carousel-container');
    carousels.forEach(carousel => {
        let isDown = false;
        let startX;
        let scrollLeft;

        carousel.addEventListener('mousedown', (e) => {
            isDown = true;
            carousel.style.cursor = 'grabbing';
            startX = e.pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
        });
        
        carousel.addEventListener('mouseleave', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });
        
        carousel.addEventListener('mouseup', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });
        
        carousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - carousel.offsetLeft;
            const walk = (x - startX) * 2; // Scroll-fast multiplier
            carousel.scrollLeft = scrollLeft - walk;
        });
        
        // Touch events for mobile
        carousel.addEventListener('touchstart', (e) => {
            startX = e.touches[0].pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
        });
        
        carousel.addEventListener('touchmove', (e) => {
            const x = e.touches[0].pageX - carousel.offsetLeft;
            const walk = (x - startX) * 2;
            carousel.scrollLeft = scrollLeft - walk;
        });
    });
}

/* ==========================================================================
   5. Tinder-style Interactive Demo
   ========================================================================== */
function initTinderDemo() {
    const card = document.querySelector('.interactive-demo');
    if (!card) return;

    const nopeBtn = card.querySelector('.nope-btn');
    const likeBtn = card.querySelector('.like-btn');
    const superBtn = card.querySelector('.super-btn');
    
    let isDragging = false;
    let startX = 0;
    
    // Simulate UI actions
    const swipeOut = (direction) => {
        const xTranslate = direction === 'left' ? -150 : 150;
        const rotate = direction === 'left' ? -15 : 15;
        
        card.style.transition = 'transform 0.4s ease-out, opacity 0.4s';
        card.style.transform = `translate(${xTranslate}px, ${direction === 'up' ? -150 : 50}px) rotate(${rotate}deg)`;
        card.style.opacity = '0';
        
        // Reset after animation to make demo infinite
        setTimeout(() => {
            card.style.transition = 'none';
            card.style.transform = 'translate(0, 0) rotate(0deg)';
            card.style.opacity = '1';
        }, 800);
    };

    if (nopeBtn) nopeBtn.addEventListener('click', () => swipeOut('left'));
    if (likeBtn) likeBtn.addEventListener('click', () => swipeOut('right'));
    if (superBtn) superBtn.addEventListener('click', () => swipeOut('up'));

    // Mouse drag simulating
    card.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        card.style.transition = 'none';
        card.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const rotate = deltaX * 0.05;
        card.style.transform = `translate(${deltaX}px, 0) rotate(${rotate}deg)`;
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        card.style.cursor = 'grab';
        
        const deltaX = e.clientX - startX;
        
        if (deltaX > 100) {
            swipeOut('right');
        } else if (deltaX < -100) {
            swipeOut('left');
        } else {
            // Spring back
            card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.transform = 'translate(0, 0) rotate(0deg)';
        }
    });

    // Touch events for mobile demo drag
    card.addEventListener('touchstart', (e) => {
        isDragging = true;
        startX = e.touches[0].clientX;
        card.style.transition = 'none';
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaX = e.touches[0].clientX - startX;
        const rotate = deltaX * 0.05;
        card.style.transform = `translate(${deltaX}px, 0) rotate(${rotate}deg)`;
    });

    document.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        // Since touch ends, we need last touch location if possible but e.changedTouches works
        const deltaX = e.changedTouches[0].clientX - startX;
        
        if (deltaX > 80) {
            swipeOut('right');
        } else if (deltaX < -80) {
            swipeOut('left');
        } else {
            card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.transform = 'translate(0, 0) rotate(0deg)';
        }
    });
}
