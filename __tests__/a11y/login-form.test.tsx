/**
 * Accessibility tests for LoginForm component using jest-axe.
 * 
 * Requirements:
 *   - jest-axe
 *   - @testing-library/react
 *   - @testing-library/jest-dom
 *   - jsdom test environment
 * 
 * Run: npm run test:a11y
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LoginForm } from '@/components/ui/login-form';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('LoginForm accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<LoginForm onSignupClick={() => {}} />);
    const results = await axe(container, {
      rules: {
        // Allow color-contrast to be checked separately if needed
        'color-contrast': { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it('should associate labels with inputs', () => {
    render(<LoginForm onSignupClick={() => {}} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should announce errors via aria-describedby', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSignupClick={() => {}} />);
    
    const submitButton = screen.getByRole('button', { name: /log in/i });
    await user.click(submitButton);

    const emailInput = screen.getByLabelText(/email/i);
    
    // Check that error association exists
    expect(emailInput).toHaveAttribute('aria-invalid');
    expect(emailInput).toHaveAttribute('aria-describedby');
    
    // Check that error message is present and has alert role
    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(/required|invalid/i);
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSignupClick={() => {}} />);
    
    // Tab to email input
    await user.tab();
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveFocus();
    
    // Tab to password input
    await user.tab();
    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveFocus();
    
    // Tab to submit button
    await user.tab();
    const submitButton = screen.getByRole('button', { name: /log in/i });
    expect(submitButton).toHaveFocus();
  });

  it('should have visible focus indicators', () => {
    const { container } = render(<LoginForm onSignupClick={() => {}} />);
    
    // Check that focus-visible styles are present
    const inputs = container.querySelectorAll('input');
    inputs.forEach(input => {
      // Focus-visible should be handled by Tailwind classes
      expect(input).toHaveClass(/focus/);
    });
  });
});

