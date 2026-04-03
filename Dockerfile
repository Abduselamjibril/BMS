# 1. Use official Node.js LTS image as the base
FROM node:18-alpine

# 2. Set working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package files first to leverage Docker layer caching
COPY package*.json ./

# 4. Install ALL dependencies (including NestJS CLI needed for the build)
# We do NOT use --production here because we need the build tools
RUN npm install --legacy-peer-deps

# 5. Copy the rest of the application source code
COPY . .

# 6. Build the TypeScript code into JavaScript
# This creates the 'dist' folder
RUN npm run build

# 7. Copy firebase-service-account.json for Firebase Admin SDK
COPY src/config/firebase-service-account.json dist/src/config/firebase-service-account.json

# 7. Expose the application port 
# (Matches the PORT=2546 in your .env)
EXPOSE 2546

# 8. Start the application
# We use 'node dist/src/main' because your build output 
# puts the entry point inside a 'src' subfolder.
CMD ["node", "dist/src/main"]