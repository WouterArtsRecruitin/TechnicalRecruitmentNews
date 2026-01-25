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
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

// Axios instance met retry logic
const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8'
  }
});

// Categorien met bijbehorende keywords voor classificatie
const CATEGORIES = {
  'Technisch Personeel Tekort & Personeelskrapte': {
    keywords: ['tekort', 'krapte', 'schaarste', 'vacature', 'personeelstekort', 'arbeidsmarkt krap', 'moeilijk te vinden', 'war for talent'],
    priority: true
  },
  'Automation & Engineering Recruitment': {
    keywords: ['automation', 'engineering', 'engineer', 'automatisering', 'robotica', 'plc', 'industrieel', 'technicus', 'monteur'],
    priority: true
  },
  'Salarissen & Arbeidsvoorwaarden Techniek 2026': {
    keywords: ['salaris', 'loon', 'cao', 'arbeidsvoorwaarden', 'beloning', 'secundair', 'minimumloon', 'loonsverhoging'],
    priority: false
  },
  'AI & Recruitment Tech Trends 2026': {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'recruitment tech', 'hr tech', 'chatbot', 'automatisering recruitment', 'ats'],
    priority: true
  },
  'HR Trends & Arbeidsmarkt 2026': {
    keywords: ['hr trend', 'arbeidsmarkt', 'werkgelegenheid', 'flexwerk', 'zzp', 'detachering', 'uitzend', 'personeelsbehoud'],
    priority: false
  },
  'Elektrotechniek & Installatietechniek': {
    keywords: ['elektrotechniek', 'installatie', 'elektricien', 'elektromonteur', 'hoogspanning', 'laagspanning', 'vsk'],
    priority: false
  },
  'Werktuigbouwkunde & Mechanical Engineering': {
    keywords: ['werktuigbouw', 'mechanical', 'constructeur', 'cad', 'solidworks', 'machinist', 'cnc'],
    priority: false
  },
  'Manufacturing & Industrial Recruitment': {
    keywords: ['manufacturing', 'productie', 'fabriek', 'industrie', 'operator', 'asml', 'maakindustrie'],
    priority: false
  },
  'Regionale Arbeidsmarkten': {
    keywords: ['regio', 'brabant', 'limburg', 'gelderland', 'overijssel', 'noord-holland', 'zuid-holland', 'veluwe', 'noorden'],
    priority: false
  },
  'Duurzame Energie & Toekomst': {
    keywords: ['duurzaam', 'energie', 'solar', 'wind', 'waterstof', 'groen', 'klimaat', 'energietransitie'],
    priority: false
  },
  'IT & Software Development': {
    keywords: ['software', 'developer', 'programmeur', 'it', 'cloud', 'devops', 'fullstack', 'backend', 'frontend'],
    priority: false
  },
  'Cybersecurity & Data Science': {
    keywords: ['cybersecurity', 'security', 'data science', 'data analyst', 'privacy', 'hacker', 'pentester'],
    priority: false
  }
};

// Uitgebreide nieuwsbronnen - alle 31+ bronnen
const NEWS_SOURCES = {
  // RSS Feeds
  rss: [
    // Recruitment & HR
    { name: 'Recruitmenttech.nl', url: 'https://www.recruitmenttech.nl/feed/' },
    { name: 'Werf&', url: 'https://www.werf-en.nl/feed/' },
    { name: 'De HR Club', url: 'https://dehrclub.nl/feed/' },
    { name: 'Trends in HR', url: 'https://www.trendsinhr.nl/feed/' },
    { name: 'Salaris Vanmorgen', url: 'https://www.salarisvanmorgen.nl/feed/' },
    { name: 'Accountancy Vanmorgen', url: 'https://www.accountancyvanmorgen.nl/feed/' },

    // Techniek & Industrie
    { name: 'Metaal Magazine', url: 'https://www.metaalmagazine.nl/feed/' },
    { name: 'Link Magazine', url: 'https://www.linkmagazine.nl/feed/' },
    { name: 'Technisch Weekblad', url: 'https://www.technischweekblad.nl/rss' },
    { name: 'DIA Groep', url: 'https://www.diagroep.nl/feed/' },

    // Algemeen Nieuws
    { name: 'BNR', url: 'https://www.bnr.nl/rss/nieuws' },
    { name: 'Telegraaf Financieel', url: 'https://www.telegraaf.nl/financieel/rss' },
    { name: 'Metro Nieuws', url: 'https://www.metronieuws.nl/feed/' },
    { name: 'L1 Nieuws', url: 'https://www.l1nieuws.nl/rss' },

    // Duurzaamheid & Energie
    { name: 'Duurzaam Ondernemen', url: 'https://www.duurzaam-ondernemen.nl/feed/' },

    // Business & Ondernemen
    { name: 'MT/Sprout', url: 'https://mtsprout.nl/feed' },
    { name: 'Baaz', url: 'https://www.baaz.nl/feed/' },
    { name: 'Manners', url: 'https://www.manners.nl/feed/' }
  ],

  // Web scraping bronnen
  web: [
    // Recruitment portals
    {
      name: 'Werkgeverslijn',
      url: 'https://werkgeverslijn.nl/nieuws/',
      selector: 'article, .news-item, .post',
      titleSelector: 'h2, h3, .title',
      linkSelector: 'a',
      descSelector: 'p, .excerpt, .summary'
    },
    {
      name: 'Stolwijk Kennisnetwerk',
      url: 'https://stolwijkkennisnetwerk.nl/nieuws/',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },
    {
      name: 'JobInvest',
      url: 'https://jobinvest.nl/vacatures/blogs/',
      selector: 'article, .blog-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },

    // Techniek bronnen
    {
      name: 'Strevon',
      url: 'https://strevon.nl/kennisbank/',
      selector: 'article, .item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    },
    {
      name: 'De Nieuwe Ingenieurs',
      url: 'https://denieuweingenieurs.nl/nieuws/',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },
    {
      name: 'Beursstand',
      url: 'https://beursstand.nl/blog/',
      selector: 'article, .post',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },

    // Regionale bronnen
    {
      name: 'Noorderlink',
      url: 'https://noorderlink.nl/nieuws/',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    },
    {
      name: 'Werk in je Regio',
      url: 'https://werkinjeregio.nl/nieuws/',
      selector: 'article, .item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    },

    // Financieel/Economisch
    {
      name: 'DNB',
      url: 'https://www.dnb.nl/actueel/nieuws-voor-de-pers/',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .intro'
    },
    {
      name: 'Knab',
      url: 'https://bieb.knab.nl/',
      selector: 'article, .post',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    },

    // Overheid & Subsidies
    {
      name: 'RVO',
      url: 'https://www.rvo.nl/actueel/nieuws',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    },

    // Transport & Logistiek
    {
      name: 'Timocom',
      url: 'https://www.timocom.nl/blog/',
      selector: 'article, .blog-post',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p, .excerpt'
    },

    // Universiteiten (vacatures/nieuws)
    {
      name: 'Universiteit Twente',
      url: 'https://www.utwente.nl/nieuws/',
      selector: 'article, .news-item',
      titleSelector: 'h2, h3',
      linkSelector: 'a',
      descSelector: 'p'
    }
  ],

  // Google News zoekqueries voor aanvullende coverage
  googleNewsQueries: [
    'technisch personeel tekort Nederland',
    'elektromonteur vacature arbeidsmarkt',
    'werktuigbouwkundige tekort',
    'automation engineer Nederland',
    'recruitment techniek sector',
    'salaris technicus 2026',
    'installatietechniek personeelstekort',
    'manufacturing vacatures Nederland'
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
 * Parse RSS feeds met retry logic
 */
async function scrapeRSSFeeds() {
  const articles = [];

  for (const source of NEWS_SOURCES.rss) {
    try {
      console.log(`📡 RSS: ${source.name}...`);
      const feed = await parser.parseURL(source.url);

      let count = 0;
      for (const item of feed.items.slice(0, 15)) {
        const title = item.title?.trim() || '';
        const description = cleanDescription(item.contentSnippet || item.content || '');

        // Filter: alleen relevante artikelen
        if (!isRelevantArticle(title, description)) continue;

        const article = {
          title,
          description: description.substring(0, 350),
          url: item.link || '',
          source: source.name,
          date: formatDate(item.pubDate || item.isoDate),
          category: categorizeArticle(title, description)
        };

        if (article.title && article.url) {
          articles.push(article);
          count++;
        }
      }

      console.log(`   ✓ ${count} relevante artikelen`);

      // Rate limiting
      await sleep(500);
    } catch (error) {
      console.error(`   ✗ Fout: ${error.message}`);
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
      console.log(`🌐 Web: ${source.name}...`);

      const response = await axiosInstance.get(source.url);
      const $ = cheerio.load(response.data);
      let count = 0;

      $(source.selector).each((i, el) => {
        if (count >= 10) return false;

        const $el = $(el);
        const title = $el.find(source.titleSelector).first().text().trim();
        let link = $el.find(source.linkSelector).first().attr('href');
        const description = cleanDescription($el.find(source.descSelector).first().text());

        if (!title || !link) return;

        // Filter: alleen relevante artikelen
        if (!isRelevantArticle(title, description)) return;

        // Maak absolute URL
        if (!link.startsWith('http')) {
          try {
            link = new URL(link, source.url).href;
          } catch {
            return;
          }
        }

        articles.push({
          title,
          description: description.substring(0, 350),
          url: link,
          source: source.name,
          date: formatDate(new Date()),
          category: categorizeArticle(title, description)
        });
        count++;
      });

      console.log(`   ✓ ${count} relevante artikelen`);

      // Rate limiting
      await sleep(1000);
    } catch (error) {
      console.error(`   ✗ Fout: ${error.message}`);
    }
  }

  return articles;
}

/**
 * Check of artikel relevant is voor technische recruitment
 */
function isRelevantArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();

  const relevantKeywords = [
    'vacature', 'recruitment', 'werving', 'personeel', 'talent',
    'arbeidsmarkt', 'salaris', 'cao', 'techniek', 'technisch',
    'engineer', 'monteur', 'installateur', 'werktuigbouw',
    'elektro', 'automation', 'industrie', 'manufacturing',
    'hr', 'werkgever', 'werknemer', 'baan', 'functie',
    'tekort', 'krapte', 'schaarste', 'detachering', 'uitzend'
  ];

  return relevantKeywords.some(keyword => text.includes(keyword));
}

/**
 * Clean description text
 */
function cleanDescription(text) {
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
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
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Lees bestaande data
 */
function readExistingData() {
  try {
    const filePath = path.join(__dirname, 'news-data.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract the newsData object - improved regex
    const match = content.match(/const newsData = (\{[\s\S]*?\});?\s*\/\//);
    if (match) {
      return eval(`(${match[1]})`);
    }

    // Fallback: try to find it differently
    const altMatch = content.match(/const newsData = (\{[\s\S]*\});/);
    if (altMatch) {
      // Find the closing brace by counting
      let braceCount = 0;
      let endIndex = 0;
      const str = altMatch[1];
      for (let i = 0; i < str.length; i++) {
        if (str[i] === '{') braceCount++;
        if (str[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
      return eval(`(${str.substring(0, endIndex)})`);
    }
  } catch (error) {
    console.log('⚠️  Kon bestaande data niet lezen, start met lege dataset');
    console.log('   Error:', error.message);
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

  // Filter nieuwe artikelen (uniek + niet example.com)
  const uniqueNewArticles = newArticles.filter(art =>
    !existingUrls.has(art.url) &&
    !art.url.includes('example.com')
  );

  console.log(`\n📊 ${uniqueNewArticles.length} nieuwe unieke artikelen gevonden`);

  if (uniqueNewArticles.length === 0) {
    return existingData;
  }

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

  // Voeg nieuwe artikelen toe aan categorien (vooraan)
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

  // Limiteer artikelen per categorie (max 50)
  Object.values(categoryMap).forEach(cat => {
    cat.articles = cat.articles.slice(0, 50);
  });

  // Selecteer top artikelen (nieuwste, priority eerst)
  const allNewWithCategory = uniqueNewArticles.map(art => ({
    ...art,
    isPriority: CATEGORIES[art.category]?.priority || false
  }));

  // Sorteer: priority eerst, dan datum
  allNewWithCategory.sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return 0;
  });

  const newTopArticles = allNewWithCategory.slice(0, 5).map((art, i) => ({
    rank: i + 1,
    title: art.title,
    description: `<strong>${art.description.substring(0, 100)}</strong> ${art.description.substring(100)}`,
    url: art.url,
    source: art.source,
    category: art.category,
    date: art.date
  }));

  // Merge met bestaande top artikelen (shift ranks)
  const mergedTopArticles = [
    ...newTopArticles,
    ...existingData.topArticles.map((art, i) => ({
      ...art,
      rank: newTopArticles.length + i + 1
    }))
  ].slice(0, 10);

  return {
    topArticles: mergedTopArticles,
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
  const timestamp = new Date().toISOString();
  const totalArticles = data.categories.reduce((sum, cat) => sum + cat.articles.length, 0);

  const content = `// Alle ${totalArticles} recruitment nieuws artikelen - Automatisch bijgewerkt op ${timestamp}
const newsData = ${JSON.stringify(data, null, 2)};

// Functie om alle artikelen plat te maken met categorie info
function getAllArticles() {
  const allArticles = [];

  newsData.categories.forEach(category => {
    category.articles.forEach(article => {
      allArticles.push({
        ...article,
        category: category.title,
        isPriority: category.priority || false
      });
    });
  });

  return allArticles;
}

// Functie om unieke categorieën te krijgen
function getUniqueCategories() {
  return newsData.categories.map(cat => ({
    title: cat.title,
    count: cat.articles.length,
    isPriority: cat.priority || false
  }));
}
`;

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`\n💾 Data geschreven naar ${filePath}`);
}

/**
 * Main functie
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('🔍 Technical Recruitment News Scraper');
  console.log(`📅 Gestart: ${new Date().toLocaleString('nl-NL')}`);
  console.log('═'.repeat(60));
  console.log(`\n📰 Bronnen: ${NEWS_SOURCES.rss.length} RSS feeds, ${NEWS_SOURCES.web.length} websites\n`);

  const isDryRun = process.argv.includes('--dry-run');

  // Scrape alle bronnen
  console.log('─'.repeat(40));
  console.log('RSS FEEDS');
  console.log('─'.repeat(40));
  const rssArticles = await scrapeRSSFeeds();

  console.log('\n' + '─'.repeat(40));
  console.log('WEBSITES');
  console.log('─'.repeat(40));
  const webArticles = await scrapeWebPages();

  const allNewArticles = [...rssArticles, ...webArticles];
  console.log(`\n📈 Totaal ${allNewArticles.length} artikelen gescraped`);

  if (isDryRun) {
    console.log('\n🧪 [DRY RUN] Geen wijzigingen opgeslagen');
    console.log('\nVoorbeeld artikelen:');
    allNewArticles.slice(0, 10).forEach(art => {
      console.log(`  • ${art.title.substring(0, 60)}...`);
      console.log(`    └─ ${art.source} | ${art.category}`);
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
  console.log('\n' + '═'.repeat(60));
  console.log('📊 STATISTIEKEN');
  console.log('═'.repeat(60));
  console.log(`  Categorieën:     ${mergedData.categories.length}`);
  console.log(`  Totaal artikelen: ${totalArticles}`);
  console.log(`  Top artikelen:   ${mergedData.topArticles.length}`);
  console.log('═'.repeat(60));

  // Breakdown per categorie
  console.log('\n📂 Per categorie:');
  mergedData.categories.forEach(cat => {
    const marker = cat.priority ? '★' : '○';
    console.log(`  ${marker} ${cat.title}: ${cat.articles.length}`);
  });
}

main().catch(error => {
  console.error('❌ Fatale fout:', error);
  process.exit(1);
});
