# Use Node.js 20 on Alpine Linux (lightweight base)
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Expose port 3001 (matches your server default)
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production

# Run the application
CMD ["node", "app_server.js"]
