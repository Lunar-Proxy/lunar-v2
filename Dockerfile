FROM node:20
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY ["package.json", "pnpm-lock.yaml*", "./"]
COPY . .
RUN npm i -g pnpm && pnpm install --no-cache
EXPOSE 8080
CMD ["pnpm", "start"]
