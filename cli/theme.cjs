const fs = require("node:fs");
function applyCssTheme(target, cssPath) {
  const css = fs.readFileSync(cssPath, "utf8");
  const values = Object.fromEntries(
    [...css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );
  const text = (key, fallback) =>
    values[key] == null ? fallback : values[key].replace(/^['"]|['"]$/g, "");
  const number = (key, fallback) =>
    values[key] == null ? fallback : Number.parseFloat(values[key]);
  const color = (key, fallback) =>
    values[key] == null ? fallback : values[key].replace("#", "").toUpperCase();
  target.fontFamily = text("chrono-font-family", target.fontFamily);
  target.bodyFontSize = number("chrono-body-font-size", target.bodyFontSize);
  target.headingColor = color("chrono-heading-color", target.headingColor);
  target.tableHeaderBackground = color(
    "chrono-table-header-background",
    target.tableHeaderBackground,
  );
  target.tableHeaderColor = color("chrono-table-header-color", target.tableHeaderColor);
  target.tableBorderColor = color("chrono-table-border-color", target.tableBorderColor);
  target.markerBackground = color("chrono-marker-background", target.markerBackground);
  target.markerColor = color("chrono-marker-color", target.markerColor);
  target.markerSizePt = number("chrono-marker-size", target.markerSizePt);
  target.componentBold = text("chrono-component-bold", String(target.componentBold)) === "true";
  target.componentColor = color("chrono-component-color", target.componentColor);
  target.linkColor = color("chrono-link-color", target.linkColor);
  target.microprintHeightPt = number("chrono-microprint-height", target.microprintHeightPt);
  target.microprintMaxWidthPt = number("chrono-microprint-max-width", target.microprintMaxWidthPt);
  target.titleBefore = number("chrono-title-before", target.titleBefore);
  target.titleAfter = number("chrono-title-after", target.titleAfter);
  target.screenBefore = number("chrono-screen-before", target.screenBefore);
  target.screenAfter = number("chrono-screen-after", target.screenAfter);
  target.tableBefore = number("chrono-table-before", target.tableBefore);
  target.tableAfter = number("chrono-table-after", target.tableAfter);
}

module.exports = { applyCssTheme };
