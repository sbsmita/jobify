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
  // Log to browser console since Activity Log UI was removed
  const timestamp = new Date().toLocaleTimeString();
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  const logMessage = `${icon} [${timestamp}] ${message}`;
  
  if (type === 'error') {
    console.error(logMessage);
  } else if (type === 'success') {
    console.log('%c' + logMessage, 'color: green; font-weight: bold');
  } else {
    console.log(logMessage);
  }
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
// PROVEN approach: Extract each section as plain text, then parse
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
    
    // Create AI session with optimized settings for structured output
    if (!promptSession) {
      if (availability === 'downloadable' || availability === 'downloading') {
        showStatus('⏬ Downloading AI model... Please wait.', 'info');
        log('⏬ Downloading Prompt API model...');
      } else {
        log('⚡ Loading Prompt API...');
      }
      
      promptSession = await window.LanguageModel.create({
        temperature: 0.1,
        topK: 1,
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
      log('✓ Prompt API ready');
    }
    
    const result = {
      firstName: '', lastName: '', email: '', phone: '',
      address: '', city: '', state: '', postalCode: '', country: '',
      linkedin: '', github: '', portfolio: '', twitter: '',
      skills: '', summary: '',
      workExperience: [], education: [], projects: []
    };
    
    // Strategy 1: ONE MASTER PROMPT - Extract everything at once in a clear format
    try {
      log('Extracting all data with master prompt...');
    const masterPrompt = `Extract ALL information from this resume and format it EXACTLY as shown below. If a field is not found, write "N/A".

BASIC INFO:
First Name: 
Last Name: 
Email: 
Phone: 
City: 
State: 
LinkedIn: 
GitHub: 
Portfolio: 

SKILLS:
[List all skills as comma-separated values on one line]

SUMMARY:
[Write a 2-3 sentence professional summary]

WORK EXPERIENCE:
[For each job, use this EXACT format]
JOB_START
Company: 
Title: 
Start: [MM/YYYY]
End: [MM/YYYY or Present]
Description: [One sentence]
JOB_END

[Repeat JOB_START...JOB_END for each job]

EDUCATION:
[For each degree, use this EXACT format]
EDU_START
Institution: 
Degree: 
Field: 
Graduated: [MM/YYYY]
EDU_END

[Repeat EDU_START...EDU_END for each degree]

PROJECTS:
[For each project, use this EXACT format]
PROJ_START
Name: 
Description: 
Technologies: 
PROJ_END

[Repeat PROJ_START...PROJ_END for each project]

Resume:
${resumeText}`;

    const response = await promptSession.prompt(masterPrompt);
    log('AI response received, parsing...');
    
    // Parse the structured response
    const lines = response.split('\n');
    let currentSection = '';
    let currentJob = null;
    let currentEdu = null;
    let currentProj = null;
    
    for (let line of lines) {
      const trimmed = line.trim();
      
      // Detect sections
      if (trimmed.startsWith('BASIC INFO:')) {
        currentSection = 'basic';
        continue;
      } else if (trimmed.startsWith('SKILLS:')) {
        currentSection = 'skills';
        continue;
      } else if (trimmed.startsWith('SUMMARY:')) {
        currentSection = 'summary';
        continue;
      } else if (trimmed.startsWith('WORK EXPERIENCE:')) {
        currentSection = 'work';
        continue;
      } else if (trimmed.startsWith('EDUCATION:')) {
        currentSection = 'education';
        continue;
      } else if (trimmed.startsWith('PROJECTS:')) {
        currentSection = 'projects';
        continue;
      }
      
      // Parse basic info
      if (currentSection === 'basic') {
        if (trimmed.startsWith('First Name:')) {
          result.firstName = trimmed.substring(11).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('Last Name:')) {
          result.lastName = trimmed.substring(10).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('Email:')) {
          result.email = trimmed.substring(6).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('Phone:')) {
          result.phone = trimmed.substring(6).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('City:')) {
          result.city = trimmed.substring(5).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('State:')) {
          result.state = trimmed.substring(6).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('LinkedIn:')) {
          result.linkedin = trimmed.substring(9).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('GitHub:')) {
          result.github = trimmed.substring(7).trim().replace(/N\/A/i, '');
        } else if (trimmed.startsWith('Portfolio:')) {
          result.portfolio = trimmed.substring(10).trim().replace(/N\/A/i, '');
        }
      }
      
      // Parse skills
      if (currentSection === 'skills' && trimmed && !trimmed.startsWith('SKILLS:')) {
        result.skills = trimmed;
        currentSection = '';
      }
      
      // Parse summary
      if (currentSection === 'summary' && trimmed && !trimmed.startsWith('SUMMARY:')) {
        if (!result.summary) result.summary = trimmed;
        else result.summary += ' ' + trimmed;
      }
      
      // Parse work experience
      if (currentSection === 'work') {
        if (trimmed === 'JOB_START') {
          currentJob = { company: '', title: '', location: '', startDate: '', endDate: '', description: '' };
        } else if (trimmed === 'JOB_END' && currentJob) {
          if (currentJob.company && currentJob.title) {
            result.workExperience.push(currentJob);
          }
          currentJob = null;
        } else if (currentJob) {
          if (trimmed.startsWith('Company:')) {
            currentJob.company = trimmed.substring(8).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Title:')) {
            currentJob.title = trimmed.substring(6).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Start:')) {
            const date = trimmed.substring(6).trim().replace(/N\/A/i, '');
            currentJob.startDate = date.replace(/[^0-9\/]/g, '').substring(0, 7);
          } else if (trimmed.startsWith('End:')) {
            const date = trimmed.substring(4).trim();
            currentJob.endDate = date.toLowerCase().includes('present') ? 'Present' : date.replace(/[^0-9\/]/g, '').substring(0, 7);
          } else if (trimmed.startsWith('Description:')) {
            currentJob.description = trimmed.substring(12).trim().replace(/N\/A/i, '');
          }
        }
      }
      
      // Parse education
      if (currentSection === 'education') {
        if (trimmed === 'EDU_START') {
          currentEdu = { institution: '', degree: '', field: '', graduationDate: '', gpa: '' };
        } else if (trimmed === 'EDU_END' && currentEdu) {
          if (currentEdu.institution && currentEdu.degree) {
            result.education.push(currentEdu);
          }
          currentEdu = null;
        } else if (currentEdu) {
          if (trimmed.startsWith('Institution:')) {
            currentEdu.institution = trimmed.substring(12).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Degree:')) {
            currentEdu.degree = trimmed.substring(7).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Field:')) {
            currentEdu.field = trimmed.substring(6).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Graduated:')) {
            const date = trimmed.substring(10).trim().replace(/N\/A/i, '');
            currentEdu.graduationDate = date.replace(/[^0-9\/]/g, '').substring(0, 7);
          }
        }
      }
      
      // Parse projects
      if (currentSection === 'projects') {
        if (trimmed === 'PROJ_START') {
          currentProj = { name: '', description: '', technologies: '', url: '' };
        } else if (trimmed === 'PROJ_END' && currentProj) {
          if (currentProj.name) {
            result.projects.push(currentProj);
          }
          currentProj = null;
        } else if (currentProj) {
          if (trimmed.startsWith('Name:')) {
            currentProj.name = trimmed.substring(5).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Description:')) {
            currentProj.description = trimmed.substring(12).trim().replace(/N\/A/i, '');
          } else if (trimmed.startsWith('Technologies:')) {
            currentProj.technologies = trimmed.substring(13).trim().replace(/N\/A/i, '');
          }
        }
      }
    }
    
    log(`✅ Extraction complete!`);
    log(`📊 Results: ${result.firstName} ${result.lastName}`);
    log(`   Email: ${result.email}, Phone: ${result.phone}`);
    log(`   ${result.workExperience.length} jobs, ${result.education.length} degrees, ${result.projects.length} projects`);
    
    if (isValidResumeStructure(result)) {
      return result;
    }
  } catch (e) {
    log(`⚠️ Strategy 1 (Master prompt) failed: ${e.message}`);
  }
    
    // If Strategy 1 failed, throw error
    throw new Error('Could not extract enough information from resume. Please check the format and try again.');
  } catch (error) {
    log(`❌ AI parsing error: ${error.message}`, 'error');
    throw error;
  }
}

// Strategy 3: Question-answer format (most reliable fallback)
async function parseResumeWithAI_Fallback(resumeText) {
    log('Strategy 3: Simple question-answer extraction...');
    try {
      const result = {
        firstName: '', lastName: '', email: '', phone: '',
        address: '', city: '', state: '', postalCode: '', country: '',
        linkedin: '', github: '', portfolio: '', twitter: '',
        skills: '', summary: '',
        workExperience: [], education: [], projects: []
      };
      
      // Ask simple questions
      const qa1 = await promptSession.prompt(`What is the person's first and last name in this resume? Answer with just the name.\n\n${resumeText.substring(0, 500)}`);
      const nameParts = qa1.trim().split(' ');
      result.firstName = nameParts[0] || '';
      result.lastName = nameParts.slice(1).join(' ') || '';
      
      const qa2 = await promptSession.prompt(`What is the email address in this resume? Answer with just the email.\n\n${resumeText.substring(0, 500)}`);
      result.email = qa2.trim();
      
      const qa3 = await promptSession.prompt(`What is the phone number in this resume? Answer with just the phone.\n\n${resumeText.substring(0, 500)}`);
      result.phone = qa3.trim();
      
      const qa4 = await promptSession.prompt(`List the person's skills from this resume as comma-separated values.\n\n${resumeText}`);
      result.skills = qa4.trim();
      
      log(`✓ Extracted: ${result.firstName} ${result.lastName}, ${result.email}`);
      
      if (isValidResumeStructure(result)) {
        log('✅ Strategy 3 (Q&A) succeeded!');
        return result;
      }
    } catch (e) {
      log(`⚠️ Strategy 3 failed: ${e.message}`);
    }
    
    // If all strategies fail, throw error
    log('❌ All parsing strategies failed', 'error');
    throw new Error('AI could not parse the resume reliably. Please try:\n1. Simplifying the resume format\n2. Removing special characters\n3. Pasting plain text instead of formatted text');
}

// Validate that the parsed structure has minimum required fields
function isValidResumeStructure(data) {
  if (!data || typeof data !== 'object') return false;
  
  // At minimum, we need either name + email OR at least one work experience
  const hasBasicInfo = (data.firstName || data.lastName || data.email);
  const hasWorkExp = (Array.isArray(data.workExperience) && data.workExperience.length > 0);
  
  return hasBasicInfo || hasWorkExp;
}

// Robustly extract and parse JSON from AI text output
function safeParseJsonFromText(text) {
  if (!text) return null;
  let clean = text.trim();
  // Strip common code fences if present
  if (clean.startsWith('```json')) clean = clean.slice(7);
  if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();
  
  // Replace smart quotes and other problematic characters
  clean = clean.replace(/[""]/g, '"').replace(/['']/g, "'");
  
  // Find the largest balanced {...}
  let start = clean.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return null;
  let candidate = clean.slice(start, end);
  
  // Multiple repair strategies
  // 1. Remove trailing commas before } or ]
  candidate = candidate.replace(/,\s*([}\]])/g, '$1');
  
  // 2. Remove control characters (except newlines and tabs)
  candidate = candidate.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');
  
  // 3. Fix bad escape sequences: replace backslashes not part of valid escapes
  // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
  candidate = candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
  
  // 4. Fix unescaped quotes inside strings (this is tricky, simplified approach)
  // Replace newlines inside string values with \n
  candidate = candidate.replace(/"([^"]*?)(\r?\n)([^"]*?)"/g, (match, p1, p2, p3) => {
    return `"${p1}\\n${p3}"`;
  });
  
  // Try parsing
  try {
    return JSON.parse(candidate);
  } catch (e) {
    console.log('JSON parse attempt 1 failed:', e.message);
    
    // Try removing all backslashes except those before quotes
    try {
      let repaired = candidate.replace(/\\(?!")/g, '');
      return JSON.parse(repaired);
    } catch (e2) {
      console.log('JSON parse attempt 2 failed:', e2.message);
      
      // Try double-escaping all backslashes
      try {
        let repaired = candidate.replace(/\\/g, '\\\\');
        return JSON.parse(repaired);
      } catch (e3) {
        console.log('JSON parse attempt 3 failed:', e3.message);
        return null;
      }
    }
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
  const progressBar = document.getElementById('resumeProgressBar');
  
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
    if (progressBar) {
      progressBar.style.display = 'block';
      progressBar.querySelector('.bar-fg').style.width = '10%';
    }
    
    // Read PDF file as text using FileReader and simple text extraction
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        if (progressBar) progressBar.querySelector('.bar-fg').style.width = '30%';
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        let pdfText = '';
        // ...existing code for extraction...
        // Strategy 1
        try {
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const fullText = decoder.decode(uint8Array);
          const textMatches = fullText.matchAll(/BT\s*(.*?)\s*ET/gs);
          for (const match of textMatches) {
            const tjMatches = match[1].matchAll(/\((.*?)\)Tj/g);
            for (const tj of tjMatches) {
              pdfText += tj[1].replace(/\\(.)/g, '$1') + ' ';
            }
            pdfText += '\n';
          }
          const tjArrayMatches = fullText.matchAll(/\[(.*?)\]TJ/gs);
          for (const match of tjArrayMatches) {
            const textParts = match[1].matchAll(/\((.*?)\)/g);
            for (const part of textParts) {
              pdfText += part[1].replace(/\\(.)/g, '$1') + ' ';
            }
            pdfText += '\n';
          }
        } catch (e) { log('Strategy 1 failed, trying alternative methods...', 'info'); }
        // Strategy 2
        if (pdfText.length < 50) {
          try {
            const latin1Decoder = new TextDecoder('latin1', { fatal: false });
            const rawText = latin1Decoder.decode(uint8Array);
            const readableTextMatches = rawText.matchAll(/[\x20-\x7E]{4,}/g);
            const extractedStrings = [];
            for (const match of readableTextMatches) {
              const text = match[0];
              if (!text.match(/^(obj|endobj|stream|endstream|xref|trailer|startxref|\/Type|\/Font|\/Page|\/Catalog|\/Length|\/Filter)$/)) {
                extractedStrings.push(text);
              }
            }
            pdfText = extractedStrings.join(' ');
            pdfText = pdfText.replace(/[\/\\]/g, ' ').replace(/\s+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
          } catch (e) { log('Strategy 2 failed', 'info'); }
        }
        // Strategy 3
        if (pdfText.length < 50) {
          try {
            const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
            const stringMatches = utf8Text.matchAll(/\(([^)]{3,})\)/g);
            const strings = [];
            for (const match of stringMatches) {
              const str = match[1].replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\t/g, ' ').replace(/\\(.)/g, '$1');
              if (str.length > 2 && !str.match(/^[0-9.]+$/)) { strings.push(str); }
            }
            pdfText = strings.join(' ');
          } catch (e) { log('Strategy 3 failed', 'info'); }
        }
        pdfText = pdfText.trim();
        if (pdfText.length < 50) {
          throw new Error('Could not extract enough text from PDF. The PDF might be:\n• Scanned (image-based) - try converting to text first\n• Encrypted or password-protected\n• Using complex encoding\n\nTry pasting the text directly instead.');
        }
        if (progressBar) progressBar.querySelector('.bar-fg').style.width = '60%';
        statusEl.innerHTML = `✅ Extracted ${pdfText.length} characters from PDF. Parsing with AI...`;
        log(`PDF text extracted: ${pdfText.substring(0, 200)}...`);
        // Now parse the extracted text with AI
        await parseResumeText(pdfText, parsePdfBtn, statusEl);
        if (progressBar) progressBar.querySelector('.bar-fg').style.width = '100%';
        setTimeout(() => { if (progressBar) progressBar.style.display = 'none'; }, 1200);
      } catch (error) {
        statusEl.style.background = '#fee';
        statusEl.style.color = '#c00';
        statusEl.innerHTML = `❌ PDF extraction failed: ${error.message}`;
        log(`PDF extraction error: ${error.message}`, 'error');
        parsePdfBtn.disabled = false;
        parsePdfBtn.innerHTML = '🤖 Parse PDF';
        if (progressBar) progressBar.style.display = 'none';
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
  
  // Show and animate the progress bar
  const progressBar = document.getElementById('parseProgressBar');
  const progressFill = document.getElementById('parseProgressBarFill');
  if (progressBar && progressFill) {
    progressBar.style.visibility = 'visible';
    progressFill.style.width = '10%';
    progressFill.textContent = '10%';
  }
  try {
    button.disabled = true;
    button.innerHTML = '<div class="spinner"></div> Parsing...';
    statusElement.textContent = '🤖 AI is analyzing your resume...';
    statusElement.className = 'status info';
    statusElement.style.display = 'block';
    statusElement.style.background = '#e7f3ff';
    statusElement.style.color = '#0066cc';
    // Animate progress bar during parsing
    let progress = 10;
    const progressStep = 7;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + progressStep, 90);
      if (progressFill) {
        progressFill.style.width = progress + '%';
        progressFill.textContent = progress + '%';
      }
    }, 700);
    // Add elapsed time indicator
    const startTime = Date.now();
    const elapsedInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      statusElement.textContent = `🤖 AI is analyzing your resume... (${elapsed}s) - Might take 5-15 minutes`;
    }, 1000);
    try {
      const parsed = await parseResumeWithAI(resumeText);
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      if (progressFill) {
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';
      }
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
      clearInterval(progressInterval);
      clearInterval(elapsedInterval);
      if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.textContent = '';
      }
      throw error;
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
    if (progressFill) {
      progressFill.style.width = '0%';
      progressFill.textContent = '';
    }
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

