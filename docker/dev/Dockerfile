FROM node:22-alpine

ARG USER_UID=1000
ARG USER_GID=1000

# Aligner l'UID/GID de l'utilisateur node avec l'utilisateur local
RUN delgroup node 2>/dev/null; deluser node 2>/dev/null; \
    EXISTING=$(getent group ${USER_GID} | cut -d: -f1); \
    [ -n "$EXISTING" ] && delgroup "$EXISTING" 2>/dev/null; \
    addgroup -g ${USER_GID} node && \
    adduser -u ${USER_UID} -G node -s /bin/sh -D node

USER node

# Installer les dépendances hors du bind mount
# pour éviter qu'un dossier node_modules root apparaisse sur l'hôte
WORKDIR /deps
COPY --chown=node:node package*.json ./
RUN npm ci

WORKDIR /app

EXPOSE 5173

# Symlink node_modules dans /app après le bind mount, puis lancer vite
CMD ["sh", "-c", "ln -sf /deps/node_modules /app/node_modules && npm run dev -- --host 0.0.0.0"]
