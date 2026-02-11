/**
 * Build Health Tests
 *
 * These tests run after every build to ensure the production bundle
 * won't cause a white screen or broken page. They verify:
 *   - index.html has all required elements (root div, JS module, meta tags)
 *   - JS and CSS bundle files actually exist in the dist folder
 *   - JS files contain valid JavaScript (not empty or corrupted)
 *   - Critical MIME-type-sensitive files have correct extensions
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const DIST = join(__dirname, "..", "dist");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function readDist(relativePath: string): string {
  return readFileSync(join(DIST, relativePath), "utf-8");
}

function listDir(relativePath: string): string[] {
  const dir = join(DIST, relativePath);
  if (!existsSync(dir)) return [];
  return readdirSync(dir);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("Build output exists", () => {
  it("dist/ directory exists", () => {
    expect(existsSync(DIST)).toBe(true);
  });

  it("index.html exists", () => {
    expect(existsSync(join(DIST, "index.html"))).toBe(true);
  });

  it("assets/ directory exists with files", () => {
    const assets = listDir("assets");
    expect(assets.length).toBeGreaterThan(0);
  });
});

describe("index.html critical elements", () => {
  let html: string;

  it("can be read", () => {
    html = readDist("index.html");
    expect(html.length).toBeGreaterThan(0);
  });

  it("contains <div id=\"root\">", () => {
    html = readDist("index.html");
    expect(html).toContain('<div id="root">');
  });

  it("contains a <script type=\"module\"> tag referencing a .js asset", () => {
    html = readDist("index.html");
    // Vite outputs: <script type="module" ... src="/assets/index-XXXX.js">
    expect(html).toMatch(/<script\s+type="module"[^>]*src="\/assets\/[^"]+\.js"/);
  });

  it("contains a <link rel=\"stylesheet\"> referencing a .css asset", () => {
    html = readDist("index.html");
    expect(html).toMatch(/<link\s+rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"/);
  });

  it("contains Google Analytics script", () => {
    html = readDist("index.html");
    expect(html).toContain("googletagmanager.com/gtag/js");
    expect(html).toContain("G-4RWXGC1L9G");
  });

  it("contains Open Graph meta tags", () => {
    html = readDist("index.html");
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:image"');
  });
});

describe("JavaScript bundle", () => {
  it("at least one .js file exists in assets/", () => {
    const assets = listDir("assets");
    const jsFiles = assets.filter((f) => f.endsWith(".js"));
    expect(jsFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("JS bundle is not empty (> 1 KB)", () => {
    const assets = listDir("assets");
    const jsFile = assets.find((f) => f.endsWith(".js"));
    expect(jsFile).toBeDefined();
    const content = readDist(`assets/${jsFile}`);
    expect(content.length).toBeGreaterThan(1024);
  });

  it("JS bundle contains React render call", () => {
    const assets = listDir("assets");
    const jsFile = assets.find((f) => f.endsWith(".js"));
    expect(jsFile).toBeDefined();
    const content = readDist(`assets/${jsFile}`);
    // Minified React will contain createRoot or render
    expect(content).toMatch(/createRoot|ReactDOM/);
  });
});

describe("CSS bundle", () => {
  it("at least one .css file exists in assets/", () => {
    const assets = listDir("assets");
    const cssFiles = assets.filter((f) => f.endsWith(".css"));
    expect(cssFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("CSS bundle is not empty (> 512 bytes)", () => {
    const assets = listDir("assets");
    const cssFile = assets.find((f) => f.endsWith(".css"));
    expect(cssFile).toBeDefined();
    const content = readDist(`assets/${cssFile}`);
    expect(content.length).toBeGreaterThan(512);
  });
});

describe("No accidental file extensions", () => {
  it("no .ts or .tsx files in dist/ (should be compiled)", () => {
    const assets = listDir("assets");
    const tsFiles = assets.filter(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx")
    );
    expect(tsFiles).toEqual([]);
  });
});
