import React, {useMemo} from "react";
import {createRoot} from "react-dom/client";
import {BibleReader, YouVersionProvider} from "@youversion/platform-react-ui";

import "./youversion-reader.css";

const DEFAULT_BOOK = "GEN";
const DEFAULT_CHAPTER = "1";

const BOOKS = [
  {code: "GEN", label: "Genesis", aliases: ["genesis", "gen"]},
  {code: "EXO", label: "Exodus", aliases: ["exodus", "exo", "exod"]},
  {code: "LEV", label: "Leviticus", aliases: ["leviticus", "lev"]},
  {code: "NUM", label: "Numbers", aliases: ["numbers", "num"]},
  {code: "DEU", label: "Deuteronomy", aliases: ["deuteronomy", "deut", "deu"]},
  {code: "JOS", label: "Joshua", aliases: ["joshua", "josh", "jos"]},
  {code: "JDG", label: "Judges", aliases: ["judges", "judg", "jdg"]},
  {code: "RUT", label: "Ruth", aliases: ["ruth", "rut"]},
  {code: "1SA", label: "1 Samuel", aliases: ["1 samuel", "1 sam", "1sa", "i samuel", "first samuel"]},
  {code: "2SA", label: "2 Samuel", aliases: ["2 samuel", "2 sam", "2sa", "ii samuel", "second samuel"]},
  {code: "1KI", label: "1 Kings", aliases: ["1 kings", "1 kgs", "1ki", "1 kin", "i kings", "first kings"]},
  {code: "2KI", label: "2 Kings", aliases: ["2 kings", "2 kgs", "2ki", "2 kin", "ii kings", "second kings"]},
  {code: "1CH", label: "1 Chronicles", aliases: ["1 chronicles", "1 chron", "1 chr", "1ch", "i chronicles", "first chronicles"]},
  {code: "2CH", label: "2 Chronicles", aliases: ["2 chronicles", "2 chron", "2 chr", "2ch", "ii chronicles", "second chronicles"]},
  {code: "EZR", label: "Ezra", aliases: ["ezra", "ezr"]},
  {code: "NEH", label: "Nehemiah", aliases: ["nehemiah", "neh"]},
  {code: "EST", label: "Esther", aliases: ["esther", "est"]},
  {code: "JOB", label: "Job", aliases: ["job"]},
  {code: "PSA", label: "Psalms", aliases: ["psalm", "psalms", "ps", "psa"]},
  {code: "PRO", label: "Proverbs", aliases: ["proverbs", "prov", "pro"]},
  {code: "ECC", label: "Ecclesiastes", aliases: ["ecclesiastes", "eccl", "ecc"]},
  {code: "SNG", label: "Song of Solomon", aliases: ["song of solomon", "song of songs", "song", "songs", "sos"]},
  {code: "ISA", label: "Isaiah", aliases: ["isaiah", "isa"]},
  {code: "JER", label: "Jeremiah", aliases: ["jeremiah", "jer"]},
  {code: "LAM", label: "Lamentations", aliases: ["lamentations", "lam"]},
  {code: "EZK", label: "Ezekiel", aliases: ["ezekiel", "ezek", "ezk"]},
  {code: "DAN", label: "Daniel", aliases: ["daniel", "dan"]},
  {code: "HOS", label: "Hosea", aliases: ["hosea", "hos"]},
  {code: "JOL", label: "Joel", aliases: ["joel", "jol"]},
  {code: "AMO", label: "Amos", aliases: ["amos", "amo"]},
  {code: "OBA", label: "Obadiah", aliases: ["obadiah", "obad", "oba"]},
  {code: "JON", label: "Jonah", aliases: ["jonah", "jon"]},
  {code: "MIC", label: "Micah", aliases: ["micah", "mic"]},
  {code: "NAM", label: "Nahum", aliases: ["nahum", "nah", "nam"]},
  {code: "HAB", label: "Habakkuk", aliases: ["habakkuk", "hab"]},
  {code: "ZEP", label: "Zephaniah", aliases: ["zephaniah", "zeph", "zep"]},
  {code: "HAG", label: "Haggai", aliases: ["haggai", "hag"]},
  {code: "ZEC", label: "Zechariah", aliases: ["zechariah", "zech", "zec"]},
  {code: "MAL", label: "Malachi", aliases: ["malachi", "mal"]},
  {code: "MAT", label: "Matthew", aliases: ["matthew", "matt", "mat", "mt"]},
  {code: "MRK", label: "Mark", aliases: ["mark", "mrk", "mk"]},
  {code: "LUK", label: "Luke", aliases: ["luke", "luk", "lk"]},
  {code: "JHN", label: "John", aliases: ["john", "jhn", "jn"]},
  {code: "ACT", label: "Acts", aliases: ["acts", "act"]},
  {code: "ROM", label: "Romans", aliases: ["romans", "rom"]},
  {code: "1CO", label: "1 Corinthians", aliases: ["1 corinthians", "1 cor", "1co", "i corinthians", "first corinthians"]},
  {code: "2CO", label: "2 Corinthians", aliases: ["2 corinthians", "2 cor", "2co", "ii corinthians", "second corinthians"]},
  {code: "GAL", label: "Galatians", aliases: ["galatians", "gal"]},
  {code: "EPH", label: "Ephesians", aliases: ["ephesians", "eph"]},
  {code: "PHP", label: "Philippians", aliases: ["philippians", "phil", "php"]},
  {code: "COL", label: "Colossians", aliases: ["colossians", "col"]},
  {code: "1TH", label: "1 Thessalonians", aliases: ["1 thessalonians", "1 thess", "1 thes", "1th", "i thessalonians", "first thessalonians"]},
  {code: "2TH", label: "2 Thessalonians", aliases: ["2 thessalonians", "2 thess", "2 thes", "2th", "ii thessalonians", "second thessalonians"]},
  {code: "1TI", label: "1 Timothy", aliases: ["1 timothy", "1 tim", "1ti", "i timothy", "first timothy"]},
  {code: "2TI", label: "2 Timothy", aliases: ["2 timothy", "2 tim", "2ti", "ii timothy", "second timothy"]},
  {code: "TIT", label: "Titus", aliases: ["titus", "tit"]},
  {code: "PHM", label: "Philemon", aliases: ["philemon", "phlm", "phm"]},
  {code: "HEB", label: "Hebrews", aliases: ["hebrews", "heb"]},
  {code: "JAS", label: "James", aliases: ["james", "jas", "jm"]},
  {code: "1PE", label: "1 Peter", aliases: ["1 peter", "1 pet", "1pe", "i peter", "first peter"]},
  {code: "2PE", label: "2 Peter", aliases: ["2 peter", "2 pet", "2pe", "ii peter", "second peter"]},
  {code: "1JN", label: "1 John", aliases: ["1 john", "1 jn", "1jn", "i john", "first john"]},
  {code: "2JN", label: "2 John", aliases: ["2 john", "2 jn", "2jn", "ii john", "second john"]},
  {code: "3JN", label: "3 John", aliases: ["3 john", "3 jn", "3jn", "iii john", "third john"]},
  {code: "JUD", label: "Jude", aliases: ["jude", "jud"]},
  {code: "REV", label: "Revelation", aliases: ["revelation", "revelations", "rev"]},
];

const BOOK_LOOKUP = buildBookLookup_();
const BOOK_KEYS = Object.keys(BOOK_LOOKUP).sort((a, b) => b.length - a.length);

function buildBookLookup_() {
  const lookup = {};

  BOOKS.forEach((book) => {
    book.aliases.forEach((alias) => {
      lookup[normalizeReferenceInput_(alias)] = book.code;
    });
  });

  return lookup;
}

function normalizeReferenceInput_(value) {
  return String(value || "")
      .toLowerCase()
      .replace(/[.]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
}

function parseReferenceInput_(value) {
  const cleanedReference = String(value || "")
      .replace(/[–—]/g, "-")
      .replace(/\(([^)]*)\)\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

  if (!cleanedReference) return null;

  const normalizedReference = normalizeReferenceInput_(cleanedReference);

  for (const bookKey of BOOK_KEYS) {
    if (normalizedReference !== bookKey &&
      !normalizedReference.startsWith(bookKey + " ")) {
      continue;
    }

    const remainder = normalizedReference.slice(bookKey.length).trim();
    const chapterMatch = remainder.match(/^(\d+)/);
    if (!chapterMatch) return null;

    return {
      book: BOOK_LOOKUP[bookKey],
      chapter: chapterMatch[1],
      displayReference: cleanedReference,
    };
  }

  return null;
}

function normalizeVersionId_(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 2692;
}

function ScriptureReader({appKey, reference, versionId, title, helperText, theme}) {
  const initialLocation = useMemo(() => {
    return parseReferenceInput_(reference) || {
      book: DEFAULT_BOOK,
      chapter: DEFAULT_CHAPTER,
    };
  }, [reference]);
  const resolvedTheme = theme === "dark" ? "dark" : "light";

  return (
    <YouVersionProvider appKey={appKey} theme={resolvedTheme}>
      <div className="yv-reader-shell">
        {helperText ? (
          <p className="yv-reader-copy">{helperText}</p>
        ) : null}

        <div className="yv-reader-host">
          <div className="yv-reader-frame">
            <BibleReader.Root
              defaultBook={initialLocation.book}
              defaultChapter={initialLocation.chapter}
              defaultVersionId={normalizeVersionId_(versionId)}
              background={resolvedTheme}
              fontSize={16}
              lineHeight={1.65}
            >
              <BibleReader.Toolbar border="bottom" />
              <BibleReader.Content />
            </BibleReader.Root>
          </div>
        </div>
      </div>
    </YouVersionProvider>
  );
}

function FallbackReader({reference, title, helperText, message}) {
  return (
    <div className="yv-reader-shell">
      {helperText ? (
        <p className="yv-reader-copy">{helperText}</p>
      ) : null}

      <div className="yv-reader-fallback">
        {title ? <strong>{title}</strong> : null}
        {reference ? <p>{reference}</p> : null}
        <p>{message}</p>
      </div>
    </div>
  );
}

export function mountYouVersionReader(container, options) {
  if (!container) {
    return function() {};
  }

  const root = createRoot(container);

  if (!options || !options.appKey) {
    root.render(
        <FallbackReader
          reference={options && options.reference}
          title={options && options.title}
          helperText={options && options.helperText}
          message="The YouVersion reader could not start because the app key is missing."
        />,
    );

    return function() {
      root.unmount();
    };
  }

  root.render(<ScriptureReader {...options} />);

  return function() {
    root.unmount();
  };
}
