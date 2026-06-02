import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MindSync",
  description: "Sync your Adult and Child minds for optimal flow. A productivity app for mental balance.",
  keywords: ["productivity", "mental health", "mindsync", "task management", "AI coaching"],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MindSync',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
      </head>
      <body
        className="font-sans antialiased"
      >
        {children}
      </body>
    </html>
  );
}

