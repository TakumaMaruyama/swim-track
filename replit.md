# SwimTrack - Swimming Performance Management System

## Overview

SwimTrack is a comprehensive swimming team management application designed to track athlete records, manage competitions, and facilitate communication between coaches and swimmers. The system provides role-based access with separate interfaces for administrators (coaches) and students (athletes), supporting Japanese language throughout the interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool and development server for fast HMR and optimized production builds
- SWC plugin for faster TypeScript/JSX compilation
- Wouter for lightweight client-side routing

**UI Component Library**
- Radix UI primitives for accessible, unstyled components (dialogs, dropdowns, forms, etc.)
- Tailwind CSS for utility-first styling with custom design tokens
- shadcn/ui component patterns for consistent, customizable UI elements
- Chart.js with react-chartjs-2 for performance visualization and analytics

**State Management & Data Fetching**
- SWR for efficient data fetching, caching, and revalidation
- React Hook Form with Zod for form state management and validation
- React Query (TanStack Query) for additional server state management
- Custom hooks pattern for business logic encapsulation

**Code Organization**
- Component-based architecture with lazy loading for performance
- Custom error boundaries for graceful error handling
- Shared hooks directory for reusable logic (auth, data fetching, UI state)
- Path aliases (@/) for clean imports and better code organization

### Backend Architecture

**Server Framework**
- Express.js as the HTTP server with TypeScript
- Custom route registration system for API endpoint organization
- Session-based authentication using express-session with MemoryStore
- CORS configuration for development/production environments

**Authentication & Authorization**
- bcrypt for password hashing with salt rounds
- Session-based authentication with role-based access control (admin/student)
- Custom auth middleware for protected routes
- Separate login flows for administrators and students

**API Design**
- RESTful API patterns with consistent response formats
- Error handling with appropriate HTTP status codes
- Request validation and sanitization

**File Structure**
- Separate server and client directories for clear separation of concerns
- Shared database schema accessible from both server and client
- TypeScript path aliases for consistent imports across the application
- Migration system for database schema versioning

### Data Storage

**Database**
- PostgreSQL as the primary database (via Neon serverless)
- Drizzle ORM for type-safe database queries and schema management
- Migration-based schema versioning for database changes

**Schema Design**
- Users table with role-based access (admin/student) and gender tracking
- Swim records with support for multiple pool lengths (15m, 25m, 50m)
- Competition tracking with location and date information
- Announcements system for team-wide communications

**Data Relationships**
- Foreign key relationships between users, records, and competitions
- Cascade delete patterns for data integrity
- Indexed fields for optimized query performance

### External Dependencies

**Database & Storage**
- Neon Database (PostgreSQL): Serverless PostgreSQL database with automatic scaling
- Drizzle ORM: Type-safe ORM for database operations and migrations

**Authentication & Session Management**
- @auth/express and @auth/core: Authentication framework integration
- express-session with memorystore: In-memory session storage for user sessions
- bcryptjs: Password hashing and verification

**UI & Visualization**
- Radix UI: Complete suite of accessible UI primitives
- Chart.js with react-chartjs-2: Data visualization for performance tracking
- Tailwind CSS: Utility-first CSS framework
- Lucide React: Icon library

**Development & Build Tools**
- Vite: Frontend build tool and dev server
- TypeScript: Type safety across the application
- ESBuild: Server-side bundling for production
- tsx: TypeScript execution for scripts and development

**Form & Validation**
- React Hook Form: Form state management
- Zod: Schema validation for forms and API requests
- @hookform/resolvers: Integration between React Hook Form and Zod

**Data Fetching**
- SWR: React hooks for data fetching with caching
- TanStack Query: Advanced server state management