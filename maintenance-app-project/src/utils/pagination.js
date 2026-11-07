const MAX_LIMIT = 500;

// Paginación opcional: ?limit=50&offset=100. Sin limit se devuelve la lista completa.
const paginationFrom = (query) => {

    const limit = Number(query?.limit);
    if (!Number.isInteger(limit) || limit < 1) 
        return null;

    const offset = Number(query?.offset);
    return {
        limit: Math.min(limit, MAX_LIMIT),
        offset: Number.isInteger(offset) && offset > 0 ? offset : 0
    };
};

// Añade LIMIT/OFFSET al SQL solo si se pidió paginación.
const withPagination = (sql, values, page) =>
    page 
        ? [`${sql} LIMIT ? OFFSET ?`, [...values, page.limit, page.offset]] 
        : [sql, values];

        
module.exports = { 
    paginationFrom, 
    withPagination 
};
