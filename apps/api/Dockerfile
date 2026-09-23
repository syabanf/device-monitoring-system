# Build the API and the seeder. The context is the repository root, so the seeder image can
# carry the generated fixtures it loads.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Dependencies come first: the layer survives every change that leaves go.mod alone.
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download

COPY apps/api/ ./
# CGO stays off so the binaries run on a scratch base.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/akcpsim ./cmd/akcpsim
# The photo directory is created here because distroless has no shell to make it at boot.
RUN install -d -m 0755 /out/uploads

FROM gcr.io/distroless/static-debian12:nonroot AS api
WORKDIR /app
COPY --from=build /out/api /app/api
# Mount a volume over /app/data/uploads to keep photos across deployments.
COPY --from=build --chown=nonroot:nonroot /out/uploads /app/data/uploads
ENV UPLOAD_DIR=/app/data/uploads
EXPOSE 3000
USER nonroot:nonroot
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 CMD ["/app/api", "-health"]
ENTRYPOINT ["/app/api"]

# One-shot image that loads the demo data: docker compose run --rm seed
FROM gcr.io/distroless/static-debian12:nonroot AS seed
WORKDIR /app
COPY --from=build /out/seed /app/seed
COPY packages/fixtures/data /app/fixtures
USER nonroot:nonroot
ENTRYPOINT ["/app/seed", "-data", "/app/fixtures"]

# Stands in for an AKCP unit on a bench without hardware: docker compose run --rm akcp-sim
FROM gcr.io/distroless/static-debian12:nonroot AS akcpsim
WORKDIR /app
COPY --from=build /out/akcpsim /app/akcpsim
USER nonroot:nonroot
ENTRYPOINT ["/app/akcpsim"]
