# Use the official Node.js image with a specific version
FROM node:22.12-alpine

# Install git and other dependencies
RUN apk add --no-cache git

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript and tsx)
RUN pnpm install --frozen-lockfile || npm install

# Copy the rest of the application files into the container
COPY . .

# Expose the port your bot will listen on (if applicable)
EXPOSE 3000

# Set the default command to run your TypeScript application using tsx
CMD ["npx", "tsx", "src/application.ts"]
