# Merchants Microservice Documentation

Welcome to the Merchants Microservice documentation! This is your entry point to all documentation.

---

## Documentation Map

For a visual overview of all documentation and how it connects, see:

**[Documentation Map](./DOCUMENTATION-MAP.md)** - Visual diagram showing all docs and their relationships

---

## Quick Navigation

### 🚀 Getting Started

New to the project? Start here:

1. **[Project README](../README.md)** - Setup and installation
2. **[Implementation Guides](./implementation/README.md)** - Development workflow and guides

### 📚 Main Documentation Areas

- **[Implementation Guides](./implementation/README.md)** - How to build and extend the microservice
- **[Testing Guides](./testing/README.md)** - How to test your code (if exists)
- **[Data Modeling](./data-modeling/README.md)** - DynamoDB design approaches (if exists)

### 🔧 Common Tasks

- **Add a new endpoint**: [Adding Endpoints Guide](./implementation/adding-endpoints-part-1-lambda-handlers.md)
- **Configure the service**: [Configuration Management](./implementation/configuration-management/README.md)
- **Set up database**: [Database Setup](./implementation/database-setup.md)
- **Deploy to AWS**: [Deployment Guide](./implementation/deployment.md)
- **Add monitoring**: [Monitoring Guide](./implementation/monitoring.md)

---

## Documentation Structure

```
docs/
├── README.md                          # ← You are here (entry point)
├── DOCUMENTATION-MAP.md               # Visual documentation map
│
├── implementation/                    # Implementation guides
│   ├── README.md                      # Implementation entry point
│   ├── microservice-development-guide-v2.md
│   ├── configuration-management/      # Configuration guides
│   ├── adding-endpoints-part-1-lambda-handlers.md
│   ├── adding-endpoints-part-2-api-gateway.md
│   ├── database-setup.md
│   └── ... (more guides)
│
└── testing/                           # Testing guides (if exists)
    └── README.md
```

---

## Need Help?

- **Can't find what you're looking for?** Check the [Documentation Map](./DOCUMENTATION-MAP.md)
- **Documentation unclear?** Open an issue or submit a PR
- **New to the project?** Start with [Implementation README](./implementation/README.md)
