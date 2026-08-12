import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const starterPath = process.env.STARTER_PPTX;
const finalPath = process.env.FINAL_PPTX;
// Authoring base: template-starter.pptx, imported below and edited in place.

const p = await PresentationFile.importPptx(await FileBlob.load(starterPath));
const inspect = await p.inspect({ kind: "slide,textbox", include: "id,slide,text,textPreview,name,bbox", maxChars: 300000 });
const records = inspect.ndjson.split("\n").filter(Boolean).map((line) => JSON.parse(line));

function findTextbox(slide, predicate) {
  const hit = records.find((r) => r.kind === "textbox" && r.slide === slide && predicate(r));
  if (!hit) throw new Error(`Textbox not found on slide ${slide}`);
  return p.resolve(hit.id);
}

function replaceExact(slide, oldText, newText) {
  const target = findTextbox(slide, (r) => r.text === oldText);
  target.text = newText;
}

function replaceEyebrow(slide, newText) {
  const target = findTextbox(slide, (r) => Array.isArray(r.bbox) && r.bbox[1] < 50 && typeof r.text === "string" && r.text.includes("•"));
  target.text = newText;
}

// Section dividers: revised numbering and plain-spoken subtitles.
replaceExact(2, "SECTION 01\nIntroduction\nToday’s mission: make every test safer and smarter.", "SECTION 01\nIntroduction\nStart with the habits that make every test safer.");
replaceExact(6, "SECTION 02\nElectrical Safety & ESD\nThe damage you cannot see still counts.", "SECTION 02\nElectrical Safety & ESD\nStatic damage can be invisible.");
replaceExact(12, "SECTION 03\nElectrical Fundamentals\nVoltage pushes. Resistance limits. Current flows.", "SECTION 03\nElectrical Fundamentals\nUnderstand the basics, then follow power through the cabinet.");
replaceExact(20, "SECTION 05\nMeter Safety & Use\nSet the meter before the probes touch.", "SECTION 04\nMeter Safety & Use\nSet the meter before the probes touch.");
replaceExact(31, "SECTION 06\nWiring Diagrams\nRead the map. Then prove it on the cabinet.", "SECTION 05\nWiring Diagrams\nUse the drawing to choose the next test.");
replaceExact(42, "SECTION 07\nHands-On Lab\nYour turn: measure, compare, explain.", "SECTION 06\nHands-On Lab\nMeasure, compare, explain.");
replaceExact(47, "SECTION 08\nIn Closing\nTurn today’s practice into tomorrow’s habit.", "SECTION 07\nIn Closing\nMake the safe sequence a field habit.");

// Roadmap: keep Power Flow visible as a topic, but not as a standalone section.
replaceExact(3, "Follow power from the wall to the cabinet load", "Follow power through the cabinet");
replaceExact(3, "Power Flow", "Power Flow (inside Fundamentals)");

// Focused title tightening.
const titleEdits = [
  [4, "To understand static electricity, the power types we work with, how power flows through a cabinet, and how to use a multimeter when troubleshooting.", "We’ll cover static electricity, the power in a cabinet, and how to use a multimeter to troubleshoot safely."],
  [7, "ESD - Electrostatic Discharge – What is it?", "ESD: What is it, and why does it matter?"],
  [8, "Static damage is not always loud, immediate, or obvious.", "Static damage can be invisible."],
  [10, "Good ESD practice is a short sequence you can repeat every call.", "Good ESD practice is a short sequence you can repeat on every call."],
  [14, "Basic Electrical", "AC and DC: where each one shows up"],
  [18, "Troubleshooting gets easier when you can picture the whole path.", "Trace power from the source to the load."],
  [23, "Most general troubleshooting uses four dial positions.", "Know the dial before you test."],
  [26, "Continuity and resistance checks require power off.", "Power off before continuity or resistance."],
  [29, "Use the same seven-step meter sequence every time.", "Use the same seven-step meter sequence every time."],
];
for (const [slide, oldText, newText] of titleEdits) replaceExact(slide, oldText, newText);

// Revised section eyebrows. These are intentionally explicit so every content slide carries the new structure.
const eyebrowEdits = {
  3: "01 • INTRODUCTION - LEARNING PATH",
  4: "01 • INTRODUCTION - WHY WE ARE HERE",
  5: "01 • INTRODUCTION - OUTCOMES",
  7: "02 • ELECTROSTATIC DISCHARGE - ESD",
  8: "02 • ELECTROSTATIC DISCHARGE - ESD",
  9: "02 • ELECTROSTATIC DISCHARGE - ESD",
  10: "02 • ELECTROSTATIC DISCHARGE - ESD",
  11: "02 • ELECTROSTATIC DISCHARGE - REVIEW / Q&A",
  13: "03 • ELECTRICAL FUNDAMENTALS - SAFETY",
  14: "03 • ELECTRICAL FUNDAMENTALS - BASIC ELECTRICAL UNDERSTANDING",
  15: "03 • ELECTRICAL FUNDAMENTALS - BASIC ELECTRICAL UNDERSTANDING",
  16: "03 • ELECTRICAL FUNDAMENTALS - POWER IN THE CABINET",
  17: "03 • ELECTRICAL FUNDAMENTALS - REVIEW / Q&A",
  18: "03 • ELECTRICAL FUNDAMENTALS - POWER FLOW",
  19: "03 • ELECTRICAL FUNDAMENTALS - REVIEW / Q&A",
  21: "04 • METER SAFETY & USE - INTRODUCTION",
  22: "04 • METER SAFETY & USE - INTRODUCTION",
  23: "04 • METER SAFETY & USE - ABOUT THE DIAL",
  24: "04 • METER SAFETY & USE - BATTERY TESTING",
  25: "04 • METER SAFETY & USE - SAFETY",
  26: "04 • METER SAFETY & USE - SAFETY",
  27: "04 • METER SAFETY & USE - CONTINUITY",
  28: "04 • METER SAFETY & USE - CONTINUITY",
  29: "04 • METER SAFETY & USE - SEVEN-STEP SEQUENCE",
  30: "04 • METER SAFETY & USE - REVIEW / Q&A",
  32: "05 • WIRING DIAGRAMS - BEFORE YOU TRACE",
  33: "05 • WIRING DIAGRAMS - BEFORE YOU TRACE",
  34: "05 • WIRING DIAGRAMS - REFERENCE DRAWING",
  35: "05 • WIRING DIAGRAMS - REFERENCE DRAWING",
  36: "05 • WIRING DIAGRAMS - REFERENCE DRAWING",
  37: "05 • WIRING DIAGRAMS - REFERENCE DRAWING",
  38: "05 • WIRING DIAGRAMS - ISOLATING THE FAULT",
  39: "05 • WIRING DIAGRAMS - TROUBLESHOOTING STEPS",
  40: "05 • WIRING DIAGRAMS - SYMPTOM GUIDE",
  41: "05 • WIRING DIAGRAMS - REVIEW / Q&A",
  43: "06 • HANDS-ON LAB - STATION ROTATION",
  44: "06 • HANDS-ON LAB - CMOS BATTERY EXAMPLE",
  45: "06 • HANDS-ON LAB - CONTINUITY TEST",
  46: "06 • HANDS-ON LAB - Q&A",
  48: "07 • POLICIES AND CLOSE - REVIEW",
  49: "07 • POLICIES AND CLOSE - VERIFY AND CLOSE",
  50: "07 • POLICIES AND CLOSE - FIELD REFERENCE",
  51: "07 • POLICIES AND CLOSE - REVIEW / Q&A",
};
for (const [slide, text] of Object.entries(eyebrowEdits)) replaceEyebrow(Number(slide), text);

const pptx = await PresentationFile.exportPptx(p);
await pptx.save(finalPath);
await fs.writeFile(`${finalPath}.edit-log.txt`, [
  "Reordered sections: Intro, ESD, Electrical Fundamentals + Power Flow, Meters, Wiring Diagrams, Hands-On Lab, Closing.",
  "Omitted the standalone Power Flow divider; retained its content inside Electrical Fundamentals.",
  "Moved the seven-step meter sequence after meter operation and safety content.",
  "Updated section divider copy and all content-slide eyebrows to match the revised structure.",
  "Applied focused title/copy tightening on selected slides.",
].join("\n"));
console.log(finalPath);
