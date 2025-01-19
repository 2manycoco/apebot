# Use the official Node.js image with a specific version
FROM node:18-alpine

# Установим git и другие зависимости для билда
RUN apk add --no-cache git python3 make g++

# Install pnpm globally
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application files into the container
COPY . .

# Compile TypeScript to JavaScript
RUN npx tsc

# Expose the port your bot will listen on (if applicable)
EXPOSE 3000

# Set the default command to run your application
CMD ["node", "dist/application.js"]
