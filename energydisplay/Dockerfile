FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=9123 HOSTNAME=0.0.0.0 NODE_OPTIONS=--max-old-space-size=128 DATA_DIR=/data
RUN mkdir /data && chown node /data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 9123
CMD ["node", "server.js"]
