FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN go build -o /raftkv .

FROM alpine:3.20
COPY --from=build /raftkv /raftkv
ENTRYPOINT ["/raftkv"]
