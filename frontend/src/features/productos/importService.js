import { http } from "../../api/http";

/**
 * Sube un archivo CSV al backend para su limpieza e importación.
 * @param {File} file El archivo CSV seleccionado por el usuario.
 * @returns {Promise<{message: string, count: number}>}
 */
export async function importarCSV(file) {
    const formData = new FormData();
    formData.append("file", file);

    return http.post("/inventory/import-csv", { body: formData, auth: true });
}
