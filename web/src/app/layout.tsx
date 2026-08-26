import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AppChrome } from "@/components/AppChrome";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "سديد · تدقيق العقود",
  description:
    "تدقيق العقود مقابل القوانين العُمانية باستشهاد قابل للتحقّق من نصّ المادة.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body className="min-h-dvh flex flex-col">
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
