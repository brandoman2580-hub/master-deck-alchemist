/**
 * Break official card text into the clauses Problem-Solving Card Text already marks.
 *
 * A colon ends the activation condition. A semicolon ends what you do when the
 * effect is activated (a cost, a target, or both). The text after that is the
 * effect. A bullet or a numbered line is one choice in a list, and the sentence
 * before it is the lead-in. The words are not rewritten.
 *
 * This runs when the text is shown. The stored description stays the official
 * string, which search and the rules text still use. The parse is one walk of
 * that string, so there is no separate precomputed copy to keep in step.
 */

export type CardTextPartKind = "condition" | "activation" | "effect" | "plain";

export type CardTextPart = {
  kind: CardTextPartKind;
  text: string;
};

export type CardTextBlock =
  | { type: "effect"; parts: CardTextPart[] }
  | { type: "choice"; lead: CardTextPart[]; items: CardTextPart[][] };

const BULLET = /^[●•▪]\s*/;

function isQuote(char: string): boolean {
  return char === '"' || char === "“" || char === "”";
}

function toggleQuote(char: string, open: boolean): boolean {
  if (char === "“") return true;
  if (char === "”") return false;
  if (char === '"') return !open;
  return open;
}

function splitMark(
  text: string,
  mark: ":" | ";",
): { before: string; after: string } | null {
  let inQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (isQuote(char)) {
      inQuote = toggleQuote(char, inQuote);
      continue;
    }
    if (!inQuote && char === mark) {
      return {
        before: text.slice(0, index).trim(),
        after: text.slice(index + 1).trim(),
      };
    }
  }
  return null;
}

function partsOf(sentence: string): CardTextPart[] {
  const colon = splitMark(sentence, ":");
  const afterColon = colon ? colon.after : sentence;
  const semicolon = splitMark(afterColon, ";");
  const parts: CardTextPart[] = [];

  if (colon?.before) parts.push({ kind: "condition", text: `${colon.before}:` });
  if (semicolon?.before) {
    parts.push({ kind: "activation", text: `${semicolon.before};` });
    if (semicolon.after) parts.push({ kind: "effect", text: semicolon.after });
    return parts;
  }
  if (colon) {
    if (afterColon) parts.push({ kind: "effect", text: afterColon });
    return parts.length > 0 ? parts : [{ kind: "plain", text: sentence }];
  }
  return [{ kind: "plain", text: sentence }];
}

function isChoiceItem(sentence: string): boolean {
  return BULLET.test(sentence) || /^\(\d+\)\s/.test(sentence);
}

function splitSentences(line: string): string[] {
  const sentences: string[] = [];
  let current = "";
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (isQuote(char)) inQuote = toggleQuote(char, inQuote);
    current += char;
    if (inQuote || char !== ".") continue;

    let end = index + 1;
    if (line[end] === ")") {
      current += ")";
      end += 1;
    }
    const rest = line.slice(end);
    const closes = rest.length === 0 || /^\s+[A-Z"(●•▪]/.test(rest);
    if (!closes) continue;

    const sentence = current.trim();
    if (sentence) sentences.push(sentence);
    current = "";
    const whitespace = rest.match(/^\s+/);
    index = end + (whitespace?.[0].length ?? 0) - 1;
  }

  const tail = current.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

function clauses(desc: string): string[] {
  const broken = desc
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*[●•▪]\s*/g, "\n● ")
    .replace(/([.:;])\s+\((\d+)\)\s+/g, "$1\n($2) ")
    .trim();

  return broken
    .split("\n")
    .flatMap((line) => splitSentences(line.trim()))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * Turn one card description into effect blocks and choice lists.
 * An empty description returns no blocks.
 */
export function formatCardText(desc: string): CardTextBlock[] {
  const sentences = clauses(desc);
  const blocks: CardTextBlock[] = [];
  let index = 0;

  while (index < sentences.length) {
    const sentence = sentences[index] ?? "";
    if (isChoiceItem(sentence)) {
      const items: CardTextPart[][] = [];
      while (index < sentences.length && isChoiceItem(sentences[index] ?? "")) {
        items.push(partsOf((sentences[index] ?? "").replace(BULLET, "")));
        index += 1;
      }
      blocks.push({ type: "choice", lead: [], items });
      continue;
    }

    const next = sentences[index + 1] ?? "";
    if (isChoiceItem(next)) {
      const lead = partsOf(sentence);
      index += 1;
      const items: CardTextPart[][] = [];
      while (index < sentences.length && isChoiceItem(sentences[index] ?? "")) {
        items.push(partsOf((sentences[index] ?? "").replace(BULLET, "")));
        index += 1;
      }
      blocks.push({ type: "choice", lead, items });
      continue;
    }

    blocks.push({ type: "effect", parts: partsOf(sentence) });
    index += 1;
  }

  return blocks;
}
