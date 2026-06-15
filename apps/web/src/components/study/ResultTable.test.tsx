import * as React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { ResultTable } from "./ResultTable";

describe("ResultTable", () => {
  it("shows a message when there are no columns", () => {
    renderWithProviders(<ResultTable columns={[]} rows={[]} />);
    expect(screen.getByText(/returned no columns/i)).toBeInTheDocument();
  });

  it("renders headers and formatted cells with a plural row count", () => {
    renderWithProviders(
      <ResultTable
        columns={["id", "name", "meta"]}
        rows={[
          [1, "Ada", { a: 1 }],
          [2, null, "x"],
        ]}
      />,
    );

    expect(screen.getByText("id")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("NULL")).toBeInTheDocument(); // null -> NULL
    expect(screen.getByText('{"a":1}')).toBeInTheDocument(); // object -> JSON
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("renders the empty-rows placeholder", () => {
    renderWithProviders(<ResultTable columns={["id"]} rows={[]} />);
    expect(screen.getByText("No rows.")).toBeInTheDocument();
    expect(screen.getByText("0 rows")).toBeInTheDocument();
  });

  it("uses a singular label for exactly one row", () => {
    renderWithProviders(<ResultTable columns={["id"]} rows={[[1]]} />);
    expect(screen.getByText("1 row")).toBeInTheDocument();
  });
});
