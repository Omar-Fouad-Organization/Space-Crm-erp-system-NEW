# SPACE CRM & ERP System

A comprehensive Enterprise Resource Planning (ERP) and Customer Relationship Management (CRM) system built for SPACE Organizing, featuring 14 integrated modules for complete business management.

## 🚀 Live Demo

**Frontend Application**: [https://wgdwzhvhc2.skywork.website](https://wgdwzhvhc2.skywork.website)

## 📋 Features

### Core Modules (14 Total)

1. **📊 Dashboard** - Real-time analytics and KPI monitoring
2. **🤝 Deals & Pipeline** - Sales pipeline management with comprehensive deal tracking
3. **👥 Clients Management** - Complete client relationship management
4. **🏢 Exhibitions & Expos** - Event and exhibition management
5. **💰 Finance Management** - Financial tracking, payments, and reporting
6. **📋 Tasks & Operations** - Task management and workflow automation
7. **👤 Users & Permissions** - User management with role-based access control
8. **💼 Commissions** - Sales commission tracking and management
9. **🏪 Booths Management** - Exhibition booth allocation and management
10. **🤝 Sponsorship Packages** - Sponsorship management and tracking
11. **🏭 Exhibitors Management** - Exhibitor registration and management
12. **💳 Payments Processing** - Payment schedules and transaction management
13. **📄 Proposals System** - Proposal creation and management
14. **📝 Documents & Contracts** - Document management with file attachments
15. **👥 HR & Team Management** - Employee management and HR operations
16. **🗓️ Meetings & Calendar** - Meeting scheduling and calendar management

### Technical Features

- **🎨 Modern UI/UX** - Built with React, TypeScript, and Tailwind CSS
- **🔐 Authentication & Authorization** - Role-based access control system
- **📱 Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **🗄️ Database Integration** - Supabase backend with PostgreSQL
- **📊 Real-time Analytics** - Live data updates and reporting
- **📁 File Management** - Document upload and attachment system
- **🔍 Advanced Search & Filtering** - Comprehensive search across all modules
- **📈 Data Visualization** - Charts and graphs for business insights
- **🌐 Multi-currency Support** - International business operations
- **📧 Notification System** - Real-time alerts and notifications

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI components
- **Lucide React** - Beautiful icon library
- **React Hook Form** - Form management with validation
- **Zod** - Schema validation
- **React Router** - Client-side routing
- **Recharts** - Data visualization library

### Backend & Database
- **Supabase** - Backend-as-a-Service platform
- **PostgreSQL** - Robust relational database
- **Row Level Security (RLS)** - Database-level security
- **Real-time Subscriptions** - Live data updates
- **Edge Functions** - Serverless functions for business logic

### Development Tools
- **ESLint** - Code linting and quality
- **Prettier** - Code formatting
- **Git** - Version control
- **npm/pnpm** - Package management

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or pnpm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW.git
   cd Space-Crm-erp-system-NEW
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your environment variables:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   
   Run the Supabase migrations in order:
   ```bash
   # Navigate to supabase/migrations/ and run each SQL file in your Supabase SQL editor:
   # 01_core_users_and_auth.sql
   # 02_core_business_entities.sql
   # 03_deals_and_sales_pipeline.sql
   # 04_finance_and_payments.sql
   # 05_tasks_communication_notifications.sql
   # 06_client_portal_and_analytics.sql
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

6. **Build for Production**
   ```bash
   npm run build
   # or
   pnpm build
   ```

## 📁 Project Structure

```
space_crm_system/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── auth/           # Authentication components
│   │   ├── layout/         # Layout components
│   │   └── forms/          # Form components
│   ├── pages/              # Page components (14 modules)
│   ├── contexts/           # React contexts for state management
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services and business logic
│   ├── types/              # TypeScript type definitions
│   └── lib/                # Utility functions
├── supabase/
│   ├── migrations/         # Database migration files
│   └── edge_functions/     # Serverless functions
├── public/                 # Static assets
└── docs/                   # Documentation
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Run the migration files in the `supabase/migrations/` directory
3. Configure Row Level Security (RLS) policies
4. Set up authentication providers if needed

### Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Third-party integrations
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_RESEND_API_KEY=re_...
```

## 📊 Database Schema

The system uses a comprehensive PostgreSQL schema with the following main tables:

- **Users & Authentication** - User accounts, roles, and permissions
- **Business Entities** - Clients, companies, and contacts
- **Sales Pipeline** - Deals, opportunities, and sales stages
- **Financial Management** - Payments, invoices, and financial records
- **Task Management** - Tasks, projects, and workflow automation
- **Communication** - Messages, notifications, and activity logs

## 🔐 Security Features

- **Row Level Security (RLS)** - Database-level access control
- **Role-based Permissions** - Granular access control system
- **JWT Authentication** - Secure token-based authentication
- **Data Encryption** - Encrypted sensitive data storage
- **Audit Logging** - Complete activity tracking

## 🎨 UI/UX Features

- **Dark/Light Mode** - Theme switching capability
- **Responsive Design** - Mobile-first approach
- **Accessibility** - WCAG 2.1 compliant
- **Internationalization** - Multi-language support ready
- **Progressive Web App** - PWA capabilities

## 📈 Performance

- **Code Splitting** - Lazy loading for optimal performance
- **Caching Strategy** - Efficient data caching
- **Bundle Optimization** - Minimized bundle sizes
- **CDN Integration** - Fast global content delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Omar Fouad Organization** - Project Owner & Lead Developer
- **SPACE Organizing** - Business Requirements & Domain Expertise

## 📞 Support

For support and questions:
- Email: om301208@gmail.com
- GitHub Issues: [Create an Issue](https://github.com/Omar-Fouad-Organization/Space-Crm-erp-system-NEW/issues)

## 🚀 Deployment

The application is deployed and accessible at:
- **Production**: [https://wgdwzhvhc2.skywork.website](https://wgdwzhvhc2.skywork.website)

### Deployment Options

1. **Vercel** (Recommended)
   ```bash
   npm run build
   vercel --prod
   ```

2. **Netlify**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

3. **Docker**
   ```bash
   docker build -t space-crm .
   docker run -p 3000:3000 space-crm
   ```

## 📋 Roadmap

- [ ] Mobile Application (React Native)
- [ ] Advanced Analytics Dashboard
- [ ] AI-powered Insights
- [ ] Third-party Integrations (Salesforce, HubSpot)
- [ ] Advanced Reporting Engine
- [ ] Workflow Automation Builder
- [ ] Multi-tenant Architecture
- [ ] API Documentation Portal

---

**Built with ❤️ by Omar Fouad Organization for SPACE Organizing**