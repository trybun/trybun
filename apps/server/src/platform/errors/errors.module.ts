import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ProblemDetailsFilter } from './problem-details.filter.js';

/** The global exception filter of the API (§18.3). */
@Module({
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class ErrorsModule {}
