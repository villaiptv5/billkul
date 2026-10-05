import type { BusinessType, Lang } from './types';

export interface SeedItem {
  name: string;
  unit: string;
}

type Seed = Record<Lang, SeedItem[]>;

/** Starter price lists. Prices are left at zero for the owner to fill in. */
export const SAMPLE_ITEMS: Record<BusinessType, Seed> = {
  computer: {
    en: [
      { name: 'Laptop (used)', unit: 'piece' },
      { name: '8 GB DDR4 RAM', unit: 'piece' },
      { name: 'SSD 256 GB', unit: 'piece' },
      { name: 'Windows installation', unit: 'job' },
      { name: 'Printer toner', unit: 'piece' },
    ],
    ur: [
      { name: 'لیپ ٹاپ (استعمال شدہ)', unit: 'عدد' },
      { name: '8 جی بی DDR4 ریم', unit: 'عدد' },
      { name: 'ایس ایس ڈی 256 جی بی', unit: 'عدد' },
      { name: 'ونڈوز انسٹالیشن', unit: 'کام' },
      { name: 'پرنٹر ٹونر', unit: 'عدد' },
    ],
  },
  general: {
    en: [
      { name: 'Rice', unit: 'kg' },
      { name: 'Cooking oil', unit: 'litre' },
      { name: 'Sugar', unit: 'kg' },
      { name: 'Tea', unit: 'pack' },
    ],
    ur: [
      { name: 'چاول', unit: 'کلو' },
      { name: 'کوکنگ آئل', unit: 'لیٹر' },
      { name: 'چینی', unit: 'کلو' },
      { name: 'چائے کی پتی', unit: 'پیکٹ' },
    ],
  },
  services: {
    en: [
      { name: 'Service visit', unit: 'visit' },
      { name: 'Labour', unit: 'hour' },
      { name: 'Installation', unit: 'job' },
    ],
    ur: [
      { name: 'سروس وزٹ', unit: 'وزٹ' },
      { name: 'مزدوری', unit: 'گھنٹہ' },
      { name: 'انسٹالیشن', unit: 'کام' },
    ],
  },
  freelancer: {
    en: [
      { name: 'Design work', unit: 'hour' },
      { name: 'Website page', unit: 'page' },
      { name: 'Consultation', unit: 'hour' },
    ],
    ur: [
      { name: 'ڈیزائن کا کام', unit: 'گھنٹہ' },
      { name: 'ویب سائٹ کا صفحہ', unit: 'صفحہ' },
      { name: 'مشاورت', unit: 'گھنٹہ' },
    ],
  },
  wholesale: {
    en: [
      { name: 'Goods', unit: 'carton' },
      { name: 'Goods', unit: 'dozen' },
      { name: 'Delivery charge', unit: 'trip' },
    ],
    ur: [
      { name: 'سامان', unit: 'کارٹن' },
      { name: 'سامان', unit: 'درجن' },
      { name: 'ڈیلیوری چارج', unit: 'چکر' },
    ],
  },
  other: { en: [], ur: [] },
};

export const COMMON_UNITS: Record<Lang, string[]> = {
  en: ['piece', 'kg', 'litre', 'metre', 'hour', 'day', 'job', 'box', 'dozen', 'pack'],
  ur: ['عدد', 'کلو', 'لیٹر', 'میٹر', 'گھنٹہ', 'دن', 'کام', 'ڈبہ', 'درجن', 'پیکٹ'],
};
