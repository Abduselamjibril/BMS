# Use official Node.js LTS image as the base
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install ALL dependencies (including devDependencies like NestJS CLI)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the application port (Matches the port in your .env)
EXPOSE 2546

# Start the NestJS application
CMD ["npm", "run", "start:prod"]