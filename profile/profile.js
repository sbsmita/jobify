// Profile Management Script
// Uses Chrome Built-in AI APIs:
// - Prompt API: Resume parsing and structured data extraction

// Profile data structure
let profileData = {
  // Basic Info
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  phoneCountry: '',
  
  // Location
  address: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
  
  // Demographics
  gender: '',
  disability: '',
  veteran: '',
  ethnicity: '',
  
  // Social Links
  linkedin: '',
  github: '',
  portfolio: '',
  twitter: '',
  
  // Work Experience (array)
  workExperience: [],
  
  // Education (array)
  education: [],
  
  // Projects (array)
  projects: [],
  
  // Skills
  skills: '',
  
  // Summary
  summary: '',
  
  // Work Authorization
  workAuthorization: 'Authorized',
  sponsorshipRequired: 'No',
  
  // Resume PDF (stored as base64)
  resumePdfBase64: null,
  resumePdfName: null
};

// AI Session cache
let promptSession = null;

// Save debouncing
let saveTimeout = null;
function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveProfile();
  }, 500); // 500ms debounce
}

// Utility Functions
function log(message, type = 'info') {
  const logsEl = document.getElementById('logs');
  if (!logsEl) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  const entry = document.createElement('div');
  entry.textContent = `${icon} [${timestamp}] ${message}`;
  entry.style.marginBottom = '5px';
  entry.style.color = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#333';
  
  logsEl.insertBefore(entry, logsEl.firstChild);
}

function showStatus(message, type = 'success') {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// AI-Powered Resume Parsing using Prompt API
async function parseResumeWithAI(resumeText) {
  try {
    log('🤖 Starting AI resume parsing with Prompt API...');
    
    // Check if Prompt API is available (using LanguageModel as per docs)
    if (!('LanguageModel' in window)) {
      log('❌ LanguageModel API not available in this context');
      throw new Error('Prompt API not available. Please fill form manually.');
    }
    
    const availability = await window.LanguageModel.availability();
    log(`Prompt API availability: ${availability}`);
    
    if (availability === 'unavailable') {
      log('❌ Prompt API unavailable');
      throw new Error('Prompt API not available');
    }
    
    // Create AI session with output language specified
    if (!promptSession) {
      if (availability === 'downloadable' || availability === 'downloading') {
        showStatus('⏬ Downloading AI model... Please wait.', 'info');
        log('⏬ Downloading Prompt API model...');
      } else {
        log('⚡ Loading Prompt API...');
      }
      
      promptSession = await window.LanguageModel.create({
        temperature: 0.3,  // Lower = faster, more focused responses
        topK: 3,           // Fewer token candidates = faster processing
        expectedInputs: [
          { type: 'text', languages: ['en'] }
        ],
        expectedOutputs: [
          { type: 'text', languages: ['en'] }
        ],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const percent = Math.round(e.loaded * 100);
            log(`Download progress: ${percent}%`);
            showStatus(`⏬ Downloading AI model: ${percent}%`, 'info');
          });
        }
      });
      log('✓ Prompt API ready with optimized settings');
    }
    
    // Optimized prompt - concise but comprehensive
    const prompt = `Parse this resume and return ONLY valid JSON. Extract ALL work experiences, ALL education entries, and ALL projects.

JSON format:
{"firstName":"","lastName":"","email":"","phone":"","address":"","city":"","state":"","postalCode":"","country":"","linkedin":"","github":"","portfolio":"","skills":"","summary":"","workExperience":[{"company":"","title":"","startDate":"MM/YYYY","endDate":"MM/YYYY","description":""}],"education":[{"institution":"","degree":"","field":"","graduationDate":"MM/YYYY","gpa":""}],"projects":[{"name":"","description":"","technologies":"","url":""}]}

Resume:
${resumeText}`;

    log('Sending FULL resume to AI for parsing (optimized prompt)...');
    const response = await promptSession.prompt(prompt);
    log('AI Response received:', response.substring(0, 500) + '...');
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log('❌ No JSON found in AI response', 'error');
      throw new Error('AI did not return valid JSON');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    log('✅ AI parsing completed successfully!');
    log(`Parsed data: ${parsed.workExperience?.length || 0} work experiences, ${parsed.education?.length || 0} education entries, ${parsed.projects?.length || 0} projects`);
    
    return parsed;
    
  } catch (error) {
    log(`❌ AI parsing error: ${error.message}`, 'error');
    throw error;
  }
}

// Save profile to Chrome storage
async function saveProfile() {
  try {
    // Collect data from form (static fields only)
    profileData.firstName = document.getElementById('firstName').value.trim();
    profileData.lastName = document.getElementById('lastName').value.trim();
    profileData.email = document.getElementById('email').value.trim();
    profileData.phoneCountry = document.getElementById('phoneCountry').value;
    profileData.phone = document.getElementById('phone').value.trim();
    
    profileData.address = document.getElementById('address').value.trim();
    profileData.city = document.getElementById('city').value.trim();
    profileData.state = document.getElementById('state').value.trim();
    profileData.postalCode = document.getElementById('postalCode').value.trim();
    profileData.country = document.getElementById('country').value.trim();
    
    profileData.gender = document.getElementById('gender').value;
    profileData.disability = document.getElementById('disability').value;
    profileData.veteran = document.getElementById('veteran').value;
    profileData.ethnicity = document.getElementById('ethnicity').value;
    
    profileData.linkedin = document.getElementById('linkedin').value.trim();
    profileData.github = document.getElementById('github').value.trim();
    profileData.portfolio = document.getElementById('portfolio').value.trim();
    profileData.twitter = document.getElementById('twitter').value.trim();
    
    profileData.skills = document.getElementById('skills').value.trim();
    profileData.summary = document.getElementById('summary').value.trim();
    
    profileData.workAuthorization = document.getElementById('workAuthorization').value;
    profileData.sponsorshipRequired = document.getElementById('sponsorshipRequired').value;
    
    // NOTE: Dynamic sections (work experience, education, projects) are updated
    // directly in profileData by their respective update functions, so we don't
    // need to read them from DOM here.
    
    // Validate required fields
    if (!profileData.firstName || !profileData.lastName || !profileData.email) {
      showStatus('Please fill in required fields (Name and Email)', 'error');
      return false;
    }
    
    // Save to Chrome storage
    await chrome.storage.local.set({ userProfile: profileData });
    
    log('✅ Profile saved successfully!', 'success');
    showStatus('✅ Profile saved successfully!', 'success');
    
    return true;
  } catch (error) {
    log(`Error saving profile: ${error.message}`, 'error');
    showStatus('Failed to save profile', 'error');
    return false;
  }
}

// Load profile from Chrome storage
async function loadProfile() {
  try {
    const result = await chrome.storage.local.get(['userProfile']);
    
    if (result.userProfile) {
      profileData = result.userProfile;
      populateForm(profileData);
      log('Profile loaded from storage', 'success');
    } else {
      log('No saved profile found');
    }
  } catch (error) {
    log(`Error loading profile: ${error.message}`, 'error');
  }
}

// Populate form with profile data
function populateForm(data) {
  // Basic Info
  if (data.firstName) document.getElementById('firstName').value = data.firstName;
  if (data.lastName) document.getElementById('lastName').value = data.lastName;
  if (data.email) document.getElementById('email').value = data.email;
  if (data.phoneCountry) document.getElementById('phoneCountry').value = data.phoneCountry;
  if (data.phone) document.getElementById('phone').value = data.phone;
  
  // Location
  if (data.address) document.getElementById('address').value = data.address;
  if (data.city) document.getElementById('city').value = data.city;
  if (data.state) document.getElementById('state').value = data.state;
  if (data.postalCode) document.getElementById('postalCode').value = data.postalCode;
  if (data.country) document.getElementById('country').value = data.country;
  
  // Demographics
  if (data.gender) document.getElementById('gender').value = data.gender;
  if (data.disability) document.getElementById('disability').value = data.disability;
  if (data.veteran) document.getElementById('veteran').value = data.veteran;
  if (data.ethnicity) document.getElementById('ethnicity').value = data.ethnicity;
  
  // Social Links
  if (data.linkedin) document.getElementById('linkedin').value = data.linkedin;
  if (data.github) document.getElementById('github').value = data.github;
  if (data.portfolio) document.getElementById('portfolio').value = data.portfolio;
  if (data.twitter) document.getElementById('twitter').value = data.twitter;
  
  // Skills & Summary
  if (data.skills) document.getElementById('skills').value = data.skills;
  if (data.summary) document.getElementById('summary').value = data.summary;
  
  // Work Authorization
  if (data.workAuthorization) document.getElementById('workAuthorization').value = data.workAuthorization;
  if (data.sponsorshipRequired) document.getElementById('sponsorshipRequired').value = data.sponsorshipRequired;
  
  // Dynamic sections
  if (data.workExperience && data.workExperience.length > 0) {
    profileData.workExperience = data.workExperience;
    log(`📋 Populating ${data.workExperience.length} work experience entries`);
    renderWorkExperience();
  }
  
  if (data.education && data.education.length > 0) {
    profileData.education = data.education;
    log(`📋 Populating ${data.education.length} education entries`);
    renderEducation();
  }
  
  if (data.projects && data.projects.length > 0) {
    profileData.projects = data.projects;
    log(`📋 Populating ${data.projects.length} project entries`);
    renderProjects();
  }
}

// Work Experience Management
function renderWorkExperience() {
  const container = document.getElementById('experienceList');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Helper to escape HTML
  const escape = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  profileData.workExperience.forEach((exp, index) => {
    const item = document.createElement('div');
    item.className = 'experience-item';
    
    item.innerHTML = `
      <div class="item-header">
        <span class="item-number">Experience #${index + 1}</span>
        <button type="button" class="remove-btn remove-experience-btn" data-index="${index}">Remove</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Company Name</label>
          <input type="text" class="exp-input" data-index="${index}" data-field="company" value="${escape(exp.company)}">
        </div>
        <div class="form-group">
          <label>Job Title</label>
          <input type="text" class="exp-input" data-index="${index}" data-field="title" value="${escape(exp.title)}">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" class="exp-input" data-index="${index}" data-field="location" value="${escape(exp.location)}" placeholder="City, State">
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input type="text" class="exp-input" data-index="${index}" data-field="startDate" value="${escape(exp.startDate)}" placeholder="MM/YYYY">
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="text" class="exp-input" data-index="${index}" data-field="endDate" value="${escape(exp.endDate)}" placeholder="MM/YYYY or Present">
        </div>
        <div class="form-group full-width">
          <label>Description</label>
          <textarea class="exp-input" data-index="${index}" data-field="description" rows="3">${escape(exp.description)}</textarea>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function addExperience() {
  profileData.workExperience.push({
    company: '',
    title: '',
    location: '',
    startDate: '',
    endDate: '',
    description: ''
  });
  renderWorkExperience();
  log('Added new work experience entry');
}

function removeExperience(index) {
  if (!confirm('Remove this work experience entry?')) return;
  
  if (!profileData.workExperience || index < 0 || index >= profileData.workExperience.length) {
    log('Invalid work experience index', 'error');
    return;
  }
  
  profileData.workExperience.splice(index, 1);
  renderWorkExperience();
  saveProfile();
  log('Removed work experience entry');
  showStatus('Work experience removed successfully!', 'success');
}

function updateExperience(index, field, value) {
  if (!profileData.workExperience[index]) {
    log(`Warning: Work experience ${index} doesn't exist`, 'error');
    return;
  }
  profileData.workExperience[index][field] = value;
  // Debounced save to avoid too many saves while typing
  debouncedSave();
}

function updateEducation(index, field, value) {
  if (!profileData.education[index]) {
    log(`Warning: Education ${index} doesn't exist`, 'error');
    return;
  }
  profileData.education[index][field] = value;
  // Debounced save to avoid too many saves while typing
  debouncedSave();
}

function updateProject(index, field, value) {
  if (!profileData.projects[index]) {
    log(`Warning: Project ${index} doesn't exist`, 'error');
    return;
  }
  profileData.projects[index][field] = value;
  // Debounced save to avoid too many saves while typing
  debouncedSave();
}
function renderEducation() {
  const container = document.getElementById('educationList');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Helper to escape HTML
  const escape = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  profileData.education.forEach((edu, index) => {
    const item = document.createElement('div');
    item.className = 'education-item';
    item.innerHTML = `
      <div class="item-header">
        <span class="item-number">Education #${index + 1}</span>
        <button type="button" class="remove-btn remove-education-btn" data-index="${index}">Remove</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Institution</label>
          <input type="text" class="edu-input" data-index="${index}" data-field="institution" value="${escape(edu.institution)}">
        </div>
        <div class="form-group">
          <label>Degree</label>
          <input type="text" class="edu-input" data-index="${index}" data-field="degree" value="${escape(edu.degree)}" placeholder="e.g., Bachelor's, Master's">
        </div>
        <div class="form-group">
          <label>Field of Study</label>
          <input type="text" class="edu-input" data-index="${index}" data-field="field" value="${escape(edu.field)}" placeholder="e.g., Computer Science">
        </div>
        <div class="form-group">
          <label>Graduation Date</label>
          <input type="text" class="edu-input" data-index="${index}" data-field="graduationDate" value="${escape(edu.graduationDate)}" placeholder="MM/YYYY">
        </div>
        <div class="form-group">
          <label>GPA (Optional)</label>
          <input type="text" class="edu-input" data-index="${index}" data-field="gpa" value="${escape(edu.gpa)}" placeholder="3.8/4.0">
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function addEducation() {
  profileData.education.push({
    institution: '',
    degree: '',
    field: '',
    graduationDate: '',
    gpa: ''
  });
  renderEducation();
  log('Added new education entry');
}

function removeEducation(index) {
  if (!confirm('Remove this education entry?')) return;
  
  if (!profileData.education || index < 0 || index >= profileData.education.length) {
    log('Invalid education index', 'error');
    return;
  }
  
  profileData.education.splice(index, 1);
  renderEducation();
  saveProfile();
  log('Removed education entry');
  showStatus('Education entry removed successfully!', 'success');
}

// Projects Management
function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Helper to escape HTML
  const escape = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };
  
  profileData.projects.forEach((proj, index) => {
    const item = document.createElement('div');
    item.className = 'project-item';
    item.innerHTML = `
      <div class="item-header">
        <span class="item-number">Project #${index + 1}</span>
        <button type="button" class="remove-btn remove-project-btn" data-index="${index}">Remove</button>
      </div>
      <div class="form-grid">
        <div class="form-group">
          <label>Project Name</label>
          <input type="text" class="proj-input" data-index="${index}" data-field="name" value="${escape(proj.name)}">
        </div>
        <div class="form-group">
          <label>Project URL (Optional)</label>
          <input type="url" class="proj-input" data-index="${index}" data-field="url" value="${escape(proj.url)}" placeholder="https://...">
        </div>
        <div class="form-group full-width">
          <label>Description</label>
          <textarea class="proj-input" data-index="${index}" data-field="description" rows="3">${escape(proj.description)}</textarea>
        </div>
        <div class="form-group full-width">
          <label>Technologies Used</label>
          <input type="text" class="proj-input" data-index="${index}" data-field="technologies" value="${escape(proj.technologies)}" placeholder="React, Node.js, MongoDB...">
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function addProject() {
  profileData.projects.push({
    name: '',
    description: '',
    technologies: '',
    url: ''
  });
  renderProjects();
  log('Added new project entry');
}

function removeProject(index) {
  if (!confirm('Remove this project entry?')) return;
  
  if (!profileData.projects || index < 0 || index >= profileData.projects.length) {
    log('Invalid project index', 'error');
    return;
  }
  
  profileData.projects.splice(index, 1);
  renderProjects();
  saveProfile();
  log('Removed project entry');
  showStatus('Project removed successfully!', 'success');
}

// Parse Resume Button Handler
async function handleParseResume() {
  const resumeText = document.getElementById('resumePaste').value.trim();
  const parseBtn = document.getElementById('parseResumeBtn');
  const statusEl = document.getElementById('parseStatus');
  
  if (!resumeText) {
    statusEl.textContent = '⚠️ Please paste your resume first';
    statusEl.className = 'status error';
    return;
  }
  
  await parseResumeText(resumeText, parseBtn, statusEl);
}

// Parse PDF Resume Handler
async function handleParsePdf() {
  const fileInput = document.getElementById('resumeFileInput');
  const parsePdfBtn = document.getElementById('parsePdfBtn');
  const statusEl = document.getElementById('resumeFileStatus');
  
  const file = fileInput.files[0];
  if (!file) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee';
    statusEl.style.color = '#c00';
    statusEl.innerHTML = '⚠️ Please select a PDF file first';
    return;
  }
  
  if (file.type !== 'application/pdf') {
    statusEl.style.display = 'block';
    statusEl.style.background = '#fee';
    statusEl.style.color = '#c00';
    statusEl.innerHTML = '❌ Please upload a PDF file';
    return;
  }
  
  try {
    parsePdfBtn.disabled = true;
    parsePdfBtn.innerHTML = '<div class="spinner"></div> Extracting text...';
    statusEl.style.display = 'block';
    statusEl.style.background = '#e7f3ff';
    statusEl.style.color = '#0066cc';
    statusEl.innerHTML = '📄 Reading PDF file...';
    
    // Read PDF file as text using FileReader and simple text extraction
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        let pdfText = '';
        
        // Try multiple decoding strategies for better PDF text extraction
        
        // Strategy 1: UTF-8 decoding with text extraction
        try {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const fullText = decoder.decode(uint8Array);
          
          // Extract text objects from PDF
          // PDFs store text in between BT (BeginText) and ET (EndText) operators
          const textMatches = fullText.matchAll(/BT\s*(.*?)\s*ET/gs);
          for (const match of textMatches) {
            // Extract text from Tj operators: (text)Tj
            const tjMatches = match[1].matchAll(/\((.*?)\)Tj/g);
            for (const tj of tjMatches) {
              pdfText += tj[1].replace(/\\(.)/g, '$1') + ' ';
            }
            pdfText += '\n';
          }
          
          // Also try to extract from TJ array operators: [(text1)(text2)]TJ
          const tjArrayMatches = fullText.matchAll(/\[(.*?)\]TJ/gs);
          for (const match of tjArrayMatches) {
            const textParts = match[1].matchAll(/\((.*?)\)/g);
            for (const part of textParts) {
              pdfText += part[1].replace(/\\(.)/g, '$1') + ' ';
            }
            pdfText += '\n';
          }
        } catch (e) {
          log('Strategy 1 failed, trying alternative methods...', 'info');
        }
        
        // Strategy 2: Look for plain text in the PDF stream (fallback)
        if (pdfText.length < 50) {
          try {
            const latin1Decoder = new TextDecoder('latin1', { fatal: false });
            const rawText = latin1Decoder.decode(uint8Array);
            
            // Extract readable text (sequences of printable characters)
            const readableTextMatches = rawText.matchAll(/[\x20-\x7E]{4,}/g);
            const extractedStrings = [];
            
            for (const match of readableTextMatches) {
              const text = match[0];
              // Filter out PDF keywords and keep meaningful text
              if (!text.match(/^(obj|endobj|stream|endstream|xref|trailer|startxref|\/Type|\/Font|\/Page|\/Catalog|\/Length|\/Filter)$/)) {
                extractedStrings.push(text);
              }
            }
            
            // Join extracted strings with spaces
            pdfText = extractedStrings.join(' ');
            
            // Clean up common PDF artifacts
            pdfText = pdfText
              .replace(/[\/\\]/g, ' ')
              .replace(/\s+/g, ' ')
              .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
              .trim();
          } catch (e) {
            log('Strategy 2 failed', 'info');
          }
        }
        
        // Strategy 3: Extract any parenthesized strings (last resort)
        if (pdfText.length < 50) {
          try {
            const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
            const stringMatches = utf8Text.matchAll(/\(([^)]{3,})\)/g);
            const strings = [];
            
            for (const match of stringMatches) {
              const str = match[1]
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '')
                .replace(/\\t/g, ' ')
                .replace(/\\(.)/g, '$1');
              
              if (str.length > 2 && !str.match(/^[0-9.]+$/)) {
                strings.push(str);
              }
            }
            
            pdfText = strings.join(' ');
          } catch (e) {
            log('Strategy 3 failed', 'info');
          }
        }
        
        pdfText = pdfText.trim();
        
        if (pdfText.length < 50) {
          throw new Error('Could not extract enough text from PDF. The PDF might be:\n• Scanned (image-based) - try converting to text first\n• Encrypted or password-protected\n• Using complex encoding\n\nTry pasting the text directly instead.');
        }
        
        statusEl.innerHTML = `✅ Extracted ${pdfText.length} characters from PDF. Parsing with AI...`;
        log(`PDF text extracted: ${pdfText.substring(0, 200)}...`);
        
        // Now parse the extracted text with AI
        await parseResumeText(pdfText, parsePdfBtn, statusEl);
        
      } catch (error) {
        statusEl.style.background = '#fee';
        statusEl.style.color = '#c00';
        statusEl.innerHTML = `❌ PDF extraction failed: ${error.message}`;
        log(`PDF extraction error: ${error.message}`, 'error');
        parsePdfBtn.disabled = false;
        parsePdfBtn.innerHTML = '🤖 Parse PDF';
      }
    };
    
    reader.onerror = () => {
      statusEl.style.background = '#fee';
      statusEl.style.color = '#c00';
      statusEl.innerHTML = '❌ Failed to read PDF file';
      parsePdfBtn.disabled = false;
      parsePdfBtn.innerHTML = '🤖 Parse PDF';
    };
    
    reader.readAsArrayBuffer(file);
    
  } catch (error) {
    statusEl.style.background = '#fee';
    statusEl.style.color = '#c00';
    statusEl.innerHTML = `❌ Error: ${error.message}`;
    log(`PDF parse error: ${error.message}`, 'error');
    parsePdfBtn.disabled = false;
    parsePdfBtn.innerHTML = '🤖 Parse PDF';
  }
}

// Common function to parse resume text (used by both paste and PDF upload)
async function parseResumeText(resumeText, button, statusElement) {
  // Check if Prompt API is available (using LanguageModel as per Chrome docs)
  if (!('LanguageModel' in window)) {
    statusElement.textContent = '❌ LanguageModel API not available. Fill form manually.';
    statusElement.className = 'status error';
    statusElement.style.background = '#fee';
    statusElement.style.color = '#c00';
    log('❌ LanguageModel not available - please fill form manually');
    showStatus('Prompt API not available. Please fill the form manually.', 'error');
    return;
  }
  
  try {
    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div> Parsing...';
    statusElement.textContent = '🤖 AI is analyzing your resume...';
    statusElement.className = 'status info';
    statusElement.style.display = 'block';
    statusElement.style.background = '#e7f3ff';
    statusElement.style.color = '#0066cc';
    
    // Add elapsed time indicator
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      statusElement.textContent = `🤖 AI is analyzing your resume... (${elapsed}s)`;
    }, 1000);
    
    try {
      const parsed = await parseResumeWithAI(resumeText);
      
      clearInterval(progressInterval);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      log(`✅ Parsing completed in ${totalTime}s`);
      
      // Merge parsed data into profile
      if (parsed.firstName) profileData.firstName = parsed.firstName;
      if (parsed.lastName) profileData.lastName = parsed.lastName;
      if (parsed.email) profileData.email = parsed.email;
      if (parsed.phone) profileData.phone = parsed.phone;
      if (parsed.address) profileData.address = parsed.address;
      if (parsed.city) profileData.city = parsed.city;
      if (parsed.state) profileData.state = parsed.state;
      if (parsed.postalCode) profileData.postalCode = parsed.postalCode;
      if (parsed.country) profileData.country = parsed.country;
      if (parsed.linkedin) profileData.linkedin = parsed.linkedin;
      if (parsed.github) profileData.github = parsed.github;
      if (parsed.portfolio) profileData.portfolio = parsed.portfolio;
      if (parsed.twitter) profileData.twitter = parsed.twitter;
      if (parsed.skills) profileData.skills = parsed.skills;
      if (parsed.summary) profileData.summary = parsed.summary;
      
      if (parsed.workExperience && Array.isArray(parsed.workExperience)) {
        profileData.workExperience = parsed.workExperience;
        log(`✓ Loaded ${parsed.workExperience.length} work experience entries`);
      }
      
      if (parsed.education && Array.isArray(parsed.education)) {
        profileData.education = parsed.education;
        log(`✓ Loaded ${parsed.education.length} education entries`);
      }
      
      if (parsed.projects && Array.isArray(parsed.projects)) {
        profileData.projects = parsed.projects;
        log(`✓ Loaded ${parsed.projects.length} project entries`);
      }
      
      // Populate form with parsed data
      populateForm(profileData);
      
      statusElement.textContent = `✅ Resume parsed in ${totalTime}s! Review and edit the fields below.`;
      statusElement.className = 'status success';
      statusElement.style.background = '#d4edda';
      statusElement.style.color = '#155724';
      
      showStatus('✅ Resume parsed successfully!', 'success');
    } catch (error) {
      clearInterval(progressInterval); // Clean up timer on error
      throw error; // Re-throw to outer catch
    }
    
  } catch (error) {
    statusElement.textContent = `❌ Parsing failed: ${error.message}`;
    statusElement.className = 'status error';
    statusElement.style.background = '#fee';
    statusElement.style.color = '#c00';
    log(`Parse error: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = button.id === 'parsePdfBtn' ? '🤖 Parse PDF' : '<span>🤖 Parse with AI</span>';
  }
}

// Reset Profile
async function resetProfile() {
  if (!confirm('Are you sure you want to clear all profile data? This cannot be undone.')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove(['userProfile']);
    
    // Reset to empty
    profileData = {
      firstName: '', lastName: '', email: '', phone: '',
      address: '', city: '', state: '', postalCode: '', country: 'United States',
      gender: '', disability: '', veteran: '', ethnicity: '',
      linkedin: '', github: '', portfolio: '', twitter: '',
      workExperience: [], education: [], projects: [],
      skills: '', summary: '',
      workAuthorization: 'Authorized', sponsorshipRequired: 'No',
      resumePdfBase64: null, resumePdfName: null
    };
    
    // Clear form
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.type === 'text' || el.type === 'email' || el.type === 'tel' || el.type === 'url') {
        el.value = '';
      } else if (el.type === 'file') {
        el.value = '';
      } else if (el.tagName === 'TEXTAREA') {
        el.value = '';
      } else if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      }
    });
    
    // Clear PDF status
    const statusDiv = document.getElementById('resumeFileStatus');
    if (statusDiv) statusDiv.style.display = 'none';
    
    // Re-render dynamic sections
    renderWorkExperience();
    renderEducation();
    renderProjects();
    
    log('Profile reset successfully', 'success');
    showStatus('Profile cleared', 'success');
    
  } catch (error) {
    log(`Error resetting profile: ${error.message}`, 'error');
    showStatus('Failed to reset profile', 'error');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  log('Profile page loaded');
  
  // Load existing profile
  await loadProfile();
  
  // Event Listeners
  document.getElementById('parseResumeBtn').addEventListener('click', handleParseResume);
  document.getElementById('parsePdfBtn').addEventListener('click', handleParsePdf);
  document.getElementById('clearResumeBtn').addEventListener('click', () => {
    document.getElementById('resumePaste').value = '';
    document.getElementById('parseStatus').textContent = '';
  });
  
  // PDF Resume Upload Handler
  document.getElementById('resumeFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
      showStatus('❌ Please upload a PDF file', 'error');
      log('Invalid file type - only PDF allowed', 'error');
      e.target.value = '';
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      showStatus('❌ File too large. Maximum 5MB allowed.', 'error');
      log(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB`, 'error');
      e.target.value = '';
      return;
    }
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        profileData.resumePdfBase64 = base64;
        profileData.resumePdfName = file.name;
        
        // Save immediately
        await saveProfile();
        
        const statusDiv = document.getElementById('resumeFileStatus');
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#d4edda';
        statusDiv.style.color = '#155724';
        statusDiv.style.border = '1px solid #c3e6cb';
        statusDiv.innerHTML = `✅ <strong>${file.name}</strong> uploaded (${(file.size / 1024).toFixed(1)} KB)`;
        
        log(`Resume PDF uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
        showStatus('✅ Resume PDF saved!', 'success');
      };
      reader.readAsDataURL(file);
      
    } catch (error) {
      showStatus('❌ Failed to upload resume', 'error');
      log(`Upload error: ${error.message}`, 'error');
    }
  });
  
  // Clear PDF Resume
  document.getElementById('clearResumeFileBtn').addEventListener('click', async () => {
    if (!confirm('Remove uploaded resume PDF?')) return;
    
    profileData.resumePdfBase64 = null;
    profileData.resumePdfName = null;
    document.getElementById('resumeFileInput').value = '';
    
    const statusDiv = document.getElementById('resumeFileStatus');
    statusDiv.style.display = 'none';
    
    await saveProfile();
    log('Resume PDF removed', 'success');
    showStatus('Resume PDF removed', 'success');
  });
  
  // Display existing PDF if present
  if (profileData.resumePdfBase64) {
    const statusDiv = document.getElementById('resumeFileStatus');
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#d4edda';
    statusDiv.style.color = '#155724';
    statusDiv.style.border = '1px solid #c3e6cb';
    statusDiv.innerHTML = `✅ <strong>${profileData.resumePdfName || 'Resume.pdf'}</strong> already uploaded`;
  }
  
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
  document.getElementById('resetProfileBtn').addEventListener('click', resetProfile);
  document.getElementById('backToPopupBtn').addEventListener('click', () => {
    window.close();
  });
  
  document.getElementById('addExperienceBtn').addEventListener('click', addExperience);
  document.getElementById('addEducationBtn').addEventListener('click', addEducation);
  document.getElementById('addProjectBtn').addEventListener('click', addProject);
  
  // Event delegation for dynamically created elements
  // Work Experience
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-experience-btn')) {
      const index = parseInt(e.target.dataset.index);
      removeExperience(index);
    } else if (e.target.classList.contains('remove-education-btn')) {
      const index = parseInt(e.target.dataset.index);
      removeEducation(index);
    } else if (e.target.classList.contains('remove-project-btn')) {
      const index = parseInt(e.target.dataset.index);
      removeProject(index);
    }
  });
  
  document.addEventListener('input', (e) => {
    // Work Experience fields
    if (e.target.classList.contains('exp-input')) {
      const index = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      updateExperience(index, field, e.target.value);
    }
    // Education fields
    else if (e.target.classList.contains('edu-input')) {
      const index = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      updateEducation(index, field, e.target.value);
    }
    // Project fields
    else if (e.target.classList.contains('proj-input')) {
      const index = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      updateProject(index, field, e.target.value);
    }
  });
  
  // Auto-save on form changes (debounced)
  let saveTimeout;
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('change', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveProfile();
      }, 1000);
    });
  });
});

// Functions are now accessed via event delegation - no need for global exposure

