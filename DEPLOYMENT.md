# Deployment Guide

## Quick Start (Local Development)

### Prerequisites
- Node.js 16+ and npm
- MongoDB running locally or Atlas connection string

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install
```

### 2. Configure Environment

**Backend** (`backend/.env`):
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/zero-waste-engine
JWT_SECRET=your-secret-key-change-in-production
EMAIL_SECRET=32-char-secret-key-change-me!!
CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=/api
```

### 3. Create Admin User

```bash
cd backend
npm run create-admin -- --email admin@example.com --username admin --password YourSecurePass123
```

### 4. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Server runs on http://localhost:5173 with proxy to backend
```

Open http://localhost:5173 in your browser and login with admin credentials.

---

## Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
# Creates frontend/dist with optimized build
```

### Deploy Backend Only
The backend automatically serves the frontend build when `frontend/dist` exists.

**Option 1: Single Node.js Server**
```bash
# Set environment variables on your host (e.g., Render, Railway, Heroku)
NODE_ENV=production
PORT=3000  # or your preferred port
MONGODB_URI=mongodb+srv://...  # your Atlas URI
JWT_SECRET=your-production-secret
EMAIL_SECRET=your-production-secret

# Start server
npm --prefix backend start
# or: npm start (if running from root)
```

**Option 2: Docker Deployment**
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy backend
COPY backend ./backend
COPY frontend/dist ./frontend/dist

WORKDIR /app/backend
RUN npm install --production
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
```

### Environment Variables for Production
- **PORT**: Server port (default: 5000)
- **MONGODB_URI**: Your MongoDB Atlas connection string
- **JWT_SECRET**: Strong random string for JWT signing
- **EMAIL_SECRET**: 32+ char string for email encryption
- **NODE_ENV**: Set to `production` for relaxed CORS

### Features
- ✅ Frontend and backend served from single origin (no CORS issues)
- ✅ No code changes needed after deployment
- ✅ Automatic fallback to `/api` endpoint
- ✅ Works with GitHub, Render, Railway, Vercel (backend), Heroku, etc.

### URL Structure (Production)
- **Frontend**: `https://your-domain.com/`
- **API**: `https://your-domain.com/api/`
- **Health Check**: `https://your-domain.com/api/health`

---

## Testing the Connection

### Local Dev
```bash
# Test backend
curl http://localhost:5000/api/health

# Test through frontend dev proxy
curl http://localhost:5173/api/health

# Test login
curl -X POST http://localhost:5173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourSecurePass123"}'
```

### Production
```bash
# Test backend + static files
curl https://your-domain.com/

# Test API
curl https://your-domain.com/api/health
```

---

## Troubleshooting

### "Cannot reach the backend" Error
- Ensure backend is running (`npm run dev` in backend folder)
- Check `VITE_API_URL` in `frontend/.env` is set to `/api`
- Rebuild frontend: `npm run build` in frontend folder
- Frontend dev proxy: `VITE_DEV_PROXY=http://localhost:5000 npm run dev`

### Port Already in Use
```bash
# Find and kill process using the port
# Linux/Mac:
lsof -i :5000
kill -9 <PID>

# Windows PowerShell:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### MongoDB Connection Failed
- Check MongoDB is running: `mongod`
- Verify connection string in `.env`
- For Atlas: whitelist your IP, use correct password in connection string

### CORS Errors in Dev
- Add frontend dev port to `backend/src/server.js` allowedOrigins
- Development mode automatically allows common ports (5173, 5174, 3000)

---

## Git & GitHub Deployment

After making changes:
```bash
git add .
git commit -m "feat: fixed frontend-backend connection and CORS"
git push origin main
```

Then deploy to your hosting platform (automatically redeploys from GitHub).
