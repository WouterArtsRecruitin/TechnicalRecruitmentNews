#!/usr/bin/env python3
"""Regionale arbeidsmarktcijfers voor Gelderland, Overijssel, Noord-Brabant, Utrecht, Flevoland, Drenthe en Zuid-Holland — CBS open data, met bron en peildatum.

Waarom (06-10-2026): Wouter wil prospects gerichter informeren met regionale arbeidsmarktinformatie. Gemeten: CBS-tabel
83599NED "Openstaande vacatures; SBI 2008, regio" geeft per kwartaal de openstaande vacatures per provincie en sector.
UWV en CBS hebben geen RSS meer; de OData-API van CBS werkt wel.

Uitvoer: arbeidsmarkt/regio-latest.json + arbeidsmarkt/regio-latest.md (tabel + kant-en-klare zinnen met bron).
Elk getal is letterlijk wat CBS levert (eenheid x 1.000); voorlopige cijfers (CBS-markering *) staan als voorlopig.

Gebruik: python3 weekly/cbs_regio.py · --zelftest
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABEL = "83599NED"
API = f"https://opendata.cbs.nl/ODataApi/odata/{TABEL}/"
BRON_URL = f"https://opendata.cbs.nl/statline/#/CBS/nl/dataset/{TABEL}/table"
REGIO = ["Gelderland (PV)", "Overijssel (PV)", "Noord-Brabant (PV)", "Utrecht (PV)", "Flevoland (PV)", "Drenthe (PV)", "Zuid-Holland (PV)", "Nederland"]
SECTOR = {"C Industrie": "industrie", "F Bouwnijverheid": "bouw", "A-U Alle economische activiteiten": "alle sectoren"}


def j(pad):
    req = urllib.request.Request(API + pad, headers={"User-Agent": "Mozilla/5.0 RecruitinBot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def pct(nieuw, oud):
    if nieuw is None or oud in (None, 0):
        return None
    return round((nieuw - oud) / oud * 100)


def bereken(reeksen, perioden):
    """reeksen: {(regio, sector): {periode_key: waarde}} · perioden: [(key, titel)] oplopend.
    -> lijst rijen met laatste waarde, vorig kwartaal, jaar eerder en procentuele verandering."""
    keys = [k for k, _ in perioden]
    titel = dict(perioden)
    rijen = []
    for (regio, sector), r in sorted(reeksen.items()):
        beschikbaar = [k for k in keys if r.get(k) is not None]
        if not beschikbaar:
            continue
        laatste = beschikbaar[-1]
        i = keys.index(laatste)
        vorig = keys[i - 1] if i >= 1 else None
        jaar = keys[i - 4] if i >= 4 else None
        rijen.append({"regio": regio.replace(" (PV)", ""), "sector": sector, "periode": titel[laatste].replace("*", "").strip(),
                      "voorlopig": "*" in titel[laatste], "waarde_x1000": r[laatste],
                      "vorig_kwartaal_x1000": r.get(vorig) if vorig else None, "jaar_eerder_x1000": r.get(jaar) if jaar else None,
                      "verandering_kwartaal_pct": pct(r[laatste], r.get(vorig) if vorig else None),
                      "verandering_jaar_pct": pct(r[laatste], r.get(jaar) if jaar else None)})
    return rijen


def kwartaal(periode):
    """'2026 2e kwartaal' -> 'tweede kwartaal van 2026'."""
    namen = {"1e": "eerste", "2e": "tweede", "3e": "derde", "4e": "vierde"}
    delen = periode.split()
    return f"{namen.get(delen[1], delen[1])} kwartaal van {delen[0]}" if len(delen) >= 2 else periode


def zin(rij, peildatum):
    n = round(rij["waarde_x1000"] * 1000)
    getal = f"{n:,}".replace(",", ".")
    waar = "in alle sectoren samen" if rij["sector"] == "alle sectoren" else f"in de {rij['sector']}"
    trend = ""
    klein = rij["waarde_x1000"] < 2.0 or (rij["jaar_eerder_x1000"] or 99) < 2.0
    if rij["jaar_eerder_x1000"] is not None and klein:
        # CBS rondt af op honderdtallen: bij kleine aantallen is een percentage ruis, dus de aantallen zelf
        trend = f" (een jaar eerder {round(rij['jaar_eerder_x1000'] * 1000):,})".replace(",", ".")
    elif rij["verandering_jaar_pct"] is not None:
        v = rij["verandering_jaar_pct"]
        trend = f", {abs(v)}% {'meer' if v > 0 else 'minder'} dan een jaar eerder" if v else ", evenveel als een jaar eerder"
    voorlopig = " (voorlopig cijfer)" if rij["voorlopig"] else ""
    return (f"In {rij['regio']} stonden in het {kwartaal(rij['periode'])} {getal} vacatures open {waar}{trend}{voorlopig}. "
            f"Bron: CBS {TABEL}, peildatum {peildatum}.")


def main():
    if "--zelftest" in sys.argv:
        sys.exit(zelftest())
    info = j("TableInfos?$format=json")["value"][0]
    peildatum = info.get("Modified", "")[:10]
    regio = {x["Key"]: x["Title"].strip() for x in j("RegioS?$format=json")["value"]}
    sbi = {x["Key"]: x["Title"].strip() for x in j("BedrijfstakkenBranchesSBI2008?$format=json")["value"]}
    per = sorted((x["Key"], x["Title"].strip()) for x in j("Perioden?$format=json")["value"])[-9:]
    rk = [k for k, v in regio.items() if v in REGIO]
    sk = [k for k, v in sbi.items() if v in SECTOR]
    if len(rk) != len(REGIO) or len(sk) != len(SECTOR):
        print(f"ONVOLLEDIG — regio's of sectoren niet gevonden in {TABEL} (regio {len(rk)}/{len(REGIO)}, sector {len(sk)}/{len(SECTOR)})")
        sys.exit(2)
    flt = "(%s) and (%s) and (%s)" % (" or ".join("RegioS eq '%s'" % k for k in rk),
                                       " or ".join("BedrijfstakkenBranchesSBI2008 eq '%s'" % k for k in sk),
                                       " or ".join("Perioden eq '%s'" % k for k, _ in per))
    data = j("TypedDataSet?$format=json&$filter=" + urllib.parse.quote(flt))["value"]
    reeksen = {}
    for r in data:
        reeksen.setdefault((regio[r["RegioS"]], SECTOR[sbi[r["BedrijfstakkenBranchesSBI2008"]]]), {})[r["Perioden"]] = r["OpenstaandeVacatures_1"]
    rijen = bereken(reeksen, per)
    uit = {"bron": f"CBS {TABEL} — Openstaande vacatures; SBI 2008, regio", "bron_url": BRON_URL, "peildatum": peildatum,
           "eenheid": "x 1.000 openstaande vacatures (einde kwartaal)", "rijen": rijen,
           "zinnen": [zin(r, peildatum) for r in rijen if r["regio"] != "Nederland"]}
    (ROOT / "arbeidsmarkt").mkdir(exist_ok=True)
    (ROOT / "arbeidsmarkt" / "regio-latest.json").write_text(json.dumps(uit, ensure_ascii=False, indent=1), encoding="utf-8")
    md = [f"# Arbeidsmarkt per provincie — openstaande vacatures", "",
          f"_Bron: [CBS {TABEL}]({BRON_URL}) · peildatum {peildatum} · eenheid x 1.000 · automatisch opgehaald door weekly/cbs_regio.py._", "",
          "| Regio | Sector | Kwartaal | Vacatures (x1.000) | t.o.v. vorig kwartaal | t.o.v. jaar eerder |", "|---|---|---|---:|---:|---:|"]
    f = lambda v: "—" if v is None else ("0%" if v == 0 else f"{v:+d}%")
    for r in rijen:
        md.append(f"| {r['regio']} | {r['sector']} | {r['periode']}{' *' if r['voorlopig'] else ''} | {r['waarde_x1000']:.1f} | "
                  f"{f(r['verandering_kwartaal_pct'])} | {f(r['verandering_jaar_pct'])} |")
    md += ["", "## Kant-en-klare zinnen (bron en peildatum erbij laten staan)", ""] + [f"- {z}" for z in uit["zinnen"]] + \
          ["", "_* = voorlopig cijfer volgens CBS. CBS rondt af op honderdtallen: onder de 2.000 vacatures zijn procentuele veranderingen grof — gebruik dan de aantallen._"]
    (ROOT / "arbeidsmarkt" / "regio-latest.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


def zelftest():
    fouten = []
    per = [("2025KW02", "2025 2e kwartaal"), ("2025KW03", "2025 3e kwartaal"), ("2025KW04", "2025 4e kwartaal"),
           ("2026KW01", "2026 1e kwartaal"), ("2026KW02", "2026 2e kwartaal*")]
    reeksen = {("Noord-Brabant (PV)", "industrie"): {"2025KW02": 7.5, "2025KW03": 7.0, "2025KW04": 6.6, "2026KW01": 7.2, "2026KW02": 7.9},
               ("Overijssel (PV)", "bouw"): {"2025KW02": 2.8, "2026KW01": 2.7}}
    rijen = {(r["regio"], r["sector"]): r for r in bereken(reeksen, per)}
    nb = rijen[("Noord-Brabant", "industrie")]
    if (nb["waarde_x1000"], nb["verandering_kwartaal_pct"], nb["verandering_jaar_pct"], nb["voorlopig"]) != (7.9, 10, 5, True):
        fouten.append(f"berekening NB industrie: {nb}")
    ov = rijen[("Overijssel", "bouw")]
    if ov["periode"] != "2026 1e kwartaal" or ov["verandering_jaar_pct"] is not None:
        fouten.append(f"ontbrekend jaar-eerder moet None zijn (niet 0): {ov}")
    z = zin(nb, "2026-07-30")
    if "7.900 vacatures open in de industrie" not in z or "tweede kwartaal van 2026" not in z or "5% meer" not in z or "voorlopig" not in z or "CBS 83599NED" not in z:
        fouten.append(f"zin: {z}")
    klein = {"regio": "Drenthe", "sector": "bouw", "periode": "2026 2e kwartaal", "voorlopig": False, "waarde_x1000": 0.7,
             "vorig_kwartaal_x1000": 0.8, "jaar_eerder_x1000": 0.8, "verandering_kwartaal_pct": -13, "verandering_jaar_pct": -13}
    zk = zin(klein, "2026-07-30")
    if "%" in zk or "een jaar eerder 800" not in zk:
        fouten.append(f"klein aantal moet aantallen tonen, geen percentage: {zk}")
    print("ZELFTEST " + ("GESLAAGD" if not fouten else "GEZAKT:\n  - " + "\n  - ".join(fouten)))
    return 0 if not fouten else 1


if __name__ == "__main__":
    main()
