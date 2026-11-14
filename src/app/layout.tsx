import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RushLab",
  description: "Festival operations simulation and scenario planning",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
