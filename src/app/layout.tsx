import type { Metadata, Viewport } from "next";
import { Fredoka, Patrick_Hand } from "next/font/google";
import { BubbleBackground } from "@/components/BubbleBackground";
import "./globals.css";

// Round, friendly font used across the whole app (see --font-sans in globals.css).
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

// Handwriting accent, only for step headings, the mascot's speech bubble and captions
// (see --font-hand in globals.css). Long text stays in Fredoka.
const patrickHand = Patrick_Hand({
  variable: "--font-patrick-hand",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alchemia",
  description: "Turn what you have into what you need.",
};

// "cover" lets the page reach under the phone's home bar, so env(safe-area-inset-bottom)
// gives the sticky action bar the right padding.
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${patrickHand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <BubbleBackground />
        {children}
      </body>
    </html>
  );
}
