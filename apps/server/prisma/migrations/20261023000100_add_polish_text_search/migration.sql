-- Polish full-text search (§14.4). The hunspell dictionary of sjp.pl is part of the project image
-- ghcr.io/trybun/postgres (`polish.affix` and `polish.dict` in `tsearch_data`). Words the
-- dictionary does not know (names, codes, English words) are kept unchanged by `simple`.
CREATE TEXT SEARCH DICTIONARY polish_hunspell (
    TEMPLATE = ispell,
    DictFile = polish,
    AffFile = polish
);

CREATE TEXT SEARCH CONFIGURATION polish (COPY = simple);

ALTER TEXT SEARCH CONFIGURATION polish
    ALTER MAPPING FOR word, hword, hword_part, asciiword, asciihword, hword_asciipart
    WITH polish_hunspell, simple;
