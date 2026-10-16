/**
 * @jest-environment jsdom
 */
import { readFileSync } from "fs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signup } from "@/app/auth/actions";
import { LandingScreen } from "@/components/mda/landing-screen";

const mockPush = jest.fn();
const mockSignIn = jest.fn();
const mockReset = jest.fn();
const mockSetUser = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockReset(...args),
    },
  },
}));

jest.mock("@/app/auth/actions", () => ({
  signup: jest.fn(async () => ({ success: true, email: "pilot@mda.core" })),
}));

jest.mock("@/store/useUserStore", () => ({
  useUserStore: (selector: (state: { setUser: typeof mockSetUser }) => unknown) =>
    selector({ setUser: mockSetUser }),
}));

describe("LandingScreen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignIn.mockReset();
    mockReset.mockReset();
    mockSetUser.mockReset();
    jest.mocked(signup).mockReset();
    jest.mocked(signup).mockResolvedValue({ success: true, email: "pilot@mda.core" });
  });

  it("renders the three chapters and their sentences", () => {
    render(<LandingScreen />);
    expect(screen.getByRole("heading", { name: "WORKSHOP" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "STRATEGIST" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ARCHIVES" })).toBeInTheDocument();
    expect(document.getElementById("landing-main")).toHaveAttribute("tabindex", "-1");
    expect(
      screen.getByText(
        "Build a legal deck list from the card library then test its matchup readiness and combo lines.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/identifying defensive options to withstand competitive meta disruptions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sort, filter, clone, share, or jump back into editing/),
    ).toBeInTheDocument();
  });

  it("opens a hotspot panel on the optic before scrolling", async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    const hotspot = screen.getByRole("button", { name: "Live Check Specification" });
    await user.hover(hotspot);
    await waitFor(() => {
      expect(document.getElementById("panelUL")).toHaveClass("panel-active");
    });
    expect(screen.getByText("LIVE CHECK")).toHaveClass("text-[#ffffff]");
  });

  it("opens the sharp login panel and switches to create account", async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    const modal = document.getElementById("authModal");
    expect(modal).toHaveAttribute("aria-hidden", "true");
    expect(modal).toHaveAttribute("inert");
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    expect(modal).toHaveClass("opacity-100");
    expect(modal).toHaveAttribute("aria-hidden", "false");
    expect(modal).not.toHaveAttribute("inert");
    expect(modal?.className).not.toContain("backdrop-blur");
    expect(screen.getByLabelText("Email Address")).toBe(document.getElementById("authEmail"));
    expect(screen.getByLabelText("Password")).toBe(document.getElementById("authPassword"));
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));
    expect(document.getElementById("authSubmitBtn")).toHaveTextContent("CREATE ACCOUNT");
    expect(document.getElementById("authPassword")).toHaveAttribute("autocomplete", "new-password");
    expect(document.getElementById("authConfirmWrap")).not.toHaveClass("hidden");
    expect(document.getElementById("authForgotBtn")).toHaveClass("hidden");
  });

  it("checks the confirm password and shows signup errors in the dialog", async () => {
    const user = userEvent.setup();
    render(<LandingScreen />);
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    await user.click(screen.getByRole("button", { name: "CREATE ACCOUNT" }));
    await user.type(screen.getByLabelText("Email Address"), "pilot@mda.core");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.type(screen.getByLabelText("Confirm Password"), "different");
    await user.click(document.getElementById("authSubmitBtn") as HTMLButtonElement);
    expect(screen.getByRole("status")).toHaveTextContent("Passwords do not match.");
    expect(signup).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("Confirm Password"), "secret123");
    jest.mocked(signup).mockResolvedValueOnce({ success: false, error: "Already registered" });
    await user.click(document.getElementById("authSubmitBtn") as HTMLButtonElement);
    expect(await screen.findByText("Already registered")).toBeInTheDocument();
  });

  it("sends a password reset email from the login dialog", async () => {
    const user = userEvent.setup();
    mockReset.mockResolvedValue({ error: null });
    render(<LandingScreen />);
    await user.click(screen.getByRole("button", { name: "LOGIN" }));
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("status")).toHaveTextContent("Enter your email address first.");

    await user.type(screen.getByLabelText("Email Address"), "pilot@mda.core");
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(mockReset).toHaveBeenCalledWith("pilot@mda.core", {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    expect(await screen.findByText("Password reset email sent to pilot@mda.core.")).toBeInTheDocument();
  });

  it("drives the word stack and optic from the page scroller", async () => {
    const create = jest.fn(() => ({ kill() {} }));
    const defaults = jest.fn();
    const view = window as Window & {
      gsap?: { registerPlugin: () => void; timeline: () => { to: () => unknown; kill: () => void }; to: () => void };
      ScrollTrigger?: { create: typeof create; defaults: typeof defaults; getAll: () => unknown[]; refresh: () => void };
    };
    const chain = { to: () => chain, kill: () => {} };
    view.gsap = {
      registerPlugin: () => {},
      timeline: () => chain,
      to: () => {},
    };
    view.ScrollTrigger = {
      create,
      defaults,
      getAll: () => [],
      refresh: () => {},
    };

    render(
      <main id="main-content">
        <LandingScreen />
      </main>,
    );

    await waitFor(() => expect(defaults).toHaveBeenCalled());
    expect(defaults).toHaveBeenCalledWith({
      scroller: document.getElementById("main-content"),
    });
    const root = document.getElementById("landing-root");
    const progress = create.mock.calls.find((call) => call[0].trigger === root);
    expect(progress?.[0]).toMatchObject({ start: "top top", end: "bottom bottom" });
    delete view.gsap;
    delete view.ScrollTrigger;
  });

  it("keeps the glass frost light enough for the optic lines", () => {
    const css = readFileSync("app/landing-story.css", "utf8");
    expect(css).toContain("rgba(236, 239, 242, 0.12)");
    expect(css).toContain("blur(3px)");
    expect(css).not.toContain("blur(14px)");
    expect(css).toContain("border: none");
    expect(css).toContain("polygon(8px 0");
  });
});
