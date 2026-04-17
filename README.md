# 🩸 BloodLink TN — Quick Start

## Port: 8000 | MongoDB: ac-hbm6pbg replica set

### 3-command start
```bash
cd blood-alert-backend
npm install
npm run dev        # starts at http://localhost:8000
```

### First time only
```bash
npm run seed       # fills database with sample data
```

### Test accounts (after seed)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bloodlink.tn | Admin@1234 |
| Blood bank | salem.bb@bloodlink.tn | Salem@1234 |
| Patient | arun@test.com | Test@1234 |

### Open frontend
Open `blood-alert/index.html` in browser (or VS Code Live Server)

### All API endpoints at localhost:8000/api
- /auth — register, login, me, status
- /blood — search, stock, status
- /requests — create, mine, incoming, respond
- /alerts — CRUD alert subscriptions
- /donations — log, mine, stats
- /payments — Razorpay create-order, verify
- /admin — stats, users, banks, broadcast
- /features — compatibility, sos, public stats

### New features in v4
1. Emergency SOS broadcast to blood banks
2. Blood compatibility checker
3. Sound alarm on new requests (bank dashboard)
4. Visual notification banner with urgency colour
5. Live profile section on all dashboards
6. Auto-approve after 12 hours (background job)
7. License number required for banks/hospitals
8. Pending approval page with countdown
