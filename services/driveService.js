import { google } from 'googleapis';
import { oauth2Client } from './googleAuth.js';

// Se encarga de interactuar con la API de Google Drive usando el cliente OAuth. 
// Busca imágenes por SKU y devuelve la URL

const drive = google.drive({ version: 'v3', auth: oauth2Client });

export async function buscarImagenesPorSKU(sku) {
    const res = await drive.files.list({
        q: `'1-R_zY7rBbem5DmHclokxLZF-wYsdvjep' in parents and name contains '${sku}' and mimeType contains 'image/' and trashed = false`,
        fields: 'files(id, name)',
        orderBy: 'name'
    });
    if (res.data.files.length > 0) {
        return res.data.files.map(file =>
            `https://drive.google.com/uc?export=view&id=${file.id}`
        );
    }
    if (res.data.files.length === 0) return [];

}