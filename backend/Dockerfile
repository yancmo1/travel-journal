FROM node:20-alpine

WORKDIR /app

# Install runtime and build dependencies for sharp (image processing)
# and libheif (HEIF/HEVC photo support)
RUN apk add --no-cache \
    vips-dev \
    fftw-dev \
    build-base \
    python3 \
    libheif-dev \
    libheif-tools

COPY package*.json ./
RUN npm install --omit=dev

COPY --chown=node:node . .

# Create photo storage directory
RUN mkdir -p /app/media/travel-photos

# Run as non-root user for security
RUN chown node:node /app/media/travel-photos
USER node

EXPOSE 4000

CMD ["node", "src/server.js"]
