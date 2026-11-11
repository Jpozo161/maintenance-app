// Envia notificaciones por correo a traves de API Gateway -> Lambda -> SES.
// La URL, la clave y el destinatario viven en .env (ver .env.example).
const { notifications } = require("../config/env");

// API Gateway rechaza en el borde, antes de tocar la integracion, con estos
// mensajes. Distinguirlos importa: significan "la peticion no llego al Lambda",
// asi que no hay nada que buscar en los logs de la funcion.
// Ojo, el codigo depende del tipo de API:
//   HTTP API (v2): 404 Not Found cuando no hay ruta que coincida.
//   REST API (v1): 403 Missing Authentication Token en el mismo caso.
const EDGE_REJECTIONS = [
    "not found",
    "missing authentication token",
    "forbidden",
    "no integration defined for method"
];

const describeEdgeRejection = (status, message) => {
    const texto = String(message || "").toLowerCase();

    if (!EDGE_REJECTIONS.some((motivo) => texto.includes(motivo))) {
        return null;
    }

    const causas = [
        "la ruta y el metodo POST no coinciden con ninguna ruta de la API",
        "sobra o falta el segmento del stage: con el stage $default de una HTTP " +
            "API la URL va sin stage, con una REST API va /<stage>/<recurso>"
    ];

    // Solo las REST API usan API keys; una HTTP API ignora el header x-api-key,
    // asi que mencionarlo ahi solo despistaria.
    if (status === 403 && !notifications.apiKey) {
        causas.push("si es una REST API con API key obligatoria, NOTIFICATIONS_API_KEY esta vacia");
    }

    return "La peticion fue rechazada por API Gateway y el Lambda NO se invoco. " +
        `Causas posibles: ${causas.join("; ")}.`;
};

const emailNewUser = async (notification) => {

    if (!notifications.url) {
        console.warn("NOTIFICATIONS_API_URL sin configurar: no se envio la notificacion.");
        return null;
    }

    const body = {
        ...notification,
        // El Lambda exige destinatario; si la llamada no lo trae, se usa el de .env.
        recipient: notification?.recipient || notifications.recipient
    };

    try {
        const response = await fetch(notifications.url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(notifications.apiKey && { "x-api-key": notifications.apiKey })
            },
            body: JSON.stringify(body),
            // Sin timeout una peticion colgada retrasaria la respuesta al cliente.
            signal: AbortSignal.timeout(notifications.timeoutMs)
        });

        // Se lee como texto primero: los errores del borde no siempre son JSON y
        // hacer json() directamente perderia el mensaje que explica el fallo.
        const raw = await response.text().catch(() => "");
        let payload = null;

        try {
            payload = raw ? JSON.parse(raw) : null;
        } catch {
            payload = null;
        }

        if (!response.ok) {
            const edge = describeEdgeRejection(response.status, payload?.message ?? raw);

            if (edge) {
                console.error(`[notificaciones] ${response.status} en el borde. ${edge}`);
            } else {
                // Aqui si hubo invocacion: el error viene del Lambda o de SES.
                console.error(
                    `[notificaciones] El Lambda respondio ${response.status}:`,
                    payload ?? raw
                );
            }

            return null;
        }

        return payload;

    } catch (error) {
        // No se propaga: el correo es un aviso, no parte de la operacion.
        const detalle = error.name === "TimeoutError"
            ? `sin respuesta en ${notifications.timeoutMs} ms`
            : error.message;

        console.error("[notificaciones] No se pudo enviar la notificacion:", detalle);
        return null;
    }
};

module.exports = {
    emailNewUser
};
