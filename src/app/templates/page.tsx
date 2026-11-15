import type { Metadata } from "next";
import TemplateLibrary from "../../features/templates/TemplateLibrary";
export const metadata: Metadata = { title: "My templates · RushLab" };
export default function TemplatesPage() {
  return <TemplateLibrary />;
}
