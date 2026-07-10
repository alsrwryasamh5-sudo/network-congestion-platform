# Network Congestion Detection Platform

AI-powered network congestion detection & root cause analysis platform built with Flask, React, and PostgreSQL. Uses a hybrid Stacking ML model (Decision Tree + XGBoost + Logistic Regression) with SHAP explainability.

> Based on the academic project: "كشف الازدحام الشبكي باستخدام التحليل الإحصائي والذكاء الاصطناعي" (Network Congestion Detection using Statistical Analysis and AI) using the NF-UNSW-NB15-v3 dataset.

---

## Features

### Backend (Flask)
- JWT authentication with Role-Based Access Control (Admin / Researcher / Viewer)
- REST API with blueprints, versioning, and Swagger-ready endpoints
- ML pipeline integration (Stacking model + SHAP + DBSCAN clustering)
- Root Cause Analysis with Culprit Score computation
- PDF report generation (executive / technical / mitigation)
- Rate limiting, caching, structured logging, audit logs
- PostgreSQL with SQLAlchemy ORM + Alembic migrations

### Frontend (React + Vite + TypeScript + TailwindCSS)
- Cyber-security themed dark UI with glassmorphism & neon gradients
- 20+ pages: Dashboard, Analytics, Congestion Detection, Root Cause, SHAP, Reports, Training, etc.
- Real-time charts (Recharts): latency, jitter, bandwidth, packet loss, congestion timeline
- SHAP feature importance visualizations
- Bilingual (Arabic/English) with full RTL/LTR support
- Responsive design (Desktop / Tablet / Mobile / Ultra-wide)
- Framer Motion animations

### Machine Learning
- **Model**: StackingClassifier (DecisionTree + XGBoost -> LogisticRegression)
- **Features**: 44 numeric NetFlow v3 features
- **Performance**: ~97% accuracy, ~86% F1, ~90% AUC
- **Explainability**: SHAP TreeExplainer on XGBoost base estimator
- **Root Cause**: 4-component Culprit Score (volume + QoS + AI + spatial)
- **Clustering**: DBSCAN per 30-second time window

---

## Project Structure

```
.
├── backend/                  # Flask API + ML pipeline
│   ├── app/
│   │   ├── blueprints/       # API routes (auth, ml, dashboard, reports, admin, system)
│   │   ├── services/         # Business logic (auth, ml, report)
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── ml/               # ML pipeline + data loader
│   │   ├── utils/            # Logger, errors, helpers
│   │   ├── config.py         # Environment-driven config
│   │   └── __init__.py       # App factory
│   ├── artifacts/            # Trained models (joblib) + reports
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── frontend/                 # React + Vite + TS
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Route pages
│   │   ├── services/         # API clients
│   │   ├── store/            # Redux Toolkit slices
│   │   ├── i18n/             # AR/EN translations
│   │   └── App.tsx
│   ├── Dockerfile
│   └── nginx.conf
├── database/
│   └── init.sql              # PostgreSQL init + views
├── docker-compose.yml
├── render.yaml               # Render deployment blueprint
└── README.md
```

---

## Quick Start (Local with Docker)

1. **Clone** the repository:
   ```bash
   git clone <your-fork-url>
   cd network-congestion-platform
   ```

2. **Create environment file**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your secrets
   ```

3. **Start all services**:
   ```bash
   docker-compose up --build
   ```
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:5000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

4. **Login** with default admin credentials:
   - Username: `admin`
   - Password: `admin12345`

5. **Train the model** (first run):
   - Open the platform in your browser
   - Go to **Training** page
   - Click **Start Training** (uses synthetic data by default)

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/congestion_db
export REDIS_URL=redis://localhost:6379/0
export SECRET_KEY=dev-secret
export JWT_SECRET_KEY=dev-jwt-secret

# Run
python run.py
# Or: gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
# Opens at http://localhost:5173
```

### Train Initial Model

```bash
cd backend
python train_initial.py
```

This generates 5,000 synthetic samples and trains the Stacking model. Artifacts are saved to `backend/artifacts/`.

---

## Using Real NF-UNSW-NB15 Dataset

To train on the real dataset instead of synthetic data:

1. **Get Kaggle credentials**:
   - Go to https://www.kaggle.com → Account → Create New Token
   - Download `kaggle.json`

2. **Set environment variables**:
   ```bash
   export KAGGLE_API_TOKEN=your_kaggle_token
   # OR place kaggle.json in ~/.kaggle/
   ```

3. **Train via API**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/ml/train \
     -H "Authorization: Bearer <YOUR_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"csv_path": "/path/to/NF-UNSW-NB15-v3.csv", "experiment_name": "real_data_v1"}'
   ```

---

## API Endpoints

### Auth (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login |
| POST | `/refresh` | Refresh access token |
| GET | `/me` | Get current user |
| POST | `/logout` | Logout |
| POST | `/change-password` | Change password |
| POST | `/forgot-password` | Request password reset |

### ML (`/api/v1/ml`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/model-info` | Get model status & metadata |
| POST | `/predict` | Single flow prediction |
| POST | `/predict-batch` | Batch prediction (CSV/JSON) |
| POST | `/shap` | SHAP values for a flow |
| POST | `/root-cause` | Root cause analysis |
| POST | `/full-inference` | Predict + SHAP + RCA combined |
| POST | `/train` | Train new model (admin/researcher) |
| GET | `/evaluate` | Get model evaluation metrics |
| GET | `/feature-importance` | Global SHAP feature importance |
| POST | `/clustering` | DBSCAN host clustering |
| GET | `/history` | Prediction history |

### Dashboard (`/api/v1/dashboard`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/overview` | Top-level stats |
| GET | `/network-health` | Network metrics timeline |
| GET | `/system-load` | CPU/RAM/Disk usage |
| GET | `/congestion-timeline` | Congestion events timeline |
| GET | `/recent-predictions` | Latest predictions |
| GET | `/api-stats` | API call statistics |

### Reports (`/api/v1/reports`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `` | List reports |
| POST | `/generate` | Generate new PDF report |
| GET | `/<id>` | Get report details |
| GET | `/<id>/download` | Download PDF |
| DELETE | `/<id>` | Delete report |

### Admin (`/api/v1/admin`) — admin role only
Users, experiments, datasets, logs, feedback, notifications management.

### System (`/api/v1/system`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Public health check |
| GET | `/info` | System info (auth required) |
| GET | `/version` | API version |
| GET | `/stats` | Platform stats |

---

## Deployment on Render

### Prerequisites
- A Render account (https://render.com)
- A GitHub repository with this code pushed

### Steps

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo>.git
   git push -u origin main
   ```

2. **Create a new Blueprint on Render**:
   - Go to https://dashboard.render.com
   - Click **New** → **Blueprint**
   - Select your GitHub repository
   - Render will detect `render.yaml` and create all services

3. **Set secret environment variables**:
   - In the Render dashboard, open the `congestion-backend` service
   - Go to **Environment** tab
   - Set `KAGGLE_API_TOKEN` manually (it's marked `sync: false` in the blueprint)

4. **Wait for deployment** to complete (~5-10 minutes for first build)

5. **Initialize the database**:
   - The backend automatically runs `db.create_all()` on startup
   - It also creates a default admin user: `admin / admin12345`

6. **Train the initial model**:
   - Open the backend shell: `python train_initial.py`
   - Or use the Training page in the UI

7. **Access your platform**:
   - Frontend: `https://<your-frontend-service>.onrender.com`
   - Backend: `https://<your-backend-service>.onrender.com`

### Render Service URLs (example)
- Frontend: `https://congestion-frontend.onrender.com`
- Backend: `https://congestion-backend.onrender.com`
- Database: `congestion-db` (private)
- Redis: `congestion-redis` (private)

---

## Security Considerations

- **Never commit secrets** to git. Use environment variables.
- **Rotate the default admin password** immediately after first login.
- **Restrict CORS_ORIGINS** to your actual frontend domain in production.
- **Enable HTTPS** (Render does this automatically with Let's Encrypt).
- **Rate limiting** is enabled by default (200/hour per IP).
- **JWT tokens** expire in 60 minutes; refresh tokens in 30 days.
- **Passwords** are hashed with PBKDF2-SHA256.
- **SQL injection** is prevented via SQLAlchemy ORM parameterized queries.
- **XSS** is mitigated via React's built-in escaping + Content-Security-Policy headers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Flask 3.0, SQLAlchemy 2.0, Flask-Limiter, PyJWT, Marshmallow |
| ML | scikit-learn 1.5, XGBoost 2.1, SHAP 0.46, pandas 2.2 |
| Frontend | React 18, Vite 5, TypeScript 5, TailwindCSS 3.4, Redux Toolkit 2 |
| Charts | Recharts 2.13, Framer Motion 11 |
| i18n | i18next 23 with Arabic + English locales |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Reports | ReportLab 4.2 |
| Deployment | Docker, docker-compose, Render, Gunicorn, Nginx |

---

## Testing

```bash
# Backend
cd backend
pytest tests/

# Frontend
cd frontend
npm run lint
npm run build
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Dataset: NF-UNSW-NB15-v3 (https://www.kaggle.com/datasets/ndayisabae/nf-unsw-nb15-v3)
- Original ML pipeline inspired by academic research on network congestion detection
- SHAP: Lundberg et al., "A Unified Approach to Interpreting Model Predictions"

---

## Support

- Issues: https://github.com/<your-username>/<repo>/issues
- Email: support@congestion.example.com
