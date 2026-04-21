/**
 * src/lib/services/categorization.js
 * ----------------------------------
 * FT-019: Dedicated service for transaction categorization and voice heuristics.
 * Data-driven categorization using keywords from database.
 */

// FALLBACK taxonomy (used if DB taxonomy is empty)
export const FALLBACK_TAXONOMY = {
  categories: [
    {
      slug: 'income',
      keywords_ru: ['доход', 'приход', 'выручк', 'прода', 'продал'],
      keywords_en: ['income', 'revenue', 'sale', 'sold'],
    },
    {
      slug: 'expense',
      keywords_ru: ['расход', 'трат', 'ушло', 'купил', 'заплатил', 'оплатил'],
      keywords_en: ['expense', 'spending', 'bought', 'paid', 'purchased'],
    },
  ],
  subCategories: [
    {
      slug: 'opex',
      keywords_ru: ['опер', 'текущ', 'хоз'],
      keywords_en: ['opex', 'operating', 'running'],
    },
    {
      slug: 'capex',
      keywords_ru: ['кап', 'инвест', 'оборуд', 'техник', 'трактор', 'машин'],
      keywords_en: ['capex', 'capital', 'investment', 'equipment', 'machinery', 'tractor'],
    },
  ],
  opexSubCategories: [
    {
      id: 'fuel',
      slug: 'fuel',
      forecasting_type: 'trend',
      keywords_ru: ['топлив', 'бензин', 'дизель', 'солярк', 'пропан'],
      keywords_en: ['fuel', 'petrol', 'diesel', 'solyarka', 'propan'],
    },
    {
      id: 'salary',
      slug: 'salary',
      forecasting_type: 'fixed',
      keywords_ru: [
        'зарплат',
        'оклад',
        'проезд',
        'билет',
        'виза',
        'экзамен',
        'патент',
        'сертификат',
      ],
      keywords_en: ['salary', 'travel', 'visa', 'exam', 'patent', 'certificate'],
    },
    {
      id: 'food',
      slug: 'food',
      forecasting_type: 'trend',
      keywords_ru: ['еда', 'продукт', 'пищ', 'хлеб', 'молоко', 'куриц', 'мясо', 'яйц', 'яиц'],
      keywords_en: ['food', 'bread', 'milk', 'chicken', 'meat', 'egg'],
    },
    {
      id: 'inventory',
      slug: 'inventory',
      forecasting_type: 'fixed',
      keywords_ru: ['запчаст', 'деталь', 'инвентар', 'гвозд'],
      keywords_en: ['spare', 'part', 'inventory', 'nail'],
    },
    {
      id: 'tools',
      slug: 'tools',
      forecasting_type: 'fixed',
      keywords_ru: ['инструмент', 'лопат', 'грабл', 'секатор', 'пила'],
      keywords_en: ['tool'],
    },
    {
      id: 'seeds',
      slug: 'seeds',
      forecasting_type: 'fixed',
      keywords_ru: ['семен', 'рассад', 'сажен'],
      keywords_en: ['seed', 'plant'],
    },
    {
      id: 'fertilizers',
      slug: 'fertilizers',
      forecasting_type: 'trend',
      keywords_ru: ['удобрен', 'навоз', 'селитр', 'карбамид', 'фосфат'],
      keywords_en: ['fertilizer', 'nitrate'],
    },
    {
      id: 'pesticides',
      slug: 'pesticides',
      forecasting_type: 'fixed',
      keywords_ru: [
        'пестицид',
        'гербицид',
        'инсектицид',
        'фунгицид',
        'стомп',
        'бандур',
        'деметр',
        'китайк',
        'би-58',
        'гаучо',
        'лямбда',
        'цигалотрин',
        'самум',
      ],
      keywords_en: ['pesticide', 'herbicide', 'stomp', 'bandur', 'demetra'],
    },
    {
      id: 'irrigation',
      slug: 'irrigation',
      forecasting_type: 'trend',
      keywords_ru: ['насос', 'орошен', 'полив', 'вода', 'водовоз', 'шланг', 'капельн', 'поле'],
      keywords_en: ['pump', 'irrigate', 'field'],
    },
    {
      id: 'utilities',
      slug: 'utilities',
      forecasting_type: 'fixed',
      keywords_ru: [
        'свет',
        'электроэнерг',
        'электричеств',
        'энергоснабжен',
        'энерго',
        'энерг',
        'коммунал',
        'газ',
        'счет',
        'квитанц',
      ],
      keywords_en: ['utilities', 'electricity', 'energy', 'bill', 'invoice'],
    },
    {
      id: 'contractLabor',
      slug: 'contractLabor',
      forecasting_type: 'fixed',
      keywords_ru: ['сезон', 'рабоч', 'найм', 'бригад'],
      keywords_en: ['seasonal', 'labor', 'hired'],
    },
    {
      id: 'construction',
      slug: 'construction',
      forecasting_type: 'fixed',
      keywords_ru: ['строй', 'кирпич', 'цемент', 'доск', 'ремонт'],
      keywords_en: ['build', 'construction'],
    },
  ],
};

/**
 * Strips filler words to get the raw candidate noun for description.
 */
export function extractItemName(rawText, language = 'ru') {
  if (!rawText) return language === 'en' ? 'Voice entry' : 'Голосовая запись';

  const fillerWords = new Set([
    'я',
    'мы',
    'он',
    'она',
    'они',
    'ты',
    'вы',
    'купил',
    'купила',
    'купили',
    'куплено',
    'куплена',
    'потратил',
    'потратила',
    'потратили',
    'заплатил',
    'заплатила',
    'заплатили',
    'оплатил',
    'оплатила',
    'оплатили',
    'взял',
    'взяла',
    'взяли',
    'приобрел',
    'приобрела',
    'приобрели',
    'потратился',
    'потратилась',
    'продал',
    'продала',
    'продали',
    'на',
    'за',
    'по',
    'в',
    'из',
    'для',
    'со',
    'от',
    'до',
    'при',
    'под',
    'над',
    'без',
    'через',
    'между',
    'и',
    'или',
    'но',
    'же',
    'бы',
    'ли',
    'не',
    'ни',
    'а',
    'то',
    'это',
    'этот',
    'эта',
    'эти',
    'тот',
    'та',
    'те',
    'есть',
    'был',
    'была',
    'было',
    'были',
    'рублей',
    'рубля',
    'рубль',
    'руб',
    'р',
    'тыс',
    'тысяч',
    'тысячи',
    'штук',
    'шт',
    'упак',
    'упаковка',
    'пачка',
    'пачку',
    'пачки',
    'мешок',
    'мешка',
    'сегодня',
    'вчера',
    'недавно',
    'давно',
    'утром',
    'вечером',
    'ночью',
    'сколько',
    'какой',
    'которая',
    'который',
    'i',
    'we',
    'he',
    'she',
    'they',
    'you',
    'bought',
    'purchased',
    'paid',
    'spent',
    'got',
    'acquired',
    'received',
    'sold',
    'for',
    'on',
    'the',
    'a',
    'an',
    'of',
    'from',
    'to',
    'at',
    'in',
    'with',
    'by',
    'about',
    'some',
    'few',
    'much',
    'many',
    'lot',
    'lots',
    'today',
    'yesterday',
    'recently',
    'this',
    'that',
    'these',
    'those',
    'rubles',
    'rub',
    'cost',
    'price',
    'worth',
    'thousand',
    'hundred',
  ]);

  const words = rawText
    .toLowerCase()
    .replace(/[0-9]+(?:[.,][0-9]+)?/g, '') // remove numbers
    .replace(/[.,!?;:()[\]]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !fillerWords.has(w));

  if (words.length === 0) return rawText;
  return words[0];
}

/**
 * Normalizes a raw noun to a canonical item name using database-driven synonyms.
 */
export function normalizeItemName(raw, options = {}) {
  const { language = 'ru', opexSubCategories = [] } = options;
  const r = (raw || '').toLowerCase().trim();

  const cats =
    opexSubCategories.length > 0 ? opexSubCategories : FALLBACK_TAXONOMY.opexSubCategories;

  for (const cat of cats) {
    const keywords = (language === 'ru' ? cat.keywords_ru : cat.keywords_en) || [];
    if (keywords.some((k) => r === k || r.startsWith(k))) {
      // Prefer localized label, then generic label, then slug, then the raw id
      const label =
        language === 'ru'
          ? cat.label_ru || cat.label || cat.slug || cat.id
          : cat.label_en || cat.label || cat.slug || cat.id;
      return label
        ? label.charAt(0).toUpperCase() + label.slice(1)
        : r.charAt(0).toUpperCase() + r.slice(1);
    }
  }

  return r.charAt(0).toUpperCase() + r.slice(1);
}

/**
 * Heuristic parser for voice/text input.
 */
export function parseHeuristics(text, options = {}) {
  const {
    language = 'ru',
    descriptionMappings = {},
    projects = [],
    voiceSelection = { type: 'expense', category: 'opex' },
    taxonomy = FALLBACK_TAXONOMY,
  } = options;

  const { categories = [], subCategories = [], opexSubCategories = [] } = taxonomy;

  let lowerText = (text || '').toLowerCase();

  // 1. Convert words to numbers (ru/en)
  const wordsToNumbers = {
    один: '1',
    одна: '1',
    одно: '1',
    one: '1',
    два: '2',
    две: '2',
    two: '2',
    три: '3',
    three: '3',
    четыре: '4',
    four: '4',
    пять: '5',
    five: '5',
    шесть: '6',
    six: '6',
    семь: '7',
    seven: '7',
    восемь: '8',
    eight: '8',
    девять: '9',
    nine: '9',
    десять: '10',
    ten: '10',
    одиннадцать: '11',
    eleven: '11',
    двенадцать: '12',
    twelve: '12',
    двести: '200',
    триста: '300',
    четыреста: '400',
    пятьсот: '500',
    шестьсот: '600',
    семьсот: '700',
    восемьсот: '800',
    девятьсот: '900',
    полтора: '1.5',
    полторы: '1.5',
    полмиллиона: '0.5 миллиона',
  };
  for (const [word, num] of Object.entries(wordsToNumbers)) {
    lowerText = lowerText.replace(new RegExp('(^|\\s)' + word + '(?=\\s|$|-)', 'g'), '$1' + num);
  }

  lowerText = lowerText.replace(/(\d+)\s*(?:hundred|сто)\b/g, (m, d) => parseInt(d) * 100);
  lowerText = lowerText.replace(/(^|\s)hundred\b/g, '$1100');
  lowerText = lowerText.replace(/(^|\s)сто\b/g, '$1100');
  lowerText = lowerText.replace(/(\d+)\s+(?:миллион|млн|million|тысяч|тыс|thousand)/g, (m) =>
    m.replace(/\s+/, ' ')
  );

  const normalizedText = lowerText
    .replace(/(\d)[.,\s](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d)\s+(?=\d)/g, '$1');

  // 2. Amount and Liters extraction
  const literMatch = normalizedText.match(/(\d+(?:\.\d+)?)\s*(?:литр(?:ов|а)?|л\b)/);
  const liters = literMatch ? parseFloat(literMatch[1]) : 0;

  let amount = 0; // default; overwritten by whichever branch matches below
  let isK = false;
  let isM = false;

  const compositeMillionMatch = normalizedText.match(
    /(?:(\d+(?:\.\d+)?)\s*)?(?:миллион(?:а|ов)?|мильон|млн|million|m\b)\s*(\d+(?:\.\d+)?)/
  );
  const compositeThousandMatch = normalizedText.match(
    /(?:(\d+(?:\.\d+)?)\s*)?(?:тысяч(?:а|и|у)?|тыс|thousand|k\b)\s*(\d+(?:\.\d+)?)/
  );
  const millionMatch = normalizedText.match(
    /(?:(\d+(?:\.\d+)?)\s*)?(?:миллион(?:а|ов)?|мильон|млн|million|m\b)/
  );
  const thousandMatch = normalizedText.match(
    /(?:(\d+(?:\.\d+)?)\s*)?(?:тысяч(?:а|и|у)?|тыс|thousand|k\b)/
  );

  if (compositeMillionMatch) {
    let mPart = compositeMillionMatch[1] ? parseFloat(compositeMillionMatch[1]) : 1;
    let tailPart = parseFloat(compositeMillionMatch[2]);
    let tailValue = tailPart > 0 && tailPart < 1000 ? tailPart * 1000 : tailPart;
    amount = mPart * 1000000 + tailValue;
    isM = true;
  } else if (compositeThousandMatch) {
    let kPart = compositeThousandMatch[1] ? parseFloat(compositeThousandMatch[1]) : 1;
    let hPart = parseFloat(compositeThousandMatch[2]);
    amount = kPart * 1000 + hPart;
  } else if (millionMatch) {
    let mPart = millionMatch[1] ? parseFloat(millionMatch[1]) : 1;
    amount = mPart * 1000000;
    isM = true;
  } else if (thousandMatch) {
    let kPart = thousandMatch[1] ? parseFloat(thousandMatch[1]) : 1;
    amount = kPart * 1000;
    isK = true;
  } else {
    const amountMatch =
      normalizedText.match(/(?:на|всего)\s*(\d+(?:\.\d+)?)/) ||
      normalizedText.match(/(\d+(?:\.\d+)?)\s*(?:руб|р\b|долл|\$)/);
    amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  }

  if (amount === 0) {
    const allNumbers = normalizedText.match(/\d+(?:\.\d+)?/g);
    if (allNumbers) {
      const unusedNumber = allNumbers.find((n) => parseFloat(n) !== liters);
      if (unusedNumber) amount = parseFloat(unusedNumber);
      else if (liters === 0) amount = parseFloat(allNumbers[0]);
    }
  }

  // 3. Categorization based on keywords from DB
  const descClean = (text || '').toLowerCase();
  const mappedSub = descriptionMappings[descClean];

  // 3.1 Detect Type (Income/Expense)
  let detectedType = voiceSelection.type;
  for (const cat of categories) {
    const keywords = [...(cat.keywords_ru || []), ...(cat.keywords_en || [])];
    if (keywords.some((k) => normalizedText.includes(k))) {
      detectedType = cat.slug;
      break;
    }
  }

  // 3.2 Detect Category (opex/capex/etc)
  let detectedCategory = detectedType === 'income' ? 'operationalRevenue' : 'opex';
  for (const sub of subCategories) {
    const keywords = [...(sub.keywords_ru || []), ...(sub.keywords_en || [])];
    if (keywords.some((k) => normalizedText.includes(k))) {
      detectedCategory = sub.slug;
      break;
    }
  }

  // 3.3 Detect Sub-category (fuel/salary/etc)
  let detectedSub = mappedSub || '';
  if (!detectedSub) {
    for (const cat of opexSubCategories) {
      const keywords = [...(cat.keywords_ru || []), ...(cat.keywords_en || [])];
      if (keywords.some((k) => normalizedText.includes(k))) {
        detectedSub = cat.slug || cat.id;
        break;
      }
    }
  }

  // 3.4 Specific Fuel Logic (hardcoded types for now as they are schema-fixed)
  const isFuel =
    detectedSub === 'fuel' ||
    normalizedText.match(
      /топлив|бензин|дизель|солярк|пропан|fuel|petrol|diesel|solarka|solyarka|propan/
    );
  const isPetrol = normalizedText.match(/бензин|petrol/);
  const isDiesel = normalizedText.match(/дизель|солярк|diesel|solarka|solyarka/);
  const isPropan = normalizedText.match(/пропан|propan|lp-gas/);
  const fuelType = isPetrol ? 'petrol' : isDiesel ? 'diesel' : isPropan ? 'propan' : '';

  const rawCandidate = extractItemName(text, language);
  const cleanDescription = normalizeItemName(rawCandidate, { language, opexSubCategories });

  return {
    type: detectedType,
    category: detectedCategory,
    amount: amount,
    liters: liters,
    isFuel: !!isFuel,
    fuelType: fuelType,
    isK: isK,
    isM: isM,
    subCategory: detectedSub,
    projectId: projects[0]?.id || 'all_projects',
    description: cleanDescription,
    fullTranscript: text,
    date: new Date().toISOString(),
  };
}
