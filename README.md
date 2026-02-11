
# Notify Me: Vehicle Compliance Management System

A sophisticated, multi-tenant SaaS application designed for commercial fleet owners to manage vehicle compliance, automated alerts, and AI-driven document audits.

## 🚀 Core Features

- **Multi-Tenant Architecture**: Secure data isolation between different fleet organizations.
- **Granular RBAC**: 
  - `TENANT_ADMIN`: Full ownership, billing, and team management.
  - `TENANT_MANAGER`: Full access to fleet and documents.
  - `TENANT_VIEWER`: Read-only access for monitoring and reporting.
- **AI-Driven Audits**: Uses **Google Gemini 3 Pro** to analyze document validity and provide operational recommendations.
- **Automated Alerts**: Intelligent triggers for upcoming expiries (RC, Insurance, Permits, etc.) with automated email generation via **Gemini 3 Flash**.
- **Payment Integration**: Secure subscription gating via **Razorpay**.
- **Modern UI/UX**: Dark mode support, responsive design, and intuitive fleet management dashboards.

## 🛠 Tech Stack

- **Frontend**: React 19 (ESM based), Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: Google Generative AI (Gemini API)
- **Payments**: Razorpay
- **Charts**: Recharts
- **Hosting**: Netlify

## ⚙️ Environment Setup

To run this application, configure the following environment variables in your deployment platform (e.g., Netlify Settings > Environment Variables):

| Variable | Description |
|----------|-------------|
| `API_KEY` | Your Google Gemini API Key |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase Anonymous Client Key |

## 📦 Database Setup

Run the provided `schema.sql` in your Supabase SQL Editor to set up:
1. Tables: `tenants`, `profiles`, `vehicles`, `compliance_records`, `automation_config`.
2. Row Level Security (RLS) policies for multi-tenancy.
3. Triggers for vehicle limit enforcement (Free vs. Pro).

## 🚢 Deployment

This project is optimized for **Netlify**.
1. Connect this repository to a new Netlify site.
2. The `netlify.toml` file will automatically handle the single-page application (SPA) routing and Content Security Policy (CSP).
3. Ensure the environment variables listed above are added to the Netlify UI.

## 📝 License

Proprietary / Internal Use Only.
