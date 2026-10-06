#!/usr/bin/env python3
"""Weekly news v2 — de juiste artikelen voor een directeur/HR van technisch MKB in Gelderland, Overijssel, Brabant, Utrecht, Flevoland, Drenthe en Zuid-Holland.

Waarom opnieuw (06-10-2026, gemeten): de oude scraper haalde 400 artikelen uit 22 domeinen, maar 12 van 31 bronnen
gaven 403/404, de categorie-filter werkte op woorddelen ('it' ving 'het/uit', 'tekort' ving 'slaaptekort'), de
top-artikelen kwamen allemaal van één bron (feedvolgorde) en Oost-Nederland kwam vrijwel niet voor.

Deze versie:
  · bronnen uit weekly/bronnen.json (gemeten feeds + Google News-zoekvragen voor regionale bedrijfssignalen);
  · alleen artikelen uit de laatste `venster_dagen`; per bron hooguit `max_per_bron` → geen verdringing;
  · woordgrens-trefwoorden; sectie per artikel (regio · arbeidsmarkt · branche · vak); ruis eruit;
  · dubbele berichten (zelfde nieuws via meerdere bronnen) samengevoegd;
  · per bron drie uitkomsten, nooit twee: gevonden · leeg · niet gemeten (een 403 is geen nul);
  · uitvoer: digest/JJJJ-Www.md (leesbaar), digest/latest.json (voor /week in Claude Code), news-data.js (site).

Alleen standaardbibliotheek. Gebruik: python3 weekly/nieuws.py [--droog] · --zelftest
"""
import datetime as dt
import email.utils
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "weekly" / "bronnen.json"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def W(*ws):
    return re.compile(r"(?<![a-zà-ÿ])(" + "|".join(ws) + r")(?![a-zà-ÿ])", re.I)


REGIO = W(r"gelderland", r"gelderse", r"overijssel", r"brabant\w*", r"twente", r"twentse", r"achterhoek\w*", r"veluwe",
          r"liemers", r"arnhem\w*", r"nijmegen", r"nijmeegse", r"apeldoorn", r"ede", r"doetinchem", r"zutphen", r"deventer",
          r"enschede", r"hengelo", r"almelo", r"zwolle", r"kampen", r"oldenzaal", r"winterswijk", r"tiel", r"wijchen",
          r"harderwijk", r"eindhoven", r"tilburg", r"den bosch", r"helmond", r"oss", r"veghel", r"uden", r"breda",
          r"waalwijk", r"oost-nederland", r"doesburg", r"duiven", r"zevenaar", r"barneveld", r"culemborg", r"hardenberg",
          r"rijssen", r"nijverdal", r"brainport", r"budel", r"weert",
          # uitgebreid 06-10-2026: Utrecht, Flevoland, Drenthe, Zuid-Holland
          r"utrecht\w*", r"amersfoort", r"veenendaal", r"nieuwegein", r"woerden", r"houten", r"zeist", r"flevoland\w*", r"almere",
          r"lelystad", r"emmeloord", r"dronten", r"zeewolde", r"noordoostpolder", r"drenthe", r"drentse", r"assen", r"emmen",
          r"hoogeveen", r"meppel", r"coevorden", r"zuid-holland\w*", r"rotterdam\w*", r"rijnmond", r"dordrecht", r"drechtsteden",
          r"leiden", r"delft", r"gouda", r"zoetermeer", r"den haag", r"haagse", r"schiedam", r"vlaardingen", r"ridderkerk",
          r"barendrecht", r"alblasserdam", r"papendrecht", r"gorinchem", r"westland", r"botlek", r"maasvlakte")
ARBEID = W(r"personeel\w*", r"tekort aan \w+", r"krapte", r"krappe", r"vacatures?", r"werving", r"werven", r"banen",
           r"arbeidsmarkt\w*", r"werkgelegenheid", r"ontslag\w*", r"reorganisatie", r"cao", r"lonen",
           r"loonsverhoging", r"loonstijging", r"salaris\w*", r"arbeidsmigrant\w*", r"vakmensen", r"\d+ medewerkers",
           r"\d+ werknemers", r"skills\w*", r"omscholing", r"sociaal akkoord", r"werkloosheid", r"technisch talent")
SIGNAAL = W(r"investeert", r"investering\w*", r"uitbreid\w*", r"uitbreiding", r"nieuwe (fabriek|hal|vestiging|locatie|directeur)",
            r"opent", r"verhuist", r"overname", r"neemt \w+ over", r"faillissement", r"failliet", r"sluit", r"sluiting",
            r"orderboek\w*", r"groeit", r"krimpt", r"benoemd", r"managing director", r"algemeen directeur", r"nieuwbouw")
INDUSTRIE = W(r"maakindustrie", r"metaal\w*", r"machinebouw\w*", r"hightech", r"installatie\w*", r"techniek", r"technische?",
              r"fabriek\w*", r"industrie\w*", r"industriële", r"automatisering", r"onderhoud", r"elektro\w*",
              r"werktuigbouw\w*", r"bouwbedrijf", r"bouwsector", r"aannemer\w*", r"chip\w*", r"halfgeleider\w*",
              r"productiebedrijf", r"toeleverancier\w*", r"maakbedrijf", r"plaatwerk", r"verspaning", r"lassen")
RUIS = W(r"zzp'?ers?", r"uitzendbranche", r"horeca", r"supermarkt\w*", r"voetbal", r"politie", r"ongeluk", r"rechtbank",
         r"verdacht\w*", r"huizenmarkt", r"hypothe\w*", r"beurs", r"aandeel\w*", r"crypto", r"recept", r"podcast\w*",
         r"webinar", r"onthult", r"lanceert", r"introduceert", r"presenteert", r"bungalowpark", r"lodges", r"camping",
         r"woning\w*", r"appartement\w*", r"parkeer\w*", r"studieschuld", r"consument\w*", r"zorg\w*", r"ziekenhuis\w*",
         r"projectprijs", r"award\w*", r"wint \w+ ?prijs", r"koopkracht", r"dagelijks leven", r"voedselbank\w*", r"\w+cast", r"gemeente \w+ investeert", r"wonen", r"leefbaarheid", r"\w*buurt", r"(woon)?wijk", r"busbaan")


def strip(t):
    t = re.sub(r"<!\[CDATA\[|\]\]>", "", t or "")
    # eerst ontsnappen ongedaan maken: Google News levert de omschrijving als &lt;a href…&gt;, anders blijft de tag staan
    # alleen echte tags (<a …>, </p>) weghalen: een losse '< inflatie' in de tekst blijft staan
    t = re.sub(r"\s+", " ", html.unescape(re.sub(r"</?[A-Za-z][^>]*>", " ", html.unescape(t)))).strip()
    # standaardregel van WordPress-feeds ("Het bericht X verscheen eerst op Salaris Vanmorgen.") telt niet als inhoud
    return re.sub(r"(The post|Het bericht) .{0,300}? (appeared first on|verscheen eerst op) [^.]*\.?$", "", t).strip()


def datum(s):
    s = strip(s)
    for f in (email.utils.parsedate_to_datetime, lambda x: dt.datetime.fromisoformat(x.replace("Z", "+00:00"))):
        try:
            d = f(s)
            return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
        except Exception:
            pass
    return None


def parse_feed(xml):
    """RSS <item> of Atom <entry> → lijst dicts. Tolerant voor rommelige feeds."""
    uit = []
    for blok in re.findall(r"<item[\s>].*?</item>|<entry[\s>].*?</entry>", xml, re.S):
        def g(*tags):
            for tag in tags:
                m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", blok, re.S)
                if m:
                    return m.group(1)
            return ""
        link = html.unescape(re.sub(r"<!\[CDATA\[|\]\]>", "", g("link"))).strip() or (re.search(r'<link[^>]+href="([^"]+)"', blok) or [None, ""])[1]
        bron = strip(g("source"))
        titel = strip(g("title"))
        if bron and titel.endswith(" - " + bron):                  # Google News plakt de bron achter de titel
            titel = titel[: -len(" - " + bron)].strip()
        uit.append({"titel": titel, "tekst": strip(g("description", "summary", "content"))[:600], "link": link,
                    "datum": datum(g("pubDate", "updated", "published")), "bron_artikel": bron})
    return uit


def haal(url, pogingen=2):
    """-> (status, tekst). status: int HTTP-code, of 'fout:<soort>'."""
    laatste = "fout:onbekend"
    for i in range(pogingen):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*",
                                                       "Accept-Language": "nl-NL,nl;q=0.9"})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status, r.read(800000).decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            laatste = e.code
            if e.code in (403, 404, 410):
                break
        except Exception as e:
            laatste = "fout:" + type(e).__name__
        time.sleep(1.5 * (i + 1))
    return laatste, ""


def score(a, bucket):
    t = a["titel"] + " . " + a["tekst"]
    # bij vakbladen telt een regio alleen in de titel (een stad ergens in de tekst maakt landelijk nieuws niet regionaal)
    regio_tekst = t if bucket == "google" else a["titel"]
    regio, ind, arb, sig = bool(REGIO.search(regio_tekst)), bool(INDUSTRIE.search(t)) or bucket == "branche", bool(ARBEID.search(t)), bool(SIGNAAL.search(t))
    s, waarom = 0, []
    if arb: s += 3; waarom.append("arbeidsmarkt")
    if regio and (ind or arb or sig): s += 3; waarom.append("regio")
    if sig and (ind or regio): s += 2; waarom.append("bedrijfssignaal")
    if ind: s += 1; waarom.append("industrie")
    if RUIS.search(t): s -= 5; waarom.append("ruis")
    return s, waarom


def sectie_van(a, bucket, google_sectie=None):
    if bucket == "vak":
        return "vak"
    if google_sectie:
        return google_sectie
    if "regio" in a["waarom"] and ("bedrijfssignaal" in a["waarom"] or "arbeidsmarkt" in a["waarom"]):
        return "regio"
    if "bedrijfssignaal" in a["waarom"]:        # directiewissel, uitbreiding, overname → branchenieuws
        return "branche"
    if "arbeidsmarkt" in a["waarom"]:
        return "arbeidsmarkt"
    return "branche"


def sleutel(titel):
    """Woordstammen (eerste 5 letters) van woorden ≥4 tekens: 'sluit' en 'sluiten' tellen als hetzelfde."""
    stop = {"over", "zijn", "voor", "naar", "deze", "niet", "meer", "worden", "wordt", "nieuwe", "nieuw", "door", "bij", "maar", "heeft", "werd"}
    return set(w[:5] for w in re.findall(r"[a-zà-ÿ0-9]{4,}", titel.lower()) if w not in stop)


def is_dubbel(a, gekozen):
    s = sleutel(a["titel"])
    for b in gekozen:
        t = sleutel(b["titel"])
        if s and t and len(s & t) / len(s | t) >= 0.4:
            return b
    return None


def verzamel(cfg, nu=None, ophalen=haal):
    nu = nu or dt.datetime.now(dt.timezone.utc)
    grens = nu - dt.timedelta(days=cfg["venster_dagen"])
    taken = [("feed", f["naam"], f["url"], f["bucket"], None) for f in cfg["feeds"]]
    for i, q in enumerate(cfg["google_news"], 1):
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(q["q"] + f" when:{cfg['venster_dagen']}d") + "&hl=nl&gl=NL&ceid=NL:nl"
        taken.append(("google", f"Google News #{i} ({q['sectie']})", url, "google", q["sectie"]))

    def één(taak):
        soort, naam, url, bucket, gsectie = taak
        status, xml = ophalen(url)
        if status != 200:
            return naam, {"uitkomst": "niet gemeten", "status": status, "items": 0, "vers": 0}, []
        items = parse_feed(xml)
        vers = [a for a in items if a["datum"] and a["datum"] >= grens]
        uit = []
        for a in vers:
            a["score"], a["waarom"] = score(a, bucket)
            if soort == "google":
                a["score"] += 2; a["waarom"].append("gerichte zoekvraag")
            a["bron"] = a["bron_artikel"] or naam if soort == "google" else naam
            a["via"] = naam
            a["sectie"] = sectie_van(a, bucket, gsectie)
            uit.append(a)
        return naam, {"uitkomst": "gevonden" if vers else "leeg", "status": status, "items": len(items), "vers": len(vers)}, uit

    with ThreadPoolExecutor(8) as ex:
        resultaten = list(ex.map(één, taken))
    status = {n: s for n, s, _ in resultaten}
    alle = [a for _, _, lijst in resultaten for a in lijst]
    return status, alle


def kies(alle, cfg):
    drempel = {"regio": 4, "arbeidsmarkt": 3, "branche": 3, "vak": 0}
    per_bron, gekozen = {}, []
    belgisch = re.compile(r"made-in\.be|nieuwsblad|hln|gazet van antwerpen|vrt|standaard\.be|tijd\.be", re.I)
    for a in sorted(alle, key=lambda a: (-a["score"], -(a["datum"].timestamp()))):
        if a["score"] < drempel[a["sectie"]] or "ruis" in a["waarom"]:
            continue
        if belgisch.search(a["bron"]) or belgisch.search(a.get("link", "")):   # Google News levert ook Vlaams nieuws
            continue
        dub = is_dubbel(a, gekozen)
        if dub:
            dub.setdefault("ook_bij", []).append(a["bron"])
            continue
        if per_bron.get(a["bron"], 0) >= cfg["max_per_bron"]:
            continue
        limiet = 3 if a["sectie"] == "vak" else (cfg.get("max_regio", cfg["max_per_sectie"]) if a["sectie"] == "regio" else cfg["max_per_sectie"])
        if sum(1 for g in gekozen if g["sectie"] == a["sectie"]) >= limiet:
            continue
        per_bron[a["bron"]] = per_bron.get(a["bron"], 0) + 1
        gekozen.append(a)
    return gekozen


def schrijf(gekozen, status, cfg, nu, droog=False):
    jaar, week, _ = nu.isocalendar()
    van = (nu - dt.timedelta(days=cfg["venster_dagen"])).strftime("%d-%m")
    regels = [f"# Weekly news — week {week} ({van} t/m {nu:%d-%m-%Y})", "",
              f"_Automatisch opgehaald {nu:%d-%m-%Y %H:%M} UTC · {len(gekozen)} artikelen gekozen uit "
              f"{sum(s['vers'] for s in status.values())} verse berichten · bron per artikel vermeld._", ""]
    for sk, titel in cfg["secties"].items():
        rij = [a for a in gekozen if a["sectie"] == sk]
        regels.append(f"## {titel} ({len(rij)})")
        regels.append("")
        for a in rij:
            ook = f" · ook bij {', '.join(sorted(set(a['ook_bij'])))}" if a.get("ook_bij") else ""
            regels.append(f"- [{a['titel']}]({a['link']}) — {a['bron']}, {a['datum']:%d-%m}{ook}")
        if not rij:
            regels.append("- _niets deze week_")
        regels.append("")
    gevonden = [n for n, s in status.items() if s["uitkomst"] == "gevonden"]
    leeg = [n for n, s in status.items() if s["uitkomst"] == "leeg"]
    niet = [f"{n} ({s['status']})" for n, s in status.items() if s["uitkomst"] == "niet gemeten"]
    regels += ["## Bronnen deze week", "",
               f"- **gevonden ({len(gevonden)}):** {', '.join(gevonden) or '—'}",
               f"- **leeg ({len(leeg)}):** {', '.join(leeg) or '—'}",
               f"- **niet gemeten ({len(niet)}):** {', '.join(niet) or '—'} — een bron die niet te lezen was, is geen nul.", ""]
    md = "\n".join(regels)
    data = {"week": f"{jaar}-W{week:02d}", "opgehaald": nu.isoformat(), "status": status,
            "artikelen": [{k: (v.isoformat() if isinstance(v, dt.datetime) else v) for k, v in a.items() if k != "tekst"} | {"samenvatting": a["tekst"][:300]}
                          for a in gekozen]}
    if droog:
        print(md)
        return md
    (ROOT / "digest").mkdir(exist_ok=True)
    (ROOT / "digest" / f"{jaar}-W{week:02d}.md").write_text(md + "\n", encoding="utf-8")
    (ROOT / "digest" / "latest.md").write_text(md + "\n", encoding="utf-8")
    (ROOT / "digest" / "latest.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    schrijf_site(gekozen, cfg, nu, status)
    print(md)
    return md


MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]


def nl_datum(d):
    """Nederlandse korte datum, los van de locale van de runner (strftime %b geeft daar 'Oct')."""
    return f"{d.day} {MAANDEN[d.month - 1]} {d.year}"


def omschrijving(a):
    """Omschrijving voor de site; bij Google News is die alleen titel + bron, dan liever niets."""
    t = a["tekst"]
    return "" if a["titel"] and t.lower().startswith(a["titel"][:40].lower()) else t[:300]


def schrijf_site(gekozen, cfg, nu, status=None):
    """news-data.js voor de bestaande site: zelfde vorm (topArticles + categories) plus meta (week, bronnenstatus);
    per artikel ook waarom/ookBij. Hulpfuncties onderaan blijven staan."""
    pad = ROOT / "news-data.js"
    staart = ""
    if pad.exists():
        oud = pad.read_text(encoding="utf-8")
        m = re.search(r"\n(//[^\n]*\n)?function ", oud)
        staart = oud[m.start():] if m else ""
    item = lambda a, i=None: ({"rank": i} if i else {}) | {"title": a["titel"], "description": omschrijving(a), "url": a["link"],
                                                           "source": a["bron"], "category": cfg["secties"][a["sectie"]],
                                                           "date": nl_datum(a["datum"]),
                                                           "why": [w for w in a.get("waarom", []) if w != "gerichte zoekvraag"],
                                                           "alsoAt": sorted(set(a.get("ook_bij") or []) - {a["bron"]})}
    jaar, week, _ = nu.isocalendar()
    meta = {"week": week, "jaar": jaar, "opgehaald": nu.isoformat(), "vensterDagen": cfg["venster_dagen"],
            "bronnen": [{"naam": n, "uitkomst": s["uitkomst"], "status": s["status"], "vers": s["vers"]}
                        for n, s in (status or {}).items()]}
    data = {"meta": meta, "topArticles": [item(a, i) for i, a in enumerate(gekozen[:10], 1)],
            "categories": [{"title": t, "priority": k in ("regio", "arbeidsmarkt"),
                            "articles": [item(a) for a in gekozen if a["sectie"] == k]} for k, t in cfg["secties"].items()]}
    pad.write_text(f"// Weekly news v2 — automatisch bijgewerkt op {nu.isoformat()} (weekly/nieuws.py)\nconst newsData = "
                   + json.dumps(data, ensure_ascii=False, indent=2) + ";\n" + staart, encoding="utf-8")


def zelftest():
    fouten = []
    if strip("Lonen &lt; inflatie, cao&apos;s &gt; 4% hoger") != "Lonen < inflatie, cao's > 4% hoger":
        fouten.append("strip haalt platte tekst met < en > weg")
    if nl_datum(dt.datetime(2026, 10, 1)) != "1 okt 2026":
        fouten.append("nl_datum moet '1 okt 2026' geven")
    if "<" in strip("&lt;a href=\"x\"&gt;Titel&lt;/a&gt;&amp;nbsp;&lt;font&gt;Bron&lt;/font&gt;"):
        fouten.append("strip laat ontsnapte HTML (Google News) staan")
    if omschrijving({"titel": "Systemair sluit fabriek", "tekst": "Systemair sluit fabriek Eindhovens Dagblad"}):
        fouten.append("omschrijving gelijk aan titel moet leeg zijn")
    nu = dt.datetime(2026, 10, 6, 7, 0, tzinfo=dt.timezone.utc)
    rss = lambda items: "<rss><channel>" + "".join(
        f"<item><title>{t}</title><link>https://x/{i}</link><pubDate>{email.utils.format_datetime(d)}</pubDate>"
        f"<description>{ds}</description>{('<source url=\"x\">' + s + '</source>') if s else ''}</item>"
        for i, (t, ds, d, s) in enumerate(items)) + "</channel></rss>"
    vers, oud = nu - dt.timedelta(days=2), nu - dt.timedelta(days=20)
    feeds = {
        "https://a/feed": (200, rss([("Metaalbedrijf in Doetinchem breidt uit met nieuwe hal en zoekt 30 medewerkers", "", vers, ""),
                                     ("Mebema introduceert nieuwe ontbraammachine", "", vers, ""),
                                     ("Oud bericht over cao", "", oud, "")])),
        "https://b/feed": (403, ""),
        "https://c/feed": (200, rss([])),
        "GOOGLE": (200, rss([("Systemair wil fabriek Waalwijk sluiten: 70 medewerkers geraakt - Omroep Brabant", "", vers, "Omroep Brabant"),
                             ("Systemair sluit fabriek in Waalwijk, 70 banen weg - BD", "", vers, "BD")])),
    }
    ophalen = lambda url: feeds["GOOGLE"] if "news.google" in url else feeds[url]
    cfg = {"venster_dagen": 8, "max_per_bron": 3, "max_per_sectie": 10,
           "secties": {"regio": "R", "arbeidsmarkt": "A", "branche": "B", "vak": "V"},
           "feeds": [{"naam": "A", "url": "https://a/feed", "bucket": "branche"}, {"naam": "B", "url": "https://b/feed", "bucket": "hr"},
                     {"naam": "C", "url": "https://c/feed", "bucket": "hr"}],
           "google_news": [{"sectie": "regio", "q": "test"}]}
    status, alle = verzamel(cfg, nu, ophalen)
    if status["B"]["uitkomst"] != "niet gemeten": fouten.append(f"403 moet 'niet gemeten' zijn, kreeg {status['B']}")
    if status["C"]["uitkomst"] != "leeg": fouten.append(f"lege feed moet 'leeg' zijn, kreeg {status['C']}")
    if status["A"]["vers"] != 2: fouten.append(f"venster: verwacht 2 verse items, kreeg {status['A']['vers']}")
    gekozen = kies(alle, cfg)
    titels = [a["titel"] for a in gekozen]
    if not any("Doetinchem" in t for t in titels): fouten.append(f"regionaal bedrijfssignaal niet gekozen: {titels}")
    if any("Mebema" in t for t in titels): fouten.append("productlancering (ruis) werd gekozen")
    sys_ = [a for a in gekozen if "Systemair" in a["titel"]]
    if len(sys_) != 1: fouten.append(f"dubbel nieuws niet samengevoegd: {len(sys_)}× Systemair")
    elif sys_[0]["bron"] not in ("Omroep Brabant", "BD") or not sys_[0].get("ook_bij"): fouten.append(f"bron/ook_bij fout: {sys_[0]}")
    if sys_ and sys_[0]["titel"].endswith("Omroep Brabant"): fouten.append("Google-bron niet van de titel gehaald")
    if W(r"it").search("het uit") or not W(r"tekort aan \w+").search("tekort aan monteurs") or W(r"tekort aan \w+").search("slaaptekort"):
        fouten.append("woordgrens werkt niet")
    print("ZELFTEST " + ("GESLAAGD" if not fouten else "GEZAKT:\n  - " + "\n  - ".join(fouten)))
    return 0 if not fouten else 1


def main():
    if "--zelftest" in sys.argv:
        sys.exit(zelftest())
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    nu = dt.datetime.now(dt.timezone.utc)
    status, alle = verzamel(cfg, nu)
    gekozen = kies(alle, cfg)
    schrijf(gekozen, status, cfg, nu, droog="--droog" in sys.argv)
    if not gekozen:
        print("LET OP: geen enkel artikel gekozen — controleer de bronnenstatus.")
        sys.exit(1)


if __name__ == "__main__":
    main()
