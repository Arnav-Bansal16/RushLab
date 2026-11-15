import type { SupabaseClient } from "@supabase/supabase-js";
import { getCloudClient } from "../account/client";
import { readTemplateDocument, templateName } from "./document";
import type { LayoutDocument } from "../editor/layout";

export interface SavedTemplate {
  id: string;
  name: string;
  updated_at: string;
  document: LayoutDocument;
}
export interface TemplateSummary {
  id: string;
  name: string;
  updated_at: string;
}
async function owner(client: SupabaseClient | null) {
  if (!client) throw new Error("Cloud saving isn’t connected yet.");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("Please sign in to access your saved templates.");
  return { client, ownerId: data.user.id };
}
export async function listTemplates(
  client = getCloudClient(),
): Promise<TemplateSummary[]> {
  const { client: cloud, ownerId } = await owner(client);
  const { data, error } = await cloud
    .from("layout_templates")
    .select("id,name,updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error)
    throw new Error("Your templates couldn’t be loaded. Please try again.");
  return data ?? [];
}
export async function loadTemplate(
  id: string,
  client = getCloudClient(),
): Promise<SavedTemplate> {
  const { client: cloud, ownerId } = await owner(client);
  const { data, error } = await cloud
    .from("layout_templates")
    .select("id,name,updated_at,document")
    .eq("owner_id", ownerId)
    .eq("id", id)
    .single();
  if (error || !data)
    throw new Error("This template could not be found in your account.");
  return { ...data, document: readTemplateDocument(data.document) };
}
export async function saveTemplate(
  name: string,
  document: LayoutDocument,
  id?: string,
  client = getCloudClient(),
): Promise<SavedTemplate> {
  // Capture and validate the complete submitted version before any asynchronous operation.
  const payload = {
    name: templateName(name),
    document: readTemplateDocument(document),
  };
  const { client: cloud, ownerId } = await owner(client);
  const query = id
    ? cloud
        .from("layout_templates")
        .update(payload)
        .eq("owner_id", ownerId)
        .eq("id", id)
    : cloud
        .from("layout_templates")
        .insert({ ...payload, owner_id: ownerId, format_version: 1 });
  const { data, error } = await query
    .select("id,name,updated_at,document")
    .single();
  if (error || !data)
    throw new Error(
      "Your template wasn’t saved. Please try again; your editor draft is still here.",
    );
  return { ...data, document: readTemplateDocument(data.document) };
}
