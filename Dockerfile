# ------------------------------------------------------------------------------------------

FROM node:22-slim AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Copy dependency-related file
COPY package.json .
COPY pnpm-lock.yaml .
# pnpm-workspace.yaml carries onlyBuiltDependencies — without it pnpm v10+ errors
# (ERR_PNPM_IGNORED_BUILDS) instead of honouring the approved native-build list.
COPY pnpm-workspace.yaml .

RUN corepack enable
# Pin to the version used locally (node_modules/.modules.yaml). pnpm@latest(11.x)
# hard-errors on ignored build scripts (ERR_PNPM_IGNORED_BUILDS) and needs Node 22.13+;
# 10.28.0 honours onlyBuiltDependencies and only warns on the rest.
RUN corepack install --global pnpm@10.28.0

# ------------------------------------------------------------------------------------------

FROM base AS deps
# Install only prod deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# ------------------------------------------------------------------------------------------

FROM deps AS builder
COPY . .
# Install including dev deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Mirror the known-good local build: larger heap + no sourcemap (the `build`
# script's --sourcemap roughly doubles peak memory on RisuAI's large bundle and
# the default ~2GB heap OOMs — exit 134).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_OPTIONS="--max-old-space-size=6144" pnpm exec vite build

# ------------------------------------------------------------------------------------------

FROM base AS runtime
WORKDIR /app

COPY package.json .
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 6001

CMD ["pnpm", "runserver"]

# ------------------------------------------------------------------------------------------
