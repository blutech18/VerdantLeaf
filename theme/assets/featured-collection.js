document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.featured-collection__slider-container');
  if (!container) return;

  const viewport = container.querySelector('.featured-collection__viewport');
  const prevBtn = container.querySelector('.featured-collection__nav--prev');
  const nextBtn = container.querySelector('.featured-collection__nav--next');
  
  if (!viewport) return;

  function getScrollAmount() {
    // Scroll by roughly one viewport width, leaving a little overlap
    return viewport.clientWidth * 0.8;
  }

  function updateButtons() {
    if (prevBtn) {
      prevBtn.disabled = viewport.scrollLeft <= 5;
    }
    if (nextBtn) {
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      nextBtn.disabled = viewport.scrollLeft >= maxScroll - 5;
    }
  }

  function scrollNext() {
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    if (viewport.scrollLeft >= maxScroll - 5) {
      // If at the end, smoothly loop back to the beginning
      viewport.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      viewport.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      // Manual click also resets the auto-play timer
      stopAutoPlay();
      scrollNext();
      startAutoPlay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stopAutoPlay();
      viewport.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
      startAutoPlay();
    });
  }

  viewport.addEventListener('scroll', updateButtons);
  window.addEventListener('resize', updateButtons);

  // Auto-play logic
  let autoPlayInterval;
  
  function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(scrollNext, 5000); // 5 seconds
  }
  
  function stopAutoPlay() {
    clearInterval(autoPlayInterval);
  }

  // Start auto-play
  startAutoPlay();
  
  // Pause auto-sliding on hover and touch interactions
  container.addEventListener('mouseenter', stopAutoPlay);
  container.addEventListener('mouseleave', startAutoPlay);
  container.addEventListener('touchstart', stopAutoPlay, { passive: true });
  container.addEventListener('touchend', startAutoPlay, { passive: true });

  // Initialize
  updateButtons();
});
