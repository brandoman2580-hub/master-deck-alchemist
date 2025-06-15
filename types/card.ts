export interface Card {
  id: number
  name: string
  type: string
  desc: string
  atk?: number
  def?: number
  level?: number
  race: string
  attribute?: string
  archetype?: string
  card_images: {
    id: number
    image_url: string
    image_url_small: string
  }[]
  card_prices: {
    cardmarket_price: string
    tcgplayer_price: string
    ebay_price: string
    amazon_price: string
  }[]
}

export interface CardSearchParams {
  name?: string
  type?: string
  race?: string
  attribute?: string
  level?: string
  atk?: string
  def?: string
  archetype?: string
  effect?: string
  sort?: string
  sortDirection?: "asc" | "desc"
}
