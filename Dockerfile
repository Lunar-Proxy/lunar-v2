FROM node:20
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "pnpm-lock.yaml*", "./"]
COPY . .
RUN npm i -g pnpm && pnpm install --no-cache && pnpm run build
EXPOSE 8080
CMD ["pnpm", "start"]
