// popup/popup.js - Job Appier Chrome Extension
// Uses Chrome Built-in AI APIs: 
// - Summarizer API: Job description summarization
// - Writer API: Cover letter generation  
// - Proofreader API: Grammar and spelling correction
// - Rewriter API: Tone and length adjustment
// - Prompt API: Resume parsing and field content generation

// ========== UTILITY FUNCTIONS ==========
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function log(msg, isError = false) {
  const logsEl = document.getElementById('logs');
  if (!logsEl) return;
  const timestamp = new Date().toLocaleTimeString();
  const prefix = isError ? '❌' : '✓';
  logsEl.innerText = `${prefix} [${timestamp}] ${msg}\n` + logsEl.innerText;
}

function updateStatus(msg, type = 'normal') {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.innerText = msg;
    // Red color for error/warning messages
    if (type === 'error') {
      statusEl.style.color = '#dc3545';
      statusEl.style.background = '#fee';
    } else {
      statusEl.style.color = '#10b981';
      statusEl.style.background = 'white';
    }
  }
}

// ========== CHROME AI API WRAPPERS ==========

// Cache for AI sessions to avoid recreating them
let summarizerSession = null;
let writerSession = null;
let proofreaderSession = null;
let promptSession = null;
let rewriterSession = null;

/**
 * Summarizer API - Summarize job descriptions
 * https://developer.chrome.com/docs/ai/summarizer-api
 */
async function summarizeText(text) {
  try {
    // Check if Summarizer API is available
    if (!('Summarizer' in self)) {
      log('Summarizer API not supported in this browser', true);
      const lines = text.split('\n').filter(l => l.trim()).slice(0, 10);
      return `Key points:\n${lines.join('\n').substring(0, 500)}...`;
    }
    
    // Reuse existing session or create new one
    if (!summarizerSession) {
      const availability = await Summarizer.availability();
      if (availability === 'unavailable') {
        log('Summarizer API unavailable', true);
        const lines = text.split('\n').filter(l => l.trim()).slice(0, 10);
        return `Key points:\n${lines.join('\n').substring(0, 500)}...`;
      }
      
      if (availability === 'downloadable') {
        log('⏬ Downloading AI model (one-time, ~2GB)...', false);
      } else {
        log('⚡ Loading AI model from cache...', false);
      }
      
      summarizerSession = await Summarizer.create({
        type: 'key-points',
        format: 'plain-text', // Changed from markdown for faster generation
        length: 'short', // Changed from medium for speed
        outputLanguage: 'en',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            log(`Download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });
      log('✓ Summarizer ready');
    } else {
      log('⚡ Using cached session (instant)');
    }
    
    const summary = await summarizerSession.summarize(text, {
      context: 'Extract key requirements, skills, and qualifications from this job posting.'
    });
    log('Job description summarized successfully');
    return summary;
  } catch (error) {
    log(`Summarizer error: ${error.message}`, true);
    // Reset session on error
    if (summarizerSession) {
      try { summarizerSession.destroy(); } catch (e) {}
      summarizerSession = null;
    }
    // Fallback: extract first 10 lines
    const lines = text.split('\n').filter(l => l.trim()).slice(0, 10);
    return `Key points:\n${lines.join('\n').substring(0, 500)}...`;
  }
}

/**
 * Writer API - Generate cover letters
 * https://developer.chrome.com/docs/ai/writer-api
 */
async function generateCoverLetter(jobSummary, resumeText, tone = 'formal') {
  try {
    // Check if Writer API is available
    if (!('Writer' in self)) {
      log('Writer API not supported in this browser', true);
      return generateFallbackCoverLetter(resumeText);
    }
    
    // Reuse existing session or create new one with matching tone
    if (!writerSession) {
      const availability = await Writer.availability();
      if (availability === 'unavailable') {
        log('Writer API unavailable', true);
        return generateFallbackCoverLetter(resumeText);
      }
      
      if (availability === 'downloadable') {
        log('⏬ Downloading AI model (one-time, ~2GB)...', false);
      } else {
        log('⚡ Loading AI model from cache...', false);
      }
      
      writerSession = await Writer.create({
        tone: tone,
        length: 'short', // Changed from medium for faster generation
        format: 'plain-text',
        outputLanguage: 'en',
        sharedContext: 'You are a professional cover letter writer. Write concise, compelling cover letters.',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            log(`Download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });
      log('✓ Writer ready');
    } else {
      log('⚡ Using cached session (instant)');
    }
    
    // Optimized shorter prompt for faster generation
    const prompt = `Write a professional cover letter (3-4 paragraphs) for this job.\n\nJob: ${jobSummary.substring(0, 500)}\n\nCandidate: ${resumeText.substring(0, 800)}\n\nBe specific and highlight relevant skills.`;
    
    const coverLetter = await writerSession.write(prompt, {
      context: 'The candidate is applying for a job and needs to demonstrate how their background matches the job requirements.'
    });
    
    log('Cover letter generated successfully');
    return coverLetter;
  } catch (error) {
    log(`Writer error: ${error.message}`, true);
    // Reset session on error
    if (writerSession) {
      try { writerSession.destroy(); } catch (e) {}
      writerSession = null;
    }
    return generateFallbackCoverLetter(resumeText);
  }
}

function generateFallbackCoverLetter(resumeText) {
  return `Dear Hiring Manager,

I am writing to express my strong interest in this position. After carefully reviewing the job description, I believe my background and skills make me an excellent fit for this role.

${resumeText.substring(0, 300)}...

I am excited about the opportunity to contribute to your team and would welcome the chance to discuss how my experience aligns with your needs.

Thank you for your consideration.

Sincerely,
[Your Name]`;
}

/**
 * Proofreader API - Check grammar and spelling
 * https://developer.chrome.com/docs/ai/proofreader-api
 */
async function proofreadText(text) {
  try {
    if (!('Proofreader' in self)) {
      log('Proofreader API not supported in this browser', true);
      return { corrected: text, corrections: [] };
    }
    
    const availability = await Proofreader.availability();
    if (availability === 'unavailable') {
      log('Proofreader API unavailable', true);
      return { corrected: text, corrections: [] };
    }
    
    if (availability === 'downloadable') {
      log('Model will be downloaded...', false);
    }
    
    const proofreader = await Proofreader.create({
      expectedInputLanguages: ['en'],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          log(`Downloading model: ${Math.round(e.loaded * 100)}%`);
        });
      }
    });
    
    const result = await proofreader.proofread(text);
    proofreader.destroy();
    
    if (result.corrections && result.corrections.length > 0) {
      log(`Found ${result.corrections.length} correction(s)`);
    } else {
      log('No corrections needed');
    }
    
    return result;
  } catch (error) {
    log(`Proofreader error: ${error.message}`, true);
    return { corrected: text, corrections: [] };
  }
}

/**
 * Prompt API - AI-powered resume parsing and field generation
 * https://developer.chrome.com/docs/ai/prompt-api
 */
async function aiPrompt(prompt, systemPrompt = '') {
  try {
    // Use window.LanguageModel as per Chrome docs
    if (!('LanguageModel' in window)) {
      log('Prompt API not supported', true);
      return null;
    }
    
    const availability = await window.LanguageModel.availability();
    if (availability === 'unavailable') {
      log('Prompt API unavailable', true);
      return null;
    }
    
    // Reuse existing session or create new one
    if (!promptSession) {
      if (availability === 'downloadable' || availability === 'downloading') {
        log('⏬ Downloading Prompt API model...', false);
      } else {
        log('⚡ Loading Prompt API...', false);
      }
      
      promptSession = await window.LanguageModel.create({
        initialPrompts: systemPrompt ? [
          { role: 'system', content: systemPrompt }
        ] : [],
        expectedInputs: [
          { type: 'text', languages: ['en'] }
        ],
        expectedOutputs: [
          { type: 'text', languages: ['en'] }
        ],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            log(`Download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });
      log('✓ Prompt API ready');
    }
    
    const response = await promptSession.prompt(prompt);
    return response;
  } catch (error) {
    log(`Prompt API error: ${error.message}`, true);
    return null;
  }
}

/**
 * AI-Powered Resume Parser using Prompt API
 */
async function aiParseResume(resumeText) {
  const prompt = `Extract structured data from this resume. Return ONLY a valid JSON object with these exact fields:
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "linkedin": "LinkedIn URL",
  "github": "GitHub URL", 
  "website": "portfolio/website URL",
  "location": "City, State",
  "skills": ["skill1", "skill2"],
  "summary": "brief professional summary"
}

If a field is not found, use null. Return ONLY the JSON, no other text.

Resume:
${resumeText.substring(0, 3000)}`;

  try {
    const response = await aiPrompt(prompt);
    if (!response) return null;
    // Try to extract the largest JSON block
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Try to repair common issues: remove trailing commas, fix smart quotes
        let repaired = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
        try { parsed = JSON.parse(repaired); } catch (e2) { parsed = null; }
      }
    }
    if (!parsed) {
      log('❌ No valid JSON found or parse error in AI response', true);
      log('Raw AI output for debugging:', response, true);
      return null;
    }
    log('✓ AI parsed resume successfully');
    return parsed;
  } catch (error) {
    log(`AI resume parsing failed: ${error.message}`, true);
    return null;
  }
}

/**
 * Rewriter API - Adjust text length and tone
 * https://developer.chrome.com/docs/ai/rewriter-api
 */
async function rewriteText(text, tone = 'as-is', length = 'as-is') {
  try {
    if (!('Rewriter' in self)) {
      log('Rewriter API not supported', true);
      return text;
    }
    
    const availability = await Rewriter.availability();
    if (availability === 'unavailable') {
      return text;
    }
    
    if (!rewriterSession) {
      if (availability === 'downloadable') {
        log('⏬ Downloading Rewriter model...', false);
      }
      
      rewriterSession = await Rewriter.create({
        tone: tone, // 'as-is', 'more-formal', 'more-casual'
        length: length, // 'as-is', 'shorter', 'longer'
        outputLanguage: 'en',
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            log(`Download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });
      log('✓ Rewriter ready');
    }
    
    const rewritten = await rewriterSession.rewrite(text);
    return rewritten;
  } catch (error) {
    log(`Rewriter error: ${error.message}`, true);
    return text;
  }
}


// ========== RESUME STORAGE ==========
let resumeData = {
  text: '',
  parsed: null
};

// Parse resume to extract structured data
async function parseResume(text) {
  // Try AI parsing first (Prompt API)
  log('🤖 Using AI to parse resume...');
  const aiParsed = await aiParseResume(text);
  
  if (aiParsed && aiParsed.email) {
    log('✓ AI parsing successful!');
    aiParsed.raw = text;
    return aiParsed;
  }
  
  // Fallback to regex parsing
  log('Using regex fallback for resume parsing');
  const parsed = {
    raw: text,
    name: null,
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    website: null,
    location: null,
    experience: [],
    education: [],
    skills: [],
    summary: null
  };
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Extract email
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  if (emailMatch) parsed.email = emailMatch[1];
  
  // Extract phone
  const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
  if (phoneMatch) parsed.phone = phoneMatch[1].trim();
  
  // Extract LinkedIn
  const linkedinMatch = text.match(/(linkedin\.com\/in\/[a-zA-Z0-9\-]+)/i);
  if (linkedinMatch) parsed.linkedin = 'https://' + linkedinMatch[1];
  
  // Extract GitHub
  const githubMatch = text.match(/(github\.com\/[a-zA-Z0-9\-]+)/i);
  if (githubMatch) parsed.github = 'https://' + githubMatch[1];
  
  // Extract website/portfolio
  const websiteMatch = text.match(/((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/);
  if (websiteMatch && !websiteMatch[1].includes('linkedin') && !websiteMatch[1].includes('github')) {
    parsed.website = websiteMatch[1];
  }
  
  // Extract name (usually first line or before contact info)
  if (lines.length > 0) {
    // Try first line that's not an email/phone
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length > 3 && line.length < 50 && 
          !line.includes('@') && !line.match(/\d{3}/)) {
        parsed.name = line;
        break;
      }
    }
  }
  
  // Extract location (look for city, state patterns)
  const locationMatch = text.match(/([A-Z][a-z]+,\s*[A-Z]{2})/);
  if (locationMatch) parsed.location = locationMatch[1];
  
  // Extract skills (common section headers)
  const skillsSection = text.match(/(?:SKILLS|Technical Skills|Technologies)[\s:]+([^\n]+(?:\n[^\n]+)*?)(?:\n\n|EXPERIENCE|EDUCATION|$)/i);
  if (skillsSection) {
    parsed.skills = skillsSection[1].split(/[,;|\n]/).map(s => s.trim()).filter(s => s.length > 0);
  }
  
  console.log('Parsed resume (regex):', parsed);
  return parsed;
}

// LEGACY RESUME FUNCTIONS - NO LONGER USED (Profile page handles resume now)
// Kept for reference but not called anywhere
/*
async function loadSavedResume() {
  try {
    const result = await chrome.storage.local.get(['savedResume']);
    if (result.savedResume) {
      resumeData.text = result.savedResume;
      
      // Try AI parsing, but don't let it block the UI
      try {
        resumeData.parsed = await parseResume(result.savedResume);
      } catch (parseError) {
        console.error('Resume parsing failed:', parseError);
        // Continue without parsed data
        resumeData.parsed = null;
      }
      
      const resumePaste = document.getElementById('resumePaste');
      const resumeStatus = document.getElementById('resumeStatus');
      const deleteResumeBtn = document.getElementById('deleteResumeBtn');
      const autofillBtn = document.getElementById('autofillBtn');
      
      if (resumePaste) resumePaste.value = result.savedResume;
      if (resumeStatus) resumeStatus.textContent = '✓ Resume loaded from storage';
      if (deleteResumeBtn) deleteResumeBtn.style.display = 'inline-block';
      if (autofillBtn) autofillBtn.disabled = false; // Enable auto-fill
      
      log('Resume loaded');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to load saved resume:', error);
    return false;
  }
}

async function saveResume(text) {
  await chrome.storage.local.set({ savedResume: text });
  log('Resume saved to storage');
}

async function deleteResume() {
  await chrome.storage.local.remove(['savedResume']);
  resumeData.text = '';
  resumeData.parsed = null;
  
  const resumePaste = document.getElementById('resumePaste');
  const resumeStatus = document.getElementById('resumeStatus');
  const deleteResumeBtn = document.getElementById('deleteResumeBtn');
  
  if (resumePaste) resumePaste.value = '';
  if (resumeStatus) resumeStatus.textContent = '';
  if (deleteResumeBtn) deleteResumeBtn.style.display = 'none';
  
  log('Resume deleted');
  updateStatus('Resume deleted. Paste a new one to continue.');
}
*/
// END LEGACY RESUME FUNCTIONS


/**
 * AI-Powered Field Content Generator
 * Uses Prompt API to generate appropriate content for any field
 */
async function aiGenerateFieldContent(fieldInfo, resumeData, jobDescription = '') {
  const { label, placeholder, name, type, maxLength, options = [], section = '' } = fieldInfo;
  
  // Build comprehensive resume context
  let resumeContext = '';
  if (resumeData) {
    if (typeof resumeData === 'object') {
      // If it's parsed data
      resumeContext = `
Name: ${resumeData.name || 'N/A'}
Email: ${resumeData.email || 'N/A'}
Phone: ${resumeData.phone || 'N/A'}
Location: ${resumeData.location || 'N/A'}
Summary: ${resumeData.summary || 'N/A'}
Skills: ${Array.isArray(resumeData.skills) ? resumeData.skills.join(', ') : (resumeData.skills || 'N/A')}
LinkedIn: ${resumeData.linkedin || 'N/A'}
GitHub: ${resumeData.github || 'N/A'}
Website: ${resumeData.website || 'N/A'}
${resumeData.raw ? '\nFull Resume:\n' + resumeData.raw.substring(0, 1500) : ''}
`;
    } else if (typeof resumeData === 'string') {
      // If it's raw text
      resumeContext = resumeData.substring(0, 2000);
    }
  }
  
  const fieldContext = [
    label ? `Label: "${label}"` : '',
    placeholder ? `Placeholder: "${placeholder}"` : '',
    name ? `Name: "${name}"` : '',
    section ? `Section: "${section}"` : ''
  ].filter(Boolean).join(' | ');
  
  const prompt = `Fill out this job application field with appropriate information from the resume.

FIELD CONTEXT:
${fieldContext}
${maxLength > 0 ? `Maximum length: ${maxLength} characters` : ''}
${options && options.length ? `Options (choose EXACT text from one of these if a dropdown):\n- ${options.slice(0,50).join('\n- ')}` : ''}

RESUME INFORMATION:
${resumeContext}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription.substring(0, 800)}\n` : ''}

Instructions:
- Write appropriate content for this specific field based on the resume
- Be professional and concise
- Match the expected format (based on field context)
- DO NOT include quotes, labels, or explanations
- Return ONLY the actual text to fill in the field
${maxLength > 0 ? `- Must be under ${maxLength} characters` : '- Keep under 300 characters unless it\'s clearly a long-form field'}
${options && options.length ? '\n- If options are provided, return EXACTLY the option text that best matches (no extra words)' : ''}

Your response (text only):`;

  try {
    const response = await aiPrompt(prompt, 'You are a professional resume assistant helping fill job applications accurately and concisely.');
    if (response) {
      // Clean up response - remove quotes, trim whitespace
      let cleaned = response.trim();
      cleaned = cleaned.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
      cleaned = cleaned.replace(/^Response:\s*/i, ''); // Remove "Response:" prefix
      
      // Respect maxLength strictly
      if (maxLength > 0 && cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength - 3) + '...';
      }
      
      log(`✓ AI generated: "${cleaned.substring(0, 50)}..."`);
      return cleaned;
    }
    return null;
  } catch (error) {
    log(`AI field generation failed: ${error.message}`, true);
    return null;
  }
}

// ========== FORM AUTO-FILL ==========
async function autofillForm() {
  try {
    const tab = await getActiveTab();
    const coverLetterText = document.getElementById('coverLetter').value;
    const jobDescText = document.getElementById('jobDesc').value;
    
    // Try to load profile data first
    let profileData = null;
    try {
      const result = await chrome.storage.local.get(['userProfile']);
      if (result.userProfile) {
        profileData = result.userProfile;
        log('✓ Using profile data for auto-fill');
      }
    } catch (e) {
      console.log('No profile data found');
    }
    
    // Fallback to resume if no profile
    const resumeText = resumeData.text;
    const resumeParsed = resumeData.parsed;
    
    if (!profileData && !resumeText) {
      log('⚠️ No profile or resume data to auto-fill', true);
      updateStatus('Please set up your profile or paste your resume first!', 'error');
      return;
    }
    
    log('Starting AI-powered auto-fill...');
    
    // Inject the content script first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_script.js']
      });
      log('Content script injected for auto-fill');
    } catch (e) {
      console.log('Content script injection:', e.message);
    }
    
    // Small delay to let script initialize
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Send autofill message with profile data or resume data
    chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_FORM',
      data: {
        profile: profileData, // NEW: Profile data
        resumeText: resumeText,
        resumeParsed: resumeParsed,
        coverLetter: coverLetterText || null,
        jobDescription: jobDescText || null
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        log('⚠️ Autofill failed: ' + chrome.runtime.lastError.message, true);
        updateStatus('⚠️ Autofill failed. Make sure you are on a job application page.');
      } else if (response && response.filled) {
        log(`✓ Auto-filled ${response.filledCount || 0} field(s) successfully!`);
        updateStatus(`✓ Auto-filled ${response.filledCount} fields! Review and submit.`);
      } else {
        log('⚠️ Autofill completed but no fields were filled', true);
        updateStatus('No fillable fields found on this page.');
      }
    });
  } catch (error) {
    log('Autofill error: ' + error.message, true);
    updateStatus('Autofill failed: ' + error.message);
  }
}

// ========== TEXT EXPORT ==========
async function exportAsText() {
  const jobSummary = document.getElementById('jobSummary').value;
  const coverLetter = document.getElementById('coverLetter').value;
  
  const content = `JOB APPLICATION MATERIALS
========================

JOB SUMMARY:
${jobSummary}

========================

COVER LETTER:
${coverLetter}

========================
Generated by Job Appier
${new Date().toLocaleString()}
`;
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-application-${Date.now()}.txt`;
  a.click();
  
  URL.revokeObjectURL(url);
  log('Application materials exported as TXT');
}

// ========== MESSAGE HANDLER FOR AI REQUESTS ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AI_GENERATE_FIELD_CONTENT') {
    // Content script requests AI to generate content for a field
    const { fieldInfo, resumeData, jobDescription } = message.data;
    
    aiGenerateFieldContent(fieldInfo, resumeData, jobDescription)
      .then(content => {
        sendResponse({ content });
      })
      .catch(error => {
        console.error('AI generation error:', error);
        sendResponse({ content: null, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🚀 Popup DOMContentLoaded event fired');
    
    console.log('📋 Getting DOM elements...');
    const readJobBtn = document.getElementById('readJobBtn');
    const clearJobBtn = document.getElementById('clearJobBtn');
    const jobDescInput = document.getElementById('jobDesc');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const jobSummaryEl = document.getElementById('jobSummary');
    const coverBtn = document.getElementById('coverBtn');
    const coverLetterEl = document.getElementById('coverLetter');
    const toneSelect = document.getElementById('toneSelect');
    const autofillBtn = document.getElementById('autofillBtn');
    const proofreadBtn = document.getElementById('proofreadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const openProfileBtn = document.getElementById('openProfileBtn');
    
    console.log('🔍 openProfileBtn element:', openProfileBtn);
    
    // Open Profile Page
    if (openProfileBtn) {
      console.log('✅ Setting up profile button click handler');
      openProfileBtn.addEventListener('click', () => {
        console.log('🖱️ Profile button clicked!');
        log('Opening profile page...');
        const profileUrl = chrome.runtime.getURL('profile/profile.html');
        console.log('📍 Profile URL:', profileUrl);
        chrome.tabs.create({ url: profileUrl })
          .then(tab => {
            console.log('✅ Profile page opened in tab:', tab.id);
            log('Profile page opened');
          })
          .catch(error => {
            console.error('❌ Failed to open profile:', error);
            log('Failed to open profile: ' + error.message, true);
          });
      });
    } else {
      console.error('❌ openProfileBtn element not found!');
    }
  
  // Auto-fill is always enabled (uses profile data)
  
  // Read job from page
  readJobBtn.addEventListener('click', async () => {
    updateStatus('Reading job description from page...');
    
    try {
      const tab = await getActiveTab();
      
      // First, inject the content script if it's not already there
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_script.js']
        });
      } catch (e) {
        // Content script might already be injected, that's OK
        console.log('Content script injection:', e.message);
      }
      
      // Small delay to let script initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now try to get the job text
      chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_TEXT' }, (response) => {
        if (chrome.runtime.lastError) {
          log('Failed to read page: ' + chrome.runtime.lastError.message, true);
          updateStatus('Failed to read page. Try copying job description manually.');
          return;
        }
        
        if (response && response.text && response.text.length > 50) {
          jobDescInput.value = response.text;
          log('Job description extracted from page');
          updateStatus('Job description loaded!');
          
          // Enable summarize and cover letter buttons
          summarizeBtn.disabled = false;
          coverBtn.disabled = false;
        } else {
          updateStatus('No job description found on page. Paste it manually.');
          log('No job text detected on this page', true);
        }
      });
    } catch (error) {
      log('Error reading page: ' + error.message, true);
      updateStatus('Failed to read page. Try copying job description manually.');
    }
  });
  
  // Clear job
  clearJobBtn.addEventListener('click', () => {
    jobDescInput.value = '';
    jobSummaryEl.value = '';
    coverLetterEl.value = '';
    summarizeBtn.disabled = true;
    coverBtn.disabled = true;
    copyBtn.disabled = true;
    exportBtn.disabled = true;
    updateStatus('Cleared. Add job description to begin.');
  });
  
  // Job input
  jobDescInput.addEventListener('input', () => {
    if (jobDescInput.value) {
      summarizeBtn.disabled = false;
      coverBtn.disabled = false;
    }
  });
  
  // Summarize
  summarizeBtn.addEventListener('click', async () => {
    console.log('Summarize button clicked');
    const jobText = jobDescInput.value;
    console.log('Job text length:', jobText.length);
    
    if (!jobText) {
      alert('Please paste or detect a job description first.');
      return;
    }
    
    try {
      updateStatus('Summarizing job description...');
      summarizeBtn.disabled = true;
      summarizeBtn.classList.add('btn-loading');
      log('Starting summarization...');
      
      const summary = await summarizeText(jobText);
      console.log('Summary received:', summary.substring(0, 100));
      jobSummaryEl.value = summary;
      
      updateStatus('Job summarized!');
      exportBtn.disabled = false;
    } catch (error) {
      console.error('Summarization error:', error);
      updateStatus('Summarization failed');
      log(`Summarization error: ${error.message}`, true);
    } finally {
      summarizeBtn.disabled = false;
      summarizeBtn.classList.remove('btn-loading');
    }
  });
  
  // Generate cover letter
  coverBtn.addEventListener('click', async () => {
    console.log('Cover letter button clicked');
    const jobText = jobDescInput.value;
    
    if (!jobText) {
      alert('Please paste or detect a job description first.');
      return;
    }
    
    try {
      updateStatus('Loading profile data...');
      
      // Load profile data from storage
      const result = await chrome.storage.local.get(['userProfile']);
      if (!result.userProfile) {
        alert('No profile found. Please set up your profile first by clicking "Profile".');
        return;
      }
      
      const profile = result.userProfile;
      
      // Build resume text from profile data
      let resumeText = `${profile.firstName} ${profile.lastName}\n`;
      if (profile.email) resumeText += `Email: ${profile.email}\n`;
      if (profile.phone) resumeText += `Phone: ${profile.phone}\n`;
      if (profile.linkedin) resumeText += `LinkedIn: ${profile.linkedin}\n`;
      
      if (profile.summary) {
        resumeText += `\nProfessional Summary:\n${profile.summary}\n`;
      }
      
      if (profile.workExperience && profile.workExperience.length > 0) {
        resumeText += `\nWork Experience:\n`;
        profile.workExperience.forEach(exp => {
          resumeText += `${exp.title} at ${exp.company} (${exp.startDate} - ${exp.endDate})\n`;
          if (exp.description) resumeText += `${exp.description}\n`;
        });
      }
      
      if (profile.education && profile.education.length > 0) {
        resumeText += `\nEducation:\n`;
        profile.education.forEach(edu => {
          resumeText += `${edu.degree} in ${edu.field} from ${edu.institution}\n`;
        });
      }
      
      if (profile.skills) {
        resumeText += `\nSkills: ${profile.skills}\n`;
      }
      
      console.log('Resume text built from profile, length:', resumeText.length);
      
      updateStatus('Generating cover letter...');
      coverBtn.disabled = true;
      coverBtn.classList.add('btn-loading');
      log('Starting cover letter generation from profile data...');
      
      let summary = jobSummaryEl.value;
      if (!summary) {
        log('No summary found, generating one first...');
        summary = await summarizeText(jobText);
        jobSummaryEl.value = summary;
      }
      
      const tone = toneSelect.value;
      console.log('Using tone:', tone);
      const coverLetter = await generateCoverLetter(summary, resumeText, tone);
      console.log('Cover letter received:', coverLetter.substring(0, 100));
      coverLetterEl.value = coverLetter;
      
      updateStatus('Cover letter generated!');
      
      if (proofreadBtn) proofreadBtn.disabled = false;
      copyBtn.disabled = false;
      exportBtn.disabled = false;
    } catch (error) {
      console.error('Cover letter error:', error);
      updateStatus('Cover letter generation failed');
      log(`Cover letter error: ${error.message}`, true);
    } finally {
      coverBtn.disabled = false;
      coverBtn.classList.remove('btn-loading');
    }
  });
  
  // Proofread handler
  if (proofreadBtn) {
    proofreadBtn.addEventListener('click', async () => {
      const text = coverLetterEl.value;
      if (!text) return;
      
      try {
        updateStatus('Proofreading...');
        proofreadBtn.disabled = true;
        
        const result = await proofreadText(text);
        coverLetterEl.value = result.corrected || result.correctedText || text;
        
        updateStatus('Proofreading complete!');
      } catch (error) {
        updateStatus('Proofreading failed');
        log(`Proofread error: ${error.message}`, true);
      } finally {
        proofreadBtn.disabled = false;
      }
    });
  }
  
  // Copy handler
  copyBtn.addEventListener('click', async () => {
    const text = coverLetterEl.value;
    if (!text) return;
    
    try {
      await navigator.clipboard.writeText(text);
      log('Cover letter copied to clipboard');
      updateStatus('Cover letter copied!');
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
    } catch (error) {
      log('Copy failed: ' + error.message, true);
    }
  });
  
  // Autofill handler
  autofillBtn.addEventListener('click', async () => {
    updateStatus('Auto-filling form...');
    await autofillForm();
  });
  
  // Export handler
  exportBtn.addEventListener('click', async () => {
    updateStatus('Exporting...');
    await exportAsText();
    updateStatus('Export complete!');
  });
  
  log('Job Appier initialized');
  updateStatus('Ready! Paste your resume to begin.');
  
  } catch (error) {
    console.error('❌ Popup initialization error:', error);
    updateStatus('Error initializing popup. Please reload.');
  }
});
