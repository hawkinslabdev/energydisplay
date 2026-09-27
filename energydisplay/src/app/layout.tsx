import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Blur from "./components/shared/Blur";
import theme from "./core/utils/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Energy Dashboard",
  description: "A self-hosted implementation of the HomeWizard Energy Display.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}

        <Blur position="top" color={theme.colors.blur.top} />
        <Blur position="bottom" color={theme.colors.blur.bottom} />
      </body>
    </html>
  );
}
