// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Billing from "./billing";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dashboard billing", () => {
  it("renders nothing (sponsor section disabled)", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 30_000,
        },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <Billing type="dashboard" />
      </QueryClientProvider>
    );

    expect(container.firstChild).toBeNull();
  });
});
