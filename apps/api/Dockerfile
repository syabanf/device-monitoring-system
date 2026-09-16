# Build the API. The context is apps/api, so the frontend workspaces never enter the image.
FROM golang:1.26-alpine AS build
WORKDIR /src

# Dependencies come first: the layer survives every change that leaves go.mod alone.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO stays off so the binary runs on a scratch base.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# The photo directory is created here because distroless has no shell to make it at boot.
# Mount a volume over /app/data/uploads to keep photos across deployments.
RUN install -d -m 0755 /out/uploads

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build --chown=nonroot:nonroot /out/uploads /app/data/uploads
ENV UPLOAD_DIR=/app/data/uploads
EXPOSE 3000
USER nonroot:nonroot
ENTRYPOINT ["/app/api"]
