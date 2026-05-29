import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../../../context/AuthContext";
import Register from "../pages/register";

function setup() {
  render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe("Register page", () => {
  it("deshabilita el boton hasta que la forma sea valida", () => {
    setup();
    const btn = screen.getByRole("button", { name: /crear cuenta/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: "a@a.com" } });
    fireEvent.change(screen.getByLabelText(/^contrase/i), { target: { value: "Demo1234!" } });
    fireEvent.change(screen.getByLabelText(/confirmar contrase/i), { target: { value: "Demo1234!" } });

    expect(btn).not.toBeDisabled();
  });
});
