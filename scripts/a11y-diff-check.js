#!/usr/bin/env node
/**
 * a11y-diff-check: Compares current accessibility scan results to baseline.
 * 
 * Fails only on NEW Critical violations or regressions.
 * Produces a concise summary for solo developer workflow.
 * 
 * Usage:
 *   node scripts/a11y-diff-check.js [--baseline-dir=baseline] [--current-dir=reports]
 * 
 * Exit codes:
 *   0: No new critical violations
 *   1: New critical violations found
 */

const fs = require('fs');
const path = require('path');

const BASELINE_DIR = process.env.BASELINE_DIR || path.join(process.cwd(), 'baseline');
const CURRENT_DIR = process.env.CURRENT_DIR || path.join(process.cwd(), 'reports');

/**
 * Loads JSON file, returns null if file doesn't exist.
 */
function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`⚠️  Failed to parse ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extracts violations from pa11y JSON report.
 */
function extractPa11yViolations(report) {
  if (!report || !Array.isArray(report)) return [];
  
  const violations = [];
  for (const item of report) {
    if (item.issues && Array.isArray(item.issues)) {
      for (const issue of item.issues) {
        violations.push({
          type: issue.type,
          code: issue.code,
          message: issue.message,
          selector: issue.selector,
          url: item.url,
        });
      }
    }
  }
  return violations;
}

/**
 * Extracts violations from jest-axe JSON report.
 */
function extractJestAxeViolations(report) {
  if (!report || !report.testResults) return [];
  
  const violations = [];
  for (const testResult of report.testResults) {
    if (testResult.assertionResults) {
      for (const assertion of testResult.assertionResults) {
        if (assertion.status === 'failed' && assertion.failureMessages) {
          // Parse axe violations from failure messages
          for (const failure of assertion.failureMessages) {
            const match = failure.match(/violations:\s*(\d+)/i);
            if (match) {
              violations.push({
                test: assertion.title,
                violations: parseInt(match[1], 10),
              });
            }
          }
        }
      }
    }
  }
  return violations;
}

/**
 * Extracts violations from Lighthouse JSON report.
 */
function extractLighthouseViolations(report) {
  if (!report || !report.audits) return [];
  
  const violations = [];
  for (const [key, audit] of Object.entries(report.audits)) {
    if (audit.score !== null && audit.score < 0.9) {
      violations.push({
        id: key,
        title: audit.title,
        description: audit.description,
        score: audit.score,
      });
    }
  }
  return violations;
}

/**
 * Compares violations and returns new critical ones.
 */
function findNewCriticalViolations(baseline, current) {
  const newViolations = [];
  
  // Create a set of baseline violation signatures for quick lookup
  const baselineSignatures = new Set();
  if (baseline) {
    for (const violation of baseline) {
      // Create signature from violation properties
      const sig = `${violation.code || violation.id || ''}:${violation.selector || ''}:${violation.url || ''}`;
      baselineSignatures.add(sig);
    }
  }
  
  // Check current violations against baseline
  if (current) {
    for (const violation of current) {
      const sig = `${violation.code || violation.id || ''}:${violation.selector || ''}:${violation.url || ''}`;
      
      // If violation is critical and not in baseline, it's new
      if (violation.type === 'error' || violation.impact === 'critical' || (violation.score && violation.score < 0.5)) {
        if (!baselineSignatures.has(sig)) {
          newViolations.push(violation);
        }
      }
    }
  }
  
  return newViolations;
}

/**
 * Main diff check function.
 */
function main() {
  console.log('🔍 Checking accessibility scan results against baseline...\n');
  
  // Ensure baseline directory exists
  if (!fs.existsSync(BASELINE_DIR)) {
    console.log(`⚠️  Baseline directory not found: ${BASELINE_DIR}`);
    console.log('   Run: npm run a11y:baseline to create baseline\n');
  }
  
  // Ensure current reports directory exists
  if (!fs.existsSync(CURRENT_DIR)) {
    console.log(`❌ Current reports directory not found: ${CURRENT_DIR}`);
    console.log('   Run: npm run a11y:scan first\n');
    process.exit(1);
  }
  
  const results = {
    pa11y: { new: [], total: 0 },
    jestAxe: { new: [], total: 0 },
    lighthouse: { new: [], total: 0 },
  };
  
  // Check pa11y results
  const pa11yBaseline = loadJson(path.join(BASELINE_DIR, 'pa11y-baseline.json'));
  const pa11yCurrent = loadJson(path.join(CURRENT_DIR, 'pa11y-report.json'));
  
  if (pa11yCurrent) {
    const baselineViolations = pa11yBaseline ? extractPa11yViolations(pa11yBaseline) : [];
    const currentViolations = extractPa11yViolations(pa11yCurrent);
    const criticalCurrent = currentViolations.filter(v => v.type === 'error');
    results.pa11y.new = findNewCriticalViolations(baselineViolations, criticalCurrent);
    results.pa11y.total = criticalCurrent.length;
  }
  
  // Check jest-axe results
  const jestAxeBaseline = loadJson(path.join(BASELINE_DIR, 'jest-a11y-baseline.json'));
  const jestAxeCurrent = loadJson(path.join(CURRENT_DIR, 'jest-a11y-results.json'));
  
  if (jestAxeCurrent) {
    const baselineViolations = jestAxeBaseline ? extractJestAxeViolations(jestAxeBaseline) : [];
    const currentViolations = extractJestAxeViolations(jestAxeCurrent);
    results.jestAxe.new = findNewCriticalViolations(baselineViolations, currentViolations);
    results.jestAxe.total = currentViolations.length;
  }
  
  // Check Lighthouse results
  const lighthouseBaseline = loadJson(path.join(BASELINE_DIR, 'lighthouse-a11y-baseline.json'));
  const lighthouseCurrent = loadJson(path.join(CURRENT_DIR, 'lighthouse-a11y.json'));
  
  if (lighthouseCurrent) {
    const baselineViolations = lighthouseBaseline ? extractLighthouseViolations(lighthouseBaseline) : [];
    const currentViolations = extractLighthouseViolations(lighthouseCurrent);
    const criticalCurrent = currentViolations.filter(v => v.score < 0.5);
    results.lighthouse.new = findNewCriticalViolations(baselineViolations, criticalCurrent);
    results.lighthouse.total = criticalCurrent.length;
  }
  
  // Print summary
  console.log('📊 Summary:');
  console.log(`   Pa11y: ${results.pa11y.total} critical violations, ${results.pa11y.new.length} new`);
  console.log(`   Jest-axe: ${results.jestAxe.total} violations, ${results.jestAxe.new.length} new`);
  console.log(`   Lighthouse: ${results.lighthouse.total} critical issues, ${results.lighthouse.new.length} new`);
  console.log('');
  
  // Print new violations
  const allNew = [...results.pa11y.new, ...results.jestAxe.new, ...results.lighthouse.new];
  
  if (allNew.length > 0) {
    console.log('❌ NEW CRITICAL VIOLATIONS FOUND:\n');
    
    for (const violation of allNew.slice(0, 10)) { // Limit to first 10
      if (violation.message) {
        console.log(`   • ${violation.message}`);
        if (violation.selector) console.log(`     Selector: ${violation.selector}`);
        if (violation.url) console.log(`     URL: ${violation.url}`);
      } else if (violation.title) {
        console.log(`   • ${violation.title}`);
        if (violation.description) console.log(`     ${violation.description}`);
      }
      console.log('');
    }
    
    if (allNew.length > 10) {
      console.log(`   ... and ${allNew.length - 10} more\n`);
    }
    
    console.log('💡 To update baseline (after fixing or accepting):');
    console.log('   npm run a11y:baseline\n');
    
    process.exit(1);
  } else {
    console.log('✅ No new critical violations found.\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

