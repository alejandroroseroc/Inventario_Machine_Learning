import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PasswordStrength from "../components/PasswordStrength";
import { scorePassword } from "../utils/passwordStrength";

describe("password strength", () => {
  it("calcula puntaje bajo para contrasenas incompletas", () => {
    expect(scorePassword("abc")).toBe(1);
    expect(scorePassword("abcdefghi")).toBe(2);
  });

  it("calcula puntaje alto con mayuscula, minuscula, numero y simbolo", () => {
    expect(scorePassword("Prueba123*")).toBe(5);
  });

  it("no muestra etiqueta si el campo esta vacio", () => {
    render(<PasswordStrength value="" />);
    expect(screen.queryByText(/fortaleza/i)).not.toBeInTheDocument();
  });

  it("muestra fortaleza fuerte para una contrasena robusta", () => {
    render(<PasswordStrength value="Prueba123*" />);
    expect(screen.getByText(/fortaleza:\s*fuerte/i)).toBeInTheDocument();
  });
});
