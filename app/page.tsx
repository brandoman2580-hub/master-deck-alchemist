import type { ReactNode } from "react";
import { LandingScreen } from "@/components/mda/landing-screen";
import "./landing-story.css";
import "../design/stitch/sticky-word-stack/fonts.local.css";

/**
 * Landing. The previous page is replaced by the Sticky Word Stack screen.
 */
export default function HomePage(): ReactNode {
  return <LandingScreen />;
}
