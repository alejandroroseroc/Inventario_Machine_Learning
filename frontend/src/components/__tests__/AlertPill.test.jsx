import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AlertPill from "../AlertPill";

describe("AlertPill", () => {
  it("muestra Info como severidad por defecto", () => {
    render(<AlertPill />);

    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("usa fallback Info cuando la severidad no existe", () => {
    render(<AlertPill severity="desconocida" />);

    expect(screen.getByText("Info")).toBeInTheDocument();
  });
});
