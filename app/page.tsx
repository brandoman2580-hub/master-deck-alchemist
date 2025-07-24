import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import DragonIcon from "@/public/images/mda_dragon_icon.svg";
import BodyBackground from "@/public/images/mda_cards_bg2.svg";

export default function Home() {
  return (
    <>
      {/* Background Image */}
      <BodyBackground
        className="fixed top-0 left-0 w-full h-auto z-0 pointer-events-none"
        style={{
          maxHeight: "50vh", // Adjust as needed
          minWidth: "100vw",
          objectFit: "cover",
          opacity: 0.8,
          maskImage:
            "radial-gradient(circle at 50% 40%, white 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 40%, white 20%, transparent 70%)",
        }}
      />
      {/* Vignette Overlay */}
      <div
        className="fixed inset-0 z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, transparent 20%, black 60%, black 100%)",
          mixBlendMode: "multiply",
        }}
      />
      <div className="container px-4 py-4">
        <div className="relative flex flex-col items-center justify-center">
          {/* Overlayed Content */}
          <div className="relative z-10 flex flex-col items-center space-y-8 text-center mt-[500px]">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl flex items-center mb-[-64px] pr-16">
              <DragonIcon className="h-48 w-48 mr-[-32px]" />
              MASTER DECK ALCHEMIST
            </h1>
            <p className="max-w-[800px] text-lg text-muted-foreground">
              Build, optimize, and master your Yu-Gi-Oh! decks with advanced
              tools and insights
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg">
                <Link href="/deck-builder">
                  Start Building <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/card-browser">Browse Cards</Link>
              </Button>
            </div>
            <div className="flex justify-center">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl flex items-center justify-center mb-[-64px]">
                BUILD. &nbsp; TEST. &nbsp; DUEL.
              </h1>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
