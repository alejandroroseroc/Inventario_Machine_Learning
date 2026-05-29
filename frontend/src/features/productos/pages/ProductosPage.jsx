import { createElement, useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/productos.css";
import ProductoForm from "../components/ProductoForm";
import ProductoTable from "../components/ProductoTable";
import {
  ArchiveX,
  CheckCircle2,
  FileUp,
  HelpCircle,
  PackageX,
  Plus,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { importarCSV } from "../importService";
import { productoCreate, productosList } from "../service";
import { marcarVencidosAuto, listLotesVencidos, listLotesDevoluciones } from "../../lotes/repository";
import { getProductosInactivos, reactivarProducto } from "../repository";

const money = (value) => Number(value || 0).toLocaleString("es-CO");

export default function ProductosPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef(null);

  const [tabInventario, setTabInventario] = useState("activos");
  const [lotesVencidos, setLotesVencidos] = useState([]);
  const [lotesDevoluciones, setLotesDevoluciones] = useState([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [inactivos, setInactivos] = useState([]);
  const [loadingInactivos, setLoadingInactivos] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setOk("");
    try {
      const data = await productosList();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los productos.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadListasEspeciales() {
    setLoadingListas(true);
    try {
      await marcarVencidosAuto();
      const [venc, devol] = await Promise.all([
        listLotesVencidos(),
        listLotesDevoluciones(),
      ]);
      setLotesVencidos(Array.isArray(venc?.results) ? venc.results : []);
      setLotesDevoluciones(Array.isArray(devol?.results) ? devol.results : []);
    } catch (e) {
      console.error("Error cargando listas especiales:", e);
    } finally {
      setLoadingListas(false);
    }
  }

  async function loadInactivos() {
    setLoadingInactivos(true);
    try {
      const data = await getProductosInactivos();
      setInactivos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error cargando inactivos:", e);
    } finally {
      setLoadingInactivos(false);
    }
  }

  useEffect(() => {
    load();
    loadListasEspeciales();
    loadInactivos();
  }, []);

  async function handleCreate(form) {
    setCreating(true);
    setError("");
    setOk("");
    try {
      await productoCreate(form);
      setOk("Producto guardado correctamente.");
      await load();
      setShowCreateForm(false);
      return true;
    } catch (e) {
      setError(e?.message || "No se pudo crear el producto.");
      return false;
    } finally {
      setCreating(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError("");
    setOk("");
    try {
      const res = await importarCSV(file);
      setOk(res.message || `Se importaron ${res.count} registros.`);
      await load();
    } catch (e) {
      setError(e?.message || "Error al importar el archivo CSV.");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  }

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter((item) => {
      const name = (item.nombre || "").toLowerCase();
      const code = (item.codigo || "").toLowerCase();
      const barcode = (item.codigo_barras || "").toLowerCase();
      return name.includes(lower) || code.includes(lower) || barcode.includes(lower);
    });
  }, [items, searchTerm]);

  const tabs = [
    { key: "activos", label: "Medicamentos activos", count: 0, Icon: CheckCircle2, tone: "success" },
    { key: "vencidos", label: "Vencidos", count: lotesVencidos.length, Icon: TriangleAlert, tone: "danger" },
    { key: "devoluciones", label: "Devoluciones", count: lotesDevoluciones.length, Icon: RotateCcw, tone: "warning" },
    { key: "inactivos", label: "Inactivos", count: inactivos.length, Icon: ArchiveX, tone: "neutral" },
  ];

  return (
    <div className="page page--productos">
      <div className="page__head">
        <h2 className="page__title" id="pf_title">Inventario</h2>

        <div className="page__actions">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImport}
            hidden
          />
          <button
            className="btn btn--secondary btn--icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileUp size={18} strokeWidth={2.4} />
            {importing ? "Importando..." : "Importar CSV"}
          </button>
        </div>
      </div>

      <div className="inventory-tabs" role="tablist" aria-label="Vistas de inventario">
        {tabs.map(({ key, label, count, Icon: TabIcon, tone }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tabInventario === key}
            className={`inventory-tab inventory-tab--${tone} ${tabInventario === key ? "is-active" : ""}`}
            onClick={() => setTabInventario(key)}
          >
            <span className="inventory-tab__icon">
              {createElement(TabIcon, { size: 18, strokeWidth: 2.4 })}
            </span>
            <span>{label}{count > 0 ? ` (${count})` : ""}</span>
          </button>
        ))}
      </div>

      {tabInventario === "activos" && (
        <>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {ok && <div className="alert alert--ok" role="status">{ok}</div>}

          <div className="inventory-list-head">
            <div>
              <h3>Listado de medicamentos</h3>
              <p>Consulta, busca y abre el detalle de cada producto activo.</p>
            </div>

            <div className="inventory-list-actions">
              <div className="inventory-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar medicamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn--primary btn--icon"
                onClick={() => setShowCreateForm((value) => !value)}
                aria-expanded={showCreateForm}
                aria-controls="producto-create-panel"
              >
                {showCreateForm ? <X size={18} /> : <Plus size={18} />}
                {showCreateForm ? "Cerrar formulario" : "Nuevo medicamento"}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--icon"
                onClick={() => setShowHelp((value) => !value)}
                aria-expanded={showHelp}
                aria-controls="inventory-help-panel"
              >
                <HelpCircle size={18} />
                Ayuda
              </button>
            </div>
          </div>

          {showHelp && (
            <section className="help help--compact" id="inventory-help-panel" aria-labelledby="ayuda_inv_titulo">
              <h3 id="ayuda_inv_titulo">Como registrar un medicamento</h3>
              <ol>
                <li>Escribe <strong>Codigo</strong> y <strong>Nombre</strong> tal como los usas en la drogueria.</li>
                <li>Ingresa el <strong>Valor unitario</strong>. Con eso sugerimos <strong>Categoria ABC</strong> y <strong>ROP</strong>.</li>
                <li>Si quieres, desactiva "Auto-sugerir" para ajustar manualmente la categoria o el ROP.</li>
                <li>Guarda el producto. Lo veras en el listado.</li>
              </ol>
              <p className="help__note">
                Estas sugerencias son temporales. Cuando cargues ventas reales, el sistema propondra valores basados en tu historial.
              </p>
            </section>
          )}

          {showCreateForm && (
            <section className="create-panel" id="producto-create-panel" aria-labelledby="producto_create_title">
              <div className="create-panel__head">
                <div>
                  <h3 id="producto_create_title">Nuevo medicamento</h3>
                  <p>Registra el producto y, si ya lo tienes disponible, agrega el primer lote.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X size={18} />
                  Cerrar
                </button>
              </div>
              <ProductoForm onSubmit={handleCreate} submitting={creating} />
            </section>
          )}

          {loading ? <p>Cargando...</p> : <ProductoTable items={filteredItems} />}
        </>
      )}

      {tabInventario === "vencidos" && (
        <StatusLotesCard
          tone="danger"
          Icon={PackageX}
          title="Lotes vencidos - Perdida total"
          description="Estos lotes ya fueron dados de baja. Se muestra la perdida a precio costo."
          loading={loadingListas}
          rows={lotesVencidos}
          emptyText="No hay lotes vencidos registrados"
          amountKey="perdida_total"
          amountLabel="PERDIDA (costo)"
          qtyKey="stock_retirado"
          dateLabel="VENCIO"
          totalLabel="Total perdidas"
        />
      )}

      {tabInventario === "devoluciones" && (
        <StatusLotesCard
          tone="warning"
          Icon={RotateCcw}
          title="Lotes en devolucion al proveedor"
          description="Estos lotes fueron enviados a devolucion. Perdida estimada del 50% del precio costo."
          loading={loadingListas}
          rows={lotesDevoluciones}
          emptyText="No hay lotes en devolucion registrados"
          amountKey="perdida_50"
          amountLabel="PERDIDA 50% (costo)"
          qtyKey="stock_devuelto"
          dateLabel="VENCIA"
          totalLabel="Total perdidas"
        />
      )}

      {tabInventario === "inactivos" && (
        <section className="status-card status-card--neutral">
          <header className="status-card__head">
            <span className="status-title__icon"><ArchiveX size={20} /></span>
            <div>
              <h3>Medicamentos inactivos</h3>
              <p>Estos medicamentos fueron desactivados. No aparecen en ventas ni en el inventario activo.</p>
            </div>
          </header>

          {loadingInactivos ? <p>Cargando...</p> : (
            <div className="status-table-wrap">
              <table className="status-table">
                <thead>
                  <tr>
                    <th>MEDICAMENTO</th>
                    <th>CODIGO</th>
                    <th>CATEGORIA</th>
                    <th>PRECIO VENTA</th>
                    <th>ACCION</th>
                  </tr>
                </thead>
                <tbody>
                  {inactivos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="status-empty">No hay medicamentos inactivos</td>
                    </tr>
                  ) : inactivos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.codigo}</td>
                      <td>{p.categoria}</td>
                      <td>${money(p.valor_unitario)}</td>
                      <td>
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={async () => {
                            try {
                              await reactivarProducto(p.id);
                              await Promise.all([load(), loadInactivos()]);
                            } catch {
                              setError("No se pudo reactivar el producto.");
                            }
                          }}
                        >
                          Reactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatusLotesCard({
  tone,
  Icon: CardIcon,
  title,
  description,
  loading,
  rows,
  emptyText,
  amountKey,
  amountLabel,
  qtyKey,
  dateLabel,
  totalLabel,
}) {
  const total = rows.reduce((sum, row) => sum + Number(row[amountKey] || 0), 0);

  return (
    <section className={`status-card status-card--${tone}`}>
      <header className="status-card__head">
        <span className="status-title__icon">{createElement(CardIcon, { size: 20 })}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>

      {loading ? <p>Cargando...</p> : (
        <div className="status-table-wrap">
          <table className="status-table">
            <thead>
              <tr>
                <th>MEDICAMENTO</th>
                <th>N. LOTE</th>
                <th>{dateLabel}</th>
                <th>CANTIDAD</th>
                <th>{amountLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="status-empty">{emptyText}</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.lote_id}>
                  <td>{row.producto_nombre}</td>
                  <td>{row.numero_lote}</td>
                  <td>{row.fecha_caducidad}</td>
                  <td>{row[qtyKey]} uds</td>
                  <td className="status-amount">${money(row[amountKey])}</td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="status-total-row">
                  <td colSpan={4}>{totalLabel}:</td>
                  <td>${money(total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
