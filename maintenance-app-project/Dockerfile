
FROM node:20-slim

WORKDIR /app

# Solo el manifiesto primero: la capa de dependencias se reaprovecha mientras
# package-lock.json no cambie.
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# La app no escribe en disco (los PDF van en memoria y de ahí a S3), así que puede
# correr sin privilegios.
USER node

# El puerto real lo decide PORT (src/config/env.js); 3000 es el valor por defecto.
EXPOSE 3000

# node directamente, y no npm start, para que el contenedor reciba el SIGTERM al parar.
CMD ["node", "app.js"]
