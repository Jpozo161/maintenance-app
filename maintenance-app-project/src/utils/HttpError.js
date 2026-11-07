// Error con código HTTP y mensaje seguro para mostrar al usuario.
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

module.exports = HttpError;
