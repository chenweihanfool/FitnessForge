# Fitness Data Management Application

## Overview

A comprehensive fitness data management application designed for tracking workout exercises, recording entries, analyzing weekly statistics, and monitoring progress. Key features include custom exercise type management, intelligent data recording, and career progress tracking with ranking capabilities. The application emphasizes quick data entry, immediate feedback, and clear visual hierarchy, inspired by data-first interfaces like MyFitnessPal and Strava.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite.
**UI Component Library**: Shadcn UI (New York variant) built on Radix UI primitives.
**Styling**: Tailwind CSS with a custom design system including an activity orange primary color and deep blue navigation.
**State Management**: TanStack Query for server state management with optimistic updates.
**Routing**: Wouter for client-side routing.
**Data Visualization**: Recharts library for charts.
**Form Management**: React Hook Form with Zod for validation.

### Backend Architecture

**Runtime**: Node.js with Express.js.
**API Design**: RESTful API for CRUD operations on exercises and workout entries, and endpoints for statistics (ranking, trends, current week details, category breakdown), CSV import, and export.
**Storage Layer**: PostgreSQL database accessed via `pg` library with Drizzle ORM for schema definition and camelCase/snake_case mapping.
**File Upload**: Multer for handling CSV file uploads.
**CSV Processing**: PapaParse for parsing and generating CSV files.
**Validation**: Zod schemas shared between frontend and backend.

### Data Schema

**Exercise Types Table**: Stores custom exercise definitions including UUID, name, unit, weight factor, and category (力量/有氧/柔韧性/核心/平衡/活动量).
**Workout Entries Table**: Records individual workout data with foreign key to exercise type, numerical value, timestamp, and optional notes.
**Computed Statistics**: Weekly aggregations of total baseline value, entry counts, rankings, and performance metrics. Includes category-specific statistics (strengthValue, cardioValue, activityValue) and separate rankings for each category.

### Key Architectural Decisions

**Monorepo Structure**: Frontend, backend, and shared code (types, schemas) reside in a single repository.
**Type Safety**: End-to-end TypeScript with shared Zod schemas.
**Database-Ready Design**: Abstracted storage layer and Drizzle ORM facilitate easy migration from in-memory to PostgreSQL.
**Component-Based UI**: Atomic design with reusable components.
**Responsive Layout**: Sidebar navigation for desktop, collapsible for mobile.
**Import/Export Workflow**: CSV-based data portability. An Excel import script (`server/import-excel.ts`) supports importing exercise definitions and historical workout data.
**Exercise Categorization System**: Exercises are organized into predefined categories with UI filtering capabilities.
**Timezone Handling (UTC+8)**: All user-facing time inputs and displays use Taipei time (UTC+8). Frontend converts datetime-local inputs to UTC before sending to backend; backend stores all timestamps in UTC. Timezone utilities (`getTaipeiTime`, `toTaipeiTime`) in `client/src/lib/timezone.ts` ensure consistent time handling across the application.

## External Dependencies

### UI & Styling
- **Radix UI**: Accessible, unstyled UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **class-variance-authority**: Variant-based component styling.
- **Recharts**: Declarative charting library.

### Data Management
- **TanStack Query**: Async state management.
- **React Hook Form**: Form library with validation.
- **Zod**: TypeScript-first schema validation.

### Backend Services
- **Express.js**: Web application framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **pg**: PostgreSQL client library.
- **Multer**: Multipart/form-data file upload handling.
- **PapaParse**: CSV parsing and serialization.
- **xlsx**: Excel file parsing.

### Development Tools
- **Vite**: Fast build tool and development server.
- **TypeScript**: Static type checking.
- **PostCSS**: CSS transformation.

### Routing & Navigation
- **Wouter**: Minimalist routing library.

### Date Handling
- **date-fns**: Modern date utility library.

### Database (Configured)
- **PostgreSQL**: Relational database.
- **Drizzle Kit**: Database migration tool.