import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import PWARegister from "./pwa-register";


export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0b" },
    { media: "(prefers-color-scheme: light)", color: "#f2f0eb" },
  ],
};

// Runs before first paint to set the theme class and prevent a flash of the wrong mode.
// Dark is the default; light applies when stored or when the OS prefers light with no stored choice.
const themeInitScript = `(function(){try{var s=localStorage.getItem('theme');if(s==='light'||(!s&&window.matchMedia('(prefers-color-scheme: light)').matches)){document.documentElement.classList.add('light');}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Rippers App",
  description: "Rippers Progressive Web App",
  manifest: "/manifest.webmanifest",
  applicationName: "Rippers",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rippers",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text antialiased">
        <PWARegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
