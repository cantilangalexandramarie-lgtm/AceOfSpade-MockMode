
// MockMode — results.js
// Handles results.html: verdict reveal, score chart,
// strengths/weaknesses display, and session reset.
// Depends on: main.js (Chart.js loaded via CDN in HTML)


// Init

document.addEventListener('DOMContentLoaded', () => {
  const verdict        = getFromStorage('verdict');
  const scores         = getFromStorage('scores');
  const resumeAnalysis = getFromStorage('resume_analysis');

  // Guard: if critical data is missing, bounce to start
  if (!verdict || !scores) {
    showToast('No results found. Please complete an interview first.', 'warning');
    setTimeout(() => navigateTo('index.html'), 2000);
    return;
  }

  revealVerdict(verdict);
  renderScoreChart(scores);
  renderResumeInsights(resumeAnalysis);
  bindActions();
});

// Verdict reveal

/**
 * Displays the verdict text, message, and final tip.
 * @param {{ verdict: string, verdict_message: string, final_tip: string, average: number }} verdict
 */
function revealVerdict(verdict) {
  const { verdict: result, verdict_message, final_tip, average } = verdict;

  // Main verdict word
  const verdictEl = document.getElementById('verdict-text');
  if (verdictEl) {
    verdictEl.textContent = result ?? 'UNKNOWN';
    verdictEl.className = `verdict-text verdict--${getVerdictClass(result)}`;

    // Animate in after a brief delay for drama
    setTimeout(() => verdictEl.classList.add('verdict--revealed'), 300);
  }

  // Average score
  const scoreEl = document.getElementById('verdict-score');
  if (scoreEl && average !== undefined) {
    scoreEl.textContent = `Average Score: ${average}%`;
  }

  // Interviewer's final message
  const messageEl = document.getElementById('verdict-message');
  if (messageEl && verdict_message) {
    messageEl.textContent = verdict_message;
  }

  // Actionable tip
  const tipEl = document.getElementById('verdict-tip');
  if (tipEl && final_tip) {
    tipEl.innerHTML = `<strong>💡 Tip:</strong> ${final_tip}`;
  }

  // Page-level color theme based on result
  document.body.dataset.verdict = getVerdictClass(result);
}

/**
 * Maps verdict string to a CSS class suffix.
 * @param {string} verdict
 * @returns {'hired'|'waitlisted'|'fired'}
 */
function getVerdictClass(verdict) {
  const map = {
    'HIRED':      'hired',
    'WAITLISTED': 'waitlisted',
    'FIRED':      'fired',
  };
  return map[(verdict ?? '').toUpperCase()] ?? 'fired';
}

// Score chart 

/**
 * Renders a Chart.js bar chart of per-question scores (Q1–Q5).
 * Green ≥ 75, Yellow ≥ 50, Red < 50.
 * @param {number[]} scores - Array of 5 numbers (0–100)
 */
function renderScoreChart(scores) {
  const canvas = document.getElementById('scores-chart');
  if (!canvas) return;

  // Ensure Chart.js is available
  if (typeof Chart === 'undefined') {
    console.warn('[MockMode] Chart.js not loaded — skipping chart.');
    return;
  }

  const labels = scores.map((_, i) => `Q${i + 1}`);

  // Determine bar color per score
  const backgroundColors = scores.map(s => {
    if (s >= 75) return 'rgba(26, 255, 122, 0.75)';   // green
    if (s >= 50) return 'rgba(255, 204, 0, 0.75)';    // yellow
    return 'rgba(255, 68, 68, 0.75)';                  // red
  });

  const borderColors = scores.map(s => {
    if (s >= 75) return '#1aff7a';
    if (s >= 50) return '#ffcc00';
    return '#ff4444';
  });

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Score',
        data: scores,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Score: ${ctx.parsed.y}/100`,
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            stepSize: 25,
            callback: val => `${val}%`,
          },
          grid: {
            color: 'rgba(255,255,255,0.06)',
          },
        },
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.6)',
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

// Resume insights 

/**
 * Renders strengths and weaknesses from the resume analysis.
 * @param {{ strengths: string[], weaknesses: string[] } | null} analysis
 */
function renderResumeInsights(analysis) {
  if (!analysis) return;

  const strengthsList   = document.getElementById('strengths-list');
  const weaknessesList  = document.getElementById('weaknesses-list');

  if (strengthsList && Array.isArray(analysis.strengths)) {
    strengthsList.innerHTML = analysis.strengths
      .map(s => `<li class="insight-item insight-item--strength">✓ ${s}</li>`)
      .join('');
  }

  if (weaknessesList && Array.isArray(analysis.weaknesses)) {
    weaknessesList.innerHTML = analysis.weaknesses
      .map(w => `<li class="insight-item insight-item--weakness">✕ ${w}</li>`)
      .join('');
  }
}

// CTA buttons 

function bindActions() {
  // "Try Again" — clear session and go to home
  const tryAgainBtn = document.getElementById('try-again-btn');
  if (tryAgainBtn) {
    tryAgainBtn.addEventListener('click', () => {
      clearSession();
      navigateTo('index.html');
    });
  }

  // "Download / Print" — browser print dialog
  const printBtn = document.getElementById('print-results-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // "Share" — Web Share API with graceful fallback
  const shareBtn = document.getElementById('share-results-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', shareResults);
  }
}

/**
 * Uses the Web Share API if available, otherwise copies a link.
 */
async function shareResults() {
  const verdict  = getFromStorage('verdict');
  const result   = verdict?.verdict ?? 'Interview result';
  const average  = verdict?.average ?? '?';
  const shareText = `I just completed a MockMode AI interview and got: ${result} (avg score: ${average}%) 🎯`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'MockMode — My Interview Result',
        text: shareText,
        url: window.location.href,
      });
    } catch (err) {
      // User cancelled — that's fine
    }
  } else {
    // Fallback: copy text to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      showToast('Result copied to clipboard!', 'success');
    } catch (err) {
      showToast('Could not share. Screenshot this page instead!', 'warning');
    }
  }
}