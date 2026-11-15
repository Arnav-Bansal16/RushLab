import type { LayoutDocument } from "../editor/layout";
import { componentKinds } from "../editor/layout";
import { validateSimulationFestival } from "../editor/simulationInput";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const textRecord = (value: unknown) =>
  object(value) &&
  Object.values(value).every((item) => typeof item === "string");
export function templateName(value: string) {
  const name = value.trim();
  if (!name || name.length > 80)
    throw new Error("Give your template a name between 1 and 80 characters.");
  return name;
}
/** Validate untrusted cloud JSON before it can replace an editor draft. Blank drafts are allowed. */
export function readTemplateDocument(value: unknown): LayoutDocument {
  try {
    if (
      !object(value) ||
      JSON.stringify(value).length > 1_000_000 ||
      value.schemaVersion !== 1 ||
      !object(value.editor)
    )
      throw new Error();
    const editor = value.editor;
    if (
      editor.schemaVersion !== 1 ||
      typeof editor.eventType !== "string" ||
      !Array.isArray(editor.elements) ||
      !textRecord(editor.labels) ||
      !textRecord(editor.colors)
    )
      throw new Error();
    const document = value as unknown as LayoutDocument;
    const entities = [
      ...document.entrances,
      ...document.vendors,
      ...document.stages,
      ...(document.amenities ?? []),
      ...document.paths,
      ...document.obstacles,
      ...document.editor.elements,
    ];
    if (
      !entities.every(
        (item) =>
          typeof item.id === "string" &&
          !["__proto__", "constructor", "prototype"].includes(item.id),
      )
    )
      throw new Error();
    if (new Set(entities.map((item) => item.id)).size !== entities.length)
      throw new Error();
    if (
      [
        ...document.entrances,
        ...document.vendors,
        ...document.stages,
        ...(document.amenities ?? []),
      ].some((item) => typeof item.name !== "string")
    )
      throw new Error();
    const errors = validateSimulationFestival(document).filter(
      (error) =>
        error !== "Add an entrance gate before sending this layout to SIM-01.",
    );
    if (errors.length) throw new Error();
    for (const item of document.editor.elements) {
      if (
        !componentKinds.includes(item.kind) ||
        typeof item.name !== "string" ||
        typeof item.color !== "string" ||
        !["circle", "rectangle"].includes(item.shape) ||
        ![
          item.position.x,
          item.position.y,
          item.size.width,
          item.size.height,
        ].every(Number.isFinite) ||
        item.size.width <= 0 ||
        item.size.height <= 0
      )
        throw new Error();
    }
    return structuredClone(document);
  } catch {
    throw new Error(
      "This saved layout is invalid or uses an unsupported format. Your current draft has not been changed.",
    );
  }
}
