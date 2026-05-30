import { http } from "../../api/http";

/**
 * Sube un archivo CSV al backend para su limpieza e importación.
 * @param {File} file El archivo CSV seleccionado por el usuario.
 * @param {string} importMode Tipo de importacion: inventory | historical_sales.
 * @returns {Promise<{message: string, count: number}>}
 */
export async function importarCSV(file, importMode = "inventory") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("import_mode", importMode);

    return http.post("/inventory/import-csv", { body: formData, auth: true });
}
