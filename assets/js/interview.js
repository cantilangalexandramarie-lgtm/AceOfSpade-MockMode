
// MockMode — interview.js
// Core game engine for interview.html.
// Manages question flow, AI evaluation, stress meter, and
// transitions to the results page.
// Depends on: main.js, ai.js


// Session state

let resumeText      = null;
let personality     = null;
let role            = null;      // 'developer' | 'designer' | 'analyst' | 'marketing' | 'general'
let questions       = [];      // string[5]
let scores          = [];      // number[]  (0–100 per answer)
let currentIndex    = 0;       // 0–4
let stressLevel     = 0;       // 0–100
let isProcessing    = false;   // guards against double-submit

// DOM references (resolved after DOMContentLoaded)

let dialogueBox     = null;    // <p> or element that shows the question
let answerInput     = null;    // <textarea> or <input>
let submitBtn       = null;    // submit answer button
let stressFill      = null;    // stress bar fill element
let stressLabel     = null;    // optional "Stress: 42%" text
let progressLabel   = null;    // optional "Question 2 / 5" text
let reactionBox     = null;    // element where AI reaction appears

// Init

document.addEventListener('DOMContentLoaded', async () => {
  // Resolve DOM nodes
  dialogueBox   = document.getElementById('dialogue-text');
  answerInput   = document.getElementById('answer-input');
  submitBtn     = document.getElementById('submit-answer-btn');
  stressFill    = document.getElementById('stress-fill');
  stressLabel   = document.getElementById('stress-label');
  progressLabel = document.getElementById('question-progress');
  reactionBox   = document.getElementById('reaction-box');

  // Load session data
  resumeText  = getFromStorage('resume');
  personality = getFromStorage('personality');
  role        = getFromStorage('role') ?? 'general';

  // Guard: if session data is missing, bounce back to upload
  if (!resumeText || !personality) {
    showToast('Session expired. Please start over.', 'warning');
    setTimeout(() => navigateTo('upload.html'), 1500);
    return;
  }

  // Display personality label if element exists
  const personalityLabel = document.getElementById('interviewer-name');
  if (personalityLabel) {
    personalityLabel.textContent = formatPersonality(personality);
  }

  // Load or generate questions
  const cached = getFromStorage('questions');

  if (Array.isArray(cached) && cached.length === 5) {
    questions = cached;
    startInterview();
  } else {
    await loadQuestions();
  }

  // Wire submit button
  if (submitBtn) {
    submitBtn.addEventListener('click', submitAnswer);
  }

  // Allow Enter (without Shift) in single-line inputs to submit
  if (answerInput && answerInput.tagName === 'INPUT') {
    answerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
});

// Question generation

async function loadQuestions() {
  showLoader('Preparing your interview questions...');

  try {
    const generated = await generateQuestions(resumeText, personality, role);

    if (!Array.isArray(generated) || generated.length === 0) {
      throw new Error('No questions returned from AI.');
    }

    questions = generated;
    saveToStorage('questions', questions);

    hideLoader();
    startInterview();

  } catch (err) {
    hideLoader();
    console.error('[MockMode] generateQuestions failed:', err);
    showToast('Could not load questions. Retrying in 3 seconds...', 'error');

    setTimeout(loadQuestions, 3000);
  }
}

// Interview flow

/**
 * Called once questions are ready. Sets up UI and asks Q1.
 */
function startInterview() {
  updateProgressLabel();
  updateStressMeter(0);
  askCurrentQuestion();
}

/**
 * Streams the current question into the dialogue box.
 */
async function askCurrentQuestion() {
  if (!dialogueBox) return;

  // Clear previous reaction
  clearReactionBox();

  // Reset answer input
  if (answerInput) {
    answerInput.value = '';
    answerInput.disabled = false;
    answerInput.focus();
  }
  if (submitBtn) submitBtn.disabled = false;

  const question = questions[currentIndex];

  // Stream the question text into the dialogue box character by character
  try {
    await streamInterviewerMessage(
      `Ask this interview question naturally, in character: "${question}"`,
      personality,
      dialogueBox,
      () => {
        // onDone: enable answer input
        if (answerInput) answerInput.disabled = false;
      }
    );
  } catch (err) {
    // Fallback: just set the text directly if streaming fails
    console.warn('[MockMode] Stream failed, using direct text:', err);
    if (dialogueBox) dialogueBox.textContent = question;
  }
}

// Answer submission

/**
 * Publicly callable (e.g. from HTML onclick="submitAnswer()").
 * Reads the answer, evaluates it via AI, updates UI, advances state.
 */
async function submitAnswer() {
  if (isProcessing) return; // prevent double-submit

  const answer = answerInput ? answerInput.value.trim() : '';

  if (!answer) {
    showToast('Type your answer before submitting!', 'warning');
    if (answerInput) answerInput.focus();
    return;
  }

  isProcessing = true;
  if (submitBtn) submitBtn.disabled = true;
  if (answerInput) answerInput.disabled = true;

  const question = questions[currentIndex];

  showLoader('Evaluating your answer...');

  try {
    const evaluation = await evaluateAnswer(question, answer, personality, role);

    if (!evaluation) throw new Error('Empty evaluation returned.');

    hideLoader();

    // Record score
    const score = Math.max(0, Math.min(100, evaluation.score ?? 50));
    scores.push(score);

    // Update stress meter
    const stressDelta = Math.max(1, Math.min(10, evaluation.stress_increase ?? 5));
    // Good answers lower stress slightly; bad answers raise it
    const stressChange = score >= 60 ? -(stressDelta * 0.5) : stressDelta;
    stressLevel = Math.max(0, Math.min(100, stressLevel + stressChange));
    updateStressMeter(stressLevel);

    // Show reaction
    showReaction(evaluation);

    // Advance or finish
    if (currentIndex < 4) {
      currentIndex++;
      updateProgressLabel();

      // Wait for candidate to read reaction, then move on
      setTimeout(() => {
        isProcessing = false;
        askCurrentQuestion();
      }, 3000);

    } else {
      // All 5 questions done
      await finishInterview();
    }

  } catch (err) {
    hideLoader();
    console.error('[MockMode] evaluateAnswer failed:', err);
    showToast('AI evaluation failed. Try submitting again.', 'error');
    isProcessing = false;
    if (submitBtn) submitBtn.disabled = false;
    if (answerInput) answerInput.disabled = false;
  }
}

// Reaction display

/**
 * Renders the AI reaction, emoji, and feedback into the reaction box.
 * @param {{ reaction: string, mood_emoji: string, feedback: string, score: number }} evaluation
 */
function showReaction(evaluation) {
  if (!reactionBox) return;

  const { reaction, mood_emoji, feedback, score } = evaluation;

  // Determine sentiment class based on score
  const sentiment = score >= 75 ? 'positive' : score >= 50 ? 'neutral' : 'negative';

  reactionBox.innerHTML = `
    <div class="reaction reaction--${sentiment}">
      <span class="reaction-emoji">${mood_emoji ?? '😐'}</span>
      <div class="reaction-content">
        <p class="reaction-text">${reaction ?? ''}</p>
        <p class="reaction-feedback">${feedback ?? ''}</p>
      </div>
    </div>
  `;

  reactionBox.classList.add('reaction--visible');
}

function clearReactionBox() {
  if (!reactionBox) return;
  reactionBox.innerHTML = '';
  reactionBox.classList.remove('reaction--visible');
}

// Stress meter

/**
 * Updates the visual stress bar and optional text label.
 * @param {number} level - 0–100
 */
function updateStressMeter(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));

  if (stressFill) {
    stressFill.style.width = `${clamped}%`;

    // Color shifts from green → yellow → red
    if (clamped < 40) {
      stressFill.style.background = 'var(--stress-low, #1aff7a)';
    } else if (clamped < 70) {
      stressFill.style.background = 'var(--stress-mid, #ffcc00)';
    } else {
      stressFill.style.background = 'var(--stress-high, #ff4444)';
    }
  }

  if (stressLabel) {
    stressLabel.textContent = `Stress: ${clamped}%`;
  }
}

// Progress label

function updateProgressLabel() {
  if (!progressLabel) return;
  progressLabel.textContent = `Question ${currentIndex + 1} / ${questions.length}`;
}

// Finish interview

/**
 * Called after the 5th answer is evaluated.
 * Persists scores, generates verdict, navigates to results.
 */
async function finishInterview() {
  saveToStorage('scores', scores);

  showLoader('Calculating your verdict...');

  try {
    const resumeAnalysis = getFromStorage('resume_analysis');

    if (!resumeAnalysis) throw new Error('Resume analysis not found in storage.');

    const verdict = await generateVerdict(scores, resumeAnalysis, personality, role);

    if (!verdict) throw new Error('Verdict generation returned empty.');

    saveToStorage('verdict', verdict);

    hideLoader();
    showToast('Interview complete! Revealing your verdict...', 'success');

    setTimeout(() => navigateTo('results.html'), 1200);

  } catch (err) {
    hideLoader();
    console.error('[MockMode] generateVerdict failed:', err);
    showToast('Could not generate verdict. Retrying...', 'error');

    isProcessing = false;
    setTimeout(finishInterview, 3000);
  }
}