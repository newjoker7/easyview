FROM node:20-bullseye

# ffmpeg + cmake e build-essential (para nodejs-whisper quando instalado no container)
RUN apt-get update && apt-get install -y ffmpeg cmake build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root dependencies (frontend)
COPY package*.json ./
RUN npm ci

# Install server dependencies (nodejs-whisper é opcional; se falhar o build continua)
COPY server/package*.json server/
RUN cd server && npm ci

# Copy rest of project
COPY . .

# Entrypoint ensures npm ci finishes before starting Vite (avoids race with volume node_modules)
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=development
EXPOSE 5173 4000

ENTRYPOINT ["/docker-entrypoint.sh"]

