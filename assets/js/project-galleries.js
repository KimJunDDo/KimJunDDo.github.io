(() => {
  const galleries = document.querySelectorAll("[data-device-gallery]");

  galleries.forEach((gallery) => {
    const slides = Array.from(gallery.querySelectorAll("[data-gallery-slide]"));
    const screen = gallery.querySelector("[data-gallery-screen]");
    const previous = gallery.querySelector("[data-gallery-previous]");
    const next = gallery.querySelector("[data-gallery-next]");
    const dotsContainer = gallery.querySelector("[data-gallery-dots]");
    let current = 0;
    let touchStartX = 0;
    let ignoreClick = false;

    const dots = slides.map((_, index) => {
      const dot = document.createElement("span");
      dot.className = "project-mockup__dot";
      dot.dataset.galleryDot = String(index);
      dotsContainer.appendChild(dot);
      return dot;
    });

    const show = (index) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === current;
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
      });
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === current);
      });
    };

    const showPrevious = () => show(current - 1);
    const showNext = () => show(current + 1);
    const isInteractiveKey = (event) => event.key === "Enter" || event.key === " ";

    if (slides.length < 2) {
      previous.disabled = true;
      next.disabled = true;
      gallery.classList.add("has-single-slide");
    }

    previous.addEventListener("click", showPrevious);
    next.addEventListener("click", showNext);
    screen.addEventListener("click", () => {
      if (ignoreClick) {
        ignoreClick = false;
        return;
      }
      showNext();
    });
    screen.addEventListener("keydown", (event) => {
      if (isInteractiveKey(event)) {
        event.preventDefault();
        showNext();
      }
    });
    gallery.addEventListener("keydown", (event) => {
      if (event.target !== gallery) return;
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    });
    screen.addEventListener("touchstart", (event) => {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    screen.addEventListener("touchend", (event) => {
      const distance = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(distance) < 40) return;
      ignoreClick = true;
      window.setTimeout(() => { ignoreClick = false; }, 350);
      distance > 0 ? showPrevious() : showNext();
    }, { passive: true });

    show(0);
  });
})();
