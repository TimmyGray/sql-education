import * as React from "react";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings, paragraphs, lists, inline code and bold", () => {
    const src = [
      "# Title",
      "",
      "A paragraph with `inline` code and **bold** text.",
      "",
      "- first",
      "- second",
    ].join("\n");

    render(<Markdown source={src} />);

    expect(
      screen.getByRole("heading", { name: "Title", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("inline")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("renders fenced code blocks verbatim", () => {
    const src = "```sql\nSELECT * FROM t;\n```";
    render(<Markdown source={src} />);
    expect(screen.getByText("SELECT * FROM t;")).toBeInTheDocument();
  });

  it("handles empty source without crashing", () => {
    const { container } = render(<Markdown source="" />);
    expect(container).toBeInTheDocument();
  });
});
