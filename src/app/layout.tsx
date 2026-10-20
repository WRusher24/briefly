import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Briefly — zero-waste intelligence briefings", template: "%s · Briefly" },
  description: "Markets, Sports and Geopolitics distilled into 3-tier insights. Read less, know more.",
  applicationName: "Briefly",
  appleWebApp: { capable: true, title: "Briefly", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Dark is the default; a saved "light" choice is applied before first paint to avoid a flash.
const themeScript = `try{if(localStorage.getItem('briefly-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
