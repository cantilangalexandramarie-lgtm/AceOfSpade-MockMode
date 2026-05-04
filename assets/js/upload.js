// MockMode — upload.js
// Handles upload.html: resume input, personality selection,
// resume analysis, and session initialization.
// Depends on: main.js, ai.js

let selectedPersonality = null;
let selectedRole = null;

document.addEventListener('DOMContentLoaded', () => {
  clearSession();
  bindPersonalityCards();
  bindRoleCards();
  bindResumeTextarea();
  bindSubmitButton();
  bindFileUpload();
});

function bindPersonalityCards() {
  const cards = document.querySelectorAll('[data-personality]');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('selected', 'active', 'border-primary', 'bg-primary/20');
        c.setAttribute('aria-pressed', 'false');
        // restore unselected look
        c.classList.add('bg-surface-container');
      });
      card.classList.add('selected', 'active', 'border-primary', 'bg-primary/20');
      card.classList.remove('bg-surface-container');
      card.setAttribute('aria-pressed', 'true');
      selectedPersonality = card.dataset.personality;
    });
  });
}

function bindRoleCards() {
  const cards = document.querySelectorAll('[data-role]');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('selected', 'active', 'border-primary', 'bg-primary/20');
        c.setAttribute('aria-pressed', 'false');
        c.classList.add('bg-surface-container');
      });
      card.classList.add('selected', 'active', 'border-primary', 'bg-primary/20');
      card.classList.remove('bg-surface-container');
      card.setAttribute('aria-pressed', 'true');
      selectedRole = card.dataset.role;
    });
  });
}

function bindResumeTextarea() {
  const textarea = document.getElementById('resume-input');
  const counter = document.getElementById('resume-char-count');
  if (!textarea) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.trim().length;
    if (counter) {
      counter.textContent = `${len} characters`;
      counter.classList.toggle('text-tertiary', len >= 100);
    }
    textarea.classList.remove('border-error');
  });
}

function bindFileUpload() {
  const fileInput = document.getElementById('resume-file');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const textarea = document.getElementById('resume-input');
    if (!textarea) return;

    if (file.type === 'text/plain') {
      const text = await file.text();
      textarea.value = text;
      textarea.dispatchEvent(new Event('input'));
      showToast('Resume loaded from file!', 'success');
      return;
    }
    showToast('Please paste your resume text directly for best results.', 'warning');
  });
}

function bindSubmitButton() {
  const btn = document.getElementById('start-interview-btn');
  if (!btn) return;
  btn.addEventListener('click', handleSubmit);
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleSubmit();
  });
}

async function handleSubmit() {
  const textarea = document.getElementById('resume-input');
  const resumeText = textarea ? textarea.value.trim() : '';

  if (!resumeText || resumeText.length < 50) {
    showToast('Please paste your resume (at least 50 characters).', 'error');
    if (textarea) {
      textarea.classList.add('border-error');
      textarea.focus();
    }
    return;
  }

  if (!selectedPersonality) {
    showToast('Pick an interviewer personality first!', 'warning');
    const section = document.querySelector('.personality-cards')
                 ?? document.querySelector('[data-personality]')?.parentElement;
    if (section) {
      section.classList.add('mm-shake');
      section.addEventListener('animationend', () => section.classList.remove('mm-shake'), { once: true });
    }
    return;
  }

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

  saveToStorage('resume', resumeText);
  saveToStorage('personality', selectedPersonality);
  saveToStorage('role', selectedRole);

  showLoader('Analyzing your resume...');

  try {
    const analysis = await analyzeResume(resumeText);
    if (!analysis) throw new Error('Resume analysis returned empty result.');

    saveToStorage('resume_analysis', analysis);
    hideLoader();
    showToast('Resume analyzed! Starting your interview...', 'success');
    setTimeout(() => navigateTo('interview.html'), 800);

  } catch (err) {
    hideLoader();
    console.error('[MockMode] Resume analysis failed:', err);
    showToast('AI analysis failed. Check your connection and try again.', 'error');
  }
}