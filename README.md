# Daniel Muendo — Portfolio & Learning Platform

Full-stack Node.js app: portfolio website + course enrollment with Stripe & M-Pesa payments.

## Tech Stack
- **Backend:** Node.js, Express, Prisma ORM
- **Database:** PostgreSQL (Neon)
- **Auth:** JWT
- **Payments:** Stripe (card), Intasend (M-Pesa)
- **Email:** Nodemailer + Gmail SMTP
- **Frontend:** Single HTML file (vanilla JS)

---

## Local Setup

### 1. Install dependencies
```bash
npm install
npx prisma generate
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env` and fill in all values (see comments in the file).

**The two most important ones to get right:**
- `DATABASE_URL` — your Neon connection string
- `FRONTEND_URL` — must be `http://localhost:5000` locally

### 3. Run database migrations + seed
```bash
npx prisma migrate dev --name init
node prisma/seed.js
```

### 4. Start the server
```bash
npm run dev        # development (auto-restarts)
npm start          # production
```

Open **http://localhost:5000**

---

## Admin Access
After seeding:
- **Email:** danmuendo4@gmail.com
- **Password:** ChangeMe123!

The Admin section in the nav only appears when logged in as ADMIN.
**Change the password after first login.**

---

## Deploy to Render

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo
3. In **Environment Variables**, set:
   - `DATABASE_URL` — your Neon connection string
   - `DIRECT_URL` — same Neon string (without pooling)
   - `FRONTEND_URL` — `https://your-app-name.onrender.com`
   - `JWT_SECRET` — any long random string
   - `SMTP_USER`, `SMTP_PASS` — Gmail credentials
   - `ADMIN_EMAIL` — danmuendo4@gmail.com
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard
   - `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY` — from Intasend
4. Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
5. Start command: `npm start`
6. After first deploy, open the **Shell** tab in Render and run: `node prisma/seed.js`

### Stripe webhook (after deploy)
In Stripe dashboard → Webhooks → Add endpoint:
- URL: `https://your-app.onrender.com/api/payments/webhook/stripe`
- Events: `checkout.session.completed`
- Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

### Intasend webhook (after deploy)
In Intasend dashboard → Webhooks:
- URL: `https://your-app.onrender.com/api/payments/webhook/mpesa`

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | — | Register new user |
| POST | /api/auth/login | — | Login, returns JWT |
| GET | /api/auth/me | ✅ | Get current user + enrollments |
| GET | /api/courses | — | List all published courses |
| GET | /api/courses/:slug | optional | Course details (locked content if not enrolled) |
| POST | /api/payments/stripe/create-session | ✅ | Create Stripe checkout session |
| POST | /api/payments/mpesa/initiate | ✅ | Send M-Pesa STK push |
| GET | /api/payments/mpesa/status/:id | ✅ | Poll M-Pesa payment status |
| GET | /api/payments/my-payments | ✅ | User's payment history |
| POST | /api/contact | — | Submit contact form |
| POST | /api/newsletter/subscribe | — | Subscribe to newsletter |
| GET | /api/progress/:courseId | ✅ | Get course progress |
| POST | /api/progress/:courseId/lesson/:lessonId/complete | ✅ | Mark lesson complete |
| GET | /api/progress/certificate/:certNumber | — | Public certificate lookup |
| GET | /api/admin/stats | 🔒 Admin | Dashboard stats |
| GET | /api/admin/messages | 🔒 Admin | Contact form submissions |
| GET | /api/admin/payments | 🔒 Admin | All payments |
| GET | /api/admin/subscribers | 🔒 Admin | Newsletter subscribers |
| POST | /api/admin/newsletter/send | 🔒 Admin | Blast newsletter |
| GET | /health | — | Health check |
