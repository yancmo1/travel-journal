FROM node:20-alpine

WORKDIR /app

# Install dependencies for Sharp and HEIF support
RUN apk add --no-cache vips-dev build-base python3 libheif libheif-dev

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create photo storage directory
RUN mkdir -p /app/media/travel-photos

EXPOSE 4000

CMD ["node", "src/server.js"]
