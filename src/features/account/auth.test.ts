import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import AuthScreen from "./AuthScreen";
import { cloudConfigured, getCloudClient } from "./client";
afterEach(() => vi.unstubAllEnvs());
describe("organizer account presentation", () => {
  it("shows a real unconfigured state and never creates a pretend session", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(cloudConfigured()).toBe(false);
    expect(getCloudClient()).toBeNull();
    const html = renderToStaticMarkup(createElement(AuthScreen));
    expect(html).toContain("Cloud accounts aren’t connected yet");
    expect(html).toContain("Sign in");
    expect(html).toContain("disabled");
    expect(html).toContain("/workspace");
    expect(html).toContain('autoComplete="current-password"');
  });
  it("offers signup and password recovery with meaningful form fields", () => {
    const signup = renderToStaticMarkup(
      createElement(AuthScreen, { initialMode: "signup" }),
    );
    expect(signup).toContain("Create my account");
    expect(signup).toContain('minLength="8"');
    expect(signup).toContain('autoComplete="new-password"');
    const recovery = renderToStaticMarkup(
      createElement(AuthScreen, { initialMode: "reset" }),
    );
    expect(recovery).toContain("Send reset link");
    expect(recovery).not.toContain('name="password"');
  });
});
