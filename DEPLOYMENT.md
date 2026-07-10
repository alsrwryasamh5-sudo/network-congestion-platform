# دليل النشر على Render - خطوة بخطوة

## المتطلبات
- حساب على [Render.com](https://render.com) (مجاني)
- حساب GitHub (المستودع جاهز بالفعل)

## رابط المستودع
```
https://github.com/alsrwryasamh5-sudo/network-congestion-platform
```

---

## خطوات النشر

### 1. اذهب إلى Render
افتح الرابط التالي في المتصفح:

```
https://render.com/deploy?repo=https://github.com/alsrwryasamh5-sudo/network-congestion-platform
```

أو يدوياً:
1. سجل دخولك إلى https://dashboard.render.com
2. اضغط **New +** → **Blueprint**
3. اختر مستودع `network-congestion-platform`

### 2. تأكيد الخدمات
Render سيقرأ ملف `render.yaml` ويعرض:
- **congestion-db**: قاعدة PostgreSQL (مجاني)
- **congestion-backend**: خدمة ويب Flask (مجاني)

اضغط **Apply** للبدء.

### 3. انتظر البناء
- بناء الـ Docker image: 5-10 دقائق
- تثبيت Python deps: 2-3 دقائق
- بناء Frontend React: 1-2 دقيقة
- تدريب النموذج الأولي: 30 ثانية

### 4. احصل على الرابط
عند الانتهاء، Render سيعطيك رابطاً مثل:
```
https://congestion-backend.onrender.com
```

### 5. سجل الدخول
- Username: `admin`
- Password: `admin12345`

---

## ملاحظات الـ Free Tier على Render

| الخدمة | الحد المجاني |
|--------|--------------|
| Web Service | 750 ساعة/شهر، spin down بعد 15 دقيقة من عدم النشاط |
| PostgreSQL | مجاني 30 يوم فقط، بعدها $7/شهر |
| Bandwidth | 100 GB/شهر |

عندما تدخل الخدمة في حالة spin down، الطلب الأول سيأخذ ~30 ثانية للاستيقاظ.

---

## استكشاف الأخطاء

### الخدمة لا تبدأ
- تحقق من الـ logs في Render dashboard
- تأكد أن `DATABASE_URL` مُعرَّفة تلقائياً من PostgreSQL service

### أخطاء قاعدة البيانات
- انتظر 1-2 دقيقة بعد إنشاء PostgreSQL قبل بدء الـ Web Service
- تحقق من connection string في Environment tab

### الـ Frontend لا يظهر
- تأكد أن build الـ Frontend نجح (انظر logs)
- الـ Frontend يُخدَم من نفس منفذ الـ Backend (لا حاجة لـ CORS منفصل)

---

## النشر على استضافات بديلة (مجانية)

### Railway (بديل لـ Render)
```
https://railway.app/new
```
اختر المستودع وسيقوم Railway بالكشف عن `Dockerfile` تلقائياً.

### Fly.io
```bash
fly launch --from https://github.com/alsrwryasamh5-sudo/network-congestion-platform
fly deploy
```

### Vercel (Frontend فقط)
الـ Frontend React يمكن نشره على Vercel، لكن الـ Backend يحتاج Render/Railway.

---

## ما بعد النشر

### تدريب النموذج على البيانات الحقيقية
```bash
curl -X POST https://congestion-backend.onrender.com/api/v1/ml/train \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"synthetic": true, "n_samples": 10000, "experiment_name": "real_v1"}'
```

### تغيير كلمة مرور الـ admin
بعد أول تسجيل دخول، اذهب إلى **Profile** → **Change Password**.

### إعداد Kaggle للتدريب على NF-UNSW-NB15
1. اذهب إلى Render → congestion-backend → Environment
2. أضف متغير: `KAGGLE_API_TOKEN = <your_token>`
3. احفظ وأعد النشر
