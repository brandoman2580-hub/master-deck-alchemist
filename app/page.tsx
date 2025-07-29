import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, Hammer, Swords, FlaskConical } from "lucide-react";
import DragonLogo from "@/public/images/mda_insanity_logo.svg";
import BodyBackground from "@/public/images/mda_cards_bg2.svg";

export default function Home() {
  return (
    <>
      {/* Background Image */}
      <BodyBackground
        className="fixed top-0 left-0 w-full h-auto z-0 pointer-events-none"
        style={{
          maxHeight: "100vh",
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
      <div className="flex flex-col pt-20">
        <div className="container px-4 flex-1 flex flex-col justify-center">
          <div className="relative z-10 flex flex-col space-y-4">
            
            {/* Logo and Title Section */}
            <div className="flex items-center justify-center">
              <DragonLogo className="h-[120] w-[120] flex-shrink-0" />
              <h1 className="flex flex-col text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter font-rowdies pt-32">
                <span>MASTER DECK</span> 
                <span className="text-red-600 text-9xl">ALCHEMIST</span>
              </h1>
            </div>

            {/* Cards Section */}
            <div className="flex justify-center">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
                
                {/* Build Card */}
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <Hammer className="h-12 w-12 text-blue-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-rowdies">BUILD</h3>
                  <p className="text-sm text-muted-foreground">
                    Construct powerful decks with our advanced deck builder and optimization tools
                  </p>
                </div>

                {/* Test Card */}
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <FlaskConical className="h-12 w-12 text-green-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-rowdies">TEST</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyze deck performance and test strategies with AI-powered simulations
                  </p>
                </div>

                {/* Duel Card */}
                <div className="bg-black/60 backdrop-blur-sm rounded-lg p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <Swords className="h-12 w-12 text-red-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-rowdies">DUEL</h3>
                  <p className="text-sm text-muted-foreground">
                    Master your gameplay and dominate the competition with refined strategies
                  </p>
                </div>

              </div>
            </div>

            {/* Description and Buttons Section */}
            <div className="flex flex-col items-center space-y-8 text-center">
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
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
