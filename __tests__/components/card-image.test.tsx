/**
 * CardImage placeholder behavior — missing art must not request /placeholder.svg
 * through next/image (that previously 404'd and spammed the terminal).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import {
  CardImage,
  clearLoadedCardImageCache,
} from "@/components/ui/card-image";

let reportDecoded = false;

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: {
    src: string;
    alt: string;
    onLoad?: (event: unknown) => void;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(node) => {
        if (!node || !reportDecoded) return;
        Object.defineProperty(node, "naturalWidth", {
          configurable: true,
          value: 200,
        });
      }}
      src={props.src}
      alt={props.alt}
      data-testid="next-image"
      onLoad={props.onLoad}
    />
  ),
}));

const hostedCard = {
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
};

describe("CardImage", () => {
  beforeEach(() => {
    reportDecoded = false;
    clearLoadedCardImageCache();
  });

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

  it("clears the skeleton on load and skips it when the same URL mounts again", () => {
    const { container, unmount } = render(
      <CardImage card={hostedCard} width={42} height={62} alt="Dracotail Phryxul" />,
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(container.querySelector("span")).toHaveClass("relative", "block");
    expect(container.querySelector("span")).not.toHaveClass("absolute");
    fireEvent.load(screen.getByTestId("next-image"));
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();

    unmount();
    const again = render(
      <CardImage card={hostedCard} width={42} height={62} alt="Dracotail Phryxul" />,
    );
    expect(again.container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(again.getByTestId("next-image")).toHaveAttribute(
      "src",
      hostedCard.card_images[0].image_url,
    );
  });

  it("drops the skeleton when a cached image already has pixels and never fires load", () => {
    reportDecoded = true;
    const { container } = render(
      <CardImage card={hostedCard} width={42} height={62} alt="Dracotail Phryxul" />,
    );

    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });
});
