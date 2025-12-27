# Docker Setup Guide for Pension Backend

## Quick Start

### 1. Clone Environment Variables
```bash
cp .env.example .env
```

Edit `.env` and update sensitive values (JWT_SECRET, database passwords, email credentials, etc.)

### 2. Build and Run with Docker Compose
```bash
docker-compose up --build
```

This will:
- Build the backend image
- Start PostgreSQL database
- Start the backend application
- Automatically run database migrations

### 3. Access the Application
- API: http://localhost:5000
- Swagger Documentation: http://localhost:5000/api-docs
- Database: localhost:5432 (use credentials from .env)

---

## Docker Commands

### Start services
```bash
docker-compose up
```

### Start in background
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (clears database)
```bash
docker-compose down -v
```

### View logs
```bash
docker-compose logs -f backend
docker-compose logs -f db
```

### Rebuild images
```bash
docker-compose up --build
```

### Run migrations
```bash
docker-compose exec backend npm run migration:run
```

### Generate new migration
```bash
docker-compose exec backend npm run migration:generate
```

---

## Environment Variables

Key variables to configure in `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | production |
| `PORT` | API port | 5000 |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `DB_NAME` | Database name | pension_db |
| `JWT_SECRET` | JWT signing key | your-secret-key |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |
| `EMAIL_USER` | Gmail account for emails | (empty) |
| `EMAIL_PASSWORD` | Gmail app password | (empty) |
| `SMS_API_KEY` | SMS provider API key | (empty) |

---

## Production Deployment

### Using Docker Compose in Production
```bash
docker-compose -f docker-compose.yml up -d
```

### Build and Push to Registry (e.g., Docker Hub)
```bash
docker build -t yourregistry/pension-backend:1.0.0 .
docker push yourregistry/pension-backend:1.0.0
```

### Use Pre-built Image
Update `docker-compose.yml` to use a pre-built image instead of building:
```yaml
backend:
  image: yourregistry/pension-backend:1.0.0
  # ... rest of config
```

---

## Health Checks

The backend includes a health check endpoint:
- Endpoint: `GET /health`
- Docker monitors this every 30 seconds
- If unhealthy, container will be restarted

---

## Database Persistence

PostgreSQL data is stored in a Docker volume `postgres_data` that persists across container restarts. To reset:
```bash
docker-compose down -v
```

---

## Networking

Services communicate via the `pension-network` bridge network:
- Backend → Database: Use `db` hostname instead of localhost
- External clients → Backend: Use http://localhost:5000

---

## Development vs Production

### Development Mode
```bash
docker-compose up
# Includes source code volumes for hot-reload development
```

### Production Mode
Comment out the volumes section in `docker-compose.yml` and use pre-built images.

---

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env or docker-compose.yml
docker-compose down
docker-compose up
```

### Database Connection Error
```bash
# Check database logs
docker-compose logs db

# Verify database is healthy
docker-compose ps
```

### Permission Denied
```bash
# Ensure Docker daemon is running
sudo systemctl start docker
```

### Clear Everything and Start Fresh
```bash
docker-compose down -v
docker system prune -a
docker-compose up --build
```

---

## Docker Image Details

- **Base Image**: `node:20-alpine` (lightweight, ~180MB)
- **Multi-stage Build**: Reduces final image size by excluding build dependencies
- **Non-root User**: Runs as `nodejs` user for security
- **Health Checks**: Automatic container health monitoring
- **Signal Handling**: Uses `dumb-init` for proper signal forwarding

Final image size: ~200-250MB
