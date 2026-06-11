FROM node:22-alpine

WORKDIR /app

# Installer les dépendances en premier pour tirer parti du cache Docker
COPY package*.json ./
RUN npm ci

# Le code source est monté via bind mount en dev
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]