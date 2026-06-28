# Use Node.js 20 as the base image
FROM node:20

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port Vite runs on (default 5173)
EXPOSE 5173

# Start the development server
# --host is needed for Docker to expose the port
CMD ["npm", "run", "dev", "--", "--host"]
