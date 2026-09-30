import { chromium } from "@playwright/test";
import { brotliDecompressSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

/** Use regular Playwright first. Linux-only fallback is useful in restricted build sandboxes. */
export async function launchBrowser(options = {}) {
  const args = [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    ...(options.args ?? []),
  ];
  if (process.env.CHROME_PATH)
    return chromium.launch({
      ...options,
      executablePath: process.env.CHROME_PATH,
      args,
    });
  try {
    return await chromium.launch({ ...options, args });
  } catch (error) {
    if (
      process.platform !== "linux" ||
      !String(error).includes("Executable doesn't exist")
    )
      throw error;
    const { default: bundle } = await import("@sparticuz/chromium");
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve("@sparticuz/chromium");
    const archive = path.join(
      path.dirname(packagePath),
      "../bin/al2023.tar.br",
    );
    const libraries = path.join(tmpdir(), "gameforge-chromium-libs");
    if (!existsSync(path.join(libraries, "lib/libnspr4.so"))) {
      mkdirSync(libraries, { recursive: true });
      const tar = path.join(libraries, "libraries.tar");
      writeFileSync(tar, brotliDecompressSync(readFileSync(archive)));
      execFileSync("tar", ["-xf", tar, "-C", libraries]);
    }
    return chromium.launch({
      ...options,
      headless: true,
      executablePath: await bundle.executablePath(),
      args: [
        ...bundle.args.filter(
          (a) => a !== "--disable-web-security" && a !== "--single-process",
        ),
        ...args,
      ],
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${libraries}/lib:${process.env.LD_LIBRARY_PATH ?? ""}`,
      },
    });
  }
}
