// Envia notificaciones por correo a traves de API Gateway -> Lambda -> SES.
// La URL, la clave y el destinatario viven en .env (ver .env.example).
const { notifications } = require("../config/env");

const emailNewUser = async (notification) => {

    if (!notifications.url) {
        console.warn("NOTIFICATIONS_API_URL sin configurar: no se envio la notificacion.");
        return null;
    }

    const body = {
        ...notification,
        // El Lambda exige destinatario; si la llamada no lo trae, se usa el de .env.
        recipient: notification?.recipient || process.env.NOTIFICATIONS_RECIPIENT
    };

    try {
        const response = await fetch(notifications.url
, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...(notifications.apiKey && { "x-api-key": notifications.apiKey })
            },
            body: JSON.stringify(body),
            // Sin timeout una peticion colgada retrasaria la respuesta al cliente.
            signal: AbortSignal.timeout(notifications.timeoutMs)
        });

        const payload = await response.json().catch(() => 
            null
    );

        if (!response.ok) {
            console.error(`Notificacion rechazada (${response.status}):`, payload);
            return null;
        }

        return payload;

    } catch (error) {
        // No se propaga: el correo es un aviso, no parte de la operacion.
        console.error("No se pudo enviar la notificacion:", error.message);
        return null;
    }
};

module.exports = {
    emailNewUser
};
