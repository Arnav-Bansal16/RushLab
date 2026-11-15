import type { LayoutDocument } from "../editor/layout";
import { readTemplateDocument } from "./document";
const key = "rushlab:pending-layout-v1";
/** A temporary tab-local draft bridges sign-in navigation; cloud saves remain explicit. */
export function preserveDraft(
  document: LayoutDocument,
  ownerId: string | null,
) {
  sessionStorage.setItem(
    key,
    JSON.stringify({ ownerId, document: readTemplateDocument(document) }),
  );
}
export function takeDraft(ownerId: string | null): LayoutDocument | null {
  const value = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!value) return null;
  const parsed = JSON.parse(value);
  if (parsed.ownerId !== null && parsed.ownerId !== ownerId) return null;
  return readTemplateDocument(parsed.document);
}
export function clearDraft() {
  sessionStorage.removeItem(key);
}
