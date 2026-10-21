import { applyDecorators, HttpStatus, SerializeOptions } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Declares the response schema of a handler once (§18.3): the serializer sends only the
 * schema's output, and the OpenAPI document describes the same schema.
 */
export function ResponseSchema(schema: StandardSchemaV1, status: number = HttpStatus.OK) {
  return applyDecorators(
    SerializeOptions({ schema }),
    ApiResponse({ status, standardSchema: schema }),
  );
}
