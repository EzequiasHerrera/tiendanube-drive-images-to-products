import dotenv from "dotenv";
import pLimit from "p-limit";
import { buscarImagenesPorSKU } from "./services/driveService.js";

dotenv.config();

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const STORE_ID = process.env.USER_ID;
const PER_PAGE = 200;

// Limite de concurrencia: máximo 5 subidas simultáneas
const limit = pLimit(5);

// ------------------- Retry con delay exponencial -------------------
const retryFetch = async (url, options, maxRetries = 3, delay = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
        const res = await fetch(url, options);
        if (res.ok) return res.json();

        let data;
        try {
            data = await res.json();
        } catch {
            data = {};
        }

        if (res.status === 429) {
            console.log(`⏳ 429 recibido, reintentando en ${delay}ms... (${i + 1})`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2; // exponencial
        } else {
            return data;
        }
    }
    return { error: "Falló después de varios intentos" };
};

// ------------------- Función para obtener productos por página -------------------
const fetchProductsPage = async (page = 1) => {
    const url = `https://api.tiendanube.com/v1/${STORE_ID}/products?per_page=${PER_PAGE}&page=${page}`;

    const res = await fetch(url, {
        method: "GET",
        headers: {
            "Authentication": `bearer ${ACCESS_TOKEN}`,
            "User-Agent": "Drive images to products (ezequiasherrera99@gmail.com)",
            "Content-Type": "application/json",
        },
    });

    if (!res.ok) {
        console.warn(`⚠️ Error en página ${page}: ${res.status} ${res.statusText}`);
        return [];
    }

    return res.json();
};

// ------------------- Función para subir una imagen individual -------------------
const subirImagenIndividual = async (uploadUrl, imageUrl, sku, productId, index) => {
    const options = {
        method: "POST",
        headers: {
            "Authentication": `bearer ${ACCESS_TOKEN}`,
            "User-Agent": "Drive images to products (ezequiasherrera99@gmail.com)",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            src: imageUrl,
            position: index + 1,
            alt: `Imagen ${index + 1} para SKU ${sku}`,
        }),
    };

    const result = await retryFetch(uploadUrl, options);
    if (result.id) {
        console.log(`✅ Imagen ${index + 1} subida para SKU ${sku} en producto ${productId}`);
    } else {
        console.log(`⚠️ Falló la subida de imagen ${index + 1} para SKU ${sku}:`, result);
    }
};

// ------------------- Función para subir todas las imágenes de un producto -------------------
const subirImagenesProducto = async (product) => {
    const productId = product.id;

    await Promise.all(
        product.variants.map(async (variant) => {
            const sku = variant.sku;
            if (!sku) {
                console.log(`⚠️ Variante sin SKU en producto ${productId}`);
                return;
            }

            console.log(`🔎 Buscando imágenes en Drive para SKU: ${sku}`);
            const imageUrls = await buscarImagenesPorSKU(sku);

            if (!imageUrls || imageUrls.length === 0) {
                console.log(`❌ No se encontró imagen para SKU ${sku}`);
                return;
            }

            const uploadUrl = `https://api.tiendanube.com/v1/${STORE_ID}/products/${productId}/images`;

            // Limitar concurrencia en las subidas de imágenes
            await Promise.all(
                imageUrls.map((imageUrl, index) =>
                    limit(() => subirImagenIndividual(uploadUrl, imageUrl, sku, productId, index))
                )
            );
        })
    );
};

// ------------------- Función principal -------------------
const uploadDriveImagesOnProducts = async () => {
    let page = 1;
    let totalProductos = 0;

    while (true) {
        const products = await fetchProductsPage(page);

        if (!products || products.length === 0) {
            console.log(`✅ Fin de productos. Total páginas recorridas: ${page - 1}`);
            break;
        }

        console.log(`📄 Procesando página ${page} con ${products.length} productos`);

        // Subimos todos los productos de esta página en paralelo
        await Promise.all(products.map(subirImagenesProducto));

        totalProductos += products.length;
        page++;
    }

    console.log(`🎯 Total productos procesados: ${totalProductos}`);
};

// ------------------- Ejecutar -------------------
// uploadDriveImagesOnProducts().catch((err) =>
//     console.error("❌ Error general:", err)
// );


fetchProductsPage();