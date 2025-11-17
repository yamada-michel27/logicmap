import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogicMap - Visualize Algorithm Flows",
  description: "Visualize algorithm flows from Markdown using ReactFlow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
