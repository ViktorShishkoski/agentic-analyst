# Use Node.js 20 as the base image
FROM node:20

# Install Python, R, Chromium and necessary system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    r-base \
    libssl-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    fontconfig \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Pre-install R packages to speed up execution
RUN R -e "install.packages(c('jsonlite', 'ggplot2', 'scales'), repos='http://cran.us.r-project.org')"

# Copy package.json and package-lock.json
COPY package*.json ./

# Skip downloading Puppeteer's built-in Chromium, we use system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install Node.js dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure the temp plots directory exists
RUN mkdir -p public/temp_plots

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "start"]
