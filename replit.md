# Fitness Data Management Application

## Overview
A comprehensive fitness data management application for tracking workout exercises, recording entries, analyzing weekly statistics, and monitoring progress. It supports custom exercise types, intelligent data recording, and career progress tracking with ranking capabilities. The application prioritizes quick data entry, immediate feedback, and a clear visual hierarchy, drawing inspiration from data-first interfaces like MyFitnessPal and Strava.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application uses React 18 with TypeScript, Vite, and Shadcn UI (New York variant) built on Radix UI primitives. Styling is managed with Tailwind CSS, featuring an activity orange primary color and deep blue navigation. It employs a responsive layout with sidebar navigation for desktops and a collapsible version for mobile. Key UI components include Recharts for data visualization and React Hook Form with Zod for form management.

### Technical Implementations
The frontend uses TanStack Query for server state management with optimistic updates and Wouter for client-side routing. The backend is built with Node.js and Express.js, providing a RESTful API for CRUD operations, statistics (ranking, trends, current week details, category breakdown, exercise weekly average), and CSV import/export. Data is stored in PostgreSQL using the `pg` library with Drizzle ORM. Multer handles CSV file uploads, and PapaParse processes CSV data. Shared Zod schemas ensure end-to-end type safety across the monorepo structure.

### Feature Specifications
- **Custom Exercise Management**: Users can define custom exercise types with units, weight factors, categories (strength, cardio, flexibility, core, balance, activity), and muscle group percentages.
- **Muscle Group Percentage Tracking**: Each exercise can specify percentage contributions to 8 muscle groups (胸/背/腿/肩/二头肌/核心/臀/三头肌). Percentages range 0-100 and can sum to more than 100% for compound movements. Dashboard displays weekly muscle group training volume calculated proportionally from entries.
- **Intelligent Data Recording**: The "Add Entry" dialog provides recommended exercises based on weekly progress and historical averages, excluding "每周平均步数" from recommendations. It also displays historical weekly averages for the selected exercise to aid goal setting.
- **Mixed-Category Exercise Support**: Exercises can span multiple fitness categories through configurable baseline value splitting. Each exercise type optionally includes `splitCategory` (secondary category: 力量/有氧/活动量) and `splitRatio` (decimal 0-1 representing proportion allocated to secondary category). When splitRatio is 0/null, exercises behave as single-category with 100% baseline to primary category. Example: "跑步機負重" with category="有氧", splitCategory="力量", splitRatio=0.5 distributes baseline equally (cardio 50%, strength 50%). Split logic implemented in MemStorage/DbStorage `getWeeklyStats()` methods: `primaryValue = baseline * (1 - splitRatio)`, `secondaryValue = baseline * splitRatio`. Frontend exercise form includes conditional UI for secondary category selection and ratio input (0 ≤ ratio ≤ 1 validation). `/api/stats/category-breakdown` endpoint calls `getWeeklyStats()` to return split-adjusted category totals, ensuring dashboard statistics, rankings, and trend visualizations accurately reflect proportional distribution. CSV imports default splitRatio=0 for backward compatibility. Enables precise tracking of hybrid activities (circuit training, CrossFit, functional movements).
- **Career Progress Tracking**: The system tracks career progress with a unified four-metric ranking system (Total/Strength/Cardio/Activity). Detailed ranking dialogs show current week performance against career averages and surrounding weeks.
- **Weekly Records Details**: A dashboard card provides a comprehensive dialog showing detailed records, category breakdown, and a comparison against career averages with motivational feedback.
- **Best Week Details**: Users can view a detailed breakdown of their best week, comparing individual exercise performance against historical averages.
- **Workout Entry Editing**: Existing workout entries can be edited, with automatic conversion of daily average steps to weekly totals and proper timezone handling.
- **Data Import/Export**: Supports CSV-based data portability and includes an Excel import script for historical data.
- **Timezone Handling**: All user-facing times are UTC+8 (Taipei time), while backend stores timestamps in UTC.
- **"每周平均步数" Special Handling**: Automatically converts daily average step inputs to weekly totals for this specific exercise type.
- **Fixed Baseline Value Storage**: Baseline values are calculated and stored in the database at the time of entry creation (value × sets × weightFactor). Once stored, all statistics queries use the saved baseline value, ensuring historical data remains unchanged even if exercise weight factors are modified later. This provides data integrity and accurate historical tracking.

### System Design Choices
The application adopts a monorepo structure, housing frontend, backend, and shared code (types, schemas). It emphasizes type safety through end-to-end TypeScript and shared Zod schemas. The storage layer is abstracted, supporting easy migration from in-memory to PostgreSQL. UI is built with a component-based, atomic design approach.

## External Dependencies

### UI & Styling
- **Radix UI**: Unstyled UI primitives.
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

### Routing & Navigation
- **Wouter**: Minimalist routing library.

### Date Handling
- **date-fns**: Modern date utility library.

### Database
- **PostgreSQL**: Relational database.
- **Drizzle Kit**: Database migration tool.