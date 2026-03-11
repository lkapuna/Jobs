# WorkHour 🕐
פלטפורמה לעבודות לפי שעות — מחברת עובדים ומעסיקים

## סטאק טכנולוגי
- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas
- **Auth**: JWT
- **Real-time**: Socket.io
- **Frontend**: HTML/CSS/JS ונילה

## מבנה הפרויקט
```
workhour/
├── server.js              # שרת ראשי
├── models/
│   ├── User.js            # משתמשים (עובד/מעסיק/אדמין)
│   ├── Job.js             # משרות
│   └── WorkSession.js     # משמרות + שעון נוכחות
├── routes/
│   ├── auth.js            # הרשמה והתחברות
│   ├── jobs.js            # ניהול משרות
│   ├── sessions.js        # שעון נוכחות
│   └── admin.js           # פאנל אדמין
├── middleware/
│   └── auth.js            # JWT middleware
└── public/
    ├── index.html         # דף בית
    └── pages/
        ├── login.html
        ├── register.html
        ├── worker-dashboard.html    # (בפיתוח)
        └── employer-dashboard.html  # (בפיתוח)
```

## התקנה מקומית
```bash
git clone <repo-url>
cd workhour
npm install
cp .env.example .env
# מלא את MONGODB_URI ו-JWT_SECRET ב-.env
npm run dev
```

## Deploy על Render
1. צור repo חדש ב-GitHub ודחוף את הקוד
2. ב-Render: **New Web Service**
3. חבר את ה-repo
4. הגדרות:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. הוסף Environment Variables:
   - `MONGODB_URI` — מ-MongoDB Atlas
   - `JWT_SECRET` — מחרוזת סודית אקראית
   - `PORT` — 3000

## API Endpoints

### Auth
| Method | Route | תיאור |
|--------|-------|-------|
| POST | `/api/auth/register/worker` | הרשמת עובד |
| POST | `/api/auth/register/employer` | הרשמת מעסיק |
| POST | `/api/auth/login` | התחברות |
| GET | `/api/auth/me` | מידע על המשתמש המחובר |

### Jobs
| Method | Route | תיאור |
|--------|-------|-------|
| GET | `/api/jobs` | חיפוש משרות |
| POST | `/api/jobs` | פרסום משרה (מעסיק) |
| POST | `/api/jobs/:id/apply` | פנייה למשרה (עובד) |
| GET | `/api/jobs/my` | המשרות שלי (מעסיק) |
| PATCH | `/api/jobs/:jobId/applicants/:workerId` | עדכון סטטוס מועמד |

### Sessions (שעון נוכחות)
| Method | Route | תיאור |
|--------|-------|-------|
| POST | `/api/sessions/start` | התחלת משמרת |
| POST | `/api/sessions/end` | סיום משמרת |
| GET | `/api/sessions/my` | ההיסטוריה שלי (עובד) |
| GET | `/api/sessions/employer` | משמרות לאישור (מעסיק) |
| PATCH | `/api/sessions/:id/approve` | אישור/תיקון/מחלוקת |

### Admin
| Method | Route | תיאור |
|--------|-------|-------|
| GET | `/api/admin/stats` | סטטיסטיקות |
| GET | `/api/admin/users` | כל המשתמשים |
| PATCH | `/api/admin/users/:id/block` | חסימת משתמש |
| GET | `/api/admin/sessions/disputes` | מחלוקות |
| PATCH | `/api/admin/sessions/:id/resolve` | הכרעה בסכסוך |

## חישוב עמלה
- עמלה: **3 ₪ לשעה מכל צד**
- לדוגמה — 6 שעות, שכר 50 ₪/שעה:
  - עובד מקבל: 300 - 18 = **282 ₪**
  - מעסיק משלם: 300 + 18 = **318 ₪**
  - רווח האפליקציה: **36 ₪**
