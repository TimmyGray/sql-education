import * as React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/renderWithProviders";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("starts masked and toggles visibility via the adornment button", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PasswordField label="Password" defaultValue="hunter2" />,
    );

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe(
      "text",
    );

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe(
      "password",
    );
  });
});
