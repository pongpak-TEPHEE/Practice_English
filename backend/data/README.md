# Word lists

The server and the seed command load one or more of these files (comma-separated
`WORDS_CSV` / `-csv`). Every file uses the header
`id,word,pos,level,meaning_th,example,audio_uk,audio_us`. Learning progress is keyed
by `id`, so ids must never change once a list is in use.

## oxford3000.csv — levels A1, A2, B1, B2

The Oxford 3000 headwords with their CEFR level and pronunciation links, from Oxford
Learner's Dictionaries. Ids 1–2983. Thai meanings and example sentences were
written for this project.

## toeic_service_list.csv — level TOEIC

Words from the **TOEIC Service List (TSL) 1.2** by Charles Browne and Brent Culligan,
<https://www.newgeneralservicelist.com/toeic-service-list>, built from a 1.5 million
word corpus of TOEIC preparation materials.

> TOEIC Service List by Browne, C. and Culligan, B., is licensed under a
> [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

What this file contains and how it was changed from the TSL:

- Only TSL words that are not already in `oxford3000.csv`: 1,058 of the 1,250.
  Excluded as duplicates of Oxford entries: `traveler` (Oxford: traveller),
  `kilometer` (kilometre) and `pant` (pants).
- Ordered by TSL rank. Id = 10001 + the word's position among TSL words not in the
  Oxford 3000, so `pant` leaves a gap at 10277.
- Headwords shown in the form TOEIC texts use: headquarters, congratulations,
  headphones, housekeeping, renowned (TSL lemmas: headquarter, congratulation,
  headphone, housekeep, renown).
- Parts of speech, Thai meanings and example sentences were written for this
  project; they are not part of the TSL. Meanings follow the business sense used in
  TOEIC (e.g. *outstanding* = unpaid, *enclose* = attach).
- No audio links: the app falls back to the browser's English voice.

Because this file adapts the TSL, it is shared under the same
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) license.
