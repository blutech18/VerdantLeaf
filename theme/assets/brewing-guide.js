document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('#brewing-guide');
  if (!section) return;

  const stickyWrapper = section.querySelector('.brewing-guide__sticky-wrapper');
  const cardsContainer = section.querySelector('.brewing-guide__cards');
  const cards = section.querySelectorAll('.brewing-card');
  const progressBar = section.querySelector('.brewing-guide__progress-bar');
  const labels = section.querySelectorAll('.brewing-guide__progress-labels span');
  if (!stickyWrapper || !cardsContainer || cards.length === 0) return;

  let isMobile = false;
  let cardWidth = 0;
  let totalCards = cards.length;
  let maxTranslate = 0;
  let headerHeight = 0;
  let totalVerticalScrollNeeded = 0;
  
  // Tuning parameters for the scroll feel
  const scrollSpeedMultiplier = 1.5; // Requires 1.5x vertical scroll to move horizontally (slower)
  const startRestSpace = 250; // Extra pixels at the start so the first card rests before sliding
  const endRestSpace = 250; // Extra pixels at the end so the last card rests before unpinning

  // Debug check for parent elements that might break sticky positioning
  function checkAncestors() {
    let parent = section.parentElement;
    while (parent && parent !== document.documentElement) {
      const style = getComputedStyle(parent);
      const overflow = style.overflow + style.overflowX + style.overflowY;
      if (overflow.includes('hidden') || overflow.includes('auto') || overflow.includes('scroll')) {
        console.warn('Potential sticky-breaking ancestor found:', parent, 'overflow styles:', {
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY
        });
      }
      parent = parent.parentElement;
    }
  }

  function init() {
    const mobile = window.innerWidth <= 600;

    if (!mobile) {
      // Reset everything for desktop
      if (isMobile) {
        section.style.height = '';
        section.style.removeProperty('--header-height');
        cardsContainer.style.transform = '';
        isMobile = false;
      }
      return;
    }

    isMobile = true;
    checkAncestors();

    // Reset transform to measure accurately
    cardsContainer.style.transform = 'none';

    // Measure fixed header height dynamically
    const header = document.querySelector('.site-header');
    headerHeight = header ? header.offsetHeight : 0;
    section.style.setProperty('--header-height', `${headerHeight}px`);

    // Measure one card's full width for reference if needed
    const firstCard = cards[0];
    const style = getComputedStyle(firstCard);
    cardWidth = firstCard.offsetWidth + parseFloat(style.marginLeft || 0) + parseFloat(style.marginRight || 0);

    // Robust calculation for maxTranslate: Center the last card on the screen
    const containerRect = cardsContainer.getBoundingClientRect();
    const lastCardRect = cards[totalCards - 1].getBoundingClientRect();
    
    // Center of the last card relative to the container's left edge
    const lastCardCenter = (lastCardRect.left - containerRect.left) + (lastCardRect.width / 2);
    
    // The container's left edge is at containerRect.left on the screen.
    // We want the last card's center to be at window.innerWidth / 2.
    // So the container needs to shift by: lastCardCenter - (window.innerWidth / 2 - containerRect.left)
    maxTranslate = lastCardCenter - ((window.innerWidth / 2) - containerRect.left);
    maxTranslate = Math.max(0, maxTranslate);
    
    // Total vertical scroll needed to complete the horizontal translation
    totalVerticalScrollNeeded = maxTranslate * scrollSpeedMultiplier;

    // Runway height = sticky viewport height + start delay + vertical travel + end padding
    section.style.height = `${(window.innerHeight - headerHeight) + startRestSpace + totalVerticalScrollNeeded + endRestSpace}px`;

    updateScroll();
  }

  function updateScroll() {
    if (!isMobile) return;

    const sectionRect = section.getBoundingClientRect();
    // Progress is how far the section has scrolled past the sticky start point (headerHeight)
    let progress = headerHeight - sectionRect.top;
    
    // Subtract the start rest space so translation begins later
    let activeProgress = Math.max(0, progress - startRestSpace);
    
    // Apply the scroll multiplier to slow down the translation
    let translateAmount = activeProgress / scrollSpeedMultiplier;

    // Clamp between 0 and maxTranslate
    translateAmount = Math.max(0, Math.min(translateAmount, maxTranslate));

    cardsContainer.style.transform = `translate3d(-${translateAmount}px, 0, 0)`;

    if (progressBar && maxTranslate > 0 && labels.length > 0) {
      const scrollPercent = translateAmount / maxTranslate;
      
      // Calculate exactly where the center of each label is
      // For 4 labels, each is 25% wide. The first label's center is at 12.5%.
      // The last label's center is at 87.5%. The travel range is 75%.
      const startOffset = 100 / (labels.length * 2); 
      const range = 100 - (startOffset * 2); 
      let progressWidth = startOffset + (scrollPercent * range);
      
      // Expand progressWidth if in startRestSpace or endRestSpace
      if (progress < startRestSpace) {
        // Grow from 0 to startOffset during startRestSpace
        const startProgress = Math.max(0, progress) / startRestSpace;
        progressWidth = startProgress * startOffset;
      } else if (progress > startRestSpace + totalVerticalScrollNeeded) {
        // Grow from (startOffset + range) to 100% during endRestSpace
        const endProgress = (progress - (startRestSpace + totalVerticalScrollNeeded)) / endRestSpace;
        const clampedEnd = Math.min(1, Math.max(0, endProgress));
        progressWidth = (startOffset + range) + (clampedEnd * startOffset);
      }
      
      progressBar.style.width = `${progressWidth}%`;

      let activeIdx = Math.round(scrollPercent * (labels.length - 1));
      labels.forEach((label, idx) => {
        if (idx === activeIdx) {
          label.classList.add('active');
        } else {
          label.classList.remove('active');
        }
      });
    }
  }

  // Listeners
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(init, 100);
  });

  window.addEventListener('scroll', () => {
    if (isMobile) {
      requestAnimationFrame(updateScroll);
    }
  }, { passive: true });

  // Init after a short delay to ensure layout is settled
  setTimeout(init, 100);
});
