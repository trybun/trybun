import { Global, Module } from '@nestjs/common';
import { ClamdScanner } from './clamd-scanner.js';
import { MALWARE_SCANNER } from './malware-scanner.js';

/** The adapter of the malware scanner (§18.3), used by the scan jobs of the Worker (ADR 0008). */
@Global()
@Module({
  providers: [{ provide: MALWARE_SCANNER, useClass: ClamdScanner }],
  exports: [MALWARE_SCANNER],
})
export class ClamavModule {}
