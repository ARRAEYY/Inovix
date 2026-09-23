import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inovix — Campus Food Ordering",
  description: "Campus-only prepaid food ordering platform. Browse outlets, place orders, track status in real time.",
  keywords: ["Inovix", "campus food", "food ordering", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui"],
  authors: [{ name: "Inovix" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Inovix — Campus Food Ordering",
    description: "Browse campus outlets, place orders, and track them in real time.",
    siteName: "Inovix",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Inovix — Campus Food Ordering",
    description: "Browse campus outlets, place orders, and track them in real time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
