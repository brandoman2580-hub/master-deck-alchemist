const fs = require('fs');
const path = require('path');

/**
 * Generate HTML test report from Jest JSON output
 */
function generateHTMLReport(jsonPath, outputPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  const {
    numTotalTests,
    numPassedTests,
    numFailedTests,
    numPendingTests,
    numTodoTests,
    startTime,
    testResults,
  } = jsonData;

  const duration = Date.now() - startTime;
  const passRate = numTotalTests > 0 ? ((numPassedTests / numTotalTests) * 100).toFixed(2) : 0;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Master Deck Alchemist - Test Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #0f1419;
      color: #f8f9fa;
      line-height: 1.6;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      background: linear-gradient(135deg, #00d9ff 0%, #0066cc 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 8px 32px rgba(0, 217, 255, 0.3);
    }
    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .stat-card.passed {
      border-color: #10b981;
    }
    .stat-card.failed {
      border-color: #ef4444;
    }
    .stat-card.pending {
      border-color: #ff9500;
    }
    .stat-value {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .stat-label {
      color: #b0b8c0;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .test-file {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .test-file-header {
      padding: 15px 20px;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      user-select: none;
    }
    .test-file-header:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .test-file-name {
      font-weight: 600;
      font-family: 'Courier New', monospace;
      color: #00d9ff;
    }
    .test-file-stats {
      display: flex;
      gap: 15px;
      font-size: 0.9em;
    }
    .test-file-content {
      padding: 20px;
      display: none;
    }
    .test-file-content.expanded {
      display: block;
    }
    .test-case {
      padding: 12px;
      margin-bottom: 10px;
      border-left: 4px solid;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.02);
    }
    .test-case.passed {
      border-color: #10b981;
    }
    .test-case.failed {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .test-case.pending {
      border-color: #ff9500;
    }
    .test-case-title {
      font-weight: 600;
      margin-bottom: 5px;
    }
    .test-case-duration {
      color: #b0b8c0;
      font-size: 0.85em;
    }
    .error-message {
      margin-top: 10px;
      padding: 10px;
      background: rgba(239, 68, 68, 0.2);
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      white-space: pre-wrap;
      color: #ff6b6b;
    }
    .timestamp {
      color: #b0b8c0;
      font-size: 0.9em;
      margin-top: 10px;
    }
    .toggle-icon {
      transition: transform 0.3s;
    }
    .toggle-icon.expanded {
      transform: rotate(90deg);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧪 Master Deck Alchemist</h1>
      <p>Test Execution Report</p>
    </header>

    <div class="summary">
      <div class="stat-card ${numFailedTests > 0 ? 'failed' : 'passed'}">
        <div class="stat-value" style="color: ${numFailedTests > 0 ? '#ef4444' : '#10b981'}">${passRate}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #00d9ff">${numTotalTests}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value" style="color: #10b981">${numPassedTests}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value" style="color: #ef4444">${numFailedTests}</div>
        <div class="stat-label">Failed</div>
      </div>
      ${numPendingTests > 0 ? `
      <div class="stat-card pending">
        <div class="stat-value" style="color: #ff9500">${numPendingTests}</div>
        <div class="stat-label">Pending</div>
      </div>
      ` : ''}
    </div>

    <div class="timestamp">
      Generated: ${new Date().toLocaleString()}<br>
      Duration: ${(duration / 1000).toFixed(2)}s
    </div>

    <h2 style="margin: 30px 0 20px 0;">Test Files</h2>
    ${testResults.map((result, index) => {
      const { name, status, message, assertionResults = [] } = result;
      const fileName = path.basename(name);
      const hasFailures = assertionResults.length > 0 ? assertionResults.some(r => r.status === 'failed') : status === 'failed';
      const testCount = assertionResults.length || 0;
      const passedCount = assertionResults.filter(r => r.status === 'passed').length;
      const failedCount = assertionResults.filter(r => r.status === 'failed').length;
      
      return `
      <div class="test-file">
        <div class="test-file-header" onclick="toggleTestFile(${index})">
          <div>
            <span class="test-file-name">${fileName}</span>
            <div class="test-file-stats" style="margin-top: 5px; color: #b0b8c0;">
              <span style="color: ${hasFailures ? '#ef4444' : '#10b981'}">${status === 'passed' ? '✓' : '✗'}</span>
              ${testCount > 0 ? `<span>${testCount} tests</span>` : '<span>Suite failed to run</span>'}
              ${passedCount > 0 ? `<span>${passedCount} passed</span>` : ''}
              ${failedCount > 0 ? `<span style="color: #ef4444">${failedCount} failed</span>` : ''}
            </div>
          </div>
          <span class="toggle-icon" id="icon-${index}">▶</span>
        </div>
        <div class="test-file-content" id="content-${index}">
          ${assertionResults.length > 0 ? assertionResults.map(test => `
            <div class="test-case ${test.status}">
              <div class="test-case-title">${test.title}</div>
              <div class="test-case-duration">${test.duration || 0}ms</div>
              ${test.failureMessages && test.failureMessages.length > 0 ? `
                <div class="error-message">${test.failureMessages.map(m => m.replace(/`/g, '\\`').replace(/\$/g, '\\$')).join('<br>')}</div>
              ` : ''}
            </div>
          `).join('') : ''}
          ${message ? `<div class="error-message">${message.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/\n/g, '<br>')}</div>` : ''}
        </div>
      </div>
      `;
    }).join('')}
  </div>

  <script>
    function toggleTestFile(index) {
      const content = document.getElementById('content-' + index);
      const icon = document.getElementById('icon-' + index);
      content.classList.toggle('expanded');
      icon.classList.toggle('expanded');
    }

    // Auto-expand failed test files
    ${testResults.map((result, index) => {
      const hasFailures = result.assertionResults && result.assertionResults.length > 0 
        ? result.assertionResults.some(r => r.status === 'failed')
        : result.status === 'failed';
      return hasFailures ? `toggleTestFile(${index});` : '';
    }).join('')}
  </script>
</body>
</html>`;

  // Ensure reports directory exists
  const reportsDir = path.dirname(outputPath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, html);
  console.log(`✅ HTML test report generated: ${outputPath}`);
}

// Run if called directly
if (require.main === module) {
  const jsonPath = process.argv[2] || path.join(__dirname, '../reports/jest-results.json');
  const outputPath = process.argv[3] || path.join(__dirname, '../reports/test-report.html');
  generateHTMLReport(jsonPath, outputPath);
}

module.exports = { generateHTMLReport };
