#!/usr/bin/env python3
"""Собирает единый словарь data/vocab.json из исходников в data/source/.

Источники:
  words.json   — базовый словарь (категории, модули, примеры)
  my_vocab.txt — наборы Quizlet репетитора («русский - English (транскрипция)»)
  extras.json  — разметка для новых слов из my_vocab.txt + дописанные примеры
  piercing.json — словарь пирсинга

Что делает:
  * убирает дубли по английскому слову (регистр, транскрипция в скобках, «?!.» не важны);
  * у каждого слова: перевод, IPA (британский словарь Britfone, MIT), транскрипция
    русскими буквами (своя из my_vocab.txt или сгенерированная из IPA), пример,
    категория, модуль, источники;
  * пишет data/vocab.json и выгрузки для Quizlet в data/quizlet/<категория>.txt.

Запуск:  python3 tools/build_vocab.py
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source"
OUT = ROOT / "data" / "vocab.json"
QUIZLET = ROOT / "data" / "quizlet"
BRITFONE = Path(__file__).resolve().parent / "britfone.main.3.0.1.csv"

SOURCES = {
    "base": "Базовый словарь",
    "q1": "Quizlet: Tattoo English 1",
    "q2": "Quizlet: урок CW21SEP",
    "q3": "Quizlet: новые слова по плану",
    "pierce": "Пирсинг",
}
SET_IDS = {"SET 1": "q1", "SET 2": "q2", "SET 3": "q3"}

# Слова, которых нет в Britfone (или с неудачным вариантом там).
MANUAL_IPA = {
    "armrest": "ˈɑːmrest", "workstation": "ˈwɜːksteɪʃn", "blackwork": "ˈblækwɜːk",
    "dotwork": "ˈdɒtwɜːk", "linework": "ˈlaɪnwɜːk", "regen": "ˈriːdʒen", "hp": "ˌeɪtʃ ˈpiː",
    "debuff": "ˈdiːbʌf", "cooldown": "ˈkuːldaʊn", "livestream": "ˈlaɪvstriːm",
    "tragus": "ˈtreɪɡəs", "daith": "deɪθ", "labret": "ˈleɪbrət", "helix": "ˈhiːlɪks",
    "threadless": "ˈθredləs", "crusties": "ˈkrʌstiz",
    "downsize": "ˈdaʊnsaɪz", "autoclave": "ˈɔːtəkleɪv", "unscented": "ʌnˈsentɪd",
    "non-refundable": "ˌnɒn rɪˈfʌndəbl", "single-use": "ˌsɪŋɡl ˈjuːs",
    "full-time": "ˌfʊl ˈtaɪm", "cover-up": "ˈkʌvər ʌp", "touch-up": "ˈtʌtʃ ʌp",
    "neo-traditional": "ˌniːəʊ trəˈdɪʃənl", "id": "ˌaɪ ˈdiː", "ok": "əʊˈkeɪ",
    "tattoo": "təˈtuː", "tattooing": "təˈtuːɪŋ", "rotary": "ˈrəʊtəri",
    "sterilization": "ˌsterəlaɪˈzeɪʃn", "millimetre": "ˈmɪlɪmiːtə",
    "lukewarm": "ˌluːkˈwɔːm", "ribcage": "ˈrɪbkeɪdʒ", "sternum": "ˈstɜːnəm",
    "mortgage": "ˈmɔːɡɪdʒ", "stencil": "ˈstensl", "needle": "ˈniːdl",
    "cartridge": "ˈkɑːtrɪdʒ", "ointment": "ˈɔɪntmənt", "apprentice": "əˈprentɪs",
    "shoulder": "ˈʃəʊldə", "sensitive": "ˈsensətɪv", "sterile": "ˈsteraɪl",
    "medieval": "ˌmediˈiːvl", "undead": "ˌʌnˈded", "dilute": "daɪˈluːt",
    "numbing": "ˈnʌmɪŋ", "watercolor": "ˈwɔːtəkʌlə", "belly": "ˈbeli",
    "eyebrow": "ˈaɪbraʊ", "nostril": "ˈnɒstrəl", "septum": "ˈseptəm",
    "conch": "kɒŋk", "rook": "rʊk", "gauge": "ɡeɪdʒ", "barbell": "ˈbɑːbel",
    "saline": "ˈseɪlaɪn", "titanium": "tɪˈteɪniəm", "you're": "jɔː",
    "i'd": "aɪd", "i'm": "aɪm", "it's": "ɪts", "let's": "lets", "don't": "dəʊnt",
    "hasn't": "ˈhæznt", "i": "aɪ", "afraid": "əˈfreɪd", "japanese": "ˌdʒæpəˈniːz",
    "piercing": "ˈpɪəsɪŋ", "pierce": "pɪəs", "industrial": "ɪnˈdʌstriəl",
    "aftercare": "ˈɑːftəkeə", "sunscreen": "ˈsʌnskriːn", "collarbone": "ˈkɒləbəʊn",
    "consultation": "ˌkɒnslˈteɪʃn", "forearm": "ˈfɔːrɑːm", "knuckles": "ˈnʌklz",
    "biceps": "ˈbaɪseps", "armpit": "ˈɑːmpɪt", "fleshy": "ˈfleʃi", "reschedule": "ˌriːˈʃedjuːl",
    "lettering": "ˈletərɪŋ", "geometric": "ˌdʒiːəˈmetrɪk", "shading": "ˈʃeɪdɪŋ",
    "swelling": "ˈswelɪŋ", "redness": "ˈrednəs", "bearable": "ˈbeərəbl",
    "thinners": "ˈθɪnəz", "disposable": "dɪˈspəʊzəbl", "bandage": "ˈbændɪdʒ",
    "curved": "kɜːvd", "irritation": "ˌɪrɪˈteɪʃn", "tomorrow": "təˈmɒrəʊ",
    "easier": "ˈiːziə", "heavier": "ˈheviə", "area": "ˈeəriə", "cannula": "ˈkænjʊlə",
    "ancient": "ˈeɪnʃənt", "hello": "həˈləʊ",
}
# Слабые формы служебных слов внутри фраз.
WEAK = {"a": "ə", "an": "ən", "the": "ðə", "to": "tə", "of": "əv", "and": "ənd",
        "for": "fə", "at": "ət", "from": "frəm", "than": "ðən", "can": "kən", "your": "jə"}
NUMBERS = {"1": "one", "2": "two", "3": "three", "5": "five", "10": "ten", "18": "eighteen"}

VOWELS = ["iː", "ɑː", "ɔː", "uː", "ɜː", "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə",
          "ɪ", "e", "æ", "ʌ", "ɒ", "ʊ", "ə", "i", "u", "a", "o"]
CONS = ["tʃ", "dʒ", "p", "b", "t", "d", "k", "ɡ", "g", "f", "v", "θ", "ð", "s", "z", "ʃ",
        "ʒ", "h", "m", "n", "ŋ", "l", "r", "j", "w"]
ONSETS = set("p b t d k ɡ f v θ ð s z ʃ ʒ h m n l r j w tʃ dʒ".split()) | {
    "pl", "bl", "kl", "ɡl", "fl", "sl", "pr", "br", "tr", "dr", "kr", "ɡr", "fr", "θr", "ʃr",
    "sp", "st", "sk", "sm", "sn", "sw", "tw", "dw", "kw", "θw", "spl", "spr", "str", "skr",
    "skw", "pj", "bj", "tj", "dj", "kj", "ɡj", "mj", "nj", "fj", "vj", "hj", "lj", "sj"}


def syllables(toks):
    """Гласные + слоговые l/n в конце после согласной (needle, cancel, session)."""
    ph = [p for p, _ in toks if p in VOWELS or p in CONS]
    n = sum(1 for p in ph if p in VOWELS)
    if len(ph) > 1 and ph[-1] in ("l", "n") and ph[-2] in CONS and ph[-2] not in ("l", "r", "j", "w"):
        n += 1
    elif len(ph) > 2 and ph[-1] in ("z", "s", "t") and ph[-2] in ("l", "n") and ph[-3] in CONS \
            and ph[-3] not in ("l", "r", "n", "ŋ", "m"):
        n += 1  # options, ancient
    return n


def tokenize(ipa):
    """IPA → список (фонема, ударение) и разделителей."""
    out, i, stress = [], 0, ""
    ipa = ipa.replace("g", "ɡ").replace("ː", "ː")
    while i < len(ipa):
        ch = ipa[i]
        if ch in "ˈˌ":
            stress = ch
            i += 1
            continue
        for ph in VOWELS + CONS:
            if ipa.startswith(ph, i):
                out.append((ph, stress))
                stress = ""
                i += len(ph)
                break
        else:
            out.append((ch, ""))
            i += 1
    return out


# ---------- Britfone ----------

def load_britfone():
    variants = {}
    if not BRITFONE.exists():
        print("! нет", BRITFONE, "— IPA только из ручного словаря", file=sys.stderr)
        return {}
    for line in BRITFONE.read_text(encoding="utf-8").splitlines():
        if "," not in line:
            continue
        word, phones = line.split(",", 1)
        word = re.sub(r"\(\d+\)$", "", word.strip().lower())
        variants.setdefault(word, []).append(phones.replace("ɹ", "r").split())
    # из вариантов берём первый с основным ударением (полная форма: you → juː, не jə)
    return {w: britfone_to_ipa(next((v for v in vs if any("ˈ" in p for p in v)), vs[0]))
            for w, vs in variants.items()}


BRITFONE_MAP = {"ɹ": "r", "ɛ": "e", "ɐ": "ʌ", "ɛə": "eə", "g": "ɡ"}


def britfone_to_ipa(phones):
    """Britfone → привычная словарная запись (как в Oxford/Cambridge).

    Там ударение стоит перед гласной — переносим его на начало слога;
    ɛ/ɐ/ɹ → e/ʌ/r; «ə l» в конце → «l» (needle ˈniːdl), «ʃ ə n» → «ʃn»;
    безударное ɪ перед гласной → i (portfolio pɔːtˈfəʊliəʊ).
    """
    toks = []
    for p in phones:
        s = ""
        if p[0] in "ˈˌ":
            s, p = p[0], p[1:]
        toks.append([BRITFONE_MAP.get(p, p), s])
    nvow = sum(1 for p, _ in toks if p in VOWELS)
    seen = False
    for t in toks:  # вторичное ударение после основного словари обычно не пишут
        if t[1] == "ˌ" and seen:
            t[1] = ""
        seen = seen or t[1] == "ˈ"
    if len(toks) > 2 and toks[-1][0] == "l" and toks[-2] == ["ə", ""] and toks[-3][0] in CONS:
        del toks[-2]
    for i in range(len(toks) - 2):
        if toks[i][0] == "ʃ" and toks[i + 1] == ["ə", ""] and toks[i + 2][0] == "n":
            del toks[i + 1]
            break
    for i in range(len(toks) - 1):
        if toks[i] == ["ɪ", ""] and toks[i + 1][0] in VOWELS:
            toks[i][0] = "i"
    res = []
    for p, s in toks:
        if s and nvow > 1:
            # набираем согласные перед гласной, берём самый длинный допустимый онсет
            j = len(res)
            while j > 0 and res[j - 1] in CONS:
                j -= 1
            run = res[j:]
            cut = len(run)
            for k in range(len(run)):
                if "".join(run[k:]) in ONSETS:
                    cut = k
                    break
            res.insert(j + cut, s)
        res.append(p)
    return "".join(res)


def word_ipa(w, bf, weak):
    lw = w.lower()
    if lw in NUMBERS:
        lw = NUMBERS[lw]
    if weak and lw in WEAK:
        return WEAK[lw]
    if lw in MANUAL_IPA:
        return MANUAL_IPA[lw]
    if lw in bf:
        return bf[lw]
    if "-" in lw:
        parts = [word_ipa(p, bf, False) for p in lw.split("-")]
        if all(parts):
            return " ".join(parts)
    return None


def phrase_ipa(en, bf):
    text = re.sub(r"\(.*?\)", "", en).replace("…", " ").replace("’", "'")
    text = re.sub(r"[?!.,]", " ", text)
    tokens = re.findall(r"[A-Za-z0-9'\-]+|[/–]", text)
    words = [t for t in tokens if t not in "/–"]
    multi = len(words) > 1
    out, missing = [], []
    for t in tokens:
        if t in "/–":
            out.append(t)
            continue
        ip = word_ipa(t, bf, multi)
        if ip is None:
            missing.append(t)
            continue
        # у односложных слов знак ударения не нужен
        if True:
            if syllables(tokenize(ip)) <= 1:
                ip = ip.replace("ˈ", "").replace("ˌ", "")
        out.append(ip)
    return " ".join(out), missing


# ---------- IPA → русские буквы ----------

RU_CONS = {"p": "п", "b": "б", "t": "т", "d": "д", "k": "к", "ɡ": "г", "f": "ф", "v": "в",
           "θ": "θ", "ð": "ð", "s": "с", "z": "з", "ʃ": "ш", "ʒ": "ж", "h": "х", "m": "м",
           "n": "н", "l": "л", "r": "р", "tʃ": "ч", "dʒ": "дж"}
RU_VOW = {"iː": "и", "ɪ": "и", "i": "и", "e": "е", "æ": "э", "ʌ": "а", "ɑː": "а", "a": "а",
          "ɒ": "о", "ɔː": "о", "o": "о", "ʊ": "у", "uː": "у", "u": "у", "ɜː": "ё", "ə": "э",
          "eɪ": "ей", "aɪ": "ай", "ɔɪ": "ой", "əʊ": "оу", "aʊ": "ау", "ɪə": "иэ", "eə": "эа",
          "ʊə": "уэ"}
ACUTE = "́"


def ipa_to_ru(ipa):
    words = []
    for chunk in ipa.split(" "):
        if chunk in ("/", "–"):
            words.append(chunk)
            continue
        toks = tokenize(chunk)
        nvow = syllables(toks)
        # ударение принадлежит первой гласной после знака
        pending, marks = "", []
        for p, s in toks:
            if s:
                pending = s
            if p in VOWELS:
                marks.append(pending == "ˈ" and nvow > 1)
                pending = ""
            else:
                marks.append(False)
        out, prev = "", None
        i = 0
        while i < len(toks):
            p = toks[i][0]
            nxt = toks[i + 1][0] if i + 1 < len(toks) else None
            start = not out
            if p == "j":
                if nxt in ("uː", "ʊ", "u", "ʊə"):
                    out += "ю" + (ACUTE if marks[i + 1] else "") + ("э" if nxt == "ʊə" else "")
                    i += 2
                    prev = nxt
                    continue
                if nxt == "ɑː":
                    out += "я" + (ACUTE if marks[i + 1] else "")
                    i += 2
                    prev = nxt
                    continue
                out += "й"
            elif p == "w":
                out += "в" if (not start and prev not in VOWELS) or nxt in ("ʊ", "uː") else "у"
            elif p == "ŋ":
                out += "н" if nxt in ("k", "ɡ") else "нг"
            elif p in RU_CONS:
                out += RU_CONS[p]
            elif p in RU_VOW:
                v = RU_VOW[p]
                if (start or prev in VOWELS or prev == "j") and v[0] == "е":
                    v = "э" + v[1:]
                if marks[i] and v[0] != "ё":
                    v = v[0] + ACUTE + v[1:]
                out += v
            else:
                out += p
            prev = p
            i += 1
        words.append(out)
    return " ".join(words)


# ---------- слияние ----------

def key(s):
    s = re.sub(r"\(.*?\)", "", s).lower().replace("’", "'")
    s = re.sub(r"[?!.…]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    s = unicodedata.normalize("NFKD", key(s)).replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "w"


def parse_my_vocab(path):
    cur, out = None, []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        m = re.match(r"## (SET \d+)", line)
        if m:
            cur = SET_IDS[m.group(1)]
            continue
        if not line or line.startswith("#"):
            continue
        ru, en = line.split(" - ", 1)
        m = re.match(r"(.*?)\s*\((.*)\)\s*$", en)
        en, tr = (m.group(1), m.group(2)) if m else (en, "")
        out.append({"en": en.strip(), "ru": ru.strip(), "tr": tr.strip(), "src": cur})
    return out


def tidy_en(en):
    """Наборы Quizlet пишут слова с заглавной — приводим к виду словаря."""
    if en.startswith(("I ", "I'")) or en[1:2].isupper():
        return en
    return en[0].lower() + en[1:]


def main():
    base = json.loads((SRC / "words.json").read_text(encoding="utf-8"))
    extras = json.loads((SRC / "extras.json").read_text(encoding="utf-8"))
    pier = json.loads((SRC / "piercing.json").read_text(encoding="utf-8"))
    bf = load_britfone()

    cats = {**base["cats"], **extras["cats"], **pier["cats"]}
    words, index = [], {}

    def add(rec):
        k = key(rec["en"])
        if k in index:
            raise SystemExit(f"дубль при добавлении: {rec['en']}")
        index[k] = rec
        words.append(rec)

    for w in base["words"]:
        add({"en": w["en"], "ru": w["ru"], "ipa": w.get("ipa", ""), "tr": "", "ex": w.get("ex", ""),
             "c": w["c"], "m": w["m"], "track": "tattoo", "src": ["base"]})

    for k, fix in extras["fill"].items():
        if k not in index:
            raise SystemExit(f"fill: нет слова {k}")
        for f, v in fix.items():
            if not index[k].get(f):
                index[k][f] = v

    for v in parse_my_vocab(SRC / "my_vocab.txt"):
        k = key(v["en"])
        k = extras["aliases"].get(k, k)
        if k in index:
            rec = index[k]
            if v["src"] not in rec["src"]:
                rec["src"].append(v["src"])
            if not rec["tr"] and k == key(v["en"]):  # у склеенных вариантов своя транскрипция не подходит
                rec["tr"] = v["tr"]
            continue
        meta = extras["new"].get(k)
        if not meta:
            raise SystemExit(f"нет разметки в extras.json для «{v['en']}»")
        add({"en": tidy_en(v["en"]), "ru": v["ru"], "ipa": "", "tr": v["tr"], "ex": meta["ex"],
             "c": meta["c"], "m": meta["m"], "track": "tattoo", "src": [v["src"]]})

    for w in pier["words"]:
        add({"en": w["en"], "ru": w["ru"], "ipa": w.get("ipa", ""), "tr": w.get("tr", ""),
             "ex": w.get("ex", ""), "c": w["c"], "m": w["m"], "track": "piercing", "src": ["pierce"]})

    problems = []
    ids = set()
    for rec in words:
        gen, missing = phrase_ipa(rec["en"], bf)
        single = len(re.findall(r"[A-Za-z']+", re.sub(r"\(.*?\)", "", rec["en"]))) == 1
        if missing:
            problems.append(f"IPA: {rec['en']} → нет {missing}")
            if not rec["ipa"]:
                rec["ipa"] = gen
        elif not (rec["ipa"] and single):
            rec["ipa"] = gen
        if not rec["tr"]:
            rec["tr"] = ipa_to_ru(rec["ipa"])
        if not rec["ex"]:
            problems.append(f"нет примера: {rec['en']}")
        i = slug(rec["en"])
        while i in ids:
            i += "-2"
        ids.add(i)
        rec["id"] = i

    order = ["id", "en", "ru", "ipa", "tr", "ex", "c", "m", "track", "src"]
    words = [{f: r[f] for f in order} for r in words]
    OUT.write_text(json.dumps({"cats": cats, "sources": SOURCES, "words": words},
                              ensure_ascii=False, indent=0).replace('\n{', '{'), encoding="utf-8")

    QUIZLET.mkdir(exist_ok=True)
    for old in QUIZLET.glob("*.txt"):
        old.unlink()
    for n, c in enumerate(cats, 1):
        ws = [w for w in words if w["c"] == c]
        if not ws:
            continue
        lines = [f"{w['en']} [{w['ipa']}]\t{w['ru']} — {w['ex']}" for w in ws]
        (QUIZLET / f"{n:02d}_{c}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"слов: {len(words)} · категорий: {len(cats)}")
    for p in problems:
        print(" !", p)


if __name__ == "__main__":
    main()
