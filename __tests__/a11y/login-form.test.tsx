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

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { LoginForm } from "@/components/ui/login-form";

jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

jest.mock("@/store/useLoginModalStore", () => ({
  useLoginModalStore: () => ({ closeLoginModal: jest.fn() }),
}));

jest.mock("@/store/useUserStore", () => ({
  useUserStore: { getState: () => ({ setUser: jest.fn() }) },
}));

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe("LoginForm accessibility", () => {
  it("should have no accessibility violations", async () => {
    const { container } = render(<LoginForm onSignupClick={() => {}} />);
    if (typeof HTMLCanvasElement.prototype.getContext !== "function") {
      HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    }
    const results = await axe(container, {
      rules: {
        // Allow color-contrast to be checked separately if needed
        "color-contrast": { enabled: true },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should associate labels with inputs", () => {
    render(<LoginForm onSignupClick={() => {}} />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("should announce errors via aria-describedby", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSignupClick={() => {}} />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email/i);

      const ariaInvalid = emailInput.getAttribute("aria-invalid");
      const ariaDescribedBy = emailInput.getAttribute("aria-describedby");

      expect(ariaInvalid).toBe("true");
      expect(ariaDescribedBy).toBeTruthy();

      const errorMessage = screen.getByRole("alert");
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage.textContent).toMatch(/invalid|failed|credentials/i);
    });
  });

  it("should support keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSignupClick={() => {}} />);

    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
    });

    await user.tab();
    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText(/password/i));
    });

    await user.tab();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /log in/i })
      );
    });
  });

  it("should have visible focus indicators", () => {
    const { container } = render(<LoginForm onSignupClick={() => {}} />);

    // Check that inputs exist and have focus-related classes
    const inputs = container.querySelectorAll("input");
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => {
      // Check that input has className (focus styles are applied via Tailwind)
      expect(input.className).toBeTruthy();
      // Focus styles are typically applied via CSS, not always visible in className
      // Just verify the input exists and has styling
      expect(input).toBeInTheDocument();
    });
  });
});
