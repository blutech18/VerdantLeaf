document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.section-testimonials');
  const cards = document.querySelectorAll('.testimonial-card');
  if (!section || cards.length === 0) return;

  function updateScroll() {
    const siteHeader = document.querySelector('.site-header');
    const headerHeight = siteHeader ? siteHeader.offsetHeight : 0;
    section.style.setProperty('--header-height', `${headerHeight}px`);

    // Only apply complex scroll effects on mobile/tablet where it is stacked
    if (window.innerWidth > 768) {
      cards.forEach(card => {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.zIndex = '';
      });
      return;
    }

    const rect = section.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Calculate how far we have scrolled into the section
    const scrollStart = rect.top - headerHeight; // when section reaches bottom of header
    const maxScroll = rect.height - windowHeight + headerHeight; // total scrollable distance
    
    // We want the animation to finish BEFORE the section ends, to give the user time to read the final card
    const delayDistance = windowHeight * 0.5; // 50vh of natural delay at the end
    const animatableScroll = Math.max(1, maxScroll - delayDistance);
    
    // progress is 0 at start, 1 at the end of the animatable distance
    let progress = -scrollStart / animatableScroll;
    progress = Math.max(0, Math.min(1, progress));

    // We have 3 cards. 
    // Card 1 is always initially in place.
    // Card 2 enters from progress 0 to 0.5.
    // Card 3 enters from progress 0.5 to 1.0.

    const totalCards = cards.length;
    const step = 1 / (totalCards - 1);

    cards.forEach((card, index) => {
      // z-index logic: higher index needs higher z-index so it overlaps
      card.style.zIndex = index + 1;
      
      // Calculate how many cards are currently covering this card
      // progress goes from 0 to 1 over the whole animation. 
      // progress * (totalCards - 1) gives us the current "covering phase" (0 to 2)
      let coveringPhase = progress * (totalCards - 1);
      let cardsCovering = Math.max(0, coveringPhase - index);
      
      // Each covering card shrinks this card by 4%
      const scale = 1 - (cardsCovering * 0.04);

      if (index === 0) {
        // First card doesn't slide up, it's just there.
        card.style.transform = `translateY(0px) scale(${scale})`;
        card.style.opacity = 1; // Keep fully opaque!
        card.style.transformOrigin = 'top center';
      } else {
        // Calculate the entrance phase for this card
        const enterStart = (index - 1) * step;
        const enterEnd = index * step;
        
        let enterProgress = (progress - enterStart) / (enterEnd - enterStart);
        enterProgress = Math.max(0, Math.min(1, enterProgress));
        
        // Translate Y from 100vh down to its resting offset
        const restingOffset = index * 45; // 45px, 90px
        const currentY = (1 - enterProgress) * windowHeight + (enterProgress * restingOffset);
        
        card.style.transform = `translateY(${currentY}px) scale(${scale})`;
        card.style.opacity = 1; // Keep fully opaque!
        card.style.transformOrigin = 'top center';
      }
    });
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
  
  window.addEventListener('resize', updateScroll);
  updateScroll(); // Initial call
});
