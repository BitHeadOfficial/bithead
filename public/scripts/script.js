console.log('[BitHead] script.js loaded');

// Conditional import of config - fallback if not available
let API_URL, fetchAPI;

try {
    const config = await import('./config.js');
    API_URL = config.API_URL;
    fetchAPI = config.fetchAPI;
} catch (error) {
    console.warn('Config not available yet, using fallback values');
    API_URL = 'https://bithead.onrender.com/api';
    fetchAPI = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    };
}

// Load a file
const loadComponent = async (path) => {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error(error);
    return `<div class="error">Error loading ${path}</div>`;
  }
};

// Update smooth scrolling to work with hash links from subpages
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').slice(1);
            const target = document.getElementById(targetId);
            
            if (target) {
                // If we're on a subpage, first navigate to index
                if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                    window.location.href = `/${this.getAttribute('href')}`;
                    return;
                }
                
                // Otherwise, scroll smoothly
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Handle hash links on page load
    if (window.location.hash) {
        const targetId = window.location.hash.slice(1);
        const target = document.getElementById(targetId);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
          });
            }, 100); // Small delay to ensure DOM is ready
      }
    }
}

// Scrollspy: highlight nav link for section in view
const setupScrollSpy = () => {
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  const sections = Array.from(navLinks)
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const offset = 80; // header height offset

  function onScroll() {
    const scrollPos = window.scrollY + offset + 1;
    let activeFound = false;
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section && section.offsetTop <= scrollPos) {
        navLinks.forEach(link => link.classList.remove('active'));
        navLinks[i].classList.add('active');
        activeFound = true;
        break;
      }
    }
    if (!activeFound) {
      navLinks.forEach(link => link.classList.remove('active'));
    }
  }
  window.addEventListener('scroll', onScroll);
  onScroll(); // Initial call
};

// Mobile burger menu
const setupBurgerMenu = () => {
  console.log('[BurgerMenu] setupBurgerMenu called');
  const hamburger = document.querySelector(".hamburger");
  const navContainer = document.querySelector(".nav-container");
  const navLinks = document.querySelector(".nav-links");

  if (!hamburger || !navContainer || !navLinks) {
    console.warn('[BurgerMenu] Elements not found:', {hamburger, navContainer, navLinks});
    return;
  }

  // Prevent double-binding
  if (hamburger.dataset.burgerBound === "true") {
    console.log('[BurgerMenu] Listeners already bound');
    return;
  }
  hamburger.dataset.burgerBound = "true";
  console.log('[BurgerMenu] Attaching listeners');

  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    hamburger.classList.toggle("active");
    navContainer.classList.toggle("active");
    navLinks.classList.toggle("active");
    hamburger.textContent = navLinks.classList.contains("active") ? "✖" : "☰";
    console.log('[BurgerMenu] Hamburger clicked, menu toggled');
  });

  // Prevent clicks inside navContainer from bubbling up
  navContainer.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    // Only close if menu is open and click is outside both hamburger and navContainer
    if (
      navLinks.classList.contains("active") &&
      !navContainer.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      hamburger.classList.remove("active");
      navContainer.classList.remove("active");
      navLinks.classList.remove("active");
      hamburger.textContent = "☰";
      console.log('[BurgerMenu] Clicked outside, menu closed');
    }
  });

  // Close menu when clicking a link
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      navContainer.classList.remove("active");
      navLinks.classList.remove("active");
      hamburger.textContent = "☰";
      console.log('[BurgerMenu] Nav link clicked, menu closed');
    });
  });
};

// Flip card event
const setupPortfolioCardFlip = () => {
  const cards = document.querySelectorAll(".portfolio-card");
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".learn-more-button")) return;
      card.classList.toggle("flipped");
    });
  });
};

// Initialize contact form
function initializeContactForm() {
    console.log('[Contact Form] Initializing form...');
    
    const form = document.getElementById('contactForm');
    const submitButton = document.getElementById('submitButton');
    const status = document.getElementById('formStatus');
    
    console.log('[Contact Form] Elements found:', {
        form: !!form,
        submitButton: !!submitButton,
        status: !!status
    });
    
    if (!form || !submitButton) {
        console.error('[Contact Form] Required elements not found!');
        return;
    }
    
    // Email validation function
    function isValidEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }
    
    // Handle form submission
    async function handleSubmit(e) {
        console.log('[Contact Form] Submit handler called');
        if (e) {
            console.log('[Contact Form] Event type:', e.type);
            e.preventDefault();
        }
        
        // Get form values
        const formValues = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            message: form.message.value.trim()
        };
        
        console.log('[Contact Form] Form values:', formValues);
        
        // Validate email
        if (!isValidEmail(formValues.email)) {
            console.log('[Contact Form] Invalid email:', formValues.email);
            status.textContent = 'Please enter a valid email address';
            status.className = 'form-status error';
            return;
        }
        
        // Validate other fields
        if (!formValues.name || !formValues.message) {
            console.log('[Contact Form] Missing required fields:', {
                name: !formValues.name,
                message: !formValues.message
            });
            status.textContent = 'Please fill in all fields';
            status.className = 'form-status error';
            return;
        }
        
        // Disable submit button
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        status.textContent = '';
        status.className = 'form-status';
        
        try {
            // Submit to our proxy endpoint
            console.log('[Contact Form] Sending request to ' + API_URL + '/contact');
            const response = await fetch(API_URL + '/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formValues)
            });
            
            console.log('[Contact Form] Response status:', response.status);
            console.log('[Contact Form] Response headers:', Object.fromEntries(response.headers.entries()));
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                // If not JSON, get the text content for debugging
                const textResponse = await response.text();
                console.error('[Contact Form] Non-JSON response received:', textResponse.substring(0, 200));
                throw new Error('Server returned an invalid response. Please try again later.');
            }
            
            const responseData = await response.json();
            console.log('[Contact Form] Response data:', responseData);
            
            if (response.ok) {
                console.log('[Contact Form] Submission successful');
                status.textContent = 'Message sent successfully!';
                status.className = 'form-status success';
                form.reset();
            } else {
                throw new Error(responseData.error || 'Failed to send message');
            }
        } catch (error) {
            console.error('[Contact Form] Submission error:', error);
            status.textContent = error.message || 'Failed to send message. Please try again.';
            status.className = 'form-status error';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Send Message';
        }
    }
    
    // Add click listener to submit button
    console.log('[Contact Form] Adding click listener to submit button');
    submitButton.addEventListener('click', function(e) {
        console.log('[Contact Form] Submit button clicked');
        handleSubmit(e);
    });
    
    // Also handle form submission (in case user presses enter)
    console.log('[Contact Form] Adding submit listener to form');
    form.addEventListener('submit', function(e) {
        console.log('[Contact Form] Form submit event triggered');
        handleSubmit(e);
    });
    
    console.log('[Contact Form] Initialization complete');
}

// Main render logic
document.addEventListener("DOMContentLoaded", async () => {
  const headerContainer = document.getElementById("header-container");
  const footerContainer = document.getElementById("footer-container");
  const app = document.getElementById("app");

  if (app) {
    // We're on the main page
    const components = {
      header: "components/header.html",
      hero: "components/hero.html",
      about: "components/about.html",
      "nft-generator-cta": "components/nft-generator-cta.html",
      portfolio: "components/portfolio.html",
      snake: "components/snake.html",
      "nft-mint": "components/nft-mint.html",
      shop: "components/shop.html",
      exclusive: "components/exclusive.html",
      cta: "components/cta.html",
      footer: "components/footer.html"
    };

    let content = "";
    for (const key in components) {
      const html = await loadComponent(components[key]);
      content += html;
    }
    app.innerHTML = content;
    // Set nav link hrefs to #section for smooth scroll on index
    document.querySelectorAll('.nav-links a, .nav-logo a').forEach(link => {
      const section = link.getAttribute('data-section');
      if (section) link.setAttribute('href', `#${section}`);
    });
    setupBurgerMenu();
    setupSmoothScrolling();
    setupScrollSpy();
    initializeContactForm(); // Initialize the contact form
  } else {
    // We're on a subpage
    if (headerContainer) {
      const headerHtml = await loadComponent("components/header.html");
      headerContainer.innerHTML = headerHtml;
      // Set nav link hrefs to index.html#section for cross-page nav
      document.querySelectorAll('.nav-links a, .nav-logo a').forEach(link => {
        const section = link.getAttribute('data-section');
        if (section) link.setAttribute('href', `index.html#${section}`);
      });
      setupBurgerMenu(); // Attach after AJAX load
    } else {
      // If header is static in HTML, attach after DOMContentLoaded
      setupBurgerMenu();
    }
  }

  // Load footer for both main page and subpages
  if (footerContainer && !document.querySelector('footer')) {
    console.log('[Footer] Loading footer component');
    try {
      const footerHtml = await loadComponent("components/footer.html");
      console.log('[Footer] Footer component loaded successfully');
      footerContainer.innerHTML = footerHtml;
      console.log('[Footer] Footer HTML injected into container');
    } catch (error) {
      console.error('[Footer] Error loading footer:', error);
    }
  } else {
    console.log('[Footer] Footer container not found or footer already exists:', {
      hasFooterContainer: !!footerContainer,
      hasExistingFooter: !!document.querySelector('footer'),
      footerContainerPath: footerContainer ? footerContainer.id : 'not found'
    });
  }

  setupPortfolioCardFlip();

  if (typeof initSnakeGame === "function") {
    initSnakeGame();
  }
});

async function checkWalletAccess(walletAddress) {
    try {
        const response = await fetchAPI('/check-access-wallet', {
            method: 'POST',
            body: JSON.stringify({ publicKey: walletAddress })
        });
        return response;
    } catch (error) {
        console.error('Error checking wallet access:', error);
        throw error;
    }
}
