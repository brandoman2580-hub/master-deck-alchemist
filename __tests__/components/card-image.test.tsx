/**
 * CardImage placeholder behavior — missing art must not request /placeholder.svg
 * through next/image (that previously 404'd and spammed the terminal).
 */

import { render, screen } from "@testing-library/react";
import { CardImage } from "@/components/ui/card-image";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} data-testid="next-image" />
  ),
}));

describe("CardImage", () => {
  it("renders an inline placeholder for provisional cards without fetching an image", () => {
    render(
      <CardImage
        card={{ id: 101302023, name: "Dracotail Phrixl", card_images: null }}
        width={42}
        height={62}
        alt="Dracotail Phrixl"
      />,
    );

    expect(screen.queryByTestId("next-image")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Dracotail Phrixl" })).toBeInTheDocument();
  });

  it("uses next/image for cards with hosted art metadata", () => {
    process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL =
      "https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small";

    render(
      <CardImage
        card={{
          id: 84477320,
          name: "Dracotail Phryxul",
          card_images: [
            {
              id: 84477320,
              image_url:
                "https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small/84477320.jpg",
              image_url_small:
                "https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small/84477320.jpg",
            },
          ],
        }}
        width={42}
        height={62}
        alt="Dracotail Phryxul"
      />,
    );

    const img = screen.getByTestId("next-image");
    expect(img).toHaveAttribute(
      "src",
      "https://mda-card-images-prod.s3.us-east-1.amazonaws.com/cards_small/84477320.jpg",
    );
    expect(img).toHaveAttribute("alt", "Dracotail Phryxul");
  });
});
