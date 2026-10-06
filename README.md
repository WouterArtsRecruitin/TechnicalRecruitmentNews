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
De oude `scraper.js` (nu in `archief/v1/`) draait niet meer: 12 van 31 bronnen dood, filter op woorddelen, één bron domineerde de top.

---

De v1-bestanden (scraper.js, news-app.js, styles.css, package.json, DEPLOYMENT.md, WORKFLOW_SETUP.md) staan in `archief/v1/`; ze draaien niet meer.
