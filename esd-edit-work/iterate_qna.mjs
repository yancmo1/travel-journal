import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = process.env.SOURCE_PPTX;
const finalPath = process.env.FINAL_PPTX;
const p = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const snapshot = await p.inspect({ kind: "slide,textbox", include: "id,slide,text,bbox", maxChars: 200000 });
const records = snapshot.ndjson.split("\n").filter(Boolean).map((line) => JSON.parse(line));

function find(slide, predicate) {
  const hit = records.find((r) => r.kind === "textbox" && r.slide === slide && predicate(r));
  if (!hit) throw new Error(`Textbox not found on slide ${slide}`);
  return p.resolve(hit.id);
}

function setText(slide, oldText, newText) {
  const target = find(slide, (r) => r.text === oldText);
  target.text = newText;
}

function setEyebrow(slide, text) {
  const target = find(slide, (r) => Array.isArray(r.bbox) && r.bbox[1] < 50 && typeof r.text === "string" && r.text.includes("•"));
  target.text = text;
}

const checkpoints = [11, 19, 30, 41, 46, 51];
for (const slide of checkpoints) {
  setText(slide, "CLASS Q&A", slide === 51 ? "FINAL DISCUSSION" : "PAUSE & DISCUSS");
  setText(slide, "QUICK REVIEW", "QUICK CHECK");
}

setEyebrow(11, "02 • ELECTROSTATIC DISCHARGE - PAUSE & CHECK");
setEyebrow(19, "03 • ELECTRICAL FUNDAMENTALS - PAUSE & CHECK");
setEyebrow(30, "04 • METER SAFETY & USE - PAUSE & CHECK");
setEyebrow(41, "05 • WIRING DIAGRAMS - PAUSE & CHECK");
setEyebrow(46, "06 • HANDS-ON LAB - PAUSE & CHECK");
setEyebrow(51, "07 • POLICIES AND CLOSE - FINAL CHECK");

setText(19, "Follow the power path—not the symptom.", "Before we measure, follow the power path.");
setText(41, "Use the drawing to choose the next test.", "The drawing tells us what to test next.");
setText(46, "Turn every reading into useful evidence.", "If you can explain the reading, you can use it in the field.");
setText(51, "Finish with habits that make work repeatable.", "What will you carry into the next service call?");

const pptx = await PresentationFile.exportPptx(p);
await pptx.save(finalPath);
console.log(finalPath);
