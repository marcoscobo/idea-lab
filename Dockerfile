FROM node:22-bookworm-slim
ARG CODEX_VERSION=latest
ARG CLAUDE_CODE_VERSION=latest
RUN npm install --global @openai/codex@${CODEX_VERSION} @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}
RUN npm cache clean --force
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 CODEX_HOME=/home/node/.codex CLAUDE_CONFIG_DIR=/home/node/.claude
COPY --chown=node:node package.json server.mjs ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
RUN mkdir -m 0700 /app/.data
RUN chown node:node /app/.data
USER node
VOLUME ["/home/node", "/app/.data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
