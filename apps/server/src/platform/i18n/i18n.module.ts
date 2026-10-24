import { Global, Module } from '@nestjs/common';
import { Translator } from './translator.js';

/** The texts of the server in the recipient's language (§13.1). */
@Global()
@Module({
  providers: [Translator],
  exports: [Translator],
})
export class I18nModule {}
