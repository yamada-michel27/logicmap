# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod ./
COPY go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o api main.go

# Runtime stage - distroless
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /

# Copy the binary from builder
COPY --from=builder /app/api /api

EXPOSE 8080

ENTRYPOINT ["/api"]
