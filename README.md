# Zero-Waste Industrial Symbiosis Engine

A lightweight full-stack B2B marketplace for industrial waste exchange, built for SDG 12.

## Stack

- Frontend: React + Vite + D3.js
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt

## Features

- Creative landing page with green-and-white environmental theme
- Unique username registration
- Protected email storage using encryption plus hashed lookup
- Password hashing with bcrypt
- Roles: `user`, `superior`, `admin`
- Monthly upgrade request flow for paid uploads
- Admin moderation dashboard
- Post creation for superior users
- Search and filtering
- Buyer-seller chat
- Force-directed industrial network graph
- Profile editing with current-password confirmation

## Project Structure

- `backend/` Express API
- `frontend/` React app

## Quick Start

### 1. Backend

Create `backend/.env` from `backend/.env.example`, then:

```bash
cd backend
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Admin Creation

Admins are not created through public signup.

```bash
cd backend
npm run create-admin -- --email admin@example.com --username admin --password StrongPass123!
```

## Suggested Improvement For Real Payments

For a real deployment, replace manual payment confirmation with:

- Razorpay payment links
- Webhook-driven subscription activation
- Cloudinary image hosting for smaller app servers

For a college project, the included manual admin approval flow is simpler and easier to demo.

