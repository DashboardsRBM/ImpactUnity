import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RBM Partnership Impact Dashboard | Global Malaria Dashboard",
  description:
    "Theory of Change Progress Monitoring of the Malaria Ecosystem Path towards eradication powered by the Big Push and Unity 30 Strategic Framework.",
  openGraph: {
    title: "RBM Partnership Impact Dashboard | Global Malaria Dashboard",
    description:
      "Theory of Change Progress Monitoring of the Malaria Ecosystem Path towards eradication powered by the Big Push and Unity 30 Strategic Framework.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Roboto:wght@400;500;700&display=swap"
        />
      </head>
      <body className="bg-[#f5f7fa] text-[#111827] antialiased selection:bg-[#2563eb] selection:text-white font-sans">
        {children}
      </body>
    </html>
  );
}
