import { describe, expect, it, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createBlankLayout,
  addComponent,
  fromFestival,
} from "../editor/layout";
import { demoFestival } from "../../fixtures/demoFestival";
import { readTemplateDocument, templateName } from "./document";
import { listTemplates, loadTemplate, saveTemplate } from "./storage";
import { preserveDraft, takeDraft } from "./draft";

function cloud(document = fromFestival(demoFestival)) {
  const row = {
    id: "template-1",
    name: "My event",
    updated_at: "2026-11-15T00:00:00Z",
    document,
  };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue({ data: [row], error: null });
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: "owner-a" } }, error: null });
  const client = {
    auth: { getUser },
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient;
  return { client, chain, getUser, row };
}
afterEach(() => vi.unstubAllGlobals());
describe("private cloud templates", () => {
  it("round-trips the full editor layout independently, including unfinished drafts and annotations", () => {
    const draft = addComponent(fromFestival(demoFestival), {
      kind: "custom",
      name: "Welcome tent",
      width: 6,
      height: 4,
      color: "#abc123",
      shape: "circle",
      category: "other",
      servers: 1,
    }).document;
    draft.editor.colors[draft.vendors[0].id] = "#123456";
    draft.editor.labels[draft.vendors[0].id] = "Renamed stall";
    const restored = readTemplateDocument(JSON.parse(JSON.stringify(draft)));
    expect(restored).toEqual(draft);
    restored.editor.labels[draft.vendors[0].id] = "Independent edit";
    expect(draft.editor.labels[draft.vendors[0].id]).toBe("Renamed stall");
    expect(readTemplateDocument(createBlankLayout())).toEqual(
      createBlankLayout(),
    );
  });
  it("rejects corrupt, oversized or unsupported payloads before replacing a draft", () => {
    for (const value of [
      null,
      {},
      { ...createBlankLayout(), schemaVersion: 2 },
      { ...createBlankLayout(), editor: {} },
      { ...createBlankLayout(), name: "x".repeat(1_000_001) },
    ])
      expect(() => readTemplateDocument(value)).toThrow(
        "current draft has not been changed",
      );
    const invalid = fromFestival(demoFestival);
    invalid.vendors[0].servers = -1;
    expect(() => readTemplateDocument(invalid)).toThrow();
    expect(() => templateName("  ")).toThrow();
    expect(() => templateName("x".repeat(81))).toThrow();
    expect(templateName("  Spring market  ")).toBe("Spring market");
  });
  it("requires authenticated ownership before listing, reading or saving", async () => {
    const { client, getUser } = cloud();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listTemplates(client)).rejects.toThrow("sign in");
    await expect(loadTemplate("template-1", client)).rejects.toThrow("sign in");
    await expect(
      saveTemplate("Event", createBlankLayout(), undefined, client),
    ).rejects.toThrow("sign in");
    expect(client.from).not.toHaveBeenCalled();
    await expect(listTemplates(null)).rejects.toThrow("isn’t connected");
  });
  it("filters all reads by the verified user and rejects missing/cross-account templates", async () => {
    const { client, chain } = cloud();
    await listTemplates(client);
    await loadTemplate("template-1", client);
    expect(chain.eq).toHaveBeenCalledWith("owner_id", "owner-a");
    expect(chain.eq).toHaveBeenCalledWith("id", "template-1");
    expect(chain.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    chain.single.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    await expect(loadTemplate("other-owner-template", client)).rejects.toThrow(
      "your account",
    );
  });
  it("takes an immutable submitted snapshot and uses verified ownership on insert/update", async () => {
    const { client, chain } = cloud();
    const document = fromFestival(demoFestival);
    const before = structuredClone(document);
    const pending = saveTemplate("  Event  ", document, undefined, client);
    document.name = "Edited while saving";
    await pending;
    expect(chain.insert).toHaveBeenCalledWith({
      name: "Event",
      owner_id: "owner-a",
      format_version: 1,
      document: before,
    });
    await saveTemplate("Renamed", before, "template-1", client);
    expect(chain.update).toHaveBeenCalledWith({
      name: "Renamed",
      document: before,
    });
    expect(chain.eq).toHaveBeenCalledWith("owner_id", "owner-a");
    expect(chain.eq).toHaveBeenCalledWith("id", "template-1");
  });
  it("reports save failures without treating them as successful local saves", async () => {
    const { client, chain } = cloud();
    chain.single.mockResolvedValue({
      data: null,
      error: { message: "offline" },
    });
    await expect(
      saveTemplate("Event", createBlankLayout(), undefined, client),
    ).rejects.toThrow("wasn’t saved");
  });
  it("preserves a draft through sign-in, consumes it once, and isolates signed-in accounts", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    });
    const draft = fromFestival(demoFestival);
    preserveDraft(draft, null);
    expect(takeDraft("newly-signed-in-owner")).toEqual(draft);
    expect(takeDraft("newly-signed-in-owner")).toBeNull();
    preserveDraft(draft, "owner-a");
    expect(takeDraft("owner-b")).toBeNull();
  });
});
