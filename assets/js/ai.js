const AI_PROXY_URL = '/api/ai';

async function askAI(messages, provider = 'groq') {
  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, provider })
    });

    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data.content;

  } catch (error) {
    console.error('AI call failed:', error);
    throw error;
  }
}

function parseJSON(text) {
  try {
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('JSON parse failed:', e);
    return null;
  }
}

async function analyzeResume(resumeText) {
  const messages = [
    {
      role: 'system',
      content: `You are a brutally honest career coach. 
      Analyze the resume and return ONLY a JSON object with no extra text.
      Format: {
        "strengths": ["strength1", "strength2", "strength3"],
        "weaknesses": ["weakness1", "weakness2", "weakness3"],
        "score": 75,
        "summary": "one sentence summary",
        "suggested_role": "best fitting job title"
      }`
    },
    {
      role: 'user',
      content: `Analyze this resume: ${resumeText}`
    }
  ];

  const result = await askAI(messages);
  return parseJSON(result);
}

async function generateQuestions(resumeText, personality) {
  const personalityPrompts = {
    corporate: 'You are a strict, formal corporate hiring manager. Ask tough, professional questions.',
    startup: 'You are a chill startup founder. Ask casual questions focused on passion and culture fit.',
    technical: 'You are a tough technical lead. Ask specific technical questions based on their stack.'
  };

  const messages = [
    {
      role: 'system',
      content: `${personalityPrompts[personality]}
      Generate exactly 5 interview questions based on the resume.
      Return ONLY a JSON array of 5 strings, no extra text.
      Format: ["question1", "question2", "question3", "question4", "question5"]`
    },
    {
      role: 'user',
      content: `Resume: ${resumeText}`
    }
  ];

  const result = await askAI(messages);
  return parseJSON(result);
}

async function evaluateAnswer(question, answer, personality) {
  const personalityPrompts = {
    corporate: 'You are a strict formal corporate hiring manager. React professionally but coldly to weak answers.',
    startup: 'You are a chill startup founder. React warmly but honestly.',
    technical: 'You are a tough technical lead. React skeptically to vague answers.'
  };

  const messages = [
    {
      role: 'system',
      content: `${personalityPrompts[personality]}
      Evaluate this interview answer and return ONLY a JSON object with no extra text.
      Format: {
        "reaction": "your in-character reaction to the answer",
        "score": 75,
        "feedback": "one sentence of honest feedback",
        "mood_emoji": "😐",
        "stress_increase": 5
      }
      score is 0-100, stress_increase is 1-10`
    },
    {
      role: 'user',
      content: `Question: ${question}\nAnswer: ${answer}`
    }
  ];

  const result = await askAI(messages);
  return parseJSON(result);
}

async function generateVerdict(scores, resumeAnalysis, personality) {
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  let verdict;

  if (average >= 75) verdict = 'HIRED';
  else if (average >= 50) verdict = 'WAITLISTED';
  else verdict = 'FIRED';

  const messages = [
    {
      role: 'system',
      content: `You are the interviewer. Give a final verdict message in character.
      Return ONLY a JSON object with no extra text.
      Format: {
        "verdict": "${verdict}",
        "verdict_message": "2-3 sentence in-character final message to the candidate",
        "final_tip": "one specific actionable tip to improve"
      }`
    },
    {
      role: 'user',
      content: `Average score: ${average}. 
      Resume strengths: ${resumeAnalysis.strengths.join(', ')}.
      Resume weaknesses: ${resumeAnalysis.weaknesses.join(', ')}.
      Individual scores: ${scores.join(', ')}.`
    }
  ];

  const result = await askAI(messages);
  const parsed = parseJSON(result);
  parsed.average = Math.round(average);
  parsed.scores = scores;
  return parsed;
}