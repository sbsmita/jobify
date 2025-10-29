// background.js

// Pre-warm AI models on extension install (Issue #4)
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    console.log('Job Appier: Extension installed/updated. Pre-warming AI models...');
    
    // Try to trigger model download in background
    try {
      // Check Summarizer availability
      if ('Summarizer' in self) {
        const summarizerAvailability = await Summarizer.availability();
        if (summarizerAvailability === 'downloadable') {
          console.log('Triggering Summarizer model download...');
          const summarizer = await Summarizer.create({
            type: 'key-points',
            format: 'markdown',
            length: 'short',
            outputLanguage: 'en',
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => {
                console.log(`Summarizer download: ${Math.round(e.loaded * 100)}%`);
              });
            }
          });
          // Quick test to ensure model is ready
          await summarizer.summarize('Test job description for model initialization.');
          summarizer.destroy();
          console.log('✓ Summarizer model ready!');
        }
      }
      
      // Check Writer availability
      if ('Writer' in self) {
        const writerAvailability = await Writer.availability();
        if (writerAvailability === 'downloadable') {
          console.log('Triggering Writer model download...');
          const writer = await Writer.create({
            tone: 'formal',
            length: 'short',
            format: 'plain-text',
            outputLanguage: 'en',
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => {
                console.log(`Writer download: ${Math.round(e.loaded * 100)}%`);
              });
            }
          });
          // Quick test
          await writer.write('Test prompt for initialization');
          writer.destroy();
          console.log('✓ Writer model ready!');
        }
      }
      
      console.log('✓ AI models pre-warmed and ready to use!');
    } catch (error) {
      console.error('Model pre-warming failed:', error);
      console.log('Models will download on first use instead.');
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FILL_FORM') {
    // Forward a fill command to content script of the target tab
    const { tabId, fields } = message;
    chrome.scripting.executeScript({
      target: { tabId },
      func: (fields) => {
        // This runs in page context to fill inputs (safer to dispatch events)
        for (const [selector, value] of Object.entries(fields)) {
          try {
            const el = document.querySelector(selector);
            if (!el) continue;
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {
            // ignore
          }
        }
      },
      args: [fields]
    });
    sendResponse({ status: 'ok' });
    return true;
  }

  // handle other messages if necessary
});
