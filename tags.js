// What each idea involves, so the site can match it against what people like and what they can't do.
// One vocabulary for both: a tag can be a taste ("I love water") and a limit ("no water for me").

// Tastes: what you're into / not into.
export const TASTES = [
  ['food', '🍕', 'אוכל'],
  ['spicy', '🌶️', 'חריף'],
  ['sport', '⚽', 'ספורט'],
  ['water', '🌊', 'ים ומים'],
  ['extreme', '🎢', 'אקסטרים'],
  ['nature', '🌳', 'טבע'],
  ['night', '🌙', 'לילה'],
  ['chill', '🛋️', 'צ\'יל'],
  ['creative', '🎨', 'יצירה'],
  ['games', '🎮', 'משחקים'],
  ['animals', '🐶', 'בעלי חיים'],
  ['culture', '🎭', 'הופעות ותרבות'],
  ['horror', '👻', 'אימה ומתח'],
  ['random', '🎲', 'דברים רנדומליים'],
];

// Limits: things that don't work for you. Phrased as what you need, never as a diagnosis.
export const LIMITS = [
  ['access', '♿', 'צריך מקום נגיש לכיסא גלגלים'],
  ['walk', '🚶', 'בלי הליכה ארוכה'],
  ['sport', '💪', 'בלי מאמץ פיזי'],
  ['water', '🏊', 'בלי מים ושחייה'],
  ['height', '🧗', 'בלי גבהים'],
  ['extreme', '🎢', 'בלי אקסטרים'],
  ['dark', '🌑', 'בלי חושך'],
  ['loud', '🔊', 'קשה לי עם רעש וצפיפות'],
  ['animals', '🐾', 'בלי בעלי חיים'],
  ['spicy', '🌶️', 'בלי חריף'],
  ['meat', '🥩', 'צמחוני'],
  ['fish', '🐟', 'בלי דגים'],
  ['late', '🕙', 'צריך לחזור מוקדם'],
  ['car', '🚗', 'בלי נסיעות רחוקות'],
];

export const tasteLabel = Object.fromEntries(TASTES.map(([t, e, l]) => [t, e + ' ' + l]));
export const limitLabel = Object.fromEntries(LIMITS.map(([t, e, l]) => [t, e + ' ' + l]));

const T = {
  // food
  'פיצה': 'food', 'המבורגר': 'food meat', 'סושי': 'food fish', 'שווארמה': 'food meat', 'פלאפל': 'food',
  'סיני / תאילנדי': 'food spicy', 'ראמן': 'food meat', 'טאקו': 'food meat spicy', 'מנגל': 'food meat',
  'פסטה': 'food', 'ארוחת בוקר בבית קפה': 'food chill', 'גלידה': 'food', 'וופל בלגי': 'food', 'דונאטס': 'food',
  'חינקלי / כופתאות': 'food meat', 'מבשלים לבד אצל מישהו': 'food chill creative', 'סופר ומאלתרים': 'food random',
  'שיפודים': 'food meat', 'בר סלטים': 'food', 'סביח': 'food', 'כנפיים': 'food meat spicy',
  'פנקייקים בלילה': 'food night late', 'אופים עוגה ביחד': 'food creative chill', 'פופקורן ונשנושים בלבד': 'food chill',
  'נקניקיות על האש': 'food meat', 'מלאווח / ג\'חנון': 'food', 'פונדו שוקולד': 'food', 'שייקים': 'food',
  'ביס מכל מקום בשוק': 'food walk loud random', 'הדבר הכי חריף בתפריט': 'food spicy random', 'מקום שאף אחד לא היה בו': 'food random',
  // out
  'קולנוע': 'culture chill dark money', 'באולינג': 'games sport money loud', 'חדר בריחה': 'games dark money',
  'קארטינג': 'extreme money car access', 'קניון': 'walk loud', 'גיימינג / פלייסטיישן': 'games chill',
  'קריוקי': 'culture loud money', 'קיר טיפוס': 'sport extreme height money access', 'טרמפולינות': 'sport extreme money access loud',
  'ארקייד': 'games loud money', 'ביליארד': 'games money', 'החלקה על הקרח': 'sport money access',
  'בריכה': 'water sport access money', 'לונה פארק': 'extreme height loud money walk', 'לייזר טאג': 'games sport dark loud money access',
  'פיינטבול': 'games sport extreme money access car', 'זריקת גרזנים': 'extreme money', 'מיני גולף': 'games walk money',
  'סקייטפארק': 'sport extreme access', 'רכיבה על אופניים': 'sport nature access', 'סיבוב קורקינטים': 'sport extreme access',
  'כדורסל במגרש': 'sport access', 'כדורגל': 'sport access', 'כדורעף חופים': 'sport water access',
  'סדנת קדרות / ציור': 'creative chill money', 'מוזיאון': 'culture walk money', 'אקווריום': 'animals culture walk money',
  'ספארי / גן חיות': 'animals walk money car', 'הופעה / סטנדאפ': 'culture loud late money', 'הופעה חיה': 'culture loud late money',
  'ערב משחקי קופסה': 'games chill', 'משחק כדורגל באצטדיון': 'sport loud late money car', 'פאזל ענק ביחד': 'games chill',
  // side quests
  'לראות זריחה ביחד': 'nature random late dark', 'לראות שקיעה מגג': 'chill height', 'לשכב ולהסתכל על כוכבים': 'nature night dark chill car',
  'לעלות על אוטובוס אקראי עד התחנה האחרונה': 'random car', 'קובייה מחליטה כל פנייה בהליכה': 'random walk',
  'לצלם 100 תמונות ביום אחד ולבחור את הכי טובה': 'creative walk', 'לצלם סרט קצר מאפס ביום אחד': 'creative',
  'ללכת רק צפונה עד שמשהו מעניין קורה': 'random walk access', 'להכין ארוחת בוקר בחוץ על גזייה': 'food nature',
  'סיבוב לילה בעיר ריקה': 'night walk late dark', 'לישון בחוץ / פיג\'מה בחצר': 'nature night late dark',
  'שחייה בים בלילה (עם מבוגר)': 'water night extreme dark late access', 'כל אחד קונה ב-20₪ משהו מוזר וטועמים': 'food random',
  'להזמין רק את המנה הכי מוזרה בתפריט': 'food random money', 'למצוא את הפסל הכי מכוער בעיר': 'random walk culture',
  'לבנות מגדל אבנים ענק': 'random nature', 'לקנות מתנות של 10₪ אחד לשני': 'random creative', 'מרתון של סרטים מהילדות': 'chill culture',
  'פיקניק עם רק אוכל בצבע אחד': 'food random creative', 'מרדף אוצרות בשכונה': 'games walk random',
  'לזרוק אצבע על מפה ולנסוע לשם': 'random car money', 'להקליט שיר ביחד': 'creative culture', 'ללטף 10 כלבים שונים': 'animals walk random',
  'לטפס לנקודה הכי גבוהה בעיר': 'height walk sport access', 'לחקור מקום נטוש (בטוח)': 'extreme dark walk access random',
  'לטעום כל טעם בגלידריה': 'food random', 'ללכת 20 ק"מ ביום אחד': 'sport walk access', 'ללכת לאורך החוף עד העיר הבאה': 'walk water sport access nature',
  'מדורה ותפוחי אדמה בגחלים': 'food nature night', 'יום שבו כל החלטה היא "כן"': 'random extreme',
  'לכתוב מכתבים לעצמנו לעוד 5 שנים': 'creative chill', 'לשתול עץ': 'nature', 'לדוג (גם אם לא תופסים כלום)': 'nature water animals chill',
  'למצוא אירוע אקראי שקורה היום ולהגיע': 'random culture', 'פיקניק במקום הכי מוזר שאפשר': 'food random',
  'קיאקים': 'water sport nature money access car', 'לעלות להר לפני הזריחה': 'nature sport walk height dark late access car',
  'לשחזר תמונה ישנה שלנו מהילדות': 'creative random', 'רכבת לעיר שאף אחד לא היה בה': 'random car money walk',
  'אבטיח שלם על החוף': 'food water chill', 'לצייר אחד את השני גרוע ככל האפשר': 'creative games chill', 'סיפורי אימה בחושך': 'dark night chill horror',
  // nature
  'ים': 'water nature chill', 'מסלול הליכה': 'nature walk sport access', 'מעיין': 'nature water walk access car', 'קמפינג': 'nature night late dark car',
  'רפטינג': 'water extreme sport money car', 'גלישה': 'water extreme sport', 'שנורקלינג': 'water sport animals',
  'טיול במדבר': 'nature walk sport access car', 'יער': 'nature walk', 'פיקניק בפארק': 'nature food chill', 'רכיבה על סוסים': 'animals sport nature money car access',
  'שבילי אופניים': 'sport nature', 'תצפית ציפורים': 'animals nature walk', 'פריחה / כלניות': 'nature walk car', 'קטיף פירות': 'nature food walk car money',
  'לילה בשטח': 'nature night dark late car access', 'ג\'יפים': 'extreme nature money car', 'נחל': 'nature water walk access car',
  'צניחה מודרכת / רחיפה': 'extreme height money car',
  // home
  'ערב סרטים': 'chill culture', 'טורניר פיפא': 'games', 'פוקר על במבה': 'games chill', 'משחקי קופסה': 'games chill',
  'מכינים פיצה מאפס': 'food creative', 'קריוקי בסלון': 'culture loud', 'בונים מבצר משמיכות': 'creative chill random',
  'בינג\' של סדרה': 'chill culture', 'כל אחד משמיע שיר ושופטים': 'culture games', 'טריוויה / קאהוט': 'games',
  'ערב טיפוח': 'chill', 'משחקים ישנים': 'games chill', 'מאפיה / איש זאב': 'games', 'ציור על חולצות': 'creative', 'אופים עוגיות': 'food creative chill',
  'פיג\'מה עד הבוקר': 'chill night late',
  // night
  'סיבוב בעיר בלילה': 'night walk late', 'אוכל באמצע הלילה': 'food night late', 'נסיעה בלי יעד': 'random car night',
  'כוכבים מחוץ לעיר': 'nature night dark car late', 'מדורה': 'nature night', 'ים בלילה': 'water night dark late',
  'יריד / פסטיבל': 'culture loud walk late money', 'מסיבה': 'loud night late culture money', 'נקודת תצפית על העיר': 'night height chill car',
  'מאפייה שפתוחה בלילה': 'food night late', 'הקרנה מאוחרת בקולנוע': 'culture dark late money', 'סקייט ברחובות ריקים': 'sport extreme night late access',
  // free
  'סתם הליכה ודיבורים': 'chill walk', 'מגרש בשכונה': 'sport', 'פארק': 'nature chill', 'ספרייה': 'culture chill',
  'שקיעה': 'nature chill', 'סיור גרפיטי בעיר': 'culture walk creative', 'גן שעשועים בלילה': 'night random', 'לצאת עם הכלב של מישהו': 'animals walk',
  'יוגה בפארק': 'sport nature chill', 'טיול צילום': 'creative walk', 'אירוע חינמי בעירייה': 'culture loud', 'ריצה ביחד': 'sport walk access',
  // horror
  'חדר בריחה אימה': 'games dark horror money', 'סרט אימה בקולנוע': 'culture dark horror money', 'מרתון סרטי אימה בבית': 'horror dark chill night',
  'מבוך אימה': 'horror dark extreme loud money', 'סיור רוחות בעיר העתיקה': 'horror night walk culture dark', 'מאפיה בחושך מוחלט': 'games dark horror chill',
  'סיפורי אימה מסביב למדורה': 'horror nature night dark', 'טיול לילה בירח מלא': 'horror nature night dark walk', 'ציד רוחות עם פנסים בפארק': 'horror night dark games walk',
  'מסיבת תחפושות מפחידה': 'horror creative loud night late',
  // gaming
  'טורניר מריו קארט': 'games chill', 'מציאות מדומה VR': 'games money', 'לאן פארטי עם לפטופים': 'games chill late', 'טורניר שחמט': 'games chill',
  'טורניר קלפים': 'games chill', 'משחק תפקידים / D&D': 'games creative chill', 'חדר בריחה אונליין': 'games chill', 'דארטס ופינג פונג': 'games sport money',
  // creative
  'ציור על קנבס בפארק': 'creative nature chill', 'סדנת קרמיקה': 'creative money', 'לצלם טיקטוק מטורף ביחד': 'creative random', 'תחרות קאפקייקס': 'food creative',
  'לכתוב שיר ולהקליט אותו': 'creative culture', 'להכין צמידים': 'creative chill', 'צילומי סטודיו מאולתרים': 'creative random', 'לערוך סרטון מהיציאה הקודמת': 'creative chill',
  // sport
  'אייג\'אמפ': 'sport extreme money access loud', 'פינג פונג': 'sport games', 'בולדרינג': 'sport extreme height money access', 'רולר בלייד': 'sport extreme access',
  'בדמינטון בפארק': 'sport nature', 'אתגר 10,000 צעדים': 'sport walk access', 'משחק כדורגל 5 על 5': 'sport access', 'סאפ בים': 'water sport money access',
};

export function tagsOf(text) {
  return (T[text] || '').split(' ').filter(Boolean);
}

// Keeps "50₪" in one piece inside Hebrew text; without the isolate it renders as "₪50".
const amt = n => `⁦${n}₪⁩`;

// Rough price per person: 0 free · 1 up to 50₪ · 2 up to 100₪ · 3 up to 250₪ · 4 more than that.
export const PRICES = [
  [0, '🆓', 'חינם'],
  [1, '₪', `עד ${amt(50)}`],
  [2, '₪₪', `עד ${amt(100)}`],
  [3, '₪₪₪', `עד ${amt(250)}`],
  [4, '💎', `יותר מ-${amt(250)}`],
];
// What I can spend on one outing (profile). ANY_BUDGET = whatever.
// A different emoji per level: a ₪ at the start of a Hebrew label jumbles the line.
export const ANY_BUDGET = 4;
export const BUDGETS = [
  [0, '🆓 רק חינם'],
  [1, `🪙 עד ${amt(50)}`],
  [2, `💵 עד ${amt(100)}`],
  [3, `💰 עד ${amt(250)}`],
  [4, '🤑 לא משנה'],
];
const PRICEY = new Set([
  'קארטינג', 'פיינטבול', 'רכיבה על סוסים', 'הופעה חיה', 'משחק כדורגל באצטדיון', 'לונה פארק',
  'ספארי / גן חיות', 'הופעה / סטנדאפ', 'לזרוק אצבע על מפה ולנסוע לשם', 'קיאקים',
]);
const VERY_PRICEY = new Set(['רפטינג', 'צניחה מודרכת / רחיפה', 'ג\'יפים']);
const CHEAP_EVEN_WITH_MONEY = new Set(['קולנוע', 'מיני גולף', 'ביליארד', 'ארקייד', 'מוזיאון', 'הקרנה מאוחרת בקולנוע', 'בריכה']);

export function priceOf(text) {
  if (VERY_PRICEY.has(text)) return 4;
  if (PRICEY.has(text)) return 3;
  const tags = tagsOf(text);
  if (tags.includes('money')) return CHEAP_EVEN_WITH_MONEY.has(text) ? 1 : 2;
  if (tags.includes('food')) return 1;
  return tags.length ? 0 : null; // own cards: unknown price
}

// Age: some ideas have a minimum age, others are fine but need an adult along below some age.
// [min age, adult needed under this age, why]
const AGE = {
  'מבוך אימה': [12, 14, ''],
  'חדר בריחה אימה': [10, 14, ''],
  'סרט אימה בקולנוע': [0, 14, 'תלוי בסרט'],
  'סיור רוחות בעיר העתיקה': [0, 14, ''],
  'טיול לילה בירח מלא': [0, 14, ''],
  'ציד רוחות עם פנסים בפארק': [0, 12, ''],
  'אייג\'אמפ': [5, 0, ''],
  'בולדרינג': [6, 12, ''],
  'סאפ בים': [8, 14, ''],
  'מסיבה': [16, 0, ''],
  'צניחה מודרכת / רחיפה': [16, 18, 'צריך אישור הורים'],
  'הופעה / סטנדאפ': [16, 0, ''],
  'נסיעה בלי יעד': [17, 0, 'צריך מישהו עם רישיון'],
  'פיינטבול': [12, 0, ''],
  'זריקת גרזנים': [12, 16, ''],
  'קארטינג': [10, 0, ''],
  'ג\'יפים': [0, 17, 'צריך נהג עם רישיון'],
  'שחייה בים בלילה (עם מבוגר)': [0, 18, ''],
  'לחקור מקום נטוש (בטוח)': [0, 16, ''],
  'לילה בשטח': [0, 16, ''],
  'קמפינג': [0, 16, ''],
  'כוכבים מחוץ לעיר': [0, 14, ''],
  'לעלות להר לפני הזריחה': [0, 14, ''],
  'אוכל באמצע הלילה': [0, 14, ''],
  'מאפייה שפתוחה בלילה': [0, 14, ''],
  'סיבוב לילה בעיר ריקה': [0, 14, ''],
  'סיבוב בעיר בלילה': [0, 14, ''],
  'גן שעשועים בלילה': [0, 14, ''],
  'סקייט ברחובות ריקים': [0, 14, ''],
  'הקרנה מאוחרת בקולנוע': [0, 13, ''],
  'הופעה חיה': [0, 14, ''],
  'משחק כדורגל באצטדיון': [0, 12, ''],
  'רפטינג': [6, 12, ''],
  'קיאקים': [6, 12, ''],
  'לזרוק אצבע על מפה ולנסוע לשם': [0, 14, ''],
  'רכבת לעיר שאף אחד לא היה בה': [0, 12, ''],
  'לעלות על אוטובוס אקראי עד התחנה האחרונה': [0, 12, ''],
};

// What an idea means for someone of this age: hard = not allowed, soft = only with an adult.
export function ageCheck(text, age) {
  const r = AGE[text];
  if (!r || !age) return { hard: null, soft: null };
  const [min, adultUnder, why] = r;
  if (min && age < min) return { hard: `🔞 מגיל ${min}` + (why ? ` · ${why}` : ''), soft: null };
  if (adultUnder && age < adultUnder) return { hard: null, soft: '👨‍👩‍👦 רק עם מבוגר' + (why ? ` · ${why}` : '') };
  return { hard: null, soft: null };
}
