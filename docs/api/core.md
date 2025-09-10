# @good-indexer/core API Documentation

Core types and runtime utilities for the good-indexer system.

## Overview

The `@good-indexer/core` package provides essential types, interfaces, and runtime utilities that form the foundation of the good-indexer system. It includes HTTP server functionality, type definitions, and shared utilities.

## Installation

```bash
npm install @good-indexer/core
```

## Exports

### HTTP Server

#### `createServer(port: number): Server`

Creates and starts an HTTP server on the specified port.

**Parameters:**
- `port` (number): The port number to listen on

**Returns:**
- `Server`: Node.js HTTP server instance

**Example:**
```typescript
import { createServer } from '@good-indexer/core';

const server = createServer(3000);
console.log('Server listening on port 3000');
```

### Types

#### `Server`

Type definition for the HTTP server.

**Properties:**
- `listen(port: number, callback?: () => void): Server`
- `close(callback?: () => void): void`

## Usage

```typescript
import { createServer } from '@good-indexer/core';

// Create and start server
const server = createServer(3000);

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

## Dependencies

- Node.js HTTP module
- TypeScript for type definitions

## Version

Current version: 1.0.0

## License

MIT
