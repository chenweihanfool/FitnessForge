# Fitness Data Management Application

## Overview

A comprehensive fitness data management application that enables users to track workout exercises, record workout entries, analyze weekly statistics, and monitor progress over time. The application features custom exercise type management, intelligent data recording, weekly statistical analysis, and career progress tracking with ranking capabilities.

The application is designed with a focus on data-first interfaces inspired by MyFitnessPal and Strava, emphasizing quick data entry (max 3 steps), immediate feedback, and clear visual hierarchy through cards, spacing, and color differentiation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component Library**: Shadcn UI (New York variant) built on Radix UI primitives, providing a comprehensive set of accessible components including dialogs, forms, cards, tables, charts, and navigation elements.

**Styling**: Tailwind CSS with custom design system:
- Color scheme: Activity orange (#FF6B35) for primary actions, deep blue (#004E89) for navigation
- Typography: Inter font family as primary, Roboto as fallback
- Spacing: 8px-based system (2, 4, 8 units)
- Responsive breakpoints: Mobile-first with tablet (768px) and desktop (1024px) breakpoints

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and cache invalidation patterns.

**Routing**: Wouter for lightweight client-side routing.

**Data Visualization**: Recharts library for rendering trend charts and statistical visualizations.

**Form Management**: React Hook Form with Zod schema validation for type-safe form handling.

### Backend Architecture

**Runtime**: Node.js with Express.js framework.

**API Design**: RESTful API with the following endpoint structure:
- `/api/exercises` - CRUD operations for exercise types
- `/api/entries` - CRUD operations for workout entries
- `/api/stats/ranking` - Weekly ranking calculations
- `/api/stats/trends` - Historical weekly statistics
- `/api/import` - CSV data import with file upload
- `/api/export` - CSV data export

**Storage Layer**: Abstract storage interface (`IStorage`) with in-memory implementation (`MemStorage`), designed to be swappable with database implementations. The schema is defined using Drizzle ORM, prepared for PostgreSQL integration.

**File Upload**: Multer middleware for handling CSV file uploads in memory.

**CSV Processing**: PapaParse library for parsing and generating CSV files.

**Validation**: Zod schemas shared between frontend and backend for consistent data validation.

### Data Schema

**Exercise Types Table**: Stores custom exercise definitions with:
- Unique identifiers
- Exercise name and unit of measurement
- Weight factor for standardized calculations across different exercise types

**Workout Entries Table**: Records individual workout data with:
- Foreign key reference to exercise type
- Numerical value
- Timestamp
- Optional notes
- Cascade deletion when exercise type is removed

**Computed Statistics**: Weekly aggregations calculating:
- Total baseline value (value × weight factor)
- Entry counts
- Rankings by comparing current week against all historical weeks
- Best/worst/average weekly performance metrics

### Key Architectural Decisions

**Monorepo Structure**: Frontend (`client/`), backend (`server/`), and shared code (`shared/`) in a single repository, enabling code sharing for types and schemas.

**Type Safety**: End-to-end TypeScript with shared Zod schemas ensuring consistent validation and type definitions across the full stack.

**Database-Ready Design**: While currently using in-memory storage, the application is architected with Drizzle ORM schemas and a storage interface abstraction, making migration to PostgreSQL straightforward without requiring API changes.

**Component-Based UI**: Atomic design with reusable components (StatsCard, RankingCard, TrendChart) that encapsulate both presentation and data handling logic.

**Responsive Layout**: Sidebar navigation for desktop, collapsible with mobile sheet overlay, ensuring consistent UX across devices.

**Import/Export Workflow**: CSV-based data portability allowing users to backup data and migrate between instances.

## External Dependencies

### UI & Styling
- **Radix UI**: Comprehensive collection of accessible, unstyled UI primitives (accordion, dialog, dropdown, popover, tabs, tooltip, etc.)
- **Tailwind CSS**: Utility-first CSS framework with custom configuration for the design system
- **class-variance-authority**: Variant-based component styling
- **Recharts**: Declarative charting library for data visualizations

### Data Management
- **TanStack Query**: Async state management with caching, background updates, and optimistic UI
- **React Hook Form**: Performance-focused form library with validation
- **Zod**: TypeScript-first schema validation library

### Backend Services
- **Express.js**: Web application framework
- **Drizzle ORM**: TypeScript ORM with schema definition for PostgreSQL
- **@neondatabase/serverless**: PostgreSQL database driver (prepared for future use)
- **Multer**: Multipart/form-data file upload handling
- **PapaParse**: CSV parsing and serialization

### Development Tools
- **Vite**: Fast build tool and development server with HMR
- **TypeScript**: Static type checking across the entire codebase
- **PostCSS**: CSS transformation with Autoprefixer

### Routing & Navigation
- **Wouter**: Minimalist routing library (2KB alternative to React Router)

### Date Handling
- **date-fns**: Modern date utility library with localization support (Chinese locale)

### Database (Configured)
- **PostgreSQL**: Relational database (via Neon serverless driver)
- **Drizzle Kit**: Database migration tool and schema management