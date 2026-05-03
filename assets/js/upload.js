
// MockMode — upload.js
// Handles resume.html: resume input, personality selection,
// resume analysis, and session initialization.
// Depends on: main.js, ai.js


// State

let selectedPersonality = null; // 'corporate' | 'startup' | 'technical'
let selectedRole       = null; // 'developer' | 'designer' | 'analyst' | 'marketing' | 'general'

// Init

document.addEventListener('DOMContentLoaded', () => {
  // Always start fresh on the upload page
  clearSession();

  bindPersonalityCards();
  bindRoleCards();
  bindResumeTextarea();
  bindSubmitButton();
  bindFileUpload();
});

// Personality card selection

function bindPersonalityCards() {
  const cards = document.querySelectorAll('[data-personality]');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      // Remove active state from all cards
      cards.forEach(c => c.classList.remove('selected', 'active'));

      // Mark this card as selected
      card.classList.add('selected', 'active');
      selectedPersonality = card.dataset.personality;

      // Visual accessibility: update aria-pressed
      cards.forEach(c => c.setAttribute('aria-pressed', 'false'));
      card.setAttribute('aria-pressed', 'true');
    });
  });
}

// Role card selection

function bindRoleCards() {
  const cards = document.querySelectorAll('[data-role]');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('selected', 'active');
        c.setAttribute('aria-pressed', 'false');
      });

      card.classList.add('selected', 'active');
      card.setAttribute('aria-pressed', 'true');
      selectedRole = card.dataset.role;
    });
  });
}

// Resume textarea character feedback

function bindResumeTextarea() {
  const textarea = document.getElementById('resume-input');
  const counter  = document.getElementById('resume-char-count');
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.trim().length;

    // Update optional character counter
    if (counter) {
      counter.textContent = `${len} characters`;
      counter.classList.toggle('mm-counter--ready', len >= 100);
    }

    // Remove error styling once user starts typing
    textarea.classList.remove('mm-input--error');
  });
}

// File upload → extract text

function bindFileUpload() {
  const fileInput = document.getElementById('resume-file');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const textarea = document.getElementById('resume-input');
    if (!textarea) return;

    // Only accept plain text files for MVP (PDF parsing is complex)
    if (file.type === 'text/plain') {
      const text = await file.text();
      textarea.value = text;
      textarea.dispatchEvent(new Event('input')); // trigger counter update
      showToast('Resume loaded from file!', 'success');
      return;
    }

    // For PDF or other types, guide the user to paste manually
    showToast('Please paste your resume text directly for best results.', 'warning');
  });
}

// Submit — validate, analyze, navigate

function bindSubmitButton() {
  const btn = document.getElementById('start-interview-btn');
  if (!btn) return;

  btn.addEventListener('click', handleSubmit);

  // Also allow Enter key on the button
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleSubmit();
  });
}

async function handleSubmit() {
  const textarea = document.getElementById('resume-input');
  const resumeText = textarea ? textarea.value.trim() : '';

  // Validate: resume not empty
  if (!resumeText || resumeText.length < 50) {
    showToast('Please paste your resume (at least 50 characters).', 'error');
    if (textarea) {
      textarea.classList.add('mm-input--error');
      textarea.focus();
    }
    return;
  }

  // Validate: personality selected
  if (!selectedPersonality) {
    showToast('Pick an interviewer personality first!', 'warning');

    // Shake the personality section to draw attention
    const section = document.querySelector('.personality-cards') 
                 ?? document.querySelector('[data-personality]')?.parentElement;
    if (section) {
      section.classList.add('mm-shake');
      section.addEventListener('animationend', () => section.classList.remove('mm-shake'), { once: true });
    }
    return;
  }

  // Validate: role selected
  if (!selectedRole) {
    showToast('Pick a role you\'re interviewing for!', 'warning');

    const section = document.querySelector('.role-cards')
                 ?? document.querySelector('[data-role]')?.parentElement;
    if (section) {
      section.classList.add('mm-shake');
      section.addEventListener('animationend', () => section.classList.remove('mm-shake'), { once: true });
    }
    return;
  }

  // Save resume + personality + role immediately
  saveToStorage('resume', resumeText);
  saveToStorage('personality', selectedPersonality);
  saveToStorage('role', selectedRole);

  // Call AI: analyze resume
  showLoader('Analyzing your resume...');

  try {
    const analysis = await analyzeResume(resumeText);

    if (!analysis) throw new Error('Resume analysis returned empty result.');

    saveToStorage('resume_analysis', analysis);

    hideLoader();
    showToast('Resume analyzed! Starting your interview...', 'success');

    // Short pause so toast is visible before transition
    setTimeout(() => navigateTo('interview.html'), 800);

  } catch (err) {
    hideLoader();
    console.error('[MockMode] Resume analysis failed:', err);
    showToast('AI analysis failed. Check your connection and try again.', 'error');
  }
}