import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevisarLoteModal from "../RevisarLoteModal";

const loteBase = {
  id: 7,
  productoNombre: "Acetaminofen 500 mg",
  numeroLote: "ACF2406B",
  cantidad: 20,
  precio_costo: 150,
};

describe("RevisarLoteModal", () => {
  it("no renderiza nada si no recibe lote", () => {
    render(<RevisarLoteModal lote={null} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("muestra flujo de devolucion cuando faltan mas de 30 dias", () => {
    render(<RevisarLoteModal lote={{ ...loteBase, diasRestantes: 45 }} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/apto para devolucion/i)).toBeInTheDocument();
    expect(screen.getByText("$1.500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /registrar devolucion/i })).toBeInTheDocument();
  });

  it("muestra baja por vencimiento cuando el lote esta caducado", () => {
    render(<RevisarLoteModal lote={{ ...loteBase, diasRestantes: -2 }} />);

    expect(screen.getByText(/caducado/i)).toBeInTheDocument();
    expect(screen.getByText(/perdida total/i)).toBeInTheDocument();
    expect(screen.getByText("$3.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /registrar baja/i })).toBeInTheDocument();
  });

  it("cierra al hacer click en el fondo del modal", () => {
    const onClose = vi.fn();
    render(<RevisarLoteModal lote={{ ...loteBase, diasRestantes: 45 }} onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog").parentElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
