/**
 * The states of the JSON syntax check: what the next character may be. The number states follow
 * the grammar of RFC 8259 section 6.
 */
type State =
  /** A value: at the start, after `:` and after `,` in an array. */
  | 'value'
  /** A value or `]`, after `[`. */
  | 'value_or_array_end'
  /** A key or `}`, after `{`. */
  | 'key_or_object_end'
  /** A key, after `,` in an object. */
  | 'key'
  | 'colon'
  /** `,` or the end of the container; at the top level only whitespace. */
  | 'after_value'
  | 'string'
  | 'escape'
  | 'unicode_escape'
  | 'minus'
  | 'zero'
  | 'integer'
  | 'fraction_start'
  | 'fraction'
  | 'exponent_start'
  | 'exponent_sign'
  | 'exponent'
  | 'literal'
  | 'invalid';

/** The states in which a number may end, e.g. at the end of the text. */
const NUMBER_ENDS: ReadonlySet<State> = new Set(['zero', 'integer', 'fraction', 'exponent']);

const LITERALS: ReadonlyMap<string, string> = new Map([
  ['t', 'true'],
  ['f', 'false'],
  ['n', 'null'],
]);

/** The characters after `\` of a string, except `u` (RFC 8259 section 7). */
const ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);

function isWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isHexDigit(character: string): boolean {
  return (
    isDigit(character) ||
    (character >= 'a' && character <= 'f') ||
    (character >= 'A' && character <= 'F')
  );
}

/**
 * The open objects and arrays, one bit each, so a deeply nested text costs one bit per level
 * instead of a stack frame or an array entry.
 */
class ContainerStack {
  private bits = new Uint8Array(64);
  depth = 0;

  push(isObject: boolean): void {
    const index = this.depth >> 3;
    if (index >= this.bits.length) {
      const bits = new Uint8Array(this.bits.length * 2);
      bits.set(this.bits);
      this.bits = bits;
    }
    const mask = 1 << (this.depth & 7);
    this.bits[index] = isObject ? (this.bits[index] ?? 0) | mask : (this.bits[index] ?? 0) & ~mask;
    this.depth += 1;
  }

  pop(): void {
    this.depth -= 1;
  }

  /** Whether the innermost open container is an object; `false` for an array. */
  isObject(): boolean {
    const position = this.depth - 1;
    return (((this.bits[position >> 3] ?? 0) >> (position & 7)) & 1) === 1;
  }
}

/**
 * A streaming check that a text is one JSON value (RFC 8259), as `JSON.parse` would accept it,
 * without holding the text or the parsed value in memory (attachment serving item 1): the text
 * arrives in parts, e.g. the decoded chunks of a stored file.
 */
export class JsonSyntaxCheck {
  private state: State = 'value';
  private readonly containers = new ContainerStack();
  private isKey = false;
  private hexDigitsLeft = 0;
  private literal = '';
  private literalIndex = 0;

  /** Checks the next part of the text; returns whether it is still valid. */
  write(text: string): boolean {
    for (const character of text) {
      this.next(character);
      if (this.state === 'invalid') {
        return false;
      }
    }
    return true;
  }

  /** Whether the whole text was one JSON value. */
  end(): boolean {
    return (
      this.containers.depth === 0 && (this.state === 'after_value' || NUMBER_ENDS.has(this.state))
    );
  }

  private next(character: string): void {
    switch (this.state) {
      case 'value':
        if (!isWhitespace(character)) {
          this.startValue(character);
        }
        return;
      case 'value_or_array_end':
        if (character === ']') {
          this.closeContainer();
        } else if (!isWhitespace(character)) {
          this.startValue(character);
        }
        return;
      case 'key_or_object_end':
        if (character === '}') {
          this.closeContainer();
        } else {
          this.startKey(character);
        }
        return;
      case 'key':
        this.startKey(character);
        return;
      case 'colon':
        if (character === ':') {
          this.state = 'value';
        } else if (!isWhitespace(character)) {
          this.state = 'invalid';
        }
        return;
      case 'after_value':
        this.afterValue(character);
        return;
      case 'string':
        if (character === '"') {
          this.state = this.isKey ? 'colon' : 'after_value';
        } else if (character === '\\') {
          this.state = 'escape';
        } else if (character < ' ') {
          // Control characters must be escaped (RFC 8259 section 7).
          this.state = 'invalid';
        }
        return;
      case 'escape':
        if (character === 'u') {
          this.hexDigitsLeft = 4;
          this.state = 'unicode_escape';
        } else {
          this.state = ESCAPES.has(character) ? 'string' : 'invalid';
        }
        return;
      case 'unicode_escape':
        if (!isHexDigit(character)) {
          this.state = 'invalid';
        } else {
          this.hexDigitsLeft -= 1;
          if (this.hexDigitsLeft === 0) {
            this.state = 'string';
          }
        }
        return;
      case 'literal':
        if (character !== this.literal[this.literalIndex]) {
          this.state = 'invalid';
        } else {
          this.literalIndex += 1;
          if (this.literalIndex === this.literal.length) {
            this.state = 'after_value';
          }
        }
        return;
      case 'invalid':
        return;
      default:
        this.nextOfNumber(character);
    }
  }

  private nextOfNumber(character: string): void {
    switch (this.state) {
      case 'minus':
        this.state = character === '0' ? 'zero' : isDigit(character) ? 'integer' : 'invalid';
        return;
      case 'zero':
      case 'integer':
      case 'fraction':
        if (isDigit(character) && this.state !== 'zero') {
          return;
        }
        if (character === '.' && this.state !== 'fraction') {
          this.state = 'fraction_start';
        } else if (character === 'e' || character === 'E') {
          this.state = 'exponent_start';
        } else {
          this.endNumber(character);
        }
        return;
      case 'fraction_start':
        this.state = isDigit(character) ? 'fraction' : 'invalid';
        return;
      case 'exponent_start':
        this.state =
          character === '+' || character === '-'
            ? 'exponent_sign'
            : isDigit(character)
              ? 'exponent'
              : 'invalid';
        return;
      case 'exponent_sign':
        this.state = isDigit(character) ? 'exponent' : 'invalid';
        return;
      case 'exponent':
        if (!isDigit(character)) {
          this.endNumber(character);
        }
        return;
      default:
        this.state = 'invalid';
    }
  }

  private startValue(character: string): void {
    if (character === '{') {
      this.containers.push(true);
      this.state = 'key_or_object_end';
    } else if (character === '[') {
      this.containers.push(false);
      this.state = 'value_or_array_end';
    } else if (character === '"') {
      this.isKey = false;
      this.state = 'string';
    } else if (character === '-') {
      this.state = 'minus';
    } else if (character === '0') {
      this.state = 'zero';
    } else if (isDigit(character)) {
      this.state = 'integer';
    } else {
      this.startLiteral(character);
    }
  }

  private startLiteral(character: string): void {
    const literal = LITERALS.get(character);
    if (literal === undefined) {
      this.state = 'invalid';
      return;
    }
    this.literal = literal;
    this.literalIndex = 1;
    this.state = 'literal';
  }

  private startKey(character: string): void {
    if (character === '"') {
      this.isKey = true;
      this.state = 'string';
    } else if (!isWhitespace(character)) {
      this.state = 'invalid';
    }
  }

  private afterValue(character: string): void {
    if (isWhitespace(character)) {
      return;
    }
    if (this.containers.depth === 0) {
      // Only whitespace may follow the value of the text.
      this.state = 'invalid';
    } else if (character === ',') {
      this.state = this.containers.isObject() ? 'key' : 'value';
    } else if (character === (this.containers.isObject() ? '}' : ']')) {
      this.closeContainer();
    } else {
      this.state = 'invalid';
    }
  }

  private closeContainer(): void {
    this.containers.pop();
    this.state = 'after_value';
  }

  /** A number ends at the first character that cannot continue it, which is then checked. */
  private endNumber(character: string): void {
    this.state = 'after_value';
    this.afterValue(character);
  }
}
