import type { Metadata } from "next";
import "./globals.css";
import "./dashboard-pro.css";
import "./public-pro.css";
export const metadata: Metadata = {
  title: {
    default: "Inspirers’ Den | Influencer Marketing & PR",
    template: "%s | Inspirers’ Den",
  },
  description:
    "Connect your brand with creative voices. Influencer marketing, public relations and social media management by Inspirers’ Den.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body cz-shortcut-listen="true">{children}</body>
    </html>
  );
}
