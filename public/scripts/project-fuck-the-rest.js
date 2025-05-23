document.addEventListener("DOMContentLoaded", () => {
  const sliderTrack = document.getElementById("sliderTrack");
  const slides = document.querySelectorAll(".slide");
  const prevBtns = document.querySelectorAll("#prev, #prevMobile");
  const nextBtns = document.querySelectorAll("#next, #nextMobile");
  let currentIndex = 0;
  const totalSlides = slides.length;
  let isMobile = window.matchMedia("(max-width: 768px)").matches;

  // Initialize slider
  function updateSlider() {
    sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    sliderTrack.style.transition =
      "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
  }

  // Handle infinite loop navigation
  function handleNavigation(direction) {
    if (direction === "next") {
      currentIndex = (currentIndex + 1) % totalSlides;
    } else {
      currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
    }
    updateSlider();
    resetZoom(); // Reset zoom on slide change
  }

  // Add event listeners to navigation buttons
  prevBtns.forEach((btn) =>
    btn.addEventListener("click", () => handleNavigation("prev"))
  );
  nextBtns.forEach((btn) =>
    btn.addEventListener("click", () => handleNavigation("next"))
  );

  // Image zoom functionality
  function handleImageZoom(e) {
    const images = document.querySelectorAll(".slide img");
    const clickedImg = e.target;

    // Reset all zoomed images
    images.forEach((img) => {
      if (img !== clickedImg) img.classList.remove("zoomed");
    });

    // Toggle zoom on clicked image
    clickedImg.classList.toggle("zoomed");

    // Close zoom when clicking outside
    if (!clickedImg.classList.contains("zoomed")) {
      document.addEventListener("click", closeZoomOnClickOutside);
    }
  }

  function closeZoomOnClickOutside(e) {
    if (!e.target.closest(".slide img")) {
      document.querySelectorAll(".slide img").forEach((img) => {
        img.classList.remove("zoomed");
      });
      document.removeEventListener("click", closeZoomOnClickOutside);
    }
  }

  function resetZoom() {
    document.querySelectorAll(".slide img").forEach((img) => {
      img.classList.remove("zoomed");
    });
  }

  // Add zoom handlers
  document.querySelectorAll(".slide img").forEach((img) => {
    // Desktop hover
    img.addEventListener("mouseenter", function () {
      if (!isMobile) this.classList.add("zoomed");
    });

    img.addEventListener("mouseleave", function () {
      if (!isMobile) this.classList.remove("zoomed");
    });

    // Mobile touch
    img.addEventListener("click", handleImageZoom);
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") handleNavigation("prev");
    if (e.key === "ArrowRight") handleNavigation("next");
    if (e.key === "Escape") resetZoom();
  });

  // Swipe handling for mobile
  let touchStartX = 0;
  let touchEndX = 0;

  sliderTrack.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].clientX;
    },
    { passive: true }
  );

  sliderTrack.addEventListener(
    "touchend",
    (e) => {
      touchEndX = e.changedTouches[0].clientX;
      if (Math.abs(touchStartX - touchEndX) > 50) {
        handleNavigation(touchStartX > touchEndX ? "next" : "prev");
      }
    },
    { passive: true }
  );

  // Window resize handler
  window.addEventListener("resize", () => {
    isMobile = window.matchMedia("(max-width: 768px)").matches;
    sliderTrack.style.transition = "none";
    sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    setTimeout(() => (sliderTrack.style.transition = ""));
    resetZoom();
  });

  // Initialize first position
  updateSlider();
});
