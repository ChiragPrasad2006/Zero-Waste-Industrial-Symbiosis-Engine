# Zero-Waste Industrial Symbiosis Engine

A lightweight full-stack B2B marketplace for industrial waste exchange, built for SDG 12.

## Stack

- Frontend: React + Vite + D3.js
- Backend: Python + FastAPI
- Database: MongoDB + PyMongo
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

- `backend/` FastAPI API
- `frontend/` React app

## Quick Start

### 1. Backend

`backend/.env` is optional. The backend uses local defaults for development, and you can override them with environment variables or a local `backend/.env` when needed.

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 5000
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
python -m app.scripts.create_admin --email admin@example.com --username admin --password StrongPass123!
```

## Suggested Improvement For Real Payments

For a real deployment, replace manual payment confirmation with:

- Razorpay payment links
- Webhook-driven subscription activation
- Cloudinary image hosting for smaller app servers

For a college project, the included manual admin approval flow is simpler and easier to demo.
