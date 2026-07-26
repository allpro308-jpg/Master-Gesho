export const config = {
  appName: 'مستر جيشو',
  tagline: 'منصتك العربية لأدوات الذكاء الاصطناعي',
  version: '1.0.0',
  categories: [
    'كتابة بالذكاء',
    'أدوات الصور',
    'أدوات البيانات',
    'أدوات المطورين',
    'أدوات مالية',
    'الإنتاجية',
    'التصميم',
    'التسويق',
  ],
  pricingOptions: ['مجاني', 'مجاني جزئياً', 'مدفوع', 'مفتوح المصدر'] as const,
  sortOptions: [
    { id: 'trending', label: 'الأكثر رواجاً' },
    { id: 'newest', label: 'الأحدث' },
    { id: 'top-rated', label: 'الأعلى تقييماً' },
    { id: 'most-voted', label: 'الأكثر تصويتاً' },
  ],
};
