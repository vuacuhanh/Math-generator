import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Math Worksheet Generator",
  description: "Generate printable math worksheets with AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* thêm bg + antialiased để test Tailwind */}
     <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
