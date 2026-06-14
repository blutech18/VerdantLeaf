/**
 * Verdant Leaf — Tea Profile Quiz Engine
 * 
 * Scoring Logic:
 * - Each answer option carries weighted scores for different tea categories
 * - Scores accumulate across all 4 questions
 * - Top 3 categories become the recommendations
 * - Results include tea name, description, price, and match percentage
 */

(function() {
  'use strict';

  // Tea catalog for result recommendations
  const TEA_CATALOG = {
    green: {
      type: 'Green Tea',
      name: 'Uji Sencha Reserve',
      origin: 'Japan',
      desc: 'A vibrant, umami-rich green tea from Uji with a smooth, sweet finish. Perfect for daily enjoyment with a gentle caffeine lift.',
      note: 'Smooth umami with a gentle daily lift.',
      tags: ['Umami', 'Light caffeine', 'Cold brew'],
      price: '$24.00',
      color: '#4a7c5c'
    },
    black: {
      type: 'Black Tea',
      name: 'Golden Yunnan Tips',
      origin: 'China',
      desc: 'Full-bodied with honeyed sweetness and malty depth. Golden buds from Yunnan province deliver a rich, warming cup.',
      note: 'Rich, malty, and warming for mornings.',
      tags: ['Full body', 'High caffeine', 'Breakfast'],
      price: '$18.00',
      color: '#4a3728'
    },
    oolong: {
      type: 'Oolong Tea',
      name: 'Ali Shan High Mountain',
      origin: 'Taiwan',
      desc: 'Creamy and floral with orchid notes, grown above the clouds on Ali Mountain. A transcendent experience in every steep.',
      note: 'Creamy florals for slow afternoon steeps.',
      tags: ['Floral', 'Medium caffeine', 'Gongfu'],
      price: '$32.00',
      color: '#5c6b4a'
    },
    white: {
      type: 'White Tea',
      name: 'Silver Needle Bai Hao',
      origin: 'China',
      desc: 'Delicate and ethereal with notes of melon and honey. Made from only the finest spring buds, minimally processed.',
      note: 'Delicate melon and honey with a soft finish.',
      tags: ['Delicate', 'Low caffeine', 'Spring buds'],
      price: '$28.00',
      color: '#8a7d62'
    },
    puerh: {
      type: "Pu-erh Tea",
      name: 'Ancient Tree Pu-erh',
      origin: 'China',
      desc: 'Deep, complex, and earthy from 200-year-old tea trees. A connoisseur\'s tea that improves with age, like fine wine.',
      note: 'Deep earthy complexity for mindful brewing.',
      tags: ['Earthy', 'High caffeine', 'Aged'],
      price: '$45.00',
      color: '#3d2b1f'
    },
    herbal: {
      type: 'Herbal Infusion',
      name: 'Chamomile Meadow Blend',
      origin: 'Egypt & France',
      desc: 'Naturally caffeine-free with soothing chamomile flowers and hints of honey. The perfect cup for evening relaxation.',
      note: 'Calming chamomile sweetness for evenings.',
      tags: ['Caffeine free', 'Soothing', 'Evening'],
      price: '$16.00',
      color: '#8a7040'
    }
  };

  // Quiz state
  let scores = {};
  let currentScreen = 'start';
  const screens = document.querySelectorAll('.quiz__screen');
  const quizContainer = document.getElementById('quiz-container');

  if (!quizContainer) return;

  // Initialize scores
  function resetScores() {
    scores = { green: 0, black: 0, oolong: 0, white: 0, puerh: 0, herbal: 0 };
  }
  resetScores();

  // Show a specific screen
  function showScreen(screenName) {
    quizContainer.classList.toggle('quiz--results', screenName === 'results');

    screens.forEach(s => {
      s.classList.remove('active');
      if (s.dataset.screen === screenName) {
        s.classList.add('active');
        // Re-trigger animation
        s.style.animation = 'none';
        s.offsetHeight; // force reflow
        s.style.animation = '';
      }
    });
    currentScreen = screenName;

    if (screenName === 'results') {
      const quizSection = quizContainer.closest('section');
      if (quizSection) {
        setTimeout(() => {
          quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }

  // Start button
  const startBtn = document.getElementById('quiz-start');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      resetScores();
      showScreen('q1');
    });
  }

  // Option selection → auto-advance
  document.querySelectorAll('.quiz__option').forEach(option => {
    option.addEventListener('click', function() {
      const optionsContainer = this.closest('.quiz__options');
      const screen = this.closest('.quiz__screen');
      const questionNum = parseInt(screen.dataset.question);

      // Mark selected
      optionsContainer.querySelectorAll('.quiz__option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');

      // Add scores
      const optionScores = JSON.parse(this.dataset.scores);
      Object.entries(optionScores).forEach(([tea, score]) => {
        scores[tea] = (scores[tea] || 0) + score;
      });

      // Auto-advance after brief delay
      setTimeout(() => {
        if (questionNum < 4) {
          showScreen('q' + (questionNum + 1));
        } else {
          showResults();
        }
      }, 400);
    });
  });

  // Calculate and show results
  function showResults() {
    // Sort teas by score descending
    const sorted = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const maxScore = sorted[0][1];
    const resultsGrid = document.getElementById('quiz-results-grid');
    const resultTitle = document.getElementById('quiz-result-title');
    const resultDesc = document.getElementById('quiz-result-desc');

    // Set result heading
    const topTea = TEA_CATALOG[sorted[0][0]];
    resultTitle.textContent = `You're a ${topTea.type} lover!`;
    resultDesc.textContent = `Your top 3 matches, ranked by flavor, caffeine, and brew style.`;

    // Build result cards
    resultsGrid.innerHTML = sorted.map(([key, score], index) => {
      const tea = TEA_CATALOG[key];
      const matchPercent = Math.round((score / maxScore) * 100);
      const matchLabel = index === 0 ? 'Best Match' : `${matchPercent}% Match`;
      const tags = tea.tags.map(tag => `<li class="quiz__result-tag">${tag}</li>`).join('');

      // Use dynamic Shopify product data if available
      const dynamicProduct = window.QuizProducts && window.QuizProducts[key];
      const displayPrice = dynamicProduct ? dynamicProduct.price : tea.price;
      const displayUrl = dynamicProduct ? dynamicProduct.url : '/collections/all';
      const displayImage = dynamicProduct ? dynamicProduct.image : null;

      let imageHtml = '';
      if (displayImage) {
        imageHtml = `
          <img
            src="${displayImage}"
            alt="${tea.name}"
            class="quiz__result-image"
            loading="lazy"
            width="480"
            height="480"
          />
        `;
      } else {
        imageHtml = `
          <div class="quiz__result-image tea-product-visual tea-product-visual--${key}" style="width: 100%; height: 100%;">
            <div class="tea-product-visual__tin">
              <span class="tea-product-visual__mark"></span>
              <span class="tea-product-visual__label">${tea.type}</span>
              <span class="tea-product-visual__origin">${tea.origin}</span>
            </div>
            <div class="tea-product-visual__scoop"></div>
            <div class="tea-product-visual__leaves tea-product-visual__leaves--one"></div>
            <div class="tea-product-visual__leaves tea-product-visual__leaves--two"></div>
          </div>
        `;
      }

      let stockHtml = '<span style="color: white;">In stock</span>';
      if (dynamicProduct) {
        if (dynamicProduct.tracks_inventory) {
          if (dynamicProduct.total_inventory > 0) {
            if (dynamicProduct.total_inventory <= 5) {
              stockHtml = `<span style="color: var(--color-error); font-weight: 600;">Only ${dynamicProduct.total_inventory} left in stock</span>`;
            } else {
              stockHtml = `<span style="color: white;">${dynamicProduct.total_inventory} in stock</span>`;
            }
          } else if (!dynamicProduct.available) {
            stockHtml = `<span style="color: var(--color-error);">Out of stock</span>`;
          }
        } else if (!dynamicProduct.available) {
          stockHtml = `<span style="color: var(--color-error);">Out of stock</span>`;
        }
      }

      return `
        <div class="quiz__result-card">
          <a href="${displayUrl}" class="quiz__result-link-wrapper" aria-label="${tea.name}">
            <div class="quiz__result-image-wrapper">
              ${imageHtml}
              <span class="quiz__result-match">${matchLabel}</span>
            </div>
            <div class="quiz__result-body">
              <div class="quiz__result-type">${tea.origin} · ${tea.type}</div>
              <h3 class="quiz__result-name">${tea.name}</h3>
              <p class="quiz__result-desc">${tea.note}</p>
              <ul class="quiz__result-tags" aria-label="${tea.type} highlights">${tags}</ul>
              
              <div class="quiz__result-price-stock" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; margin-bottom: 4px; width: 100%;">
                <div style="font-weight: 700; font-size: 16px;">
                  ${displayPrice}
                </div>
                <div style="font-size: 13px; text-align: right;">
                  ${stockHtml}
                </div>
              </div>
            </div>
          </a>
          <div class="quiz__result-actions">
            ${dynamicProduct && dynamicProduct.variant_id ? `
              <button class="quiz__btn quiz__btn--cart" type="button" aria-label="Add to cart" onclick="event.preventDefault(); fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: ${dynamicProduct.variant_id}, quantity: 1 }] }) }).then(() => window.location.href = '/cart')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                Add
              </button>
              <button class="quiz__btn quiz__btn--buy" type="button" aria-label="Buy now" onclick="event.preventDefault(); fetch('/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: ${dynamicProduct.variant_id}, quantity: 1 }] }) }).then(() => window.location.href = '/checkout')">
                Buy Now
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 6px;"><path d="M5 12h14"></path><path d="M12 5l7 7-7 7"></path></svg>
              </button>
            ` : `
              <a href="${displayUrl}" class="quiz__btn quiz__btn--buy" style="width: 100%; text-decoration: none;">
                View Tea →
              </a>
            `}
          </div>
        </div>
      `;
    }).join('');

    showScreen('results');
  }

  // Restart
  const restartBtn = document.getElementById('quiz-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      resetScores();
      // Clear all selected options
      document.querySelectorAll('.quiz__option.selected').forEach(o => o.classList.remove('selected'));
      showScreen('start');
    });
  }

  // Show start screen initially
  showScreen('start');
})();
