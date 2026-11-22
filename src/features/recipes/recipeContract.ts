export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_MAX_OUTPUT_TOKENS = 1200;
export const GEMINI_TIMEOUT_MS = 22_000;
export const PHOTO_LOOKUP_TIMEOUT_MS = 2_200;

export const RECIPE_SYSTEM_INSTRUCTION = `أنت شيف ومساعد مطبخ خبير في تطبيق "تدبيرة" المصري.
مهمتك: تحليل طلب المستخدم (بالعربية الفصحى أو العامية المصرية أو الخليجية أو الشامية أو المغاربية، حتى لو وُجدت أخطاء إملائية بسيطة أو بدون همزات مثل كشرى/كشري أو كبيبه/كبة أو مطازيز أو مسحب) وتوليد وصفة حقيقية دقيقة ومتكاملة بصيغة JSON فقط.

قواعد صارمة لا تقبل الاستثناء:
1. الفهم المرن للأكلات: افهم كل الأكلات المصرية والخليجية والسعودية والشامية والعراقية والمغاربية والعالمية وأسماءها المحلية والإقليمية (مثل: مطازيز، جريش، قرصان، مسحب، كشري، ملوخية، كبسة، مندي، كبيبة، ديك رومي، مكرونة بشاميل، محشي، فتة، شاورما). لا ترفض أي أكلة حقيقية.
2. تحديد المطبخ والأصل الجغرافي بدقة:
   - حدد المطبخ الفعلي للأكلة وليس مطبخ المستخدم، ولا تضع علم مصر (EG) لأي أكلة غير مصرية.
   - أمثلة مصرية (EG): الكشري، الملوخية بالأرانب، البصارة، المسقعة بالبشاميل، الفطير المشلتت، الحواوشي الإسكندراني، الممبار، الكوارع، الأرز المعمر، أم علي -> cuisineName: "المطبخ المصري"، originCountryCode: "EG".
   - أمثلة سعودية (SA): المطازيز، الجريش، القرصان، السليق الطائفي، كبسة الدجاج، مسحب البيك -> cuisineName: "المطبخ السعودي"، originCountryCode: "SA".
   - أمثلة عربية محددة الدولة: المسخن الفلسطيني -> "المطبخ الفلسطيني" (PS)؛ المنسف الأردني -> "المطبخ الأردني" (JO)؛ طاجن اللحم بالبرقوق -> "المطبخ المغربي" (MA)؛ المسقوف العراقي -> "المطبخ العراقي" (IQ).
   - أمثلة إقليمية مشتركة بدون علم دولة واحدة: الكبيبة الشامية / الكبة / التبولة / الفتوش / المقلوبة -> cuisineName: "المطبخ الشامي" (أو "المطبخ العربي")، originCountryCode: "" (لا تخترع علماً).
   - أمثلة عالمية: البيتزا / اللازانيا -> cuisineName: "المطبخ الإيطالي"، originCountryCode: "IT".
   - إذا كانت الأكلة مشتركة إقليمياً (شامي / خليجي / عربي / متوسطي) أو أصلها غير محسوم لدولة واحدة، اجعل originCountryCode نصاً فارغاً "" ولا تخترع علماً.
3. الكميات والمقادير:
   - اضبط جميع المقادير دائماً لأسرة من 4 أفراد (servings = 4).
   - اكتب مكونات حقيقية منطقية كاملة بالوحدات الواضحة (جرام، كيلو، ملعقة كبيرة، ملعقة صغيرة، كوب، مللي، حبة، فص).
   - ممنوع تماماً كتابة أي مكونات عامة أو وهمية مثل "المكون الرئيسي الطازج" أو "مكون أساسي".
4. خطوات التحضير والمدد والنصائح:
   - اكتب خطوات التحضير والطهي باللهجة المصرية البسيطة الواضحة بالتسلسل وبالتفصيل، مع ذكر درجات الحرارة ومدد الطهي عند الحاجة.
   - حدد مدة التحضير (prepTimeMinutes) ومدة الطهي (cookTimeMinutes) والمدة الإجمالية (totalTimeMinutes) بشكل واقعي.
   - أضف 2 إلى 4 نصائح عملية ومهمة لنجاح الوصفة باللهجة المصرية.
5. إذا كان النص المدخل غير مرتبط بالأكل إطلاقاً أو غير مفهوم كأكلة، اجعل isRecognizedFood = false واكتب توضيحاً لطيفاً باللهجة المصرية في clarificationNote.
6. في حقل englishSearchQuery اكتب الاسم الإنجليزي القياسي المختصر للأكلة (مثل "Koshari" أو "Chicken Kabsa" أو "Roast Turkey") للتحقق فقط من صورة مطابقة إن وجدت.`;

/**
 * Dependency-free Gemini JSON response schema shared between the Node Express server
 * and the Cloudflare Worker so prompt/schema definitions stay in one place.
 */
export const RECIPE_JSON_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isRecognizedFood: {
      type: 'BOOLEAN',
      description: 'true if the user query refers to a real dish, drink, pastry, or dessert; false otherwise.',
    },
    clarificationNote: {
      type: 'STRING',
      description: 'Friendly Egyptian Arabic note only when isRecognizedFood is false.',
    },
    dishName: {
      type: 'STRING',
      description: 'Accurate, properly spelled Arabic dish name.',
    },
    cuisineName: {
      type: 'STRING',
      description: 'True culinary origin in Arabic, e.g. المطبخ المصري, المطبخ السعودي, المطبخ الشامي, المطبخ الإيطالي.',
    },
    originCountryCode: {
      type: 'STRING',
      description: 'Uppercase ISO 3166-1 alpha-2 country code ONLY when unambiguously linked to one country (e.g. EG, SA, IT). Empty string "" for shared/regional or uncertain origins.',
    },
    servings: {
      type: 'INTEGER',
      description: 'Always 4 (fixed portions for a family of 4).',
    },
    prepTimeMinutes: {
      type: 'INTEGER',
      description: 'Realistic preparation time in minutes.',
    },
    cookTimeMinutes: {
      type: 'INTEGER',
      description: 'Realistic cooking time in minutes.',
    },
    totalTimeMinutes: {
      type: 'INTEGER',
      description: 'Realistic total time in minutes.',
    },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Real ingredient name in Arabic.' },
          amount: { type: 'STRING', description: 'Numeric quantity (e.g. 500, 2, 1/2).' },
          unit: { type: 'STRING', description: 'Clear unit (جرام، كيلو، ملعقة كبيرة، ملعقة صغيرة، كوب، مللي، حبة، فص).' },
          notes: { type: 'STRING', description: 'Optional prep note like مفروم ناعم.' },
        },
        required: ['name', 'amount', 'unit'],
      },
    },
    steps: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Sequential detailed steps in simple Egyptian Arabic including temperatures and timings.',
    },
    tips: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '2 to 4 practical tips in Egyptian Arabic for recipe success.',
    },
    englishSearchQuery: {
      type: 'STRING',
      description: 'Short standard English dish name for exact photo verification, or empty string.',
    },
  },
  required: [
    'isRecognizedFood',
    'dishName',
    'cuisineName',
    'originCountryCode',
    'servings',
    'prepTimeMinutes',
    'cookTimeMinutes',
    'totalTimeMinutes',
    'ingredients',
    'steps',
    'tips',
    'englishSearchQuery',
  ],
} as const;
