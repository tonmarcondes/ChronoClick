const EMUS_PER_POINT = 12700;
const color = (value, fallback) => /^[0-9a-f]{6}$/i.test(String(value || "").replace(/^#/, "")) ? String(value).replace(/^#/, "").toUpperCase() : fallback;
const number = (value, fallback, max) => Math.max(0, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));

function decoratePrints(xml, options = {}) {
  const type = ["solid", "dash", "dot", "double"].includes(options.type) ? options.type : "solid";
  const width = Math.round(number(options.widthPt, 1, 12) * EMUS_PER_POINT);
  const line = options.enabled === true && width > 0
    ? `<a:ln w="${width}" cmpd="${type === "double" ? "dbl" : "sng"}"><a:solidFill><a:srgbClr val="${color(options.color,"CBD5E1")}"/></a:solidFill><a:prstDash val="${type === "dash" ? "dash" : type === "dot" ? "sysDot" : "solid"}"/></a:ln>` : "";
  const shadow = options.shadow === true
    ? `<a:effectLst><a:outerShdw blurRad="${Math.round(number(options.blurPt,4,30)*EMUS_PER_POINT)}" dist="${Math.round(number(options.offsetPt,3,30)*EMUS_PER_POINT)}" dir="2700000" algn="ctr" rotWithShape="0"><a:srgbClr val="${color(options.shadowColor,"000000")}"><a:alpha val="${Math.round(number(options.opacity,25,100)*1000)}"/></a:srgbClr></a:outerShdw></a:effectLst>` : "";
  return xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, drawing => /name="screen-\d+"/.test(drawing) ? drawing.replace('</pic:spPr>',line+shadow+'</pic:spPr>') : drawing);
}
module.exports = { decoratePrints };
