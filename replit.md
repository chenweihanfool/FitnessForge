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

**Storage Layer**: PostgreSQL database accessed via `pg` library with `DbStorage` implementation. The schema is defined using Drizzle ORM with proper camelCase/snake_case mapping between frontend and database.

**File Upload**: Multer middleware for handling CSV file uploads in memory.

**CSV Processing**: PapaParse library for parsing and generating CSV files.

**Validation**: Zod schemas shared between frontend and backend for consistent data validation.

### Data Schema

**Exercise Types Table**: Stores custom exercise definitions with:
- Unique identifiers (UUID)
- Exercise name and unit of measurement
- Weight factor for standardized calculations across different exercise types
- Category field for organizing exercises (力量/有氧/柔韧性/核心/平衡/其他)

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

**Import/Export Workflow**: CSV-based data portability allowing users to backup data and migrate between instances. Excel import script (`server/import-excel.ts`) supports importing exercise definitions and historical workout data from structured Excel files.

**Exercise Categorization System**: Exercises can be organized into predefined categories (力量/有氧/柔韧性/核心/平衡/其他) with filtering capabilities in the UI. Category field is optional and stored as NULL/undefined in the database for uncategorized exercises.

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
- **pg**: PostgreSQL client library for database connections
- **Multer**: Multipart/form-data file upload handling
- **PapaParse**: CSV parsing and serialization
- **xlsx**: Excel file parsing for data import

### Development Tools
- **Vite**: Fast build tool and development server with HMR
- **TypeScript**: Static type checking across the entire codebase
- **PostCSS**: CSS transformation with Autoprefixer

### Routing & Navigation
- **Wouter**: Minimalist routing library (2KB alternative to React Router)

### Date Handling
- **date-fns**: Modern date utility library with localization support (Chinese locale)

### Database (Configured)
- **PostgreSQL**: Relational database (via pg driver)
- **Drizzle Kit**: Database migration tool and schema management

## Recent Changes

### 2025-10-26: Excel Import and Exercise Categorization

**Excel Data Import**:
- Created `server/import-excel.ts` script to import exercise definitions and workout entries from Excel files
- Successfully imported 11 exercise types (9 strength, 2 cardio) with categories and weight factors
- Imported 543 historical workout entries spanning from September 2024 to October 2025
- Excel format: Row 3 = units, Row 4 = weight factors, Row 5 = exercise names, Row 9+ = weekly data
- Note: Import script currently lacks idempotency checks and transaction safety (future improvement)

**Exercise Categorization System**:
- Added `category` field to exercises table (optional text field)
- Implemented category filter in Exercises page with predefined categories: 力量/有氧/柔韧性/核心/平衡/其他
- Added category selection in create and edit exercise forms
- Category badges displayed on exercise cards
- Filter options: All, specific categories, and Uncategorized
- Fixed Radix UI SelectItem empty string error by using "none" as display value and converting to undefined for API

**Database Migration**:
- Migrated from in-memory storage to PostgreSQL using `pg` library
- Implemented `DbStorage` class with proper camelCase/snake_case mapping
- Created database tables: exercises, workout_entries
- Used `npm run db:push` for schema synchronization

**Technical Implementation**:
- Form defaultValues use "none" for uncategorized exercises (display layer)
- API submissions convert "none" to undefined (data layer)
- Database stores NULL for uncategorized exercises
- Edit form converts NULL/undefined back to "none" for display

**Data Statistics**:
- Total exercises: 14 (11 imported + 3 test)
- Total workout entries: 544
- Date range: 2024-09-08 to 2025-10-26
- Top exercises by baseline value: 重训台 (113,465), 哑铃深蹲 (59,805), 伏地起身 (50,960)