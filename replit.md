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
**API Design**: RESTful API for CRUD operations on exercises and workout entries, and endpoints for statistics (ranking, trends, current week details, category breakdown, exercise weekly average), CSV import, and export.
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
**Average Steps Auto-Conversion**: For the "每周平均步数" exercise type, users input daily average steps and the system automatically multiplies by 7 to calculate weekly total steps before storage. The UI dynamically displays the conversion (daily → weekly) and final baseline calculation. Historical data imported from Excel is already in weekly format and bypasses this conversion.
**Exercise Weekly Average Display**: When recording new workout entries, the form displays the historical weekly average for the selected exercise type. The backend computes weekly averages by grouping all historical entries by week and calculating the mean across weeks. The frontend displays this reference value below the exercise selector: for "每周平均步数" it shows both daily and weekly averages (e.g., "历史周平均: 10000 步/天 (70000 步/周)"), while other exercises show the value with their unit (e.g., "历史周平均: 50.5 KG"). This helps users set realistic goals based on their past performance. The feature uses TanStack Query with a complete URL queryKey (`/api/stats/exercise-average/${exerciseId}`) to leverage the default fetcher.
**Weekly Records Details Dialog**: Clicking the "本周记录数" card on the dashboard opens a comprehensive dialog displaying: (1) detailed records table showing all exercises with entry counts, total values, and baseline values; (2) category breakdown showing percentage distribution among strength (力量), cardio (有氧), and activity (活动量) with visual progress bars; (3) career average comparison with four progress bars (total baseline, strength, cardio, activity) displaying current vs. average values and percentage differences (green for positive, orange for negative); (4) motivational evaluation message that adapts based on performance level, ranging from "太棒了！" for personal records to "再加把劲" for below-average weeks. Career averages are calculated from historical trend data across all weeks. This feature provides users with immediate performance feedback and contextualizes current effort against their fitness journey.
**Add Entry Dialog Weekly Progress & Recommendations**: The add entry dialog includes a collapsible "本周训练进度与推荐" panel (expanded by default) displaying two key sections: (1) Recommended Training - intelligent exercise suggestions with priority-based logic: first recommending exercises not yet done this week (showing "本周尚未训练，建议开始"), then exercises where current week total is >10% below historical average (showing "低于平均值X%，需加强"), and finally exercises below average (showing "可以加强训练"). Each recommendation includes a "选择" button that auto-selects the exercise in the form. (2) Weekly Progress Overview - shows all exercises with historical data, displaying current week total vs. historical weekly average with color-coded progress bars (green with TrendingUp icon for above average, orange with TrendingDown icon for below average), percentage difference (with +/- signs), and numeric comparisons. The backend API endpoint `/api/stats/weekly-progress` fetches data only when dialog opens, combining current week details with historical averages. Query invalidation ensures all stats refresh after adding/deleting entries. Future optimization opportunity: batch historical average lookups to reduce sequential database calls as exercise count grows.

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