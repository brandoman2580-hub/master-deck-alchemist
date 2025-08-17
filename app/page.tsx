import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, Hammer, Swords, FlaskConical } from "lucide-react";
import DragonLogo from "@/public/images/mda_dragon.svg";
import BodyBackground from "@/public/images/landing_page_bg.svg";

export default function Home() {
  return (
    <>
      {/* Background Image */}
      <div className="fixed inset-0 w-screen h-screen -z-10 overflow-hidden">
        <BodyBackground className="w-full h-full object-fill" />
      </div>

      {/* Body Content */}
      <div className="fixed inset-0 z-10 pointer-events-none" />
      <div className="flex flex-col min-h-screen">
        <div className="container px-4 flex-1 flex flex-col justify-start pt-4">
          <div className="relative z-10 flex flex-col">
            {/* Logo and Title Section */}
            <div style={{ lineHeight: 1 }} className="flex flex-col items-center justify-start px-4 gap-2">
              <DragonLogo
                className="block"
                style={{
                  height: "50vh",
                  width: "auto",
                  margin: 0,
                  padding: 0,
                  display: "block",
                }}
              />

              <h1
                className="flex flex-col items-center text-center font-bold tracking-tighter font-cinzel pointer-events-auto"
                style={{
                  fontSize: "clamp(1.5rem, 6vh, 4.5rem)",
                  lineHeight: 1.1,
                }}
              >
                <span>
                  MASTER DECK
                  <span
                    className="text-red-600 pl-3"
                    style={{ fontSize: "clamp(1.5rem, 6vh, 4.5rem)" }}
                  >
                    ALCHEMIST
                  </span>
                </span>
              </h1>
            </div>

            {/* Cards Section */}
            <div className="flex justify-center">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
                {/* Build Card */}
                <div className="p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <Hammer className="h-12 w-12 text-blue-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-cinzel">BUILD</h3>
                  <p className="text-sm text-muted-foreground">
                    Construct powerful decks with our advanced deck builder and
                    optimization tools
                  </p>
                </div>

                {/* Test Card */}
                <div className="p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <FlaskConical className="h-12 w-12 text-blue-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-cinzel">TEST</h3>
                  <p className="text-sm text-muted-foreground">
                    Analyze deck performance and test strategies with AI-powered
                    simulations
                  </p>
                </div>

                {/* Duel Card */}
                <div className="p-6 text-center transition-colors">
                  <div className="flex justify-center mb-4">
                    <Swords className="h-12 w-12 text-blue-400" />
                  </div>
                  <h3 className="text-4xl font-bold mb-2 font-cinzel">DUEL</h3>
                  <p className="text-sm text-muted-foreground">
                    Master your gameplay and dominate the competition with
                    refined strategies
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
