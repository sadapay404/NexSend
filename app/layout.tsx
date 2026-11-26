import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import BottomNav from "@/components/BottomNav";
import PageTransition from "@/components/PageTransition";
import { AppStateProvider } from "@/components/AppStateProvider";
import AlertBanner from "@/components/AlertBanner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "NexSend — Digital Sheikh Nexus",
  description: "Private transfer for Digital Sheikh Nexus Training Institute",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: { images: ["/icon-512.png"], title: "NexSend" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NexSend" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <html lang="en">
        <body className="bg-black text-white min-h-screen">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">
        <AppStateProvider>
          <div className="flex min-h-screen">
            <Sidebar user={user} />
            <div className="flex-1 flex flex-col min-w-0 md:pl-60">
              <Topbar user={user} />
              <main className="flex-1 px-4 pt-4 pb-28 md:px-8 md:py-8 md:pb-8 w-full max-w-5xl mx-auto">
                <AlertBanner />
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
          </div>
          <BottomNav role={user.role} />
        </AppStateProvider>
      </body>
    </html>
  );
}
