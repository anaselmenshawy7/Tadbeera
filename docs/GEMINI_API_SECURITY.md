# حماية مفتاح Gemini وتشغيل الخادم عبر Cloudflare Workers (مجاناً بدون بطاقة بنكية)

## ما الذي تغيّر في الكود؟

- مفتاح `GEMINI_API_KEY` لا يُحقن أبداً في ملفات JavaScript أو APK/AAB أو تحديثات OTA.
- `server.ts` يظل كما هو للتطوير المحلي ومعاينة Google AI Studio.
- تم تجهيز خادم Cloudflare Worker في `worker/index.ts` وإعداده في `wrangler.toml` للعمل على خطة **Workers Free** (100,000 طلب/يوم مجاناً بدون بطاقة بنكية أو تفعيل فوترة).
- الـ Worker يستقبل `/api/health` و`/api/recipes/generate`، ويقرأ `GEMINI_API_KEY` كـ Encrypted Secret فقط، ويرسله عبر الترويسة الآمنة `x-goog-api-key` إلى نموذج `gemini-2.5-flash`.
- يطبق الـ Worker طبقات حماية ضد إساءة الاستخدام:
  - التحقق من `Origin` المسموح بها (`ALLOWED_ORIGINS`) لتطبيق Android (`https://localhost`) والويب.
  - فحص نوع المحتوى (`application/json`) وحد أقصى لحجم الطلب (`64KB`).
  - منع الروابط والتعليمات المشبوهة (Prompt Injection) في حقل البحث.
  - تحديد معدل الطلبات لكل IP (`RATE_LIMIT_MAX_PER_MIN`، افتراضياً 15 طلباً/دقيقة).
  - كاش حافة مجاني عبر `caches.default` لتقليل استهلاك حصة Gemini للأكلات المتكررة.
- مسارات `.github/workflows/` تمرر الآن `VITE_GEMINI_API_BASE_URL` فقط أثناء بناء التطبيق.

## خطوات النشر (المرحلة الثانية — تُنفذ فقط عند قرارك)

1. أنشئ حساباً مجانياً على Cloudflare (بدون إدخال بطاقة بنكية، والتزم بخطة Workers Free فقط).
2. اربط مستودع GitHub أو انشر الـ Worker من الجذر باستخدام `wrangler.toml`:
   - لا تفعّل R2 أو Workers Paid أو Durable Objects.
3. أضف `GEMINI_API_KEY` كـ **Secret** في إعدادات الـ Worker (من لوحة Cloudflare أو عبر `npx wrangler secret put GEMINI_API_KEY`).
4. تأكد من عمل الرابط عبر فتح `https://YOUR-WORKER.workers.dev/api/health` وظهور `{"ok":true}`.
5. في GitHub > Settings > Secrets and variables > Actions، أضف Secret باسم `VITE_GEMINI_API_BASE_URL` بقيمة الرابط الأساسي فقط (بدون `/api` وبدون شرطة مائلة أخيرة).
6. أضف أي نطاق ويب مستقبلي إلى `ALLOWED_ORIGINS` في `wrangler.toml` أو إعدادات الـ Worker.
