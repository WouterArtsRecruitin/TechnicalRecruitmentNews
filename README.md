# Weekly news v2 (sinds 06-10-2026)

Elke maandag 05:00 UTC haalt GitHub Actions de juiste artikelen op voor een directeur/HR van technisch MKB in
Gelderland, Overijssel, Noord-Brabant, Utrecht, Flevoland, Drenthe en Zuid-Holland, plus de regionale CBS-vacaturecijfers per provincie.

| Bestand | Wat |
|---|---|
| `weekly/bronnen.json` | gemeten feeds + Google News-zoekvragen per sectie (hier wijzigen, niet in de code) |
| `weekly/nieuws.py` | ophalen, per bron begrensd, dubbel nieuws samengevoegd, ruis eruit; per bron gevonden / leeg / niet gemeten |
| `weekly/cbs_regio.py` | CBS 83599NED: openstaande vacatures per provincie × sector, trend, kant-en-klare zinnen met bron |
| `digest/latest.md` · `digest/JJJJ-Www.md` · `digest/latest.json` | het weekoverzicht (leesbaar + voor /week in Claude Code) |
| `arbeidsmarkt/regio-latest.md` · `.json` | de regiocijfers |
| `news-data.js` · `regio-data.js` | artikelen (+ weeknummer, bronnenstatus) en CBS-regiocijfers voor de site |

Site: [recruitmentnews.netlify.app](https://recruitmentnews.netlify.app) (ook `recruitmentnewsdaily`) — Netlify deployt automatisch vanaf `main`, dus de maandag-commit van de workflow zet de nieuwe week live.

Lokaal: `python3 weekly/nieuws.py --droog` · `python3 weekly/cbs_regio.py` · zelftests met `--zelftest`.
De oude `scraper.js` draait niet meer (12 van 31 bronnen dood, filter op woorddelen, één bron domineerde de top).

---

# 📰 Technical Recruitment News

**Live Demo**: Coming soon on GitHub Pages 🚀

---

## 🎯 Overzicht

Een moderne, standalone recruitment nieuws applicatie met **203 artikelen** over technisch recruitment, AI in HR, IT staffing en recruitment software.

### ✨ Features

✅ **203 Curated Artikelen** - Technisch recruitment nieuws  
✅ **Real-time Search** - Zoek door alle artikelen  
✅ **12 Categorieën** - Filter op onderwerp  
✅ **Notion Integratie** - Push artikelen direct naar Notion  
✅ **Purple Gradient Design** - Modern en eye-catching  
✅ **Fully Responsive** - Desktop & mobile  
✅ **Zero Build** - Pure HTML/CSS/JS met Tailwind CDN  

---

## 🚀 Quick Start

### **1. Clone Repository**
```bash
git clone https://github.com/WouterArtsRecruitin/TechnicalRecruitmentNews.git
cd TechnicalRecruitmentNews
```

### **2. Open in Browser**
```bash
open index.html
# Of dubbelklik op index.html
```

Dat's het! Geen build, geen dependencies. 🎉

---

## 📂 Project Structuur

```
TechnicalRecruitmentNews/
├── index.html          # Hoofd HTML pagina
├── news-data.js        # 203 artikelen data
├── news-app.js         # JavaScript logica
├── README.md           # Deze file
└── DEPLOYMENT.md       # GitHub Pages instructies
```

---

## 🎨 Design System

**Kleurenschema**: Purple Gradient Theme  
- Primary: `#667eea` → `#764ba2`  
- Accent: `#f093fb` → `#f5576c`  
- Background: Gradient van gray-50 via purple-50 naar pink-50

**Typography**: Inter (Google Fonts)  
**Framework**: Tailwind CSS (via CDN)  

---

## 🔧 Tech Stack

- **HTML5** - Semantic markup
- **Tailwind CSS** - Utility-first styling (CDN)
- **Vanilla JavaScript** - No frameworks
- **Notion API** - Optional integratie
- **LocalStorage** - Notion config opslag

---

## 🌐 GitHub Pages Deployment

**Zie**: `DEPLOYMENT.md` voor stap-voor-stap instructies

**Korte versie**:
1. Ga naar Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: "main" / Folder: "/ (root)"
4. Save

**Live URL**: `https://wouterartsrecruitin.github.io/TechnicalRecruitmentNews/`

---

## 📊 Categorieën

1. AI in Recruitment (25 artikelen)
2. HR Tech (31 artikelen)  
3. IT Staffing (18 artikelen)  
4. Recruitment Software (22 artikelen)  
5. Employer Branding (15 artikelen)  
6. Candidate Experience (17 artikelen)  
7. Tech Trends (20 artikelen)  
8. Remote Work (16 artikelen)  
9. Diversity & Inclusion (12 artikelen)  
10. Skills & Training (11 artikelen)  
11. Market Insights (10 artikelen)  
12. Tools & Platforms (6 artikelen)  

**Totaal**: 203 artikelen

---

## 🔗 Notion Integratie

### **Setup**

1. Klik op "Push naar Notion" button
2. Voer je Notion API Key in
3. Voer je Database ID in
4. Klik "Opslaan & Verbinden"

### **Vereisten**

- Notion account
- Notion API integration
- Database met juiste properties

**Docs**: [Notion API](https://www.notion.so/help/create-integrations-with-the-notion-api)

---

## 🎯 Use Cases

✅ Recruitment nieuws platform  
✅ Knowledge base voor recruiters  
✅ Research tool voor HR professionals  
✅ Content library voor tech recruiters  
✅ Portfolio project  

---

## 🚀 Roadmap

- [ ] Custom domain setup
- [ ] RSS feed export
- [ ] Bookmark functionaliteit
- [ ] Dark mode
- [ ] Analytics dashboard
- [ ] Email notifications

---

## 📝 License

MIT License - Vrij te gebruiken

---

## 👤 Auteur

**Wouter Arts**  
Repository: [TechnicalRecruitmentNews](https://github.com/WouterArtsRecruitin/TechnicalRecruitmentNews)

---

## 🙏 Credits

- Design: Custom purple gradient theme
- Icons: Heroicons (via Tailwind)
- Fonts: Google Fonts (Inter)
- Framework: Tailwind CSS

---

**Built with ❤️ for the Recruitment Community**