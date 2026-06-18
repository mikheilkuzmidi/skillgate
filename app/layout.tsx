import type { Metadata } from "next";
import { ReactNode } from "react";
import "@/app/globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SkillGate",
  description: "Credential gated task access for Granary Foods.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
