# Implementation Notes

## Overview
This document provides technical details about the LogicMap implementation.

## Technology Decisions

### Frontend: Next.js 15 with App Router
- **Why Next.js?** Modern React framework with excellent TypeScript support, built-in routing, and optimized production builds
- **App Router**: Using the latest Next.js App Router for better server-side rendering capabilities
- **ReactFlow**: Industry-standard library for node-based UIs, perfect for flowchart visualization
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development

### Backend: Go
- **Why Go?** Fast, efficient, easy to containerize, and excellent for building APIs
- **Standard Library**: Using only Go's standard library for HTTP handling (no external dependencies)
- **Stateless Design**: API is completely stateless, making it easy to scale horizontally

### Infrastructure: Docker
- **Multi-stage Builds**: Both Dockerfiles use multi-stage builds to minimize image size
- **Security**: Backend uses scratch base image for minimal attack surface
- **Development Parity**: Same containers work in development and production

## API Design

### Endpoint: POST /parse

**Request Format:**
```json
{
  "markdown": "string"
}
```

**Response Format:**
```json
{
  "nodes": [
    {
      "id": "string",
      "type": "input|default|output",
      "data": { "label": "string" },
      "position": { "x": number, "y": number }
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "label": "string (optional)"
    }
  ]
}
```

### Current Implementation (Mock)

The current implementation returns a fixed set of nodes and edges with the first 20 characters of the input markdown in one of the node labels. This serves as a proof of concept.

### Future Enhancements for Markdown Parsing

To implement real Markdown parsing, consider:

1. **Parse Markdown Structure**:
   - Use a Markdown parser library (e.g., `goldmark` for Go)
   - Identify headers, lists, code blocks, etc.

2. **Extract Flow Logic**:
   - Headers (# ##) → Node labels
   - Numbered lists → Sequential steps
   - Keywords (if, else, while, for) → Decision/loop nodes
   - Indentation → Nested/branching logic

3. **Generate Node Types**:
   - Start/End: First and last items
   - Decision: Conditional statements
   - Process: Regular steps
   - Loop: Iterative constructs

4. **Calculate Positions**:
   - Use a layout algorithm (e.g., Dagre, ELK)
   - Or implement simple top-to-bottom/left-to-right layout

## Directory Structure for AWS

```
logicmap/
├── backend/              # Deploy to ECS, Lambda, or App Runner
│   ├── Dockerfile       # ECR image
│   └── main.go
├── frontend/            # Deploy to Amplify, S3+CloudFront, or ECS
│   ├── Dockerfile       # ECR image
│   └── app/
└── docker-compose.yml   # Local development
```

### AWS Deployment Options

1. **Simple**: AWS App Runner for both services
2. **Scalable**: ECS Fargate with ALB
3. **Serverless**: Lambda (backend) + Amplify (frontend)
4. **Cost-effective**: EC2 + Docker Compose

## Environment Variables

### Backend
- `PORT`: Server port (default: 8080)

### Frontend
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NODE_ENV`: Environment (development/production)

## CORS Configuration

Currently set to allow all origins (`*`) for development. In production:

```go
func enableCORS(w http.ResponseWriter) {
    // Replace * with specific domain
    w.Header().Set("Access-Control-Allow-Origin", "https://yourdomain.com")
    w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}
```

## Performance Considerations

### Backend
- Stateless design allows horizontal scaling
- No database = no bottleneck
- Consider adding caching for complex parsing operations

### Frontend
- Next.js optimizations enabled
- ReactFlow is lazy-loaded (SSR disabled for this component)
- Static generation where possible
- Image optimization via Next.js

## Testing Strategy (Not Yet Implemented)

### Backend Tests
```bash
cd backend
go test ./...
```

Recommended tests:
- Unit tests for parsing logic
- Integration tests for HTTP endpoints
- Load tests for scalability

### Frontend Tests
```bash
cd frontend
npm test
```

Recommended tests:
- Component tests with React Testing Library
- E2E tests with Playwright or Cypress
- Visual regression tests

## Monitoring and Observability

Consider adding:
1. **Logging**: Structured logging (JSON format)
2. **Metrics**: Prometheus metrics endpoint
3. **Tracing**: OpenTelemetry for distributed tracing
4. **Health Checks**: Already implemented at `/health`

## Security Considerations

1. **Input Validation**: Add validation for markdown input size
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **Authentication**: Add auth for production use
4. **HTTPS**: Always use HTTPS in production
5. **Secrets Management**: Use AWS Secrets Manager or Parameter Store

## Cost Optimization

1. **Use AWS App Runner**: Simple and cost-effective for small loads
2. **Enable ECS Auto-scaling**: Scale down during off-peak hours
3. **Use CloudFront**: Cache frontend assets
4. **Optimize Images**: Use WebP format, lazy loading

## Development Workflow

1. Make changes to code
2. Test locally with `npm run dev` and `go run main.go`
3. Test with Docker: `docker compose up --build`
4. Push to repository
5. CI/CD pipeline builds and deploys (to be implemented)

## Known Limitations

1. Markdown parsing is currently mocked
2. No persistence (flows are not saved)
3. No user authentication
4. No collaborative editing
5. Limited error handling in frontend

## Next Steps

1. Implement real Markdown parsing logic
2. Add user authentication (e.g., AWS Cognito, Auth0)
3. Add database for saving flows (DynamoDB, RDS)
4. Implement collaborative features (WebSocket)
5. Add more node types and customization options
6. Create CI/CD pipeline (GitHub Actions, AWS CodePipeline)
7. Add monitoring and alerting
8. Write comprehensive tests
9. Add export functionality (PNG, SVG, PDF)
10. Implement variable state tracking and visualization
