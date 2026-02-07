<p align="center">
  <img src="https://img.icons8.com/fluency/96/chat.png" alt="PicoChat Logo" width="80"/>
</p>

<h1 align="center">🗨️ PicoChat</h1>

<p align="center">
  <strong>پیامرسان خصوصی، سریع و زیبا برای گفتگوی امن</strong>
</p>

<p align="center">
  <a href="#-امکانات">امکانات</a> •
  <a href="#-نصب-سریع">نصب سریع</a> •
  <a href="#-پیش-نیازها">پیش‌نیازها</a> •
  <a href="#-مستندات-api">API</a> •
  <a href="#-مشارکت">مشارکت</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python" alt="Python"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat-square&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/MongoDB-6.0+-47A248?style=flat-square&logo=mongodb" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

---

## 📸 پیش‌نمایش

<p align="center">
  <img src="docs/screenshots/login.jpeg" alt="صفحه ورود" width="45%"/>
  <img src="docs/screenshots/chat-dark.jpeg" alt="چت - تم تاریک" width="45%"/>
</p>

---

## ✨ امکانات

| امکان | توضیحات |
|-------|---------|
| 🔐 **احراز هویت امن** | ثبت‌نام و ورود با نام کاربری و رمز عبور (JWT) |
| ⚡ **پیام‌رسانی آنی** | ارسال و دریافت پیام real-time با WebSocket |
| 📷 **ارسال مدیا** | پشتیبانی از عکس، فیلم و فایل |
| 🎤 **پیام صوتی** | ضبط و ارسال پیام صوتی |
| 💬 **ریپلای** | پاسخ به پیام‌های قبلی |
| 😊 **ایموجی** | انتخاب‌گر ایموجی با جستجو |
| 🌙 **تم تاریک/روشن** | قابلیت تغییر تم با ذخیره در مرورگر |
| 🟢 **وضعیت آنلاین** | نمایش آنلاین/آفلاین کاربران |
| ✅ **وضعیت پیام** | نمایش ارسال شده/خوانده شده |
| 🌍 **RTL کامل** | پشتیبانی کامل از زبان فارسی |

---

## 🚀 نصب سریع

### نصب با یک دستور (پیشنهادی)

```bash
curl -fsSL https://raw.githubusercontent.com/MamawliV2/PicoChat/main/install.sh | sudo bash
```

یا اگر فایل را دانلود کرده‌اید:

```bash
chmod +x install.sh && sudo ./install.sh
```

> 📝 اسکریپت نصب به صورت تعاملی تمام تنظیمات را از شما می‌پرسد.

### گزینه‌های اسکریپت

```bash
./install.sh              # نصب
./install.sh --help       # راهنما  
./install.sh --uninstall  # حذف کامل
```

---

## 📋 پیش‌نیازها

| نرم‌افزار | نسخه | توضیحات |
|-----------|------|---------|
| Ubuntu/Debian | 20.04+ | یا توزیع‌های مشابه |
| Python | 3.11+ | برای backend |
| Node.js | 18+ | برای frontend |
| MongoDB | 6.0+ | دیتابیس |
| Nginx | - | (اختیاری) برای reverse proxy |
| Certbot | - | (اختیاری) برای SSL |

> 💡 اسکریپت نصب به صورت خودکار تمام پیش‌نیازها را نصب می‌کند.

---

## 🔧 نصب دستی

<details>
<summary><b>کلیک کنید برای مشاهده نصب دستی</b></summary>

### 1. کلون پروژه

```bash
git clone https://github.com/MamawliV2/PicoChat.git
cd PicoChat
```

### 2. تنظیم Backend

```bash
cd backend

# ساخت محیط مجازی
python3 -m venv venv
source venv/bin/activate

# نصب وابستگی‌ها
pip install -r requirements.txt

# تنظیم متغیرهای محیطی
cp .env.example .env
nano .env
```

محتوای `.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=picochat
JWT_SECRET=your-super-secret-key-change-this
CORS_ORIGINS=*
```

### 3. تنظیم Frontend

```bash
cd ../frontend

# نصب وابستگی‌ها
yarn install

# تنظیم متغیرهای محیطی
cp .env.example .env
nano .env
```

محتوای `.env`:
```env
REACT_APP_BACKEND_URL=http://your-server-ip:8001
```

### 4. نصب و راه‌اندازی MongoDB

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 5. اجرای برنامه

ترمینال ۱ - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001
```

ترمینال ۲ - Frontend:
```bash
cd frontend
yarn start
```

</details>

---

## 🐳 نصب با Docker

<details>
<summary><b>کلیک کنید برای مشاهده نصب Docker</b></summary>

```bash
# کلون پروژه
git clone https://github.com/MamawliV2/PicoChat.git
cd PicoChat

# تنظیم متغیرهای محیطی
export JWT_SECRET=$(openssl rand -hex 32)

# ساخت و اجرا
docker-compose up -d
```

فایل `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=picochat
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongodb
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  mongo_data:
```

</details>

---

## 📡 مستندات API

### احراز هویت

| متد | مسیر | توضیحات |
|-----|------|---------|
| `POST` | `/api/auth/register` | ثبت‌نام کاربر جدید |
| `POST` | `/api/auth/login` | ورود به حساب |
| `GET` | `/api/auth/me` | دریافت اطلاعات کاربر فعلی |
| `POST` | `/api/auth/logout` | خروج از حساب |

### کاربران

| متد | مسیر | توضیحات |
|-----|------|---------|
| `GET` | `/api/users` | لیست همه کاربران |
| `GET` | `/api/users/{id}` | اطلاعات یک کاربر |

### مکالمات

| متد | مسیر | توضیحات |
|-----|------|---------|
| `GET` | `/api/conversations` | لیست مکالمات کاربر |
| `POST` | `/api/conversations/{user_id}` | ایجاد/دریافت مکالمه |

### پیام‌ها

| متد | مسیر | توضیحات |
|-----|------|---------|
| `GET` | `/api/messages/{conv_id}` | دریافت پیام‌های مکالمه |
| `POST` | `/api/messages/{conv_id}` | ارسال پیام متنی |
| `POST` | `/api/upload/{conv_id}` | آپلود فایل/مدیا |

### WebSocket

```
WS /ws/{token}
```

**انواع پیام:**
- `message` - ارسال پیام جدید
- `typing` - نمایش در حال تایپ
- `read` - علامت‌گذاری به عنوان خوانده شده

<details>
<summary><b>نمونه درخواست‌ها</b></summary>

**ثبت‌نام:**
```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "ali", "password": "123456", "display_name": "علی"}'
```

**ورود:**
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "ali", "password": "123456"}'
```

**ارسال پیام:**
```bash
curl -X POST http://localhost:8001/api/messages/{conv_id} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"content": "سلام!", "type": "text"}'
```

</details>

---

## 📁 ساختار پروژه

```
PicoChat/
├── backend/
│   ├── server.py          # سرور اصلی FastAPI
│   ├── requirements.txt   # وابستگی‌های Python
│   ├── uploads/           # فایل‌های آپلود شده
│   └── .env              # متغیرهای محیطی
├── frontend/
│   ├── src/
│   │   ├── components/   # کامپوننت‌های UI
│   │   ├── contexts/     # Context های React
│   │   ├── pages/        # صفحات اصلی
│   │   └── App.js        # کامپوننت اصلی
│   ├── package.json
│   └── .env
├── install.sh            # اسکریپت نصب خودکار
├── docker-compose.yml    # تنظیمات Docker
└── README.md
```

---

## ⚙️ تنظیمات

### متغیرهای محیطی Backend

| متغیر | توضیحات | پیش‌فرض |
|-------|---------|---------|
| `MONGO_URL` | آدرس اتصال MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | نام دیتابیس | `picochat` |
| `JWT_SECRET` | کلید رمزنگاری JWT | **الزامی** |
| `CORS_ORIGINS` | آدرس‌های مجاز CORS | `*` |

### متغیرهای محیطی Frontend

| متغیر | توضیحات | پیش‌فرض |
|-------|---------|---------|
| `REACT_APP_BACKEND_URL` | آدرس API Backend | **الزامی** |

---

## 🔒 امنیت

- ✅ رمزنگاری پسوردها با bcrypt
- ✅ احراز هویت JWT با انقضا ۳۰ روزه
- ✅ محافظت CORS
- ✅ اعتبارسنجی ورودی‌ها با Pydantic
- ✅ WebSocket با احراز هویت

### ⚠️ نکات امنیتی مهم

1. **JWT_SECRET**: حتماً یک کلید تصادفی قوی استفاده کنید:
   ```bash
   openssl rand -hex 32
   ```

2. **HTTPS**: در محیط production حتماً SSL فعال کنید

3. **Firewall**: پورت‌های غیرضروری را ببندید

4. **MongoDB**: احراز هویت MongoDB را فعال کنید

---

## 🛠️ دستورات مدیریت

```bash
# وضعیت سرویس‌ها
sudo systemctl status picochat-backend
sudo systemctl status picochat-frontend

# ری‌استارت
sudo systemctl restart picochat-backend picochat-frontend

# مشاهده لاگ‌ها
sudo journalctl -u picochat-backend -f
sudo journalctl -u picochat-frontend -f

# توقف
sudo systemctl stop picochat-backend picochat-frontend

# حذف کامل
sudo ./install.sh --uninstall
```

---

## 🐛 عیب‌یابی

<details>
<summary><b>مشکلات رایج</b></summary>

### Backend بالا نمی‌آید
```bash
# بررسی لاگ
sudo journalctl -u picochat-backend -n 50

# بررسی MongoDB
sudo systemctl status mongodb
```

### اتصال WebSocket برقرار نمی‌شود
- مطمئن شوید Nginx به درستی proxy می‌کند
- بررسی کنید پورت‌ها باز هستند

### خطای CORS
- `CORS_ORIGINS` را در `.env` بررسی کنید
- مطمئن شوید آدرس frontend صحیح است

### آپلود فایل کار نمی‌کند
- دسترسی پوشه `uploads` را بررسی کنید:
  ```bash
  chmod 755 /opt/picochat/backend/uploads
  ```

</details>

---

## 🤝 مشارکت

از مشارکت شما استقبال می‌کنیم! 

1. Fork کنید
2. Branch جدید بسازید (`git checkout -b feature/amazing-feature`)
3. Commit کنید (`git commit -m 'Add amazing feature'`)
4. Push کنید (`git push origin feature/amazing-feature`)
5. Pull Request بسازید

### گزارش باگ

لطفاً از [Issues](https://github.com/MamawliV2/PicoChat/issues) استفاده کنید.

---

## 📄 لایسنس

این پروژه تحت لایسنس [MIT](LICENSE) منتشر شده است.

```
MIT License

Copyright (c) 2024 Your Name

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 تشکر

- [FastAPI](https://fastapi.tiangolo.com/) - فریمورک backend
- [React](https://react.dev/) - فریمورک frontend
- [Tailwind CSS](https://tailwindcss.com/) - استایل‌دهی
- [Shadcn/UI](https://ui.shadcn.com/) - کامپوننت‌ها
- [Lucide Icons](https://lucide.dev/) - آیکون‌ها
- [MongoDB](https://www.mongodb.com/) - دیتابیس

---

## 📞 پشتیبانی

- 📧 ایمیل: your.email@example.com
- 🐙 GitHub Issues: [لینک](https://github.com/MamawliV2/PicoChat/issues)
- 💬 تلگرام: [@your_telegram](https://t.me/your_telegram)

---

<p align="center">
  ساخته شده با ❤️ در ایران
</p>

<p align="center">
  <a href="#-picochat">⬆️ برگشت به بالا</a>
</p>
