FROM rust:1.83-slim-bookworm AS chef
WORKDIR /app
RUN cargo install cargo-chef

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin serverless-redis

FROM debian:bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/serverless-redis /usr/local/bin/serverless-redis

ENV PORT=3000
EXPOSE 3000

CMD ["serverless-redis"]

