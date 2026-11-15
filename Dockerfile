FROM node:24-slim
WORKDIR /app
COPY . .
RUN node scripts/build.mjs
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/tmp/ksool-community.sqlite
EXPOSE 8080
CMD ["node", "server/local.mjs"]
