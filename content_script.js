// content_script.js

// Heuristic function to extract main job text from common job sites or generic pages.
function extractJobText() {
  // Try site-specific known selectors first (LinkedIn, Indeed, Workday, etc.)
  const selectors = [
    // LinkedIn job description
    'div.description__text',
    'div.show-more-less-html__markup',
    '.jobs-description__content',
    '.jobs-description',
    '.job-details',
    
    // Indeed
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '.jobsearch-jobDescriptionText',
    
    // Workday
    '[data-automation-id="jobPostingDescription"]',
    '.jobDescription',
    
    // Greenhouse
    '#app_body',
    '.job-post-description',
    
    // Lever
    '.posting-description',
    '.content-description',
    
    // Generic job sites
    '[class*="job-description"]',
    '[id*="job-description"]',
    '[class*="jobDescription"]',
    '[id*="jobDescription"]',
    'article',
    '[role="article"]',
    '.post',
    '.content',
    'main'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 120) {
      console.log('Found job description using selector:', sel);
      return el.innerText.trim();
    }
  }

  // Fallback: try to find the longest text block on the page
  const textBlocks = Array.from(document.querySelectorAll('div, section, article'))
    .map(el => ({
      element: el,
      text: el.innerText || '',
      length: (el.innerText || '').trim().length
    }))
    .filter(block => block.length > 200 && block.length < 10000)
    .sort((a, b) => b.length - a.length);
  
  if (textBlocks.length > 0) {
    console.log('Found job description using longest text block');
    return textBlocks[0].text.trim();
  }

  // Last resort: take visible text of the page body
  const bodyText = document.body ? document.body.innerText : '';
  if (bodyText && bodyText.length > 120) {
    console.log('Using body text as fallback');
    return bodyText.trim().substring(0, 5000); // Limit to 5000 chars
  }

  return '';
}

// Expose by listening to messages
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'GET_JOB_TEXT') {
    const text = extractJobText();
    respond({ text });
    return true; // will respond asynchronously
  }

  if (message?.type === 'AUTOFILL_FORM') {
    // Call async handler
    handleAutofill(message.data, respond);
    return true; // Keep channel open for async
  }
  
  if (message?.type === 'AUTOFILL_FIELDS') {
    // Attempt to fill fields directly from content script (alternative to background)
    const { fields } = message;
    for (const [selector, value] of Object.entries(fields)) {
      try {
        const el = document.querySelector(selector);
        if (!el) continue;
        fillField(el, value);
      } catch (e) {
        // ignore
      }
    }
    respond({ status: 'ok' });
    return true;
  }
});

// Async autofill handler
async function handleAutofill(data, respond) {
  try {
    const { profile, resumeText, resumeParsed, coverLetter, jobDescription } = data;
    
    console.log('🤖 SMART AUTO-FILL STARTING...');
    console.log('📋 Profile data:', profile);
    console.log('📋 Resume data:', resumeParsed);
    
    // Show visual notification
    showAutoFillNotification('🤖 Auto-filling form with your profile data...');
    
    let filledCount = 0;
    const filledFields = [];
    
    // Wait for dynamic forms to load
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // === PRIORITIZE PROFILE DATA OVER RESUME ===
    
    let extractedData = {};
    
    if (profile) {
      // Use profile data (most reliable and comprehensive)
      console.log('✅ Using profile data for auto-fill');
      
      extractedData = {
        // Basic info
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
        email: profile.email || '',
        phone: profile.phone || '',
        phoneCountry: profile.phoneCountry || '',
        
        // Location
        address: profile.address || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || '',
        zipCode: profile.postalCode || '',
        location: `${profile.city || ''}${profile.city && profile.state ? ', ' : ''}${profile.state || ''}`.trim(),
        
        // Demographics
        gender: profile.gender || '',
        disability: profile.disability || '',
        veteran: profile.veteran || '',
        ethnicity: profile.ethnicity || '',
        
        // Social Links
        linkedin: profile.linkedin || '',
        github: profile.github || '',
        website: profile.portfolio || '',
        twitter: profile.twitter || '',
        
        // Skills and summary
        skills: profile.skills || '',
        summary: profile.summary || '',
        
        // Work Experience
        workExperience: profile.workExperience || [],
        currentCompany: profile.workExperience && profile.workExperience.length > 0 
          ? profile.workExperience[0].company 
          : '',
        currentTitle: profile.workExperience && profile.workExperience.length > 0 
          ? profile.workExperience[0].title 
          : '',
        yearsOfExperience: profile.workExperience && profile.workExperience.length > 0 
          ? String(profile.workExperience.length) 
          : '',
        
        // Education
        education: profile.education || [],
        degree: profile.education && profile.education.length > 0 
          ? profile.education[0].degree 
          : '',
        university: profile.education && profile.education.length > 0 
          ? profile.education[0].institution 
          : '',
        field: profile.education && profile.education.length > 0 
          ? profile.education[0].field 
          : '',
        graduationYear: profile.education && profile.education.length > 0 
          ? profile.education[0].graduationDate 
          : '',
        gpa: profile.education && profile.education.length > 0 
          ? profile.education[0].gpa 
          : '',
        
        // Projects
        projects: profile.projects || [],
        
        // Work Authorization
        workAuthorized: profile.workAuthorization || 'yes',
        sponsorshipRequired: profile.sponsorshipRequired || 'no',
        
        // Cover letter
        coverLetter: coverLetter || ''
      };
    } else if (resumeParsed || resumeText) {
      // Fallback to resume parsing (legacy method)
      console.log('ℹ️ Using resume data for auto-fill');
      
      extractedData = {
        // Basic info
        name: resumeParsed?.name || '',
        firstName: resumeParsed?.name ? resumeParsed.name.split(/\s+/)[0] : '',
        lastName: resumeParsed?.name ? resumeParsed.name.split(/\s+/).slice(1).join(' ') : '',
        email: resumeParsed?.email || '',
        phone: resumeParsed?.phone || '',
        
        // Location parsing
        location: resumeParsed?.location || '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
        
        // Links
        linkedin: resumeParsed?.linkedin || '',
        github: resumeParsed?.github || '',
        website: resumeParsed?.website || '',
        
        // Skills and summary
        skills: resumeParsed?.skills || [],
        summary: resumeParsed?.summary || '',
        
        // Education (extract from resume text)
        education: '',
        degree: '',
        university: '',
        graduationYear: '',
        
        // Experience (extract from resume text)
        yearsOfExperience: '',
        currentCompany: '',
        currentTitle: '',
        previousCompany: '',
        
        // Work authorization (default assumptions)
        workAuthorized: 'yes',
        requiresSponsorship: 'no',
        
        // Preferences
        employmentType: 'Full-time',
        availability: 'Immediate',
        noticePeriod: '2 weeks',
        
        // Salary
        salaryExpectation: 'Negotiable',
        
        // Cover letter
        coverLetter: coverLetter || ''
      };
    } else {
      console.error('❌ No profile or resume data available for auto-fill');
      respond({ status: 'error', error: 'No data available' });
      return;
    }
    
    // Parse location into components (if needed for resume data)
    if (!profile && extractedData.location) {
      const locationParts = extractedData.location.split(',').map(s => s.trim());
      
      if (locationParts.length === 1) {
        // Just city or just country
        if (locationParts[0].length === 2) {
          extractedData.state = locationParts[0];
          extractedData.country = 'United States';
        } else {
          extractedData.city = locationParts[0];
        }
      } else if (locationParts.length === 2) {
        // "City, State" or "City, Country"
        extractedData.city = locationParts[0];
        const second = locationParts[1];
        if (second.length === 2) {
          extractedData.state = second;
          extractedData.country = 'United States';
        } else {
          extractedData.country = second;
        }
      } else if (locationParts.length >= 3) {
        // "City, State, Country" or "City, State, ZIP, Country"
        extractedData.city = locationParts[0];
        extractedData.state = locationParts[1];
        extractedData.country = locationParts[locationParts.length - 1];
      }
      
      // Extract ZIP code if present
      const zipMatch = extractedData.location.match(/\b\d{5}(?:-\d{4})?\b/);
      if (zipMatch) extractedData.zipCode = zipMatch[0];
    }
    
    // Extract education info
    const degreePatterns = [
      { pattern: /(?:PhD|Ph\.?D\.?|Doctorate|Doctoral)/i, value: "Doctorate", level: "PhD" },
      { pattern: /(?:Master|M\.?S\.?|M\.?A\.?|MBA|M\.?Tech)/i, value: "Master's Degree", level: "Master" },
      { pattern: /(?:Bachelor|B\.?S\.?|B\.?A\.?|B\.?Tech|B\.?E\.?)/i, value: "Bachelor's Degree", level: "Bachelor" },
      { pattern: /(?:Associate|A\.?S\.?|A\.?A\.?)/i, value: "Associate Degree", level: "Associate" }
    ];
    
    for (const deg of degreePatterns) {
      if (resumeText.match(deg.pattern)) {
        extractedData.education = deg.level;
        extractedData.degree = deg.value;
        break;
      }
    }
    
    // Extract university
    const uniMatch = resumeText.match(/(?:University of|College of|Institute of)\s+([A-Z][a-zA-Z\s]+)/);
    if (uniMatch) extractedData.university = uniMatch[0];
    
    // Extract graduation year
    const gradYearMatch = resumeText.match(/(?:Graduated|Graduation|Class of|')\s*(\d{4})/i);
    if (gradYearMatch) extractedData.graduationYear = gradYearMatch[1];
    
    // Extract years of experience
    const yearsMatch = resumeText.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s*of)?\s*(?:experience|exp)/i);
    if (yearsMatch) {
      extractedData.yearsOfExperience = yearsMatch[1];
    } else {
      // Try to count from dates in resume
      const years = resumeText.match(/20\d{2}/g);
      if (years && years.length >= 2) {
        const latest = Math.max(...years.map(Number));
        const earliest = Math.min(...years.map(Number));
        extractedData.yearsOfExperience = String(latest - earliest);
      }
    }
    
    // Extract current company
    const companyMatch = resumeText.match(/(?:at|@)\s+([A-Z][a-zA-Z\s&.,]+?(?:Inc|LLC|Corp|Ltd|Co|Company)?)\s*(?:\||•|,|\n|$)/);
    if (companyMatch) extractedData.currentCompany = companyMatch[1].trim();
    
    // Extract current title
    const titleMatch = resumeText.match(/(?:^|\n)([A-Z][a-zA-Z\s]+(?:Engineer|Developer|Designer|Manager|Analyst|Consultant|Architect|Lead|Director|Specialist))/m);
    if (titleMatch) extractedData.currentTitle = titleMatch[1].trim();
    
    console.log('📊 Extracted data:', extractedData);
    
    // === SMART DROPDOWN FILLER ===
    
    const fillSelectSmart = (element, searchValues, fieldName) => {
      if (!element || element.tagName !== 'SELECT') return false;
      if (!searchValues) return false;
      
      const valuesToTry = (Array.isArray(searchValues) ? searchValues : [searchValues])
        .filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      
      if (valuesToTry.length === 0) return false;
      
      const options = Array.from(element.options);
      if (options.length <= 1) return false;
      
      for (const searchValue of valuesToTry) {
        if (!searchValue) continue;
        
        const searchLower = String(searchValue).toLowerCase().trim();
        if (!searchLower) continue;
        
        // Try 1: Exact value match
        let match = options.find(opt => opt.value.toLowerCase() === searchLower);
        
        // Try 2: Exact text match
        if (!match) {
          match = options.find(opt => opt.text.toLowerCase().trim() === searchLower);
        }
        
        // Try 3: Value starts with search
        if (!match) {
          match = options.find(opt => opt.value.toLowerCase().startsWith(searchLower));
        }
        
        // Try 4: Text starts with search
        if (!match) {
          match = options.find(opt => opt.text.toLowerCase().trim().startsWith(searchLower));
        }
        
        // Try 5: Value contains search
        if (!match) {
          match = options.find(opt => opt.value.toLowerCase().includes(searchLower));
        }
        
        // Try 6: Text contains search
        if (!match) {
          match = options.find(opt => opt.text.toLowerCase().includes(searchLower));
        }
        
        // Try 7: Search contains value (for abbreviations)
        if (!match) {
          match = options.find(opt => 
            opt.value && searchLower.includes(opt.value.toLowerCase())
          );
        }
        
        // Try 8: Search contains text
        if (!match) {
          match = options.find(opt => 
            opt.text && opt.text.length > 2 && searchLower.includes(opt.text.toLowerCase().trim())
          );
        }
        
        if (match) {
          try {
            // Focus first to simulate user interaction
            element.focus();
            element.click();
            
            // Set the value
            element.value = match.value;
            element.selectedIndex = match.index;
            
            // Trigger comprehensive events for frameworks
            element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Trigger mouse events (some frameworks listen to these)
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            
            // Remove error states
            element.classList.remove('error', 'invalid', 'is-invalid', 'ng-pristine', 'ng-untouched');
            element.classList.add('valid', 'is-valid', 'ng-dirty', 'ng-touched', 'filled');
            
            // Remove aria-invalid
            element.removeAttribute('aria-invalid');
            element.setAttribute('aria-invalid', 'false');
            
            // Blur to finalize
            element.blur();
            
            console.log(`✅ Selected "${fieldName}": "${match.text}" (value: "${match.value}")`);
            filledCount++;
            filledFields.push(fieldName);
            return true;
          } catch (e) {
            console.error(`Error setting dropdown value:`, e);
          }
        }
      }
      
      console.warn(`⚠️ Could not match "${fieldName}" with any of:`, valuesToTry);
      return false;
    };
    
    // === SMART TEXT FIELD FILLER ===
    
    const fillTextSmart = (element, value, fieldName) => {
      if (!element || !value) return false;
      if (element.tagName === 'SELECT') return false;
      
      // Skip if already filled
      if (element.value && element.value.length > 10) {
        console.log(`⏭️ Skipping filled field: ${fieldName}`);
        return false;
      }
      
      try {
        const valueStr = String(value).trim();
        if (!valueStr) return false;
        
        // STEP 1: Simulate user interaction - Focus
        element.focus();
        element.click(); // Simulate click to trigger focus events
        
        // Wait a tiny bit for focus to register
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        
        // STEP 2: Set value using native setter (React/Vue/Angular compatibility)
        const prototypeProperty = element.tagName === 'TEXTAREA' 
          ? window.HTMLTextAreaElement.prototype 
          : window.HTMLInputElement.prototype;
        
        const nativeSetter = Object.getOwnPropertyDescriptor(prototypeProperty, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(element, valueStr);
        } else {
          element.value = valueStr;
        }
        
        // STEP 3: Trigger input events (simulates typing)
        element.dispatchEvent(new InputEvent('input', { 
          bubbles: true, 
          cancelable: true,
          data: valueStr,
          inputType: 'insertText'
        }));
        
        // STEP 3.5: Trigger composition events (for frameworks with floating labels)
        element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: valueStr }));
        element.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: valueStr }));
        element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: valueStr }));

        // STEP 4: Trigger keyboard events (for frameworks that listen to these)
        element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: valueStr[0] || 'a' }));
        element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: valueStr[0] || 'a' }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: valueStr[0] || 'a' }));
        
        // STEP 5: Trigger change event (for form validation)
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        
        // STEP 6: Remove Angular pristine/untouched classes
        element.classList.remove('ng-pristine', 'ng-untouched'); // Angular
        element.classList.add('ng-dirty', 'ng-touched', 'ng-valid'); // Angular
        
        // Mark as valid (remove error states)
        element.classList.remove('error', 'invalid', 'is-invalid', 'ng-invalid');
        element.classList.add('valid', 'is-valid', 'filled');
        
        // Remove aria-invalid
        element.removeAttribute('aria-invalid');
        element.setAttribute('aria-invalid', 'false');
        
        // STEP 7: Blur to finalize (triggers validation in many frameworks)
        // Use setTimeout to ensure value is processed before blur
        setTimeout(() => {
          element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
          element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
          
          // Force validation state after blur
          setTimeout(() => {
            if (element.value && element.value.trim()) {
              element.classList.remove('error', 'invalid', 'is-invalid', 'ng-invalid');
              element.classList.add('ng-valid', 'ng-dirty', 'ng-touched');
            }
          }, 50);
        }, 50);
        
        // Verify
        if (element.value === valueStr || element.value.length > 0) {
          console.log(`✅ Filled "${fieldName}": "${valueStr.substring(0, 60)}${valueStr.length > 60 ? '...' : ''}"`);
          filledCount++;
          filledFields.push(fieldName);
          return true;
        }
        
        return false;
      } catch (error) {
        console.error(`Error filling ${fieldName}:`, error);
        return false;
      }
    };
    
    // === AI FALLBACK: Ask popup to generate field content ===
    async function aiGenerateAndFill(field, fieldNameLabel, sectionHint = '') {
      try {
        // Build fieldInfo payload
        const fieldInfo = {
          label: (fieldNameLabel || '').toString(),
          placeholder: field.placeholder || '',
          name: field.name || field.id || '',
          type: (field.type || field.tagName || 'text').toLowerCase(),
          maxLength: parseInt(field.getAttribute('maxlength') || '0', 10) || 0,
          section: sectionHint || '',
          ariaLabel: field.getAttribute('aria-label') || '',
          dataAutomationId: field.getAttribute('data-automation-id') || '',
          dataFieldName: field.getAttribute('data-field-name') || '',
          className: field.className || ''
        };
        if (field.tagName === 'SELECT') {
          fieldInfo.options = Array.from(field.options).map(o => (o.text || o.value || '').trim()).filter(Boolean).slice(0, 100);
        }
        
        const content = await new Promise(resolve => {
          try {
            chrome.runtime.sendMessage({
              type: 'AI_GENERATE_FIELD_CONTENT',
              data: {
                fieldInfo,
                resumeData: profile || extractedData || {},
                jobDescription
              }
            }, (resp) => resolve(resp && resp.content ? resp.content : null));
          } catch (e) {
            resolve(null);
          }
        });
        
        if (!content) return false;
        
        if (field.tagName === 'SELECT') {
          return fillSelectSmart(field, [content], fieldInfo.label || 'AI Field');
        } else {
          return fillTextSmart(field, content, fieldInfo.label || 'AI Field');
        }
      } catch (err) {
        console.log('🤖 AI fallback error:', err);
        return false;
      }
    }
    
    // === SCAN ALL FORM FIELDS ===
    
    const allFields = Array.from(document.querySelectorAll('input, textarea, select'));
    console.log(`📝 Found ${allFields.length} total form fields`);
    
    const visibleFields = allFields.filter(field => {
      if (field.type === 'hidden') return false;
      if (field.disabled) return false;
      if (field.offsetParent === null && field.tagName !== 'SELECT') return false;
      if (field.getAttribute('aria-hidden') === 'true') return false;
      return true;
    });
    
    console.log(`✓ ${visibleFields.length} visible fields to process`);
    
    // === INTELLIGENT FIELD FILLING ===
    
    for (const field of visibleFields) {
      // Get field context
      const name = (field.name || '').toLowerCase();
      const id = (field.id || '').toLowerCase();
      const placeholder = (field.placeholder || '').toLowerCase();
      const type = (field.type || 'text').toLowerCase();
      const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
      const dataAutomationId = (field.getAttribute('data-automation-id') || '').toLowerCase();
      const dataFieldName = (field.getAttribute('data-field-name') || '').toLowerCase();
      const className = (field.className || '').toLowerCase();
      
      // Get label
      let label = '';
      if (field.id) {
        const labelEl = document.querySelector(`label[for="${field.id}"]`);
        if (labelEl) label = labelEl.textContent.toLowerCase().trim();
      }
      if (!label) {
        const parentLabel = field.closest('label');
        if (parentLabel) {
          label = parentLabel.textContent.toLowerCase().trim();
          // Remove the field's own text from label
          if (field.textContent) {
            label = label.replace(field.textContent.toLowerCase(), '').trim();
          }
        }
      }
      
      // Get parent section context (to detect if we're in a work/education/project section)
      // Check multiple levels up to catch nested structures
      const parentSection = field.closest([
        '[class*="experience"]', '[class*="education"]', '[class*="project"]',
        '[class*="work-history"]', '[class*="employment"]', '[class*="job"]',
        '[data-automation-id*="experience"]', '[data-automation-id*="education"]', '[data-automation-id*="project"]',
        '[id*="experience"]', '[id*="education"]', '[id*="project"]',
        'section:has([name*="project"])', 'section:has([name*="experience"])', 'section:has([name*="education"])',
        'div[class*="section"]:has([class*="project"])',
        'div[class*="section"]:has([class*="experience"])',
        'div[class*="section"]:has([class*="education"])'
      ].join(', '));
      const inDynamicSection = !!parentSection;
      
      // Also check if any ancestor element has project/experience/education keywords
      let ancestor = field.parentElement;
      let ancestorContext = '';
      for (let i = 0; i < 5 && ancestor; i++) {
        ancestorContext += ` ${ancestor.className || ''} ${ancestor.id || ''} ${ancestor.getAttribute('data-automation-id') || ''}`.toLowerCase();
        ancestor = ancestor.parentElement;
      }
      const inProjectSection = ancestorContext.includes('project') || inDynamicSection;
      const inExperienceSection = ancestorContext.includes('experience') || ancestorContext.includes('work') || ancestorContext.includes('employment');
      const inEducationSection = ancestorContext.includes('education') || ancestorContext.includes('school');
      
      const sectionContext = parentSection ? (parentSection.className || '').toLowerCase() : '';
      
      // Combined context for matching (including Workday & ATS-specific attributes)
      const context = `${name} ${id} ${placeholder} ${label} ${ariaLabel} ${dataAutomationId} ${dataFieldName} ${className}`.toLowerCase();
      
      const isSelect = field.tagName === 'SELECT';
      
      // === FILL BASED ON FIELD TYPE ===
      
      // EMAIL
      if (type === 'email' || context.match(/\b(email|e-mail)\b/)) {
        if (extractedData.email) {
          fillTextSmart(field, extractedData.email, 'Email');
          continue;
        }
      }
      
      // PHONE COUNTRY CODE (Dropdown for +1, +44, +91, etc.)
      // Match various patterns for country code dropdowns
      if (isSelect && (
        context.match(/\b(phone.*country|country.*phone|country.*code|dial.*code|phone.*code|calling.*code|telephone.*code)\b/) ||
        (context.match(/\bcountry\b/) && context.match(/\b(phone|mobile|tel)\b/)) ||
        (label.includes('country') && (name.includes('phone') || id.includes('phone')))
      )) {
        // Determine country code from user's phoneCountry field or country
        let phoneCountryCode = null;
        const userPhoneCountry = extractedData.phoneCountry || '';
        const userCountry = (extractedData.country || '').toLowerCase();
        
        console.log(`📞 Detected phone country code dropdown. User phoneCountry: "${userPhoneCountry}", country: "${userCountry}"`);
        
        // Priority 1: Use explicit phoneCountry field
        if (userPhoneCountry === 'UK' || userPhoneCountry === 'GB') {
          phoneCountryCode = ['+44', '44', 'UK', 'United Kingdom', 'GB', 'GBR'];
        } else if (userPhoneCountry === 'US') {
          phoneCountryCode = ['+1', '1', 'US', 'United States', 'USA'];
        } else if (userPhoneCountry === 'CA') {
          phoneCountryCode = ['+1', '1', 'CA', 'Canada'];
        } else if (userPhoneCountry === 'IN') {
          phoneCountryCode = ['+91', '91', 'IN', 'India', 'IND'];
        } else if (userPhoneCountry === 'AU') {
          phoneCountryCode = ['+61', '61', 'AU', 'Australia', 'AUS'];
        } else if (userPhoneCountry === 'DE') {
          phoneCountryCode = ['+49', '49', 'DE', 'Germany', 'DEU'];
        } else if (userPhoneCountry === 'FR') {
          phoneCountryCode = ['+33', '33', 'FR', 'France', 'FRA'];
        } else if (userPhoneCountry === 'NL') {
          phoneCountryCode = ['+31', '31', 'NL', 'Netherlands', 'NLD'];
        } else if (userPhoneCountry === 'ES') {
          phoneCountryCode = ['+34', '34', 'ES', 'Spain', 'ESP'];
        } else if (userPhoneCountry === 'IT') {
          phoneCountryCode = ['+39', '39', 'IT', 'Italy', 'ITA'];
        } else if (userPhoneCountry === 'IE') {
          phoneCountryCode = ['+353', '353', 'IE', 'Ireland', 'IRL'];
        } else if (userPhoneCountry === 'SG') {
          phoneCountryCode = ['+65', '65', 'SG', 'Singapore', 'SGP'];
        } else if (userPhoneCountry === 'NZ') {
          phoneCountryCode = ['+64', '64', 'NZ', 'New Zealand', 'NZL'];
        }
        // Priority 2: Infer from country field
        else if (userCountry.includes('united kingdom') || userCountry.includes('uk') || userCountry === 'gb') {
          phoneCountryCode = ['+44', '44', 'UK', 'United Kingdom', 'GB', 'GBR'];
        } else if (userCountry.includes('united states') || userCountry.includes('usa') || userCountry === 'us') {
          phoneCountryCode = ['+1', '1', 'US', 'United States', 'USA'];
        } else if (userCountry.includes('canada') || userCountry === 'ca') {
          phoneCountryCode = ['+1', '1', 'CA', 'Canada'];
        } else if (userCountry.includes('india') || userCountry === 'in') {
          phoneCountryCode = ['+91', '91', 'IN', 'India', 'IND'];
        } else if (userCountry.includes('australia') || userCountry === 'au') {
          phoneCountryCode = ['+61', '61', 'AU', 'Australia', 'AUS'];
        } else if (userCountry.includes('germany') || userCountry === 'de') {
          phoneCountryCode = ['+49', '49', 'DE', 'Germany', 'DEU'];
        } else if (userCountry.includes('france') || userCountry === 'fr') {
          phoneCountryCode = ['+33', '33', 'FR', 'France', 'FRA'];
        } else {
          // Default to UK if country not specified
          phoneCountryCode = ['+44', '44', 'UK', 'United Kingdom', 'GB', 'GBR'];
        }
        
        if (phoneCountryCode) {
          console.log(`📞 Filling phone country code dropdown with: ${phoneCountryCode[0]}`);
          fillSelectSmart(field, phoneCountryCode, 'Phone Country Code');
          continue;
        }
      }
      
      // PHONE
      if (type === 'tel' || context.match(/\b(phone|mobile|telephone|contact.*number)\b/) && !context.match(/country|code/)) {
        if (extractedData.phone) {
          fillTextSmart(field, extractedData.phone, 'Phone');
          continue;
        }
      }
      
      // === INTELLIGENT NAME FIELD CLASSIFICATION ===
      // Strategy: Only fill if we can CONFIDENTLY identify the field type
      // Skip ALL ambiguous fields to prevent wrong data from being filled
      
      // First: Never fill name fields if we're in work/education/project sections
      if (inDynamicSection || inProjectSection || inExperienceSection || inEducationSection) {
        if (context.match(/\bname\b/)) {
          console.log(`⏭️ Skipping name field - in dynamic section (work/edu/project). Context: "${context.substring(0, 80)}"`);
          continue;
        }
      }
      
      // Second: Check if this has non-personal context (company/project/school)
      const hasNonPersonalContext = context.match(/\b(company|employer|organization|business|project|school|university|college|institution|degree|course|program|local)\b/);
      
      if (hasNonPersonalContext) {
        console.log(`⏭️ Skipping non-personal name field. Context: "${context.substring(0, 80)}"`);
        continue;
      }
      
      // Third: Classify the exact type of name field
      let nameFieldType = null;
      
      // FIRST NAME - must have explicit "first" or "given" WITH "name"
      if (context.match(/\bfirst\s*name\b/) || context.match(/\bgiven\s*name\(s\)\b/) || context.match(/\bfname\b/) || context.match(/\bfirstname\b/)) {
        // But NOT if it also mentions last/family (that would be ambiguous)
        if (!context.match(/\b(last|family|sur)\b/)) {
          nameFieldType = 'firstName';
        }
      }
      // LAST NAME - must have explicit "last", "family", or "surname" WITH "name"
      else if (context.match(/\blast\s*name\b/) || context.match(/\bfamily\s*name\b/) || context.match(/\bsurname\b/) || context.match(/\blname\b/) || context.match(/\blastname\b/)) {
        // But NOT if it also mentions first/given (that would be ambiguous)
        if (!context.match(/\b(first|given)\b/)) {
          nameFieldType = 'lastName';
        }
      }
      // FULL NAME - only if EXPLICITLY stated with qualifiers
      else if (context.match(/\b(full\s*name|complete\s*name|legal\s*name|your\s*name|applicant\s*name|candidate\s*name)\b/)) {
        nameFieldType = 'fullName';
      }
      
      // Fill based on classified type
      if (nameFieldType === 'firstName' && extractedData.firstName) {
        console.log(`✅ Filling FIRST NAME. Context: "${context.substring(0, 70)}"`);
        fillTextSmart(field, extractedData.firstName, 'First Name');
        continue;
      } else if (nameFieldType === 'lastName' && extractedData.lastName) {
        console.log(`✅ Filling LAST NAME. Context: "${context.substring(0, 70)}"`);
        fillTextSmart(field, extractedData.lastName, 'Last Name');
        continue;
      } else if (nameFieldType === 'fullName' && extractedData.name) {
        console.log(`✅ Filling FULL NAME. Context: "${context.substring(0, 70)}"`);
        fillTextSmart(field, extractedData.name, 'Full Name');
        continue;
      }
      
      // If field contains "name" but we couldn't classify it confidently - try AI; else skip
      if (context.match(/\bname\b/)) {
        const aiOk = await aiGenerateAndFill(field, 'Personal Name', 'identity');
        if (aiOk) { continue; }
        console.log(`⏭️ Skipping unclassified/ambiguous name field. Context: "${context.substring(0, 100)}"`);
        continue;
      }

      
      // ADDRESS / STREET (Workday format)
      if (context.match(/\b(street|address.*line|address1|addressline1|addr1|home.*address)\b/) && !context.includes('email')) {
        if (extractedData.address) {
          fillTextSmart(field, extractedData.address, 'Address');
          continue;
        }
      }
      
      // CITY
      if (context.match(/\b(city|town)\b/) && !context.includes('country')) {
        if (isSelect) {
          const ok = fillSelectSmart(field, [extractedData.city], 'City');
          if (!ok) {
            const aiOk = await aiGenerateAndFill(field, 'City', 'location');
            if (aiOk) { continue; }
          } else { continue; }
        } else if (extractedData.city) {
          fillTextSmart(field, extractedData.city, 'City');
          continue;
        } else {
          const aiOk = await aiGenerateAndFill(field, 'City', 'location');
          if (aiOk) { continue; }
        }
      }
      
      // STATE/PROVINCE
      if (context.match(/\b(state|province|region)\b/) && !context.includes('country')) {
        if (isSelect) {
          const ok = fillSelectSmart(field, [extractedData.state, extractedData.state?.toUpperCase()], 'State');
          if (!ok) {
            const aiOk = await aiGenerateAndFill(field, 'State/Province', 'location');
            if (aiOk) { continue; }
          } else { continue; }
        } else if (extractedData.state) {
          fillTextSmart(field, extractedData.state, 'State');
          continue;
        } else {
          const aiOk = await aiGenerateAndFill(field, 'State/Province', 'location');
          if (aiOk) { continue; }
        }
      }
      
      // ZIP/POSTAL CODE
      if (context.match(/\b(zip|postal.*code|postcode|pincode)\b/)) {
        if (extractedData.zipCode) {
          fillTextSmart(field, extractedData.zipCode, 'ZIP Code');
          continue;
        }
      }
      
      // COUNTRY
      if (context.match(/\b(country|nation|citizenship)\b/)) {
        if (isSelect) {
          // Build comprehensive list of country variants
          const countryVariants = [];
          
          if (extractedData.country) {
            countryVariants.push(extractedData.country);
            
            const countryLower = extractedData.country.toLowerCase();
            
            // United States variants
            if (countryLower.includes('united states') || countryLower.includes('usa') || countryLower === 'us') {
              countryVariants.push('United States', 'US', 'USA', 'United States of America', 'America', 'U.S.', 'U.S.A.');
            }
            // United Kingdom variants
            else if (countryLower.includes('united kingdom') || countryLower.includes('uk') || countryLower === 'gb') {
              countryVariants.push('United Kingdom', 'UK', 'GB', 'Great Britain', 'U.K.', 'Britain');
            }
            // Canada variants
            else if (countryLower.includes('canada') || countryLower === 'ca') {
              countryVariants.push('Canada', 'CA', 'CAN');
            }
            // India variants
            else if (countryLower.includes('india') || countryLower === 'in') {
              countryVariants.push('India', 'IN', 'IND');
            }
            // Germany variants
            else if (countryLower.includes('germany') || countryLower === 'de') {
              countryVariants.push('Germany', 'DE', 'DEU', 'Deutschland');
            }
            // France variants
            else if (countryLower.includes('france') || countryLower === 'fr') {
              countryVariants.push('France', 'FR', 'FRA');
            }
            // Australia variants
            else if (countryLower.includes('australia') || countryLower === 'au') {
              countryVariants.push('Australia', 'AU', 'AUS');
            }
          }
          
          if (countryVariants.length > 0) {
            const ok = fillSelectSmart(field, countryVariants, 'Country');
            if (!ok) {
              const aiOk = await aiGenerateAndFill(field, 'Country', 'location');
              if (aiOk) { continue; }
            }
          } else {
            console.log('⚠️ No country data available to fill dropdown');
            const aiOk = await aiGenerateAndFill(field, 'Country', 'location');
            if (aiOk) { continue; }
          }
        } else if (extractedData.country) {
          fillTextSmart(field, extractedData.country, 'Country');
        }
        continue;
      }
      
      // LOCATION (combined field)
      if (context.match(/\b(location|address|where.*live)\b/)) {
        if (isSelect) {
          // For dropdown, try location and its parts
          const locationVariants = [];
          if (extractedData.location) {
            locationVariants.push(extractedData.location);
            // Split by comma for city, state combinations
            const parts = extractedData.location.split(',').map(s => s.trim());
            locationVariants.push(...parts);
          }
          if (extractedData.city) locationVariants.push(extractedData.city);
          if (extractedData.state) locationVariants.push(extractedData.state);
          
          fillSelectSmart(field, locationVariants, 'Location');
        } else if (extractedData.location) {
          fillTextSmart(field, extractedData.location, 'Location');
        } else {
          const aiOk = await aiGenerateAndFill(field, 'Location', 'location');
          if (aiOk) { continue; }
        }
        continue;
      }
      
      // LINKEDIN
      if (context.match(/\b(linkedin|linked-in)\b/)) {
        if (extractedData.linkedin) {
          fillTextSmart(field, extractedData.linkedin, 'LinkedIn');
          continue;
        }
      }
      
      // GITHUB
      if (context.match(/\b(github|git)\b/)) {
        if (extractedData.github) {
          fillTextSmart(field, extractedData.github, 'GitHub');
          continue;
        }
      }
      
      // WEBSITE/PORTFOLIO
      if (type === 'url' || context.match(/\b(website|portfolio|personal.*site|homepage|blog)\b/)) {
        if (extractedData.website) {
          fillTextSmart(field, extractedData.website, 'Website');
          continue;
        }
      }
      
      // EDUCATION LEVEL
      if (context.match(/\b(education|degree|qualification|highest.*education|level.*education)\b/)) {
        if (isSelect) {
          // Create comprehensive degree variants
          const degreeVariants = [];
          if (extractedData.degree) {
            const deg = extractedData.degree;
            degreeVariants.push(deg); // Original
            
            // Remove "'s Degree" or " Degree" suffix
            const withoutDegree = deg.replace(/'s\s+Degree$/i, '').replace(/\s+Degree$/i, '').trim();
            degreeVariants.push(withoutDegree);
            
            // Add "'s" variant if not present
            if (!deg.includes("'s") && !deg.endsWith('s')) {
              degreeVariants.push(deg + "'s");
              degreeVariants.push(deg + "'s Degree");
            }
            
            // Add " Degree" variant
            if (!deg.toLowerCase().includes('degree')) {
              degreeVariants.push(deg + ' Degree');
            }
            
            // First word only (e.g., "Bachelor", "Master", "Associate")
            const firstWord = deg.split(/\s+/)[0];
            if (firstWord && firstWord.length > 3) {
              degreeVariants.push(firstWord);
              degreeVariants.push(firstWord + "'s");
              degreeVariants.push(firstWord + "'s Degree");
            }
            
            // Common abbreviations
            const degLower = deg.toLowerCase();
            if (degLower.includes('bachelor')) {
              degreeVariants.push("Bachelor's", "Bachelor's Degree", "Bachelors", "Bachelor", 
                                  "BS", "B.S.", "B.A.", "BA", "Undergraduate");
            } else if (degLower.includes('master')) {
              degreeVariants.push("Master's", "Master's Degree", "Masters", "Master", 
                                  "MS", "M.S.", "M.A.", "MA", "Graduate");
            } else if (degLower.includes('doctor') || degLower.includes('phd')) {
              degreeVariants.push("Doctorate", "PhD", "Ph.D.", "Doctoral", "Doctoral Degree");
            } else if (degLower.includes('associate')) {
              degreeVariants.push("Associate's", "Associate", "Associates", "AS", "A.S.", "AA", "A.A.");
            } else if (degLower.includes('high school') || degLower.includes('diploma')) {
              degreeVariants.push("High School", "High School Diploma", "HS Diploma", "Secondary");
            }
            
            // Remove duplicates
            const uniqueVariants = [...new Set(degreeVariants)].filter(v => v);
            fillSelectSmart(field, uniqueVariants, 'Education Degree');
          } else {
            // No degree data - try common defaults
            fillSelectSmart(field, ["Bachelor's Degree", "Bachelor's", "High School"], 'Education Degree');
          }
        } else if (extractedData.degree) {
          fillTextSmart(field, extractedData.degree, 'Education');
        }
        continue;
      }
      
      // UNIVERSITY/SCHOOL
      if (context.match(/\b(university|college|school|institution)\b/) && !context.includes('high')) {
        if (extractedData.university) {
          if (isSelect) {
            fillSelectSmart(field, [extractedData.university], 'University');
          } else {
            fillTextSmart(field, extractedData.university, 'University');
          }
          continue;
        }
      }
      
      // GRADUATION YEAR
      if (context.match(/\b(graduation.*year|year.*graduation|grad.*year)\b/)) {
        if (extractedData.graduationYear) {
          if (isSelect) {
            fillSelectSmart(field, [extractedData.graduationYear], 'Graduation Year');
          } else {
            fillTextSmart(field, extractedData.graduationYear, 'Graduation Year');
          }
          continue;
        }
      }
      
      // YEARS OF EXPERIENCE
      if (context.match(/\b(years.*experience|experience.*years|yoe|total.*experience)\b/)) {
        if (extractedData.yearsOfExperience) {
          if (isSelect) {
            fillSelectSmart(field, [
              extractedData.yearsOfExperience,
              extractedData.yearsOfExperience + '+',
              extractedData.yearsOfExperience + ' years',
              extractedData.yearsOfExperience + '-' + (parseInt(extractedData.yearsOfExperience) + 2)
            ], 'Years of Experience');
          } else {
            fillTextSmart(field, extractedData.yearsOfExperience, 'Years of Experience');
          }
          continue;
        }
      }
      
      // CURRENT COMPANY
      if (context.match(/\b(current.*company|current.*employer|company.*name|employer)\b/)) {
        if (extractedData.currentCompany) {
          if (isSelect) {
            fillSelectSmart(field, [extractedData.currentCompany], 'Current Company');
          } else {
            fillTextSmart(field, extractedData.currentCompany, 'Current Company');
          }
          continue;
        }
      }
      
      // CURRENT JOB TITLE
      if (context.match(/\b(current.*title|current.*position|job.*title|current.*role|position.*title)\b/)) {
        if (extractedData.currentTitle) {
          if (isSelect) {
            fillSelectSmart(field, [extractedData.currentTitle], 'Current Title');
          } else {
            fillTextSmart(field, extractedData.currentTitle, 'Current Title');
          }
          continue;
        }
      }
      
      // WORK AUTHORIZATION
      if (context.match(/\b(work.*authorization|authorized.*work|legally.*work|right.*work|visa.*status|sponsorship.*required)\b/)) {
        if (isSelect) {
          if (context.includes('sponsor')) {
            fillSelectSmart(field, ['No', 'no', 'false', 'Do not require'], 'Sponsorship');
          } else {
            fillSelectSmart(field, ['Yes', 'yes', 'true', 'Authorized', 'authorized to work'], 'Work Authorization');
          }
        } else {
          fillTextSmart(field, 'Yes', 'Work Authorization');
        }
        continue;
      }
      
      // EMPLOYMENT TYPE
      if (context.match(/\b(employment.*type|job.*type|position.*type|work.*type)\b/)) {
        if (isSelect) {
          fillSelectSmart(field, ['Full-time', 'Full time', 'Permanent', 'FTE'], 'Employment Type');
        }
        continue;
      }
      
      // AVAILABILITY / NOTICE PERIOD
      if (context.match(/\b(availability|notice.*period|start.*date|when.*start|available.*start|join.*date)\b/)) {
        if (isSelect) {
          fillSelectSmart(field, ['Immediate', 'Immediately', 'ASAP', '2 weeks', 'Two weeks'], 'Availability');
        } else {
          fillTextSmart(field, 'Immediate', 'Availability');
        }
        continue;
      }
      
      // SALARY EXPECTATION
      if (context.match(/\b(salary|compensation|expected.*salary|salary.*expectation|pay.*range)\b/)) {
        if (isSelect) {
          fillSelectSmart(field, ['Negotiable', 'Market rate', 'Competitive'], 'Salary');
        } else {
          fillTextSmart(field, 'Negotiable', 'Salary');
        }
        continue;
      }
      
      // GENDER (EEO fields - common in Workday, Greenhouse)
      if (context.match(/\b(gender|sex)\b/) && isSelect && !context.includes('sexual')) {
        if (extractedData.gender) {
          // Generate comprehensive gender variants
          const genderVariants = [
            extractedData.gender,
            extractedData.gender.charAt(0).toUpperCase() + extractedData.gender.slice(1).toLowerCase(),
            extractedData.gender.toLowerCase(),
            extractedData.gender.toUpperCase()
          ];
          
          // Add common abbreviations
          const lowerGender = extractedData.gender.toLowerCase();
          if (lowerGender.includes('male') && !lowerGender.includes('female')) {
            genderVariants.push('Male', 'male', 'MALE', 'M', 'm');
          } else if (lowerGender.includes('female')) {
            genderVariants.push('Female', 'female', 'FEMALE', 'F', 'f');
          } else if (lowerGender.includes('non-binary') || lowerGender.includes('nonbinary')) {
            genderVariants.push('Non-binary', 'Nonbinary', 'non-binary', 'nonbinary', 'Other', 'other');
          } else if (lowerGender.includes('prefer')) {
            genderVariants.push('Prefer not to say', 'Prefer not to answer', 'Decline to self identify');
          }
          
          fillSelectSmart(field, genderVariants, 'Gender');
        } else {
          // Even if no gender data, try common default
          fillSelectSmart(field, ['Prefer not to say', 'Decline to self identify'], 'Gender');
        }
        continue;
      }
      
      // DISABILITY STATUS (EEO fields)
      if (context.match(/\b(disability|disabled|handicap)\b/) && isSelect) {
        const disabilityVariants = [];
        if (extractedData.disability) {
          disabilityVariants.push(extractedData.disability);
          const disLower = extractedData.disability.toLowerCase();
          if (disLower.includes('no') || disLower.includes('not')) {
            disabilityVariants.push('No', 'No, I do not have a disability', 'I do not have a disability', 'None');
          } else if (disLower.includes('yes')) {
            disabilityVariants.push('Yes', 'Yes, I have a disability', 'I have a disability');
          } else if (disLower.includes('prefer')) {
            disabilityVariants.push("I don't wish to answer", "Prefer not to say", "Decline to self identify");
          }
        } else {
          // Default to prefer not to answer
          disabilityVariants.push("I don't wish to answer", "Prefer not to say", "Decline to self identify");
        }
        fillSelectSmart(field, disabilityVariants, 'Disability Status');
        continue;
      }
      
      // VETERAN STATUS (EEO fields - common in US job applications)
      if (context.match(/\b(veteran|protected.*veteran|military)\b/) && isSelect) {
        const veteranVariants = [];
        if (extractedData.veteran) {
          veteranVariants.push(extractedData.veteran);
          const vetLower = extractedData.veteran.toLowerCase();
          if (vetLower.includes('no') || vetLower.includes('not')) {
            veteranVariants.push('I am not a protected veteran', 'No', 'Not a veteran', 'I am not a veteran');
          } else if (vetLower.includes('yes')) {
            veteranVariants.push('I am a protected veteran', 'Yes', 'Protected veteran');
          } else if (vetLower.includes('prefer')) {
            veteranVariants.push("I don't wish to answer", "Prefer not to say", "Decline to self identify");
          }
        } else {
          // Default to not a veteran
          veteranVariants.push('I am not a protected veteran', "I don't wish to answer", 'No', 'Not a veteran');
        }
        fillSelectSmart(field, veteranVariants, 'Veteran Status');
        continue;
      }
      
      // ETHNICITY/RACE (EEO fields)
      if (context.match(/\b(ethnicity|race|ethnic)\b/) && isSelect) {
        const ethnicityVariants = [];
        if (extractedData.ethnicity) {
          ethnicityVariants.push(extractedData.ethnicity);
          // Add variations
          const ethLower = extractedData.ethnicity.toLowerCase();
          if (ethLower.includes('prefer')) {
            ethnicityVariants.push("Prefer not to say", "I don't wish to answer", "Decline to self identify");
          }
        } else {
          // Default to prefer not to answer
          ethnicityVariants.push("Prefer not to say", "I don't wish to answer", "Decline to self identify");
        }
        fillSelectSmart(field, ethnicityVariants, 'Ethnicity');
        continue;
      }
      
      // SKILLS
      if (context.match(/\b(skills|expertise|technologies|technical.*skills|competencies)\b/) && field.tagName !== 'SELECT') {
        const skillsText = Array.isArray(extractedData.skills) 
          ? extractedData.skills.join(', ') 
          : extractedData.skills;
        
        if (skillsText) {
          fillTextSmart(field, skillsText, 'Skills');
          continue;
        }
      }
      
      // SUMMARY / BIO / ABOUT
      if (context.match(/\b(summary|bio|about.*you|about.*yourself|profile|introduction|objective)\b/) && field.tagName === 'TEXTAREA') {
        if (extractedData.summary) {
          fillTextSmart(field, extractedData.summary, 'Summary');
          continue;
        }
      }
      
      // COVER LETTER
      if (field.tagName === 'TEXTAREA' && extractedData.coverLetter) {
        const isLarge = (field.rows > 4 || field.offsetHeight > 100);
        const isCoverLetter = context.match(/\b(cover.*letter|why.*you|why.*interest|why.*apply|motivation|message|additional.*info|tell.*us.*about)\b/);
        
        if (isLarge || isCoverLetter) {
          let textToFill = extractedData.coverLetter;
          
          // Handle maxLength
          if (field.maxLength > 0 && field.maxLength < textToFill.length) {
            const paragraphs = textToFill.split('\n\n');
            textToFill = paragraphs[0] + '\n\n' + paragraphs[paragraphs.length - 1];
            if (textToFill.length > field.maxLength) {
              textToFill = textToFill.substring(0, field.maxLength - 20);
            }
          }
          
          fillTextSmart(field, textToFill, 'Cover Letter');
          continue;
        }
      }
      
      // TWITTER/SOCIAL MEDIA
      if (context.match(/\b(twitter|social.*media)\b/) && !context.includes('linkedin')) {
        if (extractedData.twitter) {
          fillTextSmart(field, extractedData.twitter, 'Twitter');
          continue;
        }
      }
      
      // GPA (for recent grads)
      if (context.match(/\b(gpa|grade.*point)\b/)) {
        if (extractedData.gpa) {
          fillTextSmart(field, extractedData.gpa, 'GPA');
          continue;
        }
      }
      
      // FIELD OF STUDY / MAJOR
      if (context.match(/\b(major|field.*study|area.*study|subject|specialization)\b/) && !isSelect) {
        if (extractedData.field) {
          fillTextSmart(field, extractedData.field, 'Field of Study');
          continue;
        }
      }
    }
    
    // === HANDLE FILE UPLOAD FIELDS ===
    // Try to auto-upload resume PDF if available
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (fileInputs.length > 0) {
      console.log(`📎 Found ${fileInputs.length} file upload field(s)`);
      
      // Check if we have a resume PDF in profile
      if (profile && profile.resumePdfBase64 && profile.resumePdfName) {
        console.log(`📎 Resume PDF available: ${profile.resumePdfName}`);
        
        for (const input of fileInputs) {
          // Get comprehensive context
          const label = input.closest('label')?.textContent || '';
          const labelLower = label.toLowerCase();
          const nameLower = (input.name || '').toLowerCase();
          const idLower = (input.id || '').toLowerCase();
          const placeholderLower = (input.placeholder || '').toLowerCase();
          
          // Check parent elements for context (up to 3 levels)
          let parentContext = '';
          let parent = input.parentElement;
          // Get previous sibling text (often labels are before input)
          let siblingContext = '';
          let prevSibling = input.previousElementSibling;
          if (prevSibling) {
            siblingContext = (prevSibling.textContent || '').toLowerCase();
          }
          
          const fullContext = `${labelLower} ${nameLower} ${idLower} ${placeholderLower} ${parentContext} ${siblingContext}`;
          
          // Check if this looks like a resume/CV upload field
          const isResumeField = 
            fullContext.includes('resume') || 
            fullContext.includes('cv') || 
            fullContext.includes('curriculum') || 
            fullContext.includes('vitae') ||
            fullContext.includes('upload resume') ||
            fullContext.includes('attach resume') ||
            fullContext.includes('your resume') ||
            fullContext.includes('upload your') ||
            fullContext.includes('attach your') ||
            fullContext.includes('upload cv') ||
            fullContext.includes('attach cv');
          
          // If no specific keyword found but it's the ONLY file input or first one, try it anyway
          const shouldTryUpload = isResumeField || (fileInputs.length === 1) || (fileInputs.indexOf(input) === 0);
          
          if (shouldTryUpload) {
            try {
              console.log(`📎 Uploading resume to: ${label.trim() || input.name || input.id || `File input #${fileInputs.indexOf(input) + 1}`}`);
              
              // Convert base64 to File object
              // Handle both formats: "data:application/pdf;base64,..." and just base64 string
              const base64Data = profile.resumePdfBase64.includes(',') 
                ? profile.resumePdfBase64.split(',')[1] 
                : profile.resumePdfBase64;
              
              const binaryData = atob(base64Data);
              const bytes = new Uint8Array(binaryData.length);
              for (let i = 0; i < binaryData.length; i++) {
                bytes[i] = binaryData.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: 'application/pdf' });
              const file = new File([blob], profile.resumePdfName, { 
                type: 'application/pdf',
                lastModified: Date.now()
              });
              
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              input.files = dataTransfer.files;
              
              await new Promise(resolve => setTimeout(resolve, 200));
              
              input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              input.dispatchEvent(new Event('blur', { bubbles: true }));
              input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
              input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              console.log(`✅ Resume uploaded: ${profile.resumePdfName}`);
              filledCount++;
              filledFields.push('Resume PDF');
            } catch (error) {
              console.error(`❌ Failed to auto-upload resume:`, error);
            }
          }
        }
      } else {
        console.log(`⚠️ No resume PDF found in profile. Please upload in profile page.`);
        if (!profile) {
          console.log(`   ℹ️ No profile data available`);
        } else if (!profile.resumePdfBase64) {
          console.log(`   ℹ️ Profile exists but no resumePdfBase64 field`);
        } else if (!profile.resumePdfName) {
          console.log(`   ℹ️ Profile exists but no resumePdfName field`);
        }
        
        fileInputs.forEach((input, idx) => {
          const label = input.closest('label')?.textContent || input.name || input.id || 'Unnamed';
          console.log(`   ${idx + 1}. ${label.trim()} - Please upload manually`);
        });
      }
    }
    
    // === HANDLE DYNAMIC SECTIONS ===
    
    // Fill Work Experience entries
    if (extractedData.workExperience && Array.isArray(extractedData.workExperience) && extractedData.workExperience.length > 0) {
      const workFilled = await fillMultipleWorkExperiences(extractedData.workExperience);
      filledCount += workFilled;
      if (workFilled > 0) {
        filledFields.push(`${workFilled} work experience fields`);
      }
    }
    
    // Fill Education entries
    if (extractedData.education && Array.isArray(extractedData.education) && extractedData.education.length > 0) {
      const eduFilled = await fillMultipleEducation(extractedData.education);
      filledCount += eduFilled;
      if (eduFilled > 0) {
        filledFields.push(`${eduFilled} education fields`);
      }
    }
    
    // Fill Project entries
    if (extractedData.projects && Array.isArray(extractedData.projects) && extractedData.projects.length > 0) {
      const projectsFilled = await fillMultipleProjects(extractedData.projects);
      filledCount += projectsFilled;
      if (projectsFilled > 0) {
        filledFields.push(`${projectsFilled} project fields`);
      }
    }
    
    // === FINAL STEP: Trigger form validation ===
    
    // Find all forms and trigger validation
    const forms = document.querySelectorAll('form');
    forms.forEach((form, idx) => {
      try {
        form.dispatchEvent(new Event('change', { bubbles: true }));
        form.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof form.checkValidity === 'function') {
          form.checkValidity();
        }
      } catch (e) {
        // Silent fail
      }
    });
    
    // Re-check all filled fields to ensure they're marked as valid
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Aggressive validation state cleanup - run multiple times to override framework validation
    for (let attempt = 0; attempt < 3; attempt++) {
      visibleFields.forEach(field => {
        if (field.value && field.value.trim().length > 0) {
          // Remove all possible error classes
          field.classList.remove('error', 'invalid', 'is-invalid', 'ng-invalid', 'has-error', 'field-error');
          // Add all possible valid classes
          field.classList.add('valid', 'is-valid', 'filled', 'ng-valid', 'ng-dirty', 'ng-touched');
          // Remove aria-invalid
          field.removeAttribute('aria-invalid');
          field.setAttribute('aria-invalid', 'false');
          
          // Also check parent elements for error states
          const parent = field.parentElement;
          if (parent) {
            parent.classList.remove('has-error', 'error', 'is-invalid');
            parent.classList.add('has-success', 'is-valid');
          }
        }
      });
      
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`\n✅ AUTO-FILL COMPLETE!`);
    console.log(`📊 Filled ${filledCount} fields:`, filledFields);
    
    // Update notification with results
    showAutoFillNotification(`✅ Auto-filled ${filledCount} field(s)! Review and submit.`, 'success');
    
    respond({ 
      status: 'ok', 
      filled: filledCount > 0,
      filledCount,
      fields: filledFields
    });
    
  } catch (error) {
    console.error('❌ Autofill error:', error);
    showAutoFillNotification('❌ Auto-fill failed: ' + error.message, 'error');
    respond({ status: 'error', error: error.message });
  }
}

// Visual notification for auto-fill
function showAutoFillNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.getElementById('jobify-autofill-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'jobify-autofill-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: ${type === 'success' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                 type === 'error' ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' :
                 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'};
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
    backdrop-filter: blur(10px);
  `;
  
  notification.textContent = message;
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Auto-remove after delay
  const removeDelay = type === 'success' || type === 'error' ? 4000 : 2000;
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, removeDelay);
}

// Legacy helper removed - using new findAndClickAddButtonInSection instead

// Fill multiple work experience entries - BATTLE-TESTED APPROACH
async function fillMultipleWorkExperiences(experiences) {
  console.log(`\n💼 AUTO-FILLING ${experiences.length} WORK EXPERIENCES`);
  let totalFilled = 0;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Find work experience section
  const workSection = await findSectionContainer('work experience', [
    'work experience', 'employment history', 'professional experience', 
    'work history', 'career history', 'employment'
  ]);
  
  if (!workSection) {
    console.log('❌ Work section not found');
    return 0;
  }
  
  workSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await new Promise(resolve => setTimeout(resolve, 800));
  workSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // HELPER: Get all visible work fields (including filled ones)
  const getAllWorkFields = () => {
    return Array.from(workSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
      .filter(field => {
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (field.disabled || field.readOnly) return false;
        
        // Exclude skills fields
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
        
        return true;
      });
  };
  
  // CHECK: Does the section already have fields, or do we need to create the first entry?
  const initialFields = getAllWorkFields();
  console.log(`📊 Initial work experience fields found: ${initialFields.length}`);
  
  const needsFirstEntry = initialFields.length === 0;
  if (needsFirstEntry) {
    console.log(`🔘 No fields found - will need to click Add for first entry too!`);
  }
  
  // Process each work experience
  for (let i = 0; i < experiences.length; i++) {
    const exp = experiences[i];
    console.log(`\n📝 Entry #${i + 1}: ${exp.company} - ${exp.title}`);
    
    // STRATEGY: Get snapshot of fields BEFORE any action
    const fieldsBeforeAction = getAllWorkFields();
    console.log(`   📊 Total fields before: ${fieldsBeforeAction.length}`);
    
    // Click Add button if:
    // 1. This is NOT the first entry (i > 0), OR
    // 2. This IS the first entry but no fields exist (needsFirstEntry)
    const shouldClickAdd = (i > 0) || (i === 0 && needsFirstEntry);
    
    if (shouldClickAdd) {
      console.log(`\n   ➕ Clicking Add button for entry #${i + 1}...`);
      
      const addButtons = Array.from(workSection.querySelectorAll('button, a, [role="button"]'));
      let addClicked = false;
      
      for (const btn of addButtons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('add') && (text.includes('experience') || text.includes('another') || text === 'add')) {
          console.log(`   🖱️ Clicking: "${btn.textContent.trim()}"`);
          btn.click();
          addClicked = true;
          await new Promise(resolve => setTimeout(resolve, 800));
          break;
        }
      }
      
      if (!addClicked) {
        console.log(`   ⚠️ Add button not found - stopping`);
        break;
      }
      
      // Wait for new fields to appear
      let newFieldsAppeared = false;
      for (let wait = 0; wait < 10; wait++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const currentFields = getAllWorkFields();
        if (currentFields.length > fieldsBeforeAction.length) {
          console.log(`   ✅ New fields detected! (${currentFields.length} total, was ${fieldsBeforeAction.length})`);
          newFieldsAppeared = true;
          break;
        }
      }
      
      if (!newFieldsAppeared) {
        console.log(`   ⚠️ No new fields appeared after Add click`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`   ℹ️ Using existing fields (first entry already present)`);
    }
    
    // NOW get available fields for THIS entry
    const getAllEmptyWorkFields = () => {
      return Array.from(workSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .filter(field => {
          const style = window.getComputedStyle(field);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (field.disabled || field.readOnly) return false;
          
          // Accept EMPTY fields OR fields that match previous entries (to allow overwriting if needed)
          const isEmpty = !field.value || field.value.trim() === '';
          
          // Exclude skills fields
          const label = getFieldLabel(field).toLowerCase();
          const id = (field.id || '').toLowerCase();
          const name = (field.name || '').toLowerCase();
          if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
          
          return isEmpty;
        });
    };
    
    // SMART FIELD MATCHER - Finds best field for data using multiple strategies
    const findBestFieldForData = (fields, dataKey, dataValue) => {
      const patterns = {
        company: {
          keywords: ['company', 'employer', 'organization', 'organisation', 'business', 'firm'],
          antiKeywords: ['title', 'position', 'role', 'date', 'year', 'description', 'location']
        },
        title: {
          keywords: ['title', 'position', 'role', 'job title', 'job', 'designation'],
          antiKeywords: ['company', 'employer', 'date', 'year', 'description', 'location']
        },
        startDate: {
          keywords: ['start', 'from', 'begin', 'starting', 'started', 'join', 'joined'],
          antiKeywords: ['end', 'to', 'until', 'finish', 'leaving', 'left', 'completion', 'complete', 'present', 'current']
        },
        endDate: {
          keywords: ['end', 'to', 'until', 'finish', 'finished', 'ending', 'ended', 'leaving', 'left', 'present', 'current'],
          antiKeywords: ['start', 'from', 'begin', 'starting', 'started', 'join', 'joined']
        },
        location: {
          keywords: ['location', 'city', 'place', 'where', 'based', 'country', 'state', 'region', 'locale', 'area'],
          antiKeywords: ['company', 'title', 'description', 'responsibility', 'duty', 'skill']
        },
        description: {
          keywords: ['description', 'responsibilities', 'duties', 'summary', 'role', 'what you did', 'details'],
          antiKeywords: ['company', 'title', 'location', 'date']
        }
      };
      
      const pattern = patterns[dataKey];
      if (!pattern) return null;
      
      let bestField = null;
      let bestScore = -9999;
      
      for (const field of fields) {
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const fieldType = (field.type || field.tagName).toLowerCase();
        
        const fullContext = `${label} ${id} ${name} ${placeholder}`;
        let score = 0;
        
        // Positive keyword matching
        for (const keyword of pattern.keywords) {
          if (fullContext.includes(keyword)) {
            // Label match is strongest
            if (label.includes(keyword)) score += 100;
            // ID/name match is good
            else if (id.includes(keyword) || name.includes(keyword)) score += 50;
            // Placeholder match is okay
            else if (placeholder.includes(keyword)) score += 25;
          }
        }
        
        // Negative keyword matching (penalties)
        for (const antiKeyword of pattern.antiKeywords) {
          if (fullContext.includes(antiKeyword)) {
            score -= 40;
          }
        }
        
        // Type bonuses
        if (dataKey === 'description' && fieldType === 'textarea') score += 30;
        if (dataKey.includes('Date') && (fieldType.includes('date') || fieldType.includes('month'))) score += 30;
        
        // Special handling for date fields - check if field name contains month/year indicators
        if (dataKey === 'startDate') {
          if (fullContext.includes('start') || fullContext.includes('from') || fullContext.includes('begin')) {
            score += 20;
          }
          // Penalty if it looks like an end date
          if (fullContext.includes('end') || fullContext.includes('to') || fullContext.includes('until')) {
            score -= 100;
          }
        }
        if (dataKey === 'endDate') {
          if (fullContext.includes('end') || fullContext.includes('to') || fullContext.includes('until')) {
            score += 20;
          }
          // Penalty if it looks like a start date
          if (fullContext.includes('start') || fullContext.includes('from') || fullContext.includes('begin')) {
            score -= 100;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestField = field;
        }
      }
      
      return bestScore > 0 ? bestField : null;
    };
    
    // Get empty fields for THIS iteration
    const emptyFields = getAllEmptyWorkFields();
    
    if (emptyFields.length === 0) {
      console.log(`   ⚠️ No empty fields found in work section #${workSections.indexOf(section) + 1}`);
    }
    
    const dataToFill = {
      company: exp.company,
      title: exp.title,
      location: exp.location,
      startDate: exp.startDate,
      endDate: exp.endDate || 'Present',
      description: exp.description
    };
    
    let entryFilledCount = 0;
    const filledFieldsList = [...emptyFields];
    
    for (const [key, value] of Object.entries(dataToFill)) {
      if (!value) continue;
      
      const field = findBestFieldForData(filledFieldsList, key, value);
      if (field) {
        if (field.tagName === 'SELECT') {
          if (key === 'location') {
            const locationParts = value.split(',').map(s => s.trim());
            const locationVariants = [value, ...locationParts];
            fillSelectSmart(field, locationVariants, `Work ${key}`);
          } else {
            fillSelectSmart(field, [value], `Work ${key}`);
          }
        } else {
          await simpleFieldFill(field, String(value));
        }
        
        entryFilledCount++;
        totalFilled++;
        
        const idx = filledFieldsList.indexOf(field);
        if (idx > -1) filledFieldsList.splice(idx, 1);
        
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.log(`   ✓ Entry #${i + 1} complete: filled ${entryFilledCount} fields`);
  }
  
  console.log(`\n✅ Work Experience Complete: ${totalFilled} total fields filled`);
  return totalFilled;
}

// Fill multiple education entries - BATTLE-TESTED APPROACH (same as work experience)
async function fillMultipleEducation(educationList) {
  console.log(`\n🎓 AUTO-FILLING ${educationList.length} EDUCATION ENTRIES`);
  let totalFilled = 0;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Find education section
  const eduSection = await findSectionContainer('education', [
    'education', 'academic', 'schools', 'degrees', 'qualifications',
    'academic background', 'educational background', 'my education'
  ]);
  
  if (!eduSection) {
    console.log('❌ Education section not found');
    return 0;
  }
  
  eduSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // HELPER: Get all visible education fields
  const getAllEduFields = () => {
    return Array.from(eduSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
      .filter(field => {
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (field.disabled || field.readOnly) return false;
        
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
        
        return true;
      });
  };
  
  // CHECK: Does section have fields or need to create first entry?
  const initialFields = getAllEduFields();
  console.log(`📊 Initial education fields found: ${initialFields.length}`);
  
  const needsFirstEntry = initialFields.length === 0;
  if (needsFirstEntry) {
    console.log(`🔘 No fields found - will click Add for first entry!`);
  }
  
  // Process each education entry
  for (let i = 0; i < educationList.length; i++) {
    const edu = educationList[i];
    console.log(`\n📚 Entry #${i + 1}: ${edu.degree} from ${edu.institution}`);
    
    const fieldsBeforeAction = getAllEduFields();
    console.log(`   📊 Total fields before: ${fieldsBeforeAction.length}`);
    
    const shouldClickAdd = (i > 0) || (i === 0 && needsFirstEntry);
    
    if (shouldClickAdd) {
      console.log(`\n   ➕ Clicking Add button for entry #${i + 1}...`);
      
      const addButtons = Array.from(eduSection.querySelectorAll('button, a, [role="button"]'));
      let addClicked = false;
      
      for (const btn of addButtons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('add') && (text.includes('education') || text.includes('school') || text.includes('degree') || text.includes('another') || text === 'add')) {
          console.log(`   🖱️ Clicking: "${btn.textContent.trim()}"`);
          btn.click();
          addClicked = true;
          await new Promise(resolve => setTimeout(resolve, 800));
          break;
        }
      }
      
      if (!addClicked) {
        console.log(`   ⚠️ Add button not found - stopping`);
        break;
      }
      
      // Wait for new fields
      let newFieldsAppeared = false;
      for (let wait = 0; wait < 10; wait++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const currentFields = getAllEduFields();
        if (currentFields.length > fieldsBeforeAction.length) {
          console.log(`   ✅ New fields detected! (${currentFields.length} total, was ${fieldsBeforeAction.length})`);
          newFieldsAppeared = true;
          break;
        }
      }
      
      if (!newFieldsAppeared) {
        console.log(`   ⚠️ No new fields appeared`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`   ℹ️ Using existing fields`);
    }
    
    // Get empty fields
    const getAllEmptyEduFields = () => {
      return Array.from(eduSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .filter(field => {
          const style = window.getComputedStyle(field);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (field.disabled || field.readOnly) return false;
          
          const isEmpty = !field.value || field.value.trim() === '';
          
          const label = getFieldLabel(field).toLowerCase();
          const id = (field.id || '').toLowerCase();
          const name = (field.name || '').toLowerCase();
          if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
          
          return isEmpty;
        });
    };
    
    // Field matcher for education
    const findBestFieldForData = (fields, dataKey, dataValue) => {
      const patterns = {
        institution: {
          keywords: ['school', 'university', 'college', 'institution', 'academy', 'institute', 'educational'],
          antiKeywords: ['high school name', 'grade', 'degree', 'field', 'major', 'date', 'gpa']
        },
        degree: {
          keywords: ['degree', 'level', 'qualification', 'education level', 'highest education', 'diploma', 'credential', 'program', 'course'],
          antiKeywords: ['temperature', 'angle', 'field', 'school', 'university', 'major', 'date']
        },
        field: {
          keywords: ['major', 'field', 'study', 'concentration', 'specialization', 'subject', 'discipline', 'area of study', 'program', 'area'],
          antiKeywords: ['work', 'job', 'company', 'degree', 'school', 'university', 'date']
        },
        graduationDate: {
          keywords: ['graduation', 'grad date', 'completion', 'end date', 'finish', 'awarded', 'conferred', 'year', 'graduated', 'end', 'date'],
          antiKeywords: ['start', 'begin', 'enrollment']
        },
        gpa: {
          keywords: ['gpa', 'grade', 'marks', 'score', 'cgpa', 'percentage', 'grade point', 'average'],
          antiKeywords: ['school name', 'university', 'institution']
        }
      };
      
      const pattern = patterns[dataKey];
      if (!pattern) return null;
      
      let bestField = null;
      let bestScore = -9999;
      
      for (const field of fields) {
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const fieldType = (field.type || field.tagName).toLowerCase();
        
        const fullContext = `${label} ${id} ${name} ${placeholder}`;
        let score = 0;
        
        for (const keyword of pattern.keywords) {
          if (fullContext.includes(keyword)) {
            if (label.includes(keyword)) score += 100;
            else if (id.includes(keyword) || name.includes(keyword)) score += 50;
            else if (placeholder.includes(keyword)) score += 25;
          }
        }
        
        for (const antiKeyword of pattern.antiKeywords) {
          if (fullContext.includes(antiKeyword)) {
            score -= 40;
          }
        }
        
        if (dataKey === 'graduationDate' && (fieldType.includes('date') || fullContext.includes('year'))) score += 20;
        if (dataKey === 'gpa' && fieldType === 'number') score += 20;
        
        if (score > bestScore) {
          bestScore = score;
          bestField = field;
        }
      }
      
      return bestScore > 0 ? bestField : null;
    };
    
    const emptyFields = getAllEmptyEduFields();
    
    if (emptyFields.length === 0) {
      console.log(`   ⚠️ No empty fields found in education section`);
    }
    
    const dataToFill = {
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      graduationDate: edu.graduationDate,
      gpa: edu.gpa
    };
    
    let entryFilledCount = 0;
    const filledFieldsList = [...emptyFields];
    
    for (const [key, value] of Object.entries(dataToFill)) {
      if (!value) continue;
      
      const field = findBestFieldForData(filledFieldsList, key, value);
      if (field) {
        if (field.tagName === 'SELECT') {
          if (key === 'degree') {
            // Create comprehensive degree variants
            const degreeVariants = [value];
            
            // Remove "'s Degree" or " Degree" suffix
            const withoutDegree = value.replace(/'s\s+Degree$/i, '').replace(/\s+Degree$/i, '').trim();
            degreeVariants.push(withoutDegree);
            
            // Add "'s" variant if not present
            if (!value.includes("'s") && !value.endsWith('s')) {
              degreeVariants.push(value + "'s");
              degreeVariants.push(value + "'s Degree");
            }
            
            // Add " Degree" variant
            if (!value.toLowerCase().includes('degree')) {
              degreeVariants.push(value + ' Degree');
            }
            
            // First word only
            const firstWord = value.split(/\s+/)[0];
            if (firstWord && firstWord.length > 3) {
              degreeVariants.push(firstWord);
              degreeVariants.push(firstWord + "'s");
            }
            
            // Common abbreviations based on degree type
            const degLower = value.toLowerCase();
            if (degLower.includes('bachelor')) {
              degreeVariants.push("Bachelor's", "Bachelor's Degree", "Bachelors", "Bachelor", 
                                  "BS", "B.S.", "B.A.", "BA");
            } else if (degLower.includes('master')) {
              degreeVariants.push("Master's", "Master's Degree", "Masters", "Master", 
                                  "MS", "M.S.", "M.A.", "MA");
            } else if (degLower.includes('doctor') || degLower.includes('phd')) {
              degreeVariants.push("Doctorate", "PhD", "Ph.D.", "Doctoral");
            } else if (degLower.includes('associate')) {
              degreeVariants.push("Associate's", "Associate", "Associates", "AS", "A.S.");
            }
            
            // Remove duplicates and empty values
            const uniqueVariants = [...new Set(degreeVariants)].filter(v => v);
            fillSelectSmart(field, uniqueVariants, `Education ${key}`);
          } else {
            fillSelectSmart(field, [value], `Education ${key}`);
          }
        } else {
          await simpleFieldFill(field, String(value));
        }
        
        entryFilledCount++;
        totalFilled++;
        
        const idx = filledFieldsList.indexOf(field);
        if (idx > -1) filledFieldsList.splice(idx, 1);
        
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.log(`   ✓ Entry #${i + 1} complete: filled ${entryFilledCount} fields`);
  }
  
  console.log(`\n✅ Education Complete: ${totalFilled} total fields filled`);
  return totalFilled;
}

// Fill multiple project entries - BATTLE-TESTED APPROACH (same as work experience)
async function fillMultipleProjects(projects) {
  console.log(`\n🚀 AUTO-FILLING ${projects.length} PROJECT ENTRIES`);
  let totalFilled = 0;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Find projects section
  const projectsSection = await findSectionContainer('projects', [
    'projects', 'portfolio', 'work samples', 'personal projects',
    'side projects', 'coding projects', 'my projects'
  ]);
  
  if (!projectsSection) {
    console.log('❌ Projects section not found');
    return 0;
  }
  
  projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // HELPER: Get all visible project fields
  const getAllProjectFields = () => {
    return Array.from(projectsSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
      .filter(field => {
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (field.disabled || field.readOnly) return false;
        
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
        
        return true;
      });
  };
  
  // CHECK: Does section have fields or need to create first entry?
  const initialFields = getAllProjectFields();
  console.log(`📊 Initial project fields found: ${initialFields.length}`);
  
  const needsFirstEntry = initialFields.length === 0;
  if (needsFirstEntry) {
    console.log(`🔘 No fields found - will click Add for first entry!`);
  }
  
  // Process each project entry
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    console.log(`\n💡 Entry #${i + 1}: ${project.name}`);
    
    const fieldsBeforeAction = getAllProjectFields();
    console.log(`   📊 Total fields before: ${fieldsBeforeAction.length}`);
    
    const shouldClickAdd = (i > 0) || (i === 0 && needsFirstEntry);
    
    if (shouldClickAdd) {
      console.log(`\n   ➕ Clicking Add button for entry #${i + 1}...`);
      
      const addButtons = Array.from(projectsSection.querySelectorAll('button, a, [role="button"]'));
      let addClicked = false;
      
      for (const btn of addButtons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('add') && (text.includes('project') || text.includes('portfolio') || text.includes('another') || text === 'add')) {
          console.log(`   🖱️ Clicking: "${btn.textContent.trim()}"`);
          btn.click();
          addClicked = true;
          await new Promise(resolve => setTimeout(resolve, 800));
          break;
        }
      }
      
      if (!addClicked) {
        console.log(`   ⚠️ Add button not found - stopping`);
        break;
      }
      
      // Wait for new fields
      let newFieldsAppeared = false;
      for (let wait = 0; wait < 10; wait++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const currentFields = getAllProjectFields();
        if (currentFields.length > fieldsBeforeAction.length) {
          console.log(`   ✅ New fields detected! (${currentFields.length} total, was ${fieldsBeforeAction.length})`);
          newFieldsAppeared = true;
          break;
        }
      }
      
      if (!newFieldsAppeared) {
        console.log(`   ⚠️ No new fields appeared`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`   ℹ️ Using existing fields`);
    }
    
    // Get empty fields
    const getAllEmptyProjectFields = () => {
      return Array.from(projectsSection.querySelectorAll('input:not([type="hidden"]), textarea, select'))
        .filter(field => {
          const style = window.getComputedStyle(field);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (field.disabled || field.readOnly) return false;
          
          const isEmpty = !field.value || field.value.trim() === '';
          
          const label = getFieldLabel(field).toLowerCase();
          const id = (field.id || '').toLowerCase();
          const name = (field.name || '').toLowerCase();
          if (label.includes('skill') || id.includes('skill') || name.includes('skill')) return false;
          
          return isEmpty;
        });
    };
    
    // Field matcher for projects
    const findBestFieldForData = (fields, dataKey, dataValue) => {
      const patterns = {
        name: {
          keywords: ['name', 'title', 'project name', 'project title'],
          antiKeywords: ['description', 'tech', 'url', 'link', 'date']
        },
        description: {
          keywords: ['description', 'details', 'summary', 'about', 'what'],
          antiKeywords: ['name', 'title', 'tech', 'url', 'link']
        },
        technologies: {
          keywords: ['tech', 'technology', 'technologies', 'stack', 'tools', 'skills', 'language'],
          antiKeywords: ['name', 'title', 'description', 'url']
        },
        url: {
          keywords: ['url', 'link', 'website', 'demo', 'github', 'repo', 'repository'],
          antiKeywords: ['name', 'title', 'description']
        }
      };
      
      const pattern = patterns[dataKey];
      if (!pattern) return null;
      
      let bestField = null;
      let bestScore = -9999;
      
      for (const field of fields) {
        const label = getFieldLabel(field).toLowerCase();
        const id = (field.id || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const fieldType = (field.type || field.tagName).toLowerCase();
        
        const fullContext = `${label} ${id} ${name} ${placeholder}`;
        let score = 0;
        
        for (const keyword of pattern.keywords) {
          if (fullContext.includes(keyword)) {
            if (label.includes(keyword)) score += 100;
            else if (id.includes(keyword) || name.includes(keyword)) score += 50;
            else if (placeholder.includes(keyword)) score += 25;
          }
        }
        
        for (const antiKeyword of pattern.antiKeywords) {
          if (fullContext.includes(antiKeyword)) {
            score -= 40;
          }
        }
        
        if (dataKey === 'description' && fieldType === 'textarea') score += 30;
        if (dataKey === 'url' && fieldType === 'url') score += 20;
        
        if (score > bestScore) {
          bestScore = score;
          bestField = field;
        }
      }
      
      return bestScore > 0 ? bestField : null;
    };
    
    const emptyFields = getAllEmptyProjectFields();
    console.log(`   📊 Found ${emptyFields.length} empty fields available`);
    
    if (emptyFields.length === 0) {
      console.log(`   ⚠️ No empty fields found`);
      const allFields = getAllProjectFields();
      if (allFields.length > 0) {
        console.log(`   📋 Sample fields:`);
        allFields.slice(0, 3).forEach(f => {
          console.log(`      - ID: ${f.id || 'none'}, Value: "${f.value}", Label: "${getFieldLabel(f)}"`);
        });
      }
    }
    
    const dataToFill = {
      name: project.name,
      description: project.description,
      technologies: Array.isArray(project.technologies) ? project.technologies.join(', ') : project.technologies,
      url: project.url
    };
    
    let entryFilledCount = 0;
    const filledFieldsList = [...emptyFields];
    
    for (const [key, value] of Object.entries(dataToFill)) {
      if (!value) continue;
      
      const field = findBestFieldForData(filledFieldsList, key, value);
      if (field) {
        const fieldLabel = getFieldLabel(field);
        console.log(`   ✅ Filling ${key}: "${fieldLabel}" (ID: ${field.id || 'none'}) ← ${String(value).substring(0, 40)}`);
        
        await simpleFieldFill(field, String(value));
        entryFilledCount++;
        totalFilled++;
        
        const idx = filledFieldsList.indexOf(field);
        if (idx > -1) filledFieldsList.splice(idx, 1);
        
        await new Promise(resolve => setTimeout(resolve, 150));
      } else {
        console.log(`   ⚠️ No matching field found for ${key} = "${value}"`);
      }
    }
    
    console.log(`   ✓ Entry #${i + 1} complete: filled ${entryFilledCount} fields`);
  }
  
  console.log(`\n✅ Projects Complete: ${totalFilled} total fields filled`);
  return totalFilled;
}
// === IMPROVED DYNAMIC SECTION HELPERS ===

// Find the main section container (e.g., "Work Experience", "Education", "Projects")
async function findSectionContainer(sectionType, searchTerms) {
  console.log(`🔍 Looking for ${sectionType} section...`);
  
  // Look for headings that contain our search terms
  const headingSelectors = 'h1, h2, h3, h4, h5, h6, .heading, .section-title, .title, [role="heading"]';
  const headings = Array.from(document.querySelectorAll(headingSelectors));
  
  for (const heading of headings) {
    const headingText = heading.textContent.toLowerCase().trim();
    
    for (const term of searchTerms) {
      if (headingText.includes(term.toLowerCase())) {
        console.log(`  ✓ Found section heading: "${headingText}"`);
        
        // Try to find the section container that follows this heading
        let sectionContainer = heading.parentElement;
        
        // Look up the DOM tree to find a proper section container
        for (let i = 0; i < 5 && sectionContainer; i++) {
          if (sectionContainer.tagName === 'SECTION' || 
              sectionContainer.classList.toString().includes('section') ||
              sectionContainer.classList.toString().includes(sectionType) ||
              sectionContainer.getAttribute('data-automation-id')?.includes(sectionType)) {
            return sectionContainer;
          }
          sectionContainer = sectionContainer.parentElement;
        }
        
        // If no proper container found, use the heading's parent
        return heading.parentElement;
      }
    }
  }
  
  // Fallback: Look for sections with data attributes or classes
  const fallbackSelectors = [
    `[data-automation-id*="${sectionType}"]`,
    `[class*="${sectionType}"]`,
    `section:has([class*="${sectionType}"])`,
    `div:has(h1:contains("${searchTerms[0]}"))`
  ];
  
  for (const selector of fallbackSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`  ✓ Found section via fallback: ${selector}`);
        return element;
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }
  
  return null;
}

// DYNAMIC: Detect new fields that appear after clicking Add button
async function detectNewlyAddedFields(sectionContainer, fieldsBefore) {
  console.log(`  🔍 Detecting newly added fields...`);
  
  // Get all current fields
  const allFieldsNow = Array.from(sectionContainer.querySelectorAll('input:not([type="hidden"]), textarea, select'));
  
  // Find fields that weren't there before
  const newFields = allFieldsNow.filter(field => !fieldsBefore.includes(field));
  
  if (newFields.length === 0) {
    console.log(`  ⚠️ No new fields detected`);
    return null;
  }
  
  console.log(`  ✅ Found ${newFields.length} new fields`);
  
  // Find the common parent container of these new fields
  let commonParent = newFields[0];
  
  // Walk up the DOM tree to find a container that contains ALL new fields
  for (let level = 0; level < 10; level++) {
    if (!commonParent) break;
    
    const containsAll = newFields.every(field => commonParent.contains(field));
    
    if (containsAll) {
      // Check if this is a reasonable container (not the whole section)
      const fieldsInContainer = commonParent.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
      const newFieldsCount = newFields.length;
      
      // If this container has mostly new fields, it's probably the right one
      if (fieldsInContainer <= newFieldsCount * 2) {
        console.log(`  📦 Found container: ${commonParent.tagName}.${commonParent.className.substring(0, 40)}`);
        console.log(`  📊 Container has ${fieldsInContainer} total fields, ${newFieldsCount} are new`);
        return commonParent;
      }
    }
    
    commonParent = commonParent.parentElement;
  }
  
  console.log(`  ⚠️ Could not find container, using section itself`);
  return sectionContainer;
}

// Find existing entry slots - SIMPLIFIED, just look for groups of fields
async function findExistingEntrySlots(sectionContainer, entryType) {
  console.log(`  🔍 Searching for ${entryType} entry containers...`);
  
  // Define expected field patterns for each entry type
  const expectedPatterns = {
    'work': ['title', 'company', 'job', 'employer', 'position', 'role'],
    'education': ['school', 'university', 'degree', 'college', 'institution'],
    'project': ['project', 'name', 'title']
  };
  
  const patterns = expectedPatterns[entryType] || [];
  
  // Get ALL elements within the section that have form fields
  const allElements = Array.from(sectionContainer.querySelectorAll('*'));
  
  const potentialContainers = allElements.filter(el => {
    // Skip tiny elements
    if (el.offsetHeight < 30 || el.offsetWidth < 100) return false;
    
    // Must have form fields inside
    const fieldCount = el.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
    
    // Valid entry containers have multiple fields (flexible range)
    if (fieldCount < 2) return false;
    
    // IMPORTANT: Check if this container has fields matching our expected pattern
    const allFieldsInContainer = Array.from(el.querySelectorAll('input, textarea, select'));
    const hasExpectedFields = allFieldsInContainer.some(field => {
      const fieldContext = `
        ${field.name || ''} 
        ${field.id || ''} 
        ${field.placeholder || ''} 
        ${getFieldLabel(field)}
      `.toLowerCase();
      
      // Check if this field matches our expected patterns
      return patterns.some(pattern => fieldContext.includes(pattern));
    });
    
    if (!hasExpectedFields) return false;
    
    return true;
  });
  
  // Remove nested duplicates - keep only outermost containers
  const validEntries = potentialContainers.filter((container, index) => {
    // Check if this container is inside any other container in the list
    const isNested = potentialContainers.some((other, otherIndex) => {
      return otherIndex !== index && other.contains(container);
    });
    return !isNested;
  });
  
  validEntries.forEach((entry, idx) => {
    const fieldCount = entry.querySelectorAll('input:not([type="hidden"]), textarea, select').length;
    const sampleField = entry.querySelector('input, textarea, select');
    const sampleLabel = sampleField ? getFieldLabel(sampleField).substring(0, 30) : 'no label';
    console.log(`    ✓ Entry ${idx + 1}: ${entry.tagName}.${entry.className.substring(0, 30)} (${fieldCount} fields, sample: "${sampleLabel}")`);
  });
  
  console.log(`  📊 Found ${validEntries.length} ${entryType} entry containers`);
  return validEntries;
}

// Find and click Add button within a specific section
async function findAndClickAddButtonInSection(sectionContainer, buttonTexts) {
  console.log(`  🔘 Looking for Add button in section...`);
  
  // Look for buttons within the section
  const buttons = Array.from(sectionContainer.querySelectorAll('button, a, span[role="button"], div[role="button"]'));
  
  for (const button of buttons) {
    const buttonText = button.textContent.toLowerCase().trim();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const title = (button.getAttribute('title') || '').toLowerCase();
    const allText = `${buttonText} ${ariaLabel} ${title}`;
    
    for (const searchText of buttonTexts) {
      if (allText.includes(searchText.toLowerCase())) {
        console.log(`    ✓ Found Add button: "${buttonText}"`);
        
        // Scroll into view and click
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await new Promise(resolve => setTimeout(resolve, 300));
        
        button.focus();
        button.click();
        
        return true;
      }
    }
  }
  
  // Also look for buttons just outside the section (sometimes Add buttons are at the bottom)
  const parentContainer = sectionContainer.parentElement;
  if (parentContainer) {
    const nearbyButtons = Array.from(parentContainer.querySelectorAll('button, a[role="button"]'))
      .filter(btn => {
        const rect = btn.getBoundingClientRect();
        const sectionRect = sectionContainer.getBoundingClientRect();
        
        // Check if button is visually near the section
        return Math.abs(rect.top - sectionRect.bottom) < 100 || 
               Math.abs(rect.bottom - sectionRect.top) < 100;
      });
    
    for (const button of nearbyButtons) {
      const buttonText = button.textContent.toLowerCase().trim();
      
      for (const searchText of buttonTexts) {
        if (buttonText.includes(searchText.toLowerCase())) {
          console.log(`    ✓ Found nearby Add button: "${buttonText}"`);
          
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(resolve => setTimeout(resolve, 300));
          
          button.focus();
          button.click();
          
          return true;
        }
      }
    }
  }
  
  return false;
}

// Find a specific entry container by index
async function findEntryContainer(sectionContainer, entryIndex, entryType) {
  const entrySlots = await findExistingEntrySlots(sectionContainer, entryType);
  
  console.log(`    🔍 Looking for ${entryType} entry #${entryIndex + 1} (found ${entrySlots.length} slots)`);
  
  if (entrySlots.length > entryIndex) {
    const targetEntry = entrySlots[entryIndex];
    console.log(`    ✅ Found target ${entryType} entry container at index ${entryIndex}`);
    return targetEntry;
  }
  
  // If not enough slots, but we have at least one, use the last one
  if (entrySlots.length > 0) {
    const lastEntry = entrySlots[entrySlots.length - 1];
    console.log(`    ⚠️ Using last available ${entryType} entry (index ${entrySlots.length - 1}) for target ${entryIndex}`);
    return lastEntry;
  }
  
  // Fallback: no entry containers found, use section itself
  console.log(`    ⚠️ No ${entryType} entry containers found, using section container`);
  return sectionContainer;
}

// ============================================================================
// SMART FIELD FILLING WITH FLEXIBLE MATCHING
// ============================================================================

// Fill fields using smart label matching (like Simplify does)
async function fillEntryFields(entryContainer, fieldData, entryType) {
  console.log(`\n💼 Filling ${entryType} fields...`);
  console.log(`📦 Data available:`, fieldData);
  
  let filledCount = 0;
  
  // Wait for DOM to settle and fields to be rendered
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Get ALL input fields in the container
  const allInputs = entryContainer.querySelectorAll('input:not([type="hidden"]), textarea, select');
  console.log(`📊 Found ${allInputs.length} total fields in container`);
  console.log(`🔍 Container:`, entryContainer.className, entryContainer.id);
  
  // Filter to visible, editable fields with DETAILED logging
  const fields = Array.from(allInputs).filter(field => {
    if (field.disabled || field.readOnly) {
      console.log(`  ⏭️ Skipping disabled/readonly: ${field.name || field.id}`);
      return false;
    }
    if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'file') {
      console.log(`  ⏭️ Skipping ${field.type}: ${field.name || field.id}`);
      return false;
    }
    
    const style = window.getComputedStyle(field);
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    
    if (!isVisible) {
      console.log(`  ⏭️ Hidden field: ${field.name || field.id} (display:${style.display}, visibility:${style.visibility})`);
      return false;
    }
    
    const label = getFieldLabel(field);
    const currentValue = field.value || '(empty)';
    console.log(`  ✅ VISIBLE FIELD: ${field.tagName} | name="${field.name}" | id="${field.id}" | label="${label}" | current="${currentValue.substring(0, 30)}"`);
    
    return true;
  });
  
  console.log(`\n✅ ${fields.length} VISIBLE, EDITABLE fields found\n`);
  
  if (fields.length === 0) {
    console.log(`⚠️ No fields found in container!`);
    return 0;
  }
  
  // Build smarter data map with field type hints
  const dataMap = [];
  
  if (entryType === 'work') {
    if (fieldData.company) dataMap.push({ 
      value: fieldData.company, 
      keywords: ['company', 'employer', 'organization', 'business'],
      antiKeywords: ['email', 'phone', 'title', 'position', 'date', 'year', 'description'],
      fieldTypes: ['text'],
      priority: 100
    });
    if (fieldData.title) dataMap.push({ 
      value: fieldData.title, 
      keywords: ['title', 'position', 'role', 'job title'],
      antiKeywords: ['company', 'employer', 'date', 'year', 'description'],
      fieldTypes: ['text'],
      priority: 90
    });
    if (fieldData.startDate) dataMap.push({ 
      value: fieldData.startDate, 
      keywords: ['start', 'from', 'begin', 'starting'],
      antiKeywords: ['end', 'to', 'until', 'completion'],
      fieldTypes: ['date', 'month', 'text'],
      priority: 80,
      isDate: true
    });
    if (fieldData.endDate) dataMap.push({ 
      value: fieldData.endDate, 
      keywords: ['end', 'to', 'until', 'ending', 'completion'],
      antiKeywords: ['start', 'from', 'begin'],
      fieldTypes: ['date', 'month', 'text'],
      priority: 70,
      isDate: true
    });
    if (fieldData.description) dataMap.push({ 
      value: fieldData.description, 
      keywords: ['description', 'responsibilities', 'duties', 'role', 'what you did'],
      antiKeywords: ['company', 'title', 'date', 'year'],
      fieldTypes: ['textarea', 'text'],
      priority: 60
    });
  } else if (entryType === 'education') {
    if (fieldData.institution) dataMap.push({ 
      value: fieldData.institution, 
      keywords: ['school', 'university', 'college', 'institution', 'name of'],
      antiKeywords: ['degree', 'field', 'major', 'date', 'year', 'gpa', 'grade'],
      fieldTypes: ['text'],
      priority: 100
    });
    if (fieldData.degree) dataMap.push({ 
      value: fieldData.degree, 
      keywords: ['degree', 'qualification', 'program', 'level'],
      antiKeywords: ['school', 'university', 'field', 'major', 'date', 'year', 'gpa'],
      fieldTypes: ['text', 'select'],
      priority: 90
    });
    if (fieldData.field) dataMap.push({ 
      value: fieldData.field, 
      keywords: ['field', 'major', 'study', 'subject', 'area', 'concentration'],
      antiKeywords: ['school', 'degree', 'date', 'year', 'gpa', 'grade'],
      fieldTypes: ['text'],
      priority: 85
    });
    if (fieldData.graduationDate) dataMap.push({ 
      value: fieldData.graduationDate, 
      keywords: ['graduation', 'year', 'attended', 'end', 'completion', 'graduated'],
      antiKeywords: ['school', 'degree', 'field', 'major', 'gpa', 'start'],
      fieldTypes: ['date', 'month', 'text', 'select'],
      priority: 75,
      isDate: true
    });
    if (fieldData.gpa) dataMap.push({ 
      value: fieldData.gpa, 
      keywords: ['gpa', 'grade', 'result', 'score', 'cgpa'],
      antiKeywords: ['school', 'degree', 'field', 'date', 'year'],
      fieldTypes: ['text', 'number'],
      priority: 70
    });
  } else if (entryType === 'project') {
    if (fieldData.name) dataMap.push({ 
      value: fieldData.name, 
      keywords: ['name', 'title', 'project name', 'project title'],
      antiKeywords: ['description', 'tech', 'url', 'link'],
      fieldTypes: ['text'],
      priority: 100
    });
    if (fieldData.description) dataMap.push({ 
      value: fieldData.description, 
      keywords: ['description', 'about', 'details', 'summary'],
      antiKeywords: ['name', 'title', 'tech', 'url'],
      fieldTypes: ['textarea', 'text'],
      priority: 80
    });
    if (fieldData.technologies) dataMap.push({ 
      value: fieldData.technologies, 
      keywords: ['tech', 'technology', 'stack', 'tools', 'skills'],
      antiKeywords: ['name', 'description', 'url'],
      fieldTypes: ['text', 'textarea'],
      priority: 70
    });
    if (fieldData.url) dataMap.push({ 
      value: fieldData.url, 
      keywords: ['url', 'link', 'website', 'github', 'demo'],
      antiKeywords: ['name', 'description', 'tech'],
      fieldTypes: ['url', 'text'],
      priority: 60
    });
  }
  
  console.log(`\n📝 Attempting to fill ${dataMap.length} data values with SMART matching...\n`);
  
  // Match and fill each data item with INTELLIGENT SCORING
  const filledFields = new Set();
  
  for (const data of dataMap) {
    console.log(`\n🎯 Processing: ${data.keywords[0].toUpperCase()} = "${String(data.value).substring(0, 40)}..."`);
    
    let bestField = null;
    let bestScore = -999;
    let scoreDetails = [];
    
    for (const field of fields) {
      if (filledFields.has(field)) continue; // Skip already filled fields
      
      const label = getFieldLabel(field).toLowerCase();
      const fieldName = (field.name || field.id || '').toLowerCase();
      const placeholder = (field.placeholder || '').toLowerCase();
      const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
      const fieldType = (field.type || field.tagName.toLowerCase()).toLowerCase();
      const isRequired = field.required || field.getAttribute('aria-required') === 'true';
      
      const context = `${label} ${fieldName} ${placeholder} ${ariaLabel}`;
      
      let score = 0;
      let matches = [];
      let penalties = [];
      
      // POSITIVE SCORING: Keyword matches
      for (const keyword of data.keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // Exact match in label (highest score)
        if (label === keywordLower) {
          score += 50;
          matches.push(`EXACT:${keyword}`);
        }
        // Label contains keyword as whole word
        else if (new RegExp(`\\b${keywordLower}\\b`).test(label)) {
          score += 30;
          matches.push(`WORD:${keyword}`);
        }
        // Contains in any context
        else if (context.includes(keywordLower)) {
          score += 10;
          matches.push(`PARTIAL:${keyword}`);
        }
      }
      
      // NEGATIVE SCORING: Anti-keyword penalties (avoid wrong fields)
      if (data.antiKeywords) {
        for (const antiKeyword of data.antiKeywords) {
          if (context.includes(antiKeyword.toLowerCase())) {
            score -= 25;
            penalties.push(`ANTI:${antiKeyword}`);
          }
        }
      }
      
      // FIELD TYPE MATCHING BONUS
      if (data.fieldTypes && data.fieldTypes.includes(fieldType)) {
        score += 15;
        matches.push(`TYPE:${fieldType}`);
      }
      
      // DATE FIELD SPECIAL HANDLING
      if (data.isDate) {
        // Prefer actual date/month fields for dates
        if (fieldType === 'date' || fieldType === 'month') {
          score += 25;
          matches.push('DATE_FIELD');
        }
        // Penalize textarea for dates
        if (fieldType === 'textarea') {
          score -= 30;
          penalties.push('TEXTAREA_FOR_DATE');
        }
      } else {
        // Non-date data should avoid date fields
        if (fieldType === 'date' || fieldType === 'month') {
          score -= 40;
          penalties.push('DATE_FIELD_FOR_TEXT');
        }
      }
      
      // REQUIRED FIELD BONUS (likely to be important fields)
      if (isRequired && score > 0) {
        score += 5;
        matches.push('REQUIRED');
      }
      
      // TEXTAREA BONUS for long text
      if (fieldType === 'textarea' && String(data.value).length > 100) {
        score += 20;
        matches.push('TEXTAREA_FOR_LONG');
      }
      
      // SIZE MATCHING: Avoid putting long text in short fields
      if (field.maxLength && field.maxLength > 0) {
        if (String(data.value).length > field.maxLength) {
          score -= 50;
          penalties.push(`TOO_LONG:${field.maxLength}`);
        }
      }
      
      if (score > 0 || penalties.length > 0) {
        scoreDetails.push({
          field: field.name || field.id || 'unnamed',
          label: label || 'no label',
          type: fieldType,
          score: score,
          matches: matches,
          penalties: penalties
        });
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }
    
    // Sort score details by score for better logging
    scoreDetails.sort((a, b) => b.score - a.score);
    console.log(`  🔍 Top 3 field matches:`, scoreDetails.slice(0, 3));
    
    if (bestField && bestScore > 0) {
      const fieldInfo = getFieldLabel(bestField) || bestField.name || bestField.id || 'unknown';
      console.log(`  ✅ BEST MATCH: "${fieldInfo}" (score: ${bestScore}, type: ${bestField.type || bestField.tagName})`);
      console.log(`  📤 Filling with: "${String(data.value).substring(0, 50)}..."`);
      
      const success = await simpleFieldFill(bestField, data.value);
      
      if (success) {
        filledCount++;
        filledFields.add(bestField);
        console.log(`  ✅✅✅ SUCCESSFULLY FILLED!`);
      } else {
        console.log(`  ❌❌❌ FILL FAILED - field is still empty!`);
      }
    } else {
      console.log(`  ❌ No good match found (best score: ${bestScore})`);
      console.log(`  💡 Available unfilled fields:`, 
        fields.filter(f => !filledFields.has(f))
              .map(f => `${getFieldLabel(f) || f.name || f.id} [${f.type || f.tagName}]`)
              .join(', '));
    }
  }
  
  console.log(`\n✅ Filled ${filledCount}/${dataMap.length} fields in ${entryType} entry\n`);
  return filledCount;
}

// Get field label from multiple sources
function getFieldLabel(field) {
  // Try aria-label
  if (field.getAttribute('aria-label')) {
    return field.getAttribute('aria-label');
  }
  
  // Try associated label
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) return label.textContent.trim();
  }
  
  // Try parent label
  const parentLabel = field.closest('label');
  if (parentLabel) {
    return parentLabel.textContent.replace(field.textContent || '', '').trim();
  }
  
  // Try placeholder
  if (field.placeholder) {
    return field.placeholder;
  }
  
  // Try name or id
  return field.name || field.id || '';
}

// Simple, direct field filling - ULTRA AGGRESSIVE with React-specific handling
async function simpleFieldFill(field, value) {
  if (!field || !value) {
    console.log('    ⚠️ Missing field or value');
    return false;
  }
  
  const valueStr = String(value).trim();
  if (!valueStr) {
    console.log('    ⚠️ Empty value string');
    return false;
  }
  
  console.log(`    🔧 Attempting to fill: ${field.tagName} type="${field.type}" with "${valueStr.substring(0, 30)}..."`);
  console.log(`    🔧 Field details: id="${field.id}", name="${field.name}"`);
  
  try {
    // For SELECT dropdowns
    if (field.tagName === 'SELECT') {
      const options = Array.from(field.options);
      console.log(`    🔧 SELECT has ${options.length} options`);
      
      const match = options.find(opt => 
        opt.text.toLowerCase().includes(valueStr.toLowerCase()) ||
        opt.value.toLowerCase().includes(valueStr.toLowerCase()) ||
        valueStr.toLowerCase().includes(opt.text.toLowerCase())
      );
      
      if (match) {
        console.log(`    ✓ Found matching option: "${match.text}"`);
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log(`    ✅ SELECT filled successfully`);
        return true;
      }
      console.log(`    ❌ No matching option found in: ${options.map(o => o.text).join(', ')}`);
      return false;
    }
    
    // For DATE and MONTH fields - special handling
    if (field.type === 'date' || field.type === 'month') {
      console.log(`    🔧 Detected ${field.type.toUpperCase()} field`);
      
      let formattedDate = valueStr;
      
      // Try to parse and format the date properly
      try {
        // If value is like "2020-01" or "01/2020" or "January 2020"
        const yearMatch = valueStr.match(/\b(19|20)\d{2}\b/);
        const monthMatch = valueStr.match(/\b(0?[1-9]|1[0-2])\b/);
        const monthNameMatch = valueStr.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
        
        if (field.type === 'month') {
          // Format: YYYY-MM
          if (yearMatch) {
            const year = yearMatch[0];
            let month = '01';
            
            if (monthMatch) {
              month = monthMatch[0].padStart(2, '0');
            } else if (monthNameMatch) {
              const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                                'july', 'august', 'september', 'october', 'november', 'december'];
              month = String(monthNames.indexOf(monthNameMatch[0].toLowerCase()) + 1).padStart(2, '0');
            }
            
            formattedDate = `${year}-${month}`;
            console.log(`    🔧 Formatted month value: "${formattedDate}"`);
          }
        } else if (field.type === 'date') {
          // Format: YYYY-MM-DD
          // If we have a full date
          const dateMatch = valueStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            formattedDate = valueStr;
          } else if (yearMatch) {
            // Default to first of the month
            const year = yearMatch[0];
            const month = monthMatch ? monthMatch[0].padStart(2, '0') : '01';
            formattedDate = `${year}-${month}-01`;
            console.log(`    🔧 Formatted date value: "${formattedDate}"`);
          }
        }
      } catch (e) {
        console.log(`    ⚠️ Date parsing warning:`, e.message);
      }
      
      field.focus();
      field.value = formattedDate;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.blur();
      
      await new Promise(r => setTimeout(r, 100));
      
      const success = field.value === formattedDate;
      console.log(`    ${success ? '✅' : '❌'} ${field.type} field: "${field.value}"`);
      return success;
    }
    
    // For text inputs and textareas - SIMPLIFIED REACT-AWARE approach
    console.log(`    🔧 Old value: "${field.value}"`);
    
    // SMART VALUE EXTRACTION: Detect field type from context
    let smartValue = valueStr;
    const fieldId = (field.id || '').toLowerCase();
    const fieldName = (field.name || '').toLowerCase();
    const fieldLabel = getFieldLabel(field).toLowerCase();
    const fieldContext = `${fieldId} ${fieldName} ${fieldLabel}`;
    
    // Year field detection - extract 4-digit year only
    if (fieldContext.match(/\byear\b/) && !fieldContext.match(/\b(range|to|from)\b/)) {
      const yearMatch = valueStr.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        smartValue = yearMatch[0];
        console.log(`    🎯 YEAR FIELD detected - extracted: "${smartValue}" from "${valueStr}"`);
      }
    }
    // Month field detection - extract month number
    else if (fieldContext.match(/\bmonth\b/) && !fieldContext.match(/\byear\b/)) {
      const monthMatch = valueStr.match(/\b(0?[1-9]|1[0-2])\b/);
      if (monthMatch) {
        smartValue = monthMatch[0].padStart(2, '0');
        console.log(`    🎯 MONTH FIELD detected - extracted: "${smartValue}" from "${valueStr}"`);
      }
    }
    // Day field detection
    else if (fieldContext.match(/\bday\b/)) {
      const dayMatch = valueStr.match(/\b(0?[1-9]|[12][0-9]|3[01])\b/);
      if (dayMatch) {
        smartValue = dayMatch[0].padStart(2, '0');
        console.log(`    🎯 DAY FIELD detected - extracted: "${smartValue}" from "${valueStr}"`);
      }
    }
    
    // Get the native value setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    // METHOD 1: Scroll into view and focus
    field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 150));
    
    field.focus();
    await new Promise(r => setTimeout(r, 50));
    
    // METHOD 2: Clear the field first (important for React)
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, '');
    }
    field.value = '';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    
    // METHOD 3: Set the new value using native setter (React-compatible)
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, smartValue);
    }
    field.value = smartValue;
    
    // METHOD 4: Trigger all necessary events
    field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 50));
    
    field.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 50));
    
    // METHOD 5: Blur to commit the change
    field.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    field.blur();
    
    await new Promise(r => setTimeout(r, 100));
    
    // Update visual state
    field.classList.remove('ng-pristine', 'ng-untouched', 'ng-empty', 'error', 'invalid', 'is-invalid');
    field.classList.add('ng-dirty', 'ng-touched', 'ng-valid', 'ng-not-empty', 'valid', 'is-valid', 'filled');
    field.removeAttribute('aria-invalid');
    
    // Final check
    await new Promise(r => setTimeout(r, 100));
    console.log(`    🔧 Final value: "${field.value}"`);
    
    const success = field.value && field.value.trim() === smartValue.trim();
    if (success) {
      console.log(`    ✅ Field filled successfully!`);
      return true;
    }
    
    // FALLBACK: If value didn't stick, try one more time with focus
    console.log(`    ⚠️ First attempt failed, trying fallback method...`);
    field.focus();
    await new Promise(r => setTimeout(r, 100));
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(field, smartValue);
    }
    field.value = smartValue;
    
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    await new Promise(r => setTimeout(r, 200));
    field.blur();
    
    await new Promise(r => setTimeout(r, 100));
    
    const finalSuccess = field.value && field.value.trim() === smartValue.trim();
    console.log(`    ${finalSuccess ? '✅' : '❌'} Fallback result: "${field.value}"`);
    return finalSuccess;
    
  } catch (error) {
    console.error(`    ❌ Error filling field:`, error);
    return false;
  }
}

// Legacy compatibility
function fillField(field, value) {
  return simpleFieldFill(field, value);
}

// ============================================================================
// END OF FIELD FILLING
// ============================================================================

// Dynamic section filler (generic)
async function fillDynamicSection(config) {
  console.log(`\n🔄 Processing ${config.sectionName}...`);
  // This is a placeholder for future generic implementation
  // Currently using specific functions above
}


