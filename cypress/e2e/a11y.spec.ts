/**
 * Accessibility E2E tests using Cypress and cypress-axe.
 * 
 * Requirements:
 *   - cypress
 *   - cypress-axe
 * 
 * Setup: Import 'cypress-axe' in cypress/support/e2e.ts
 * 
 * Run: npx cypress run --spec "cypress/e2e/a11y.spec.ts"
 */

describe('Accessibility E2E Tests', () => {
  beforeEach(() => {
    // Inject axe-core into the page
    cy.visit('/');
    cy.injectAxe();
  });

  it('homepage should have no accessibility violations', () => {
    cy.checkA11y(
      undefined,
      {
        rules: {
          // Allow color-contrast to be checked separately
          'color-contrast': { enabled: true },
        },
      },
      (violations) => {
        // Custom violation handler for debugging
        if (violations.length > 0) {
          console.log('Accessibility violations:', violations);
        }
      },
      false // Don't fail on violations, just log them
    );
  });

  it('deck builder page should be accessible', () => {
    cy.visit('/deck-builder');
    cy.injectAxe();
    
    cy.checkA11y(
      undefined,
      {
        rules: {
          'color-contrast': { enabled: true },
        },
      },
      undefined,
      false
    );
  });

  it('login modal should be accessible', () => {
    cy.visit('/');
    cy.get('button').contains('Login').click();
    
    // Wait for modal to open
    cy.get('[role="dialog"]').should('be.visible');
    cy.injectAxe();
    
    // Check only the dialog content
    cy.checkA11y('[role="dialog"]', {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  });

  it('should support keyboard navigation', () => {
    cy.visit('/');
    
    // Tab through navigation
    cy.get('body').tab();
    cy.focused().should('contain', 'Skip');
    
    cy.get('body').tab();
    cy.focused().should('contain', 'Deck Builder');
    
    // Test Enter key activation
    cy.focused().type('{enter}');
    cy.url().should('include', '/deck-builder');
  });

  it('should have skip link functionality', () => {
    cy.visit('/');
    
    // Find skip link
    cy.get('a[href="#main-content"]').should('exist');
    
    // Tab to skip link and activate
    cy.get('body').tab();
    cy.focused().should('have.attr', 'href', '#main-content');
    cy.focused().type('{enter}');
    
    // Main content should be focused
    cy.focused().should('have.id', 'main-content');
  });
});

