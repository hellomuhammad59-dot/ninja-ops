# ⚡ Ninja OPS — Captain Performance Dashboard

## خطوات النشر (5 خطوات فقط)

---

### 1️⃣ أنشئ حساب GitHub
- روح: https://github.com
- اضغط **Sign up** وسجّل بإيميلك

---

### 2️⃣ ارفع المشروع على GitHub
- في GitHub اضغط **+** (يمين الصفحة) ← **New repository**
- الاسم: `ninja-ops`
- اختر **Public** ← **Create repository**
- في الصفحة اضغط **uploading an existing file**
- **اسحب كل الملفات** من هذا الفولدر (ما عدا node_modules)
- اضغط **Commit changes**

---

### 3️⃣ احصل على مفتاح Anthropic API
- روح: https://console.anthropic.com
- سجّل حساب (تحتاج تضيف بطاقة — 5$ تكفيك وقت طويل)
- اضغط **API Keys** ← **Create Key**
- انسخ المفتاح (يبدأ بـ `sk-ant-...`)

---

### 4️⃣ انشر على Vercel (مجاني)
- روح: https://vercel.com
- اضغط **Sign Up** ← **Continue with GitHub**
- اضغط **Add New Project** ← اختر `ninja-ops`
- افتح **Environment Variables** وأضف:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** مفتاحك اللي نسخته
- اضغط **Deploy** ✅

---

### 5️⃣ رابطك جاهز!
بعد دقيقة يطلعلك رابط مثل:
`https://ninja-ops-xxx.vercel.app`

شاركه لأي أحد 🎉
