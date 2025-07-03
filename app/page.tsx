import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowRight, Search, Layers, Save } from "lucide-react"
import BodyLogo from "@/public/images/mda_body_logo.svg"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col items-center justify-center space-y-8 text-center">
        <BodyLogo className="h-96 w-96" />
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">Master Deck Alchemist</h1>
        <p className="max-w-[700px] text-lg text-muted-foreground">
          Build, optimize, and master your Yu-Gi-Oh! decks with advanced tools and insights
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button asChild size="lg">
            <Link href="/deck-builder">
              Start Building <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/card-browser">Browse Cards</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
        <Card>
          <CardHeader>
            <Search className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Browse & Search</CardTitle>
            <CardDescription>Search, filter, and sort cards by attributes and effect keywords</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Find exactly what you need with powerful search tools. Filter by Type, Archetype, ATK/DEF, Level, and
              more.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/card-browser">
                Browse Cards <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Layers className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Build & Optimize</CardTitle>
            <CardDescription>Create decks with intelligent synergy tips and warnings</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Get real-time suggestions based on your deck composition. Optimize your Main, Extra, and Side Decks.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/deck-builder">
                Build Deck <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <Save className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Save & Export</CardTitle>
            <CardDescription>Save your decks locally or export them as JSON</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Never lose your creations. Save multiple decks locally and export them to share with others.</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/saved-decks">
                Saved Decks <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
