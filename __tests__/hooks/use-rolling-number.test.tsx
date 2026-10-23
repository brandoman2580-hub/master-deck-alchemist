import { act, render, screen } from "@testing-library/react";
import { useRollingNumber } from "@/hooks/useRollingNumber";

let reduceMotion = false;

jest.mock("framer-motion", () => ({
  useReducedMotion: () => reduceMotion,
}));

function Probe({ value }: { value: number }) {
  const display = useRollingNumber(value, 150);
  return <span>{display}</span>;
}

describe("useRollingNumber", () => {
  afterEach(() => {
    reduceMotion = false;
    jest.useRealTimers();
  });

  it("paints the finished value and snaps when motion is reduced", () => {
    reduceMotion = true;
    const { rerender } = render(<Probe value={40} />);
    expect(screen.getByText("40")).toBeInTheDocument();
    rerender(<Probe value={43} />);
    expect(screen.getByText("43")).toBeInTheDocument();
  });

  it("rolls to the next integer instead of jumping on the first frame", () => {
    jest.useFakeTimers();
    const { rerender } = render(<Probe value={40} />);
    rerender(<Probe value={43} />);
    act(() => {
      jest.advanceTimersByTime(16);
    });
    expect(screen.getByText("41")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(screen.getByText("43")).toBeInTheDocument();
  });
});
