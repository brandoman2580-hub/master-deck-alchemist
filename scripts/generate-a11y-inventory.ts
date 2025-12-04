#!/usr/bin/env tsx
/**
 * Generates accessibility inventory from React components in the codebase.
 * Outputs a11y-inventory.json with component metadata and baseline violations.
 * 
 * Usage: npm run a11y:inventory
 * 
 * This script scans app/, components/, and pages/ directories for React components
 * and generates a structured inventory for accessibility auditing.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'fast-glob';
import { execSync } from 'child_process';

interface ComponentRecord {
  component_name: string;
  path: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  state: 'untested' | 'in-progress' | 'fixed' | 'verified';
  notes: string;
  wcag_criteria_violations: string[];
  baseline_violations: string[];
  last_scan_sha: string | null;
}

/**
/**
 * Determines priority based on component path and type.
 */
function determinePriority(filePath: string): 'Critical' | 'High' | 'Medium' | 'Low' {
  // Critical: Authentication, forms, navigation, modals
  if (
    filePath.includes('login') ||
    filePath.includes('signup') ||
    filePath.includes('auth') ||
    filePath.includes('navbar') ||
    filePath.includes('dialog') ||
    filePath.includes('modal') ||
    filePath.includes('input') ||
    filePath.includes('select') ||
    filePath.includes('form')
  ) {
    return 'Critical';
  }

  // High: Interactive components, search, filters, chatbot
  if (
    filePath.includes('filter') ||
    filePath.includes('search') ||
    filePath.includes('chatbot') ||
    filePath.includes('dropdown') ||
    filePath.includes('tooltip') ||
    filePath.includes('deck-builder')
  ) {
    return 'High';
  }

  // Medium: Display components, cards, lists, tabs
  if (
    filePath.includes('card') ||
    filePath.includes('grid') ||
    filePath.includes('list') ||
    filePath.includes('tabs') ||
    filePath.includes('preview')
  ) {
    return 'Medium';
  }

  // Low: Decorative, animations, loading states
  return 'Low';
}

/**
 * Extracts component name from file path.
 */
function extractComponentName(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));
  // Convert kebab-case to PascalCase
  return fileName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Gets current git SHA for tracking scan baseline.
 */
function getCurrentSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Loads existing inventory to preserve state and baseline_violations.
 */
function loadExistingInventory(): Map<string, ComponentRecord> {
  const inventoryPath = path.join(process.cwd(), 'a11y-inventory.json');
  if (!fs.existsSync(inventoryPath)) {
    return new Map();
  }

  try {
    const content = fs.readFileSync(inventoryPath, 'utf-8');
    const records: ComponentRecord[] = JSON.parse(content);
    return new Map(records.map(record => [record.path, record]));
  } catch {
    return new Map();
  }
}

/**
 * Main inventory generation function.
 */
async function generateInventory() {
  const repoRoot = process.cwd();
  const currentSha = getCurrentSha();
  const existingInventory = loadExistingInventory();

  // Find all React component files
  const patterns = [
    'app/**/*.{tsx,ts}',
    'components/**/*.{tsx,ts}',
    'pages/**/*.{tsx,ts}',
  ];

  const files = await glob(patterns, {
    cwd: repoRoot,
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/types/**',
      '**/lib/**',
      '**/utils/**',
      '**/store/**',
      '**/context/**',
      '**/hooks/**',
    ],
    absolute: false,
  });

  const inventory: ComponentRecord[] = [];

  for (const file of files) {
    const fullPath = path.join(repoRoot, file);
    const stats = fs.statSync(fullPath);
    
    // Skip if not a file or if it's a type/utility file
    if (!stats.isFile()) continue;
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Only include files that export React components
    if (!content.match(/(export\s+(default\s+)?(function|const|class)\s+\w+|export\s+\{[^}]*\})/)) {
      continue;
    }

    const existing = existingInventory.get(file);
    const componentName = extractComponentName(file);
    const priority = determinePriority(file);

    inventory.push({
      component_name: componentName,
      path: file,
      priority,
      state: existing?.state || 'untested',
      notes: existing?.notes || '',
      wcag_criteria_violations: existing?.wcag_criteria_violations || [],
      baseline_violations: existing?.baseline_violations || [],
      last_scan_sha: existing?.last_scan_sha || currentSha,
    });
  }

  // Sort by priority (Critical → High → Medium → Low), then by path
  const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  inventory.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.path.localeCompare(b.path);
  });

  // Write inventory JSON
  const outputPath = path.join(repoRoot, 'a11y-inventory.json');
  fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2) + '\n');

  console.log(`✅ Generated inventory: ${inventory.length} components`);
  console.log(`   Critical: ${inventory.filter(c => c.priority === 'Critical').length}`);
  console.log(`   High: ${inventory.filter(c => c.priority === 'High').length}`);
  console.log(`   Medium: ${inventory.filter(c => c.priority === 'Medium').length}`);
  console.log(`   Low: ${inventory.filter(c => c.priority === 'Low').length}`);
  console.log(`   Output: ${outputPath}`);
}

// Run if executed directly
if (require.main === module) {
  generateInventory().catch((error) => {
    console.error('❌ Error generating inventory:', error);
    process.exit(1);
  });
}

export { generateInventory };

