// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

const url = "https://lyqppisn2an040y1.52zju.cn/subscribe?token=secret";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("copyText", () => {
  it("uses the clipboard API and does not insert the URL into the page", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText(url)).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith(url);
    expect(document.body.querySelector("a, span, textarea")).toBeNull();
    expect(document.body.textContent).not.toContain(url);
  });

  it("falls back to a textarea value when the clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    document.execCommand = vi.fn((command: string) => {
      expect(command).toBe("copy");
      const area = document.querySelector("textarea");
      expect(area?.value).toBe(url);
      expect(area?.textContent).toBe("");
      expect(document.querySelector("a, span")).toBeNull();
      return true;
    });

    await expect(copyText(url)).resolves.toBe(true);
    expect(document.body.childElementCount).toBe(0);
    expect(document.body.textContent).not.toContain(url);
  });
});
