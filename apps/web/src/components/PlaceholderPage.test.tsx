import { render, screen } from "@testing-library/react";
import { PlaceholderPage } from "./PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders the title", () => {
    render(<PlaceholderPage title="Hello World" />);
    expect(
      screen.getByRole("heading", { name: "Hello World" }),
    ).toBeInTheDocument();
  });

  it("shows the default Wave 2 note", () => {
    render(<PlaceholderPage title="X" />);
    expect(screen.getByText(/Filled by Wave 2/i)).toBeInTheDocument();
  });
});
