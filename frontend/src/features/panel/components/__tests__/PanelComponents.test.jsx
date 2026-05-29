import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import KpiCard from "../KpiCard";
import MlSummaryCard from "../MlSummaryCard";
import RecentEvents from "../RecentEvents";

describe("panel components", () => {
  it("KpiCard muestra titulo, valor y subtitulo", () => {
    render(<KpiCard title="Valor inventario" value="$ 250.000" subtitle="Actualizado hoy" />);

    expect(screen.getByText("Valor inventario")).toBeInTheDocument();
    expect(screen.getByText("$ 250.000")).toBeInTheDocument();
    expect(screen.getByText("Actualizado hoy")).toBeInTheDocument();
  });

  it("RecentEvents muestra estado vacio cuando no hay eventos", () => {
    render(<RecentEvents items={[]} />);

    expect(screen.getByText(/no hay eventos recientes/i)).toBeInTheDocument();
  });

  it("RecentEvents clasifica ingresos, ventas y ajustes", () => {
    render(
      <RecentEvents
        items={[
          "Recibi 100 de Acetaminofen.",
          "Se vendieron 2 de Ibuprofeno.",
          "Ajuste 10 de Loratadina.",
        ]}
      />
    );

    expect(screen.getByText("Ingreso")).toBeInTheDocument();
    expect(screen.getByText("Venta/Salida")).toBeInTheDocument();
    expect(screen.getAllByText(/Ajuste/).length).toBeGreaterThan(0);
  });

  it("MlSummaryCard muestra mensaje de lotes por vencer y enlace a sugerencias", () => {
    render(
      <MemoryRouter>
        <MlSummaryCard countPorVencer={3} />
      </MemoryRouter>
    );

    expect(screen.getByText(/3 lote/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /revisar sugerencias/i })).toHaveAttribute(
      "href",
      "/alertas/sugerencias"
    );
  });
});
