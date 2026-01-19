/**
 * Technical Recruitment News Scraper
 * Scraped wekelijks nieuws van Nederlandse recruitment en techniek bronnen
 */

const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RecruitinBot/1.0)'
  }
});

// Categorien met bijbehorende keywords voor classificatie
const CATEGORIES = {
  'Technisch Personeel Tekort & Personeelskrapte': {
    keywords: ['tekort', 'krapte', 'schaarste', 'vacature', 'personeelstekort', 'arbeidsmarkt krap', 'moeilijk te vinden'],
    priority: true
  },
  'Automation & Engineering Recruitment': {
    keywords: ['automation', 'engineering', 'engineer', 'automatisering', 'robotica', 'plc', 'industrieel'],
    priority: true
  },
  'Salarissen & Arbeidsvoorwaarden Techniek 2026': {
    keywords: ['salaris', 'loon', 'cao', 'arbeidsvoorwaarden', 'beloning', 'secundair'],
    priority: false
  },
  'AI & Recruitment Tech Trends 2026': {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'recruitment tech', 'hr tech', 'chatbot', 'automatisering recruitment'],
    priority: true
  },
  'HR Trends & Arbeidsmarkt 2026': {
    keywords: ['hr trend', 'arbeidsmarkt', 'werkgelegenheid', 'flexwerk', 'zzp', 'detachering'],
    priority: false
  },
  'Elektrotechniek & Installatietechniek': {
    keywords: ['elektrotechniek', 'installatie', 'elektricien', 'elektromonteur', 'hoogspanning', 'laagspanning'],
    priority: false
  },
  'Werktuigbouwkunde & Mechanical Engineering': {
    keywords: ['werktuigbouw', 'mechanical', 'constructeur', 'cad', 'solidworks', 'machinist'],
    priority: false
  },
  'Manufacturing & Industrial Recruitment': {
    keywords: ['manufacturing', 'productie', 'fabriek', 'industrie', 'operator', 'cnc'],
    priority: false
  },
  'Regionale Arbeidsmarkten': {
    keywords: ['regio', 'brabant', 'limburg', 'gelderland', 'overijssel', 'noord-holland', 'zuid-holland'],
    priority: false
  },
  'Duurzame Energie & Toekomst': {
    keywords: ['duurzaam', 'energie', 'solar', 'wind', 'waterstof', 'groen', 'klimaat'],
    priority: false
  }
};

// Nieuwsbronnen - RSS feeds en webpaginas
const NEWS_SOURCES = {
  rss: [
    { name: 'Werf&', url: 'https://www.werf-en.nl/feed/' },
    { name: 'HRpraktijk', url: 'https://www.hrpraktijk.nl/rss' },
    { name: 'PW.', url: 'https://www.pwnet.nl/rss' },
    { name: 'Recruitmenttech.nl', url: 'https://www.recruitmenttech.nl/feed/' },
    { name: 'MT/Sprout', url: 'https://mtsprout.nl/feed' },
    { name: 'Technisch Weekblad', url: 'https://www.technischweekblad.nl/rss' }
  ],
  web: [
    {
      name: 'Metaal Magazine',
      url: 'https://www.metaalmagazine.nl/nieuws/',
      selector: 'article.news-item, .article-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },
    {
      name: 'Link Magazine',
      url: 'https://www.linkmagazine.nl/category/nieuws/',
      selector: 'article, .post',
      titleSelector: 'h2, .entry-title',
      linkSelector: 'a',
      descSelector: '.excerpt, .entry-summary'
    }
  ]
};

/**
 * Bepaal de categorie van een artikel op basis van title en description
 */
function categorizeArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  let bestMatch = null;
  let highestScore = 0;

  for (const [category, config] of Object.entries(CATEGORIES)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += config.priority ? 2 : 1;
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
    }
  }

  return bestMatch || 'HR Trends & Arbeidsmarkt 2026';
}

/**
 * Parse RSS feeds
 */
async function scrapeRSSFeeds() {
  const articles = [];

  for (const source of NEWS_SOURCES.rss) {
    try {
      console.log(`Scraping RSS: ${source.name}...`);
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items.slice(0, 10)) {
        const article = {
          title: item.title?.trim() || '',
          description: (item.contentSnippet || item.content || '').substring(0, 300).trim(),
          url: item.link || '',
          source: source.name,
          date: formatDate(item.pubDate || item.isoDate),
          category: categorizeArticle(item.title || '', item.contentSnippet || '')
        };

        if (article.title && article.url) {
          articles.push(article);
        }
      }

      console.log(`  -> ${feed.items.length} items gevonden`);
    } catch (error) {
      console.error(`  -> Fout bij ${source.name}: ${error.message}`);
    }
  }

  return articles;
}

/**
 * Scrape webpaginas met cheerio
 */
async function scrapeWebPages() {
  const articles = [];

  for (const source of NEWS_SOURCES.web) {
    try {
      console.log(`Scraping web: ${source.name}...`);

      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      let count = 0;

      $(source.selector).each((i, el) => {
        if (count >= 10) return false;

        const $el = $(el);
        const title = $el.find(source.titleSelector).first().text().trim();
        const link = $el.find(source.linkSelector).first().attr('href');
        const description = $el.find(source.descSelector).first().text().trim();

        if (title && link) {
          const fullUrl = link.startsWith('http') ? link : new URL(link, source.url).href;

          articles.push({
            title,
            description: description.substring(0, 300),
            url: fullUrl,
            source: source.name,
            date: formatDate(new Date()),
            category: categorizeArticle(title, description)
          });
          count++;
        }
      });

      console.log(`  -> ${count} items gevonden`);
    } catch (error) {
      console.error(`  -> Fout bij ${source.name}: ${error.message}`);
    }
  }

  return articles;
}

/**
 * Formatteer datum naar Nederlandse notatie
 */
function formatDate(dateInput) {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return formatDate(new Date());
  }

  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Lees bestaande data
 */
function readExistingData() {
  try {
    const filePath = path.join(__dirname, 'news-data.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract the newsData object
    const match = content.match(/const newsData = ({[\s\S]*});/);
    if (match) {
      // Use eval to parse (safe here because we control the file)
      return eval(`(${match[1]})`);
    }
  } catch (error) {
    console.log('Geen bestaande data gevonden, start met lege dataset');
  }

  return { topArticles: [], categories: [] };
}

/**
 * Merge nieuwe artikelen met bestaande data
 */
function mergeArticles(existingData, newArticles) {
  // Maak een set van bestaande URLs voor deduplicatie
  const existingUrls = new Set();

  existingData.categories.forEach(cat => {
    cat.articles.forEach(art => existingUrls.add(art.url));
  });
  existingData.topArticles.forEach(art => existingUrls.add(art.url));

  // Filter nieuwe artikelen
  const uniqueNewArticles = newArticles.filter(art => !existingUrls.has(art.url));

  console.log(`\n${uniqueNewArticles.length} nieuwe unieke artikelen gevonden`);

  // Groepeer per categorie
  const categoryMap = {};

  // Voeg bestaande categorien toe
  existingData.categories.forEach(cat => {
    categoryMap[cat.title] = {
      title: cat.title,
      priority: cat.priority || CATEGORIES[cat.title]?.priority || false,
      articles: [...cat.articles]
    };
  });

  // Voeg nieuwe artikelen toe aan categorien
  uniqueNewArticles.forEach(article => {
    if (!categoryMap[article.category]) {
      categoryMap[article.category] = {
        title: article.category,
        priority: CATEGORIES[article.category]?.priority || false,
        articles: []
      };
    }

    categoryMap[article.category].articles.unshift({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source,
      date: article.date
    });
  });

  // Sorteer artikelen per categorie op datum (nieuwste eerst)
  Object.values(categoryMap).forEach(cat => {
    cat.articles = cat.articles.slice(0, 50); // Max 50 per categorie
  });

  // Selecteer top artikelen (nieuwste met priority categorien eerst)
  const allArticles = uniqueNewArticles.concat(existingData.topArticles);
  const topArticles = allArticles
    .filter((art, index, self) => self.findIndex(a => a.url === art.url) === index)
    .slice(0, 10)
    .map((art, index) => ({ ...art, rank: index + 1 }));

  return {
    topArticles,
    categories: Object.values(categoryMap).sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return 0;
    })
  };
}

/**
 * Schrijf data naar news-data.js
 */
function writeNewsData(data) {
  const filePath = path.join(__dirname, 'news-data.js');

  const content = `// Alle recruitment nieuws artikelen - Automatisch bijgewerkt op ${new Date().toISOString()}
const newsData = ${JSON.stringify(data, null, 2)};

// Helper functions voor de app
function getAllArticles() {
  const articles = [];
  newsData.categories.forEach(cat => {
    cat.articles.forEach(art => {
      articles.push({ ...art, category: cat.title });
    });
  });
  return articles;
}

function getUniqueCategories() {
  return newsData.categories.map(cat => ({
    title: cat.title,
    count: cat.articles.length,
    priority: cat.priority
  }));
}

function getTopArticles() {
  return newsData.topArticles;
}
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\nData geschreven naar ${filePath}`);
}

/**
 * Main functie
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Technical Recruitment News Scraper');
  console.log(`Gestart: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const isDryRun = process.argv.includes('--dry-run');

  // Scrape alle bronnen
  const rssArticles = await scrapeRSSFeeds();
  const webArticles = await scrapeWebPages();

  const allNewArticles = [...rssArticles, ...webArticles];
  console.log(`\nTotaal ${allNewArticles.length} artikelen gescraped`);

  if (isDryRun) {
    console.log('\n[DRY RUN] Geen wijzigingen opgeslagen');
    console.log('Voorbeeld artikelen:');
    allNewArticles.slice(0, 5).forEach(art => {
      console.log(`  - ${art.title} (${art.category})`);
    });
    return;
  }

  // Lees bestaande data en merge
  const existingData = readExistingData();
  const mergedData = mergeArticles(existingData, allNewArticles);

  // Schrijf naar bestand
  writeNewsData(mergedData);

  // Statistieken
  const totalArticles = mergedData.categories.reduce((sum, cat) => sum + cat.articles.length, 0);
  console.log('\n' + '='.repeat(60));
  console.log('Statistieken:');
  console.log(`  Totaal categorien: ${mergedData.categories.length}`);
  console.log(`  Totaal artikelen: ${totalArticles}`);
  console.log(`  Top artikelen: ${mergedData.topArticles.length}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
