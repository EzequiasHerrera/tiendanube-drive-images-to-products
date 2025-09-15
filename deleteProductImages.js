import dotenv from "dotenv";
import fetch from "node-fetch";
import pLimit from "p-limit";

dotenv.config();

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const STORE_ID = process.env.USER_ID;
const PER_PAGE = 200;

// Limite de concurrencia: máximo 5 requests simultáneos
const limit = pLimit(5);

// ------------------- Retry con delay exponencial -------------------
const retryFetch = async (url, options, maxRetries = 3, delay = 2000) => {
    for (let i = 0; i < maxRetries; i++) {
        const res = await fetch(url, options);
        if (res.ok) return true;

        if (res.status === 429) {
            console.log(`⏳ 429 recibido, reintentando en ${delay}ms... (${i + 1})`);
            await new Promise((r) => setTimeout(r, delay));
            delay *= 2; // exponencial
        } else {
            const data = await res.json().catch(() => ({}));
            console.warn(`⚠️ Error ${res.status}:`, data);
            return false;
        }
    }
    console.error(`❌ Falló después de varios intentos: ${url}`);
    return false;
};

// ------------------- Obtener productos por página -------------------
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

// ------------------- Borrar todas las imágenes de un producto -------------------
const borrarImagenesProducto = async (product) => {
    const productId = product.id;

    if (!product.images || product.images.length === 0) return;

    await Promise.all(
        product.images.map((image) =>
            limit(() => {
                const url = `https://api.tiendanube.com/v1/${STORE_ID}/products/${productId}/images/${image.id}`;
                const options = {
                    method: "DELETE",
                    headers: {
                        "Authentication": `bearer ${ACCESS_TOKEN}`,
                        "User-Agent": "Drive images to products (ezequiasherrera99@gmail.com)",
                    },
                };
                return retryFetch(url, options).then((success) => {
                    if (success) {
                        console.log(`🗑️ Imagen ${image.id} eliminada del producto ${productId}`);
                    } else {
                        console.warn(`⚠️ No se pudo eliminar imagen ${image.id} del producto ${productId}`);
                    }
                });
            })
        )
    );
};

// ------------------- Función principal -------------------
const borrarTodasLasImagenes = async () => {
    let page = 1;
    let totalProductos = 0;

    while (true) {
        const products = await fetchProductsPage(page);

        if (!products || products.length === 0) {
            console.log(`✅ Fin de productos. Total páginas recorridas: ${page - 1}`);
            break;
        }

        console.log(`📄 Procesando página ${page} con ${products.length} productos`);

        // Borrar imágenes de todos los productos de esta página en paralelo (con límite)
        await Promise.all(products.map(borrarImagenesProducto));

        totalProductos += products.length;
        page++;
    }

    console.log(`🎯 Total productos procesados: ${totalProductos}`);
};

// ------------------- Ejecutar -------------------
borrarTodasLasImagenes().catch((err) =>
    console.error("❌ Error general:", err)
);
