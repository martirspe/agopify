const fs = require("node:fs"),
  path = require("node:path"),
  postcss = require("postcss");
const root =
  path
    .resolve(
      process.argv[2] ||
        (() => {
          throw new Error(
            "Usage: node scripts/import-rosaline-reference.cjs <source-directory>",
          );
        })(),
    )
    .replaceAll("\\", "/") + "/";
const target = "apps/store/src/app/templates/rosaline/";
const pub = "apps/store/public/themes/rosaline/source/";
function copy(file) {
  const dest = pub + file;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(root + file, dest);
}
let result =
  "/* Original Rosaline 1.0.0 CSS, scoped mechanically. No visual values changed. */\n";
for (const file of [
  "assets/css/bootstrap.min.css",
  "assets/css/swiper-bundle.min.css",
  "assets/css/animate.css",
  "assets/css/image-compare-viewer.min.css",
  "assets/icon/icomoon/style.css",
  "assets/css/styles.css",
]) {
  const ast = postcss.parse(fs.readFileSync(root + file, "utf8"));
  ast.walkAtRules((r) => {
    if (["charset", "import"].includes(r.name)) r.remove();
  });
  ast.walkDecls((decl) => {
    decl.value = decl.value.replace(
      /url\((['"]?)([^)'"\s]+)\1\)/g,
      (all, q, url) => {
        if (/^(data:|https?:|#)/.test(url)) return all;
        const filePath = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), url.split("?")[0]),
        );
        if (fs.existsSync(root + filePath)) {
          copy(filePath);
          return 'url("/themes/rosaline/source/' + filePath + '")';
        }
        return all;
      },
    );
  });
  ast.walkRules((rule) => {
    let parent = rule.parent;
    while (parent) {
      if (parent.type === "atrule" && /keyframes$/.test(parent.name)) return;
      parent = parent.parent;
    }
    rule.selectors = rule.selectors.map((selector) => {
      selector = selector.trim();
      if (selector.startsWith("body::"))
        return selector.replace(/^body/, "body.tpl-rosaline");
      if (selector === ":root" || selector === "html" || selector === "body")
        return "body.tpl-rosaline .ro-shell";
      if (/^(html|body)(?=[\s.#:[>])/.test(selector))
        return selector.replace(
          /^(?:html\s+)?body|^html/,
          "body.tpl-rosaline .ro-shell",
        );
      return "body.tpl-rosaline .ro-shell " + selector;
    });
  });
  result += "\n/* " + file + " */\n" + ast.toString();
}
const isolated = postcss.parse(result);
const animations = new Map();
isolated.walkAtRules((rule) => {
  if (/keyframes$/.test(rule.name)) {
    const old = rule.params;
    animations.set(old, "rosaline-reference-" + old);
    rule.params = "rosaline-reference-" + old;
  }
});
isolated.walkDecls((decl) => {
  if (/^(-webkit-)?animation(?:-name)?$/.test(decl.prop))
    decl.value = decl.value.replace(
      /[a-zA-Z_][a-zA-Z0-9_-]*/g,
      (token) => animations.get(token) || token,
    );
  if (decl.prop === "font-family")
    decl.value = decl.value.replace(/(['"]?)icomoon\1/g, '"Rosaline Icons"');
});
fs.writeFileSync(target + "reference.css", isolated.toString());
const crypto = require("node:crypto");
const files = [
  "home-bold-modern.html",
  "assets/css/bootstrap.min.css",
  "assets/css/swiper-bundle.min.css",
  "assets/css/animate.css",
  "assets/css/image-compare-viewer.min.css",
  "assets/icon/icomoon/style.css",
  "assets/css/styles.css",
];
fs.writeFileSync(
  target + "reference-provenance.json",
  JSON.stringify(
    {
      template: "Rosaline 1.0.0 / home-bold-modern.html",
      transformation:
        "Selector scope, local asset URLs, namespaced keyframes and icon font. Visual declaration values preserved.",
      sources: Object.fromEntries(
        files.map((file) => [
          file,
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(root + file))
            .digest("hex"),
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log("Original CSS scoped; local resources and provenance written.");
